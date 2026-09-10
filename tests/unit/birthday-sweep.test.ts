import type { GuildUser } from "@shared/types/guild-user.type.js";

import { BOT_TIMEZONE } from "@shared/consts/config.constants.js";

import { BIRTHDAY_GIFT_POINTS, BIRTHDAY_WARNING_DAYS } from "@features/birthday/birthday.constants.js";

import { DateTime } from "luxon";
import { container } from "@sapphire/framework";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const getGuildSettings = vi.hoisted(() => vi.fn());
const claimBirthdayGift = vi.hoisted(() => vi.fn());
const getUsersWithBirthday = vi.hoisted(() => vi.fn());
const claimBirthdayWarning = vi.hoisted(() => vi.fn());
const buildCheerMessage = vi.hoisted(() => vi.fn());

vi.mock("@core/services/guild.service.js", () => ({ getGuildSettings }));

vi.mock("@core/services/user.service.js", () => ({
  claimBirthdayGift,
  claimBirthdayWarning,
  getUsersWithBirthday,
}));

vi.mock("@features/cheer/cheer.service.js", () => ({ buildCheerMessage }));

const { runBirthdaySweep } = await import("@features/birthday/birthday.service.js");

const CHEER_CONTENT = "¡Feliz cumpleaños!";

let send: ReturnType<typeof vi.fn>;
let fetchChannel: ReturnType<typeof vi.fn>;

function at(iso: string): DateTime {
  return DateTime.fromISO(iso, { zone: BOT_TIMEZONE });
}

function user(overrides: Partial<GuildUser> & Pick<GuildUser, "userId">): GuildUser {
  return {
    guildId: "guild-1",
    points: 0,
    isUwufied: 0,
    timesBegged: 0,
    timesSlapped: 0,
    scannedThings: 0,
    activatedMines: 0,
    monstersDrinked: 0,
    historicalPoints: 0,
    birthdayDay: 15,
    birthdayMonth: 3,
    birthdayCheeredYear: null,
    birthdayWarnedYear: null,
    lastBeggedAt: null,
    lastDrinkedAt: null,
    excludedAt: null,
    ...overrides,
  };
}

/** getUsersWithBirthday is called twice per sweep: today's keys, then the warning day's. */
function birthdays(today: GuildUser[], upcoming: GuildUser[] = []): void {
  getUsersWithBirthday.mockReset().mockReturnValueOnce(today).mockReturnValueOnce(upcoming);
}

function sentContents(): string[] {
  return send.mock.calls.map((call) => String((call[0] as { content: string }).content));
}

beforeEach(() => {
  send = vi.fn().mockResolvedValue(undefined);
  fetchChannel = vi.fn().mockResolvedValue({ isSendable: () => true, send });

  container.client = { channels: { fetch: fetchChannel } } as never;

  getGuildSettings.mockReset().mockReturnValue({ guildId: "guild-1", mainChannelId: "channel-1" });
  claimBirthdayGift.mockReset().mockReturnValue(true);
  claimBirthdayWarning.mockReset().mockReturnValue(true);
  buildCheerMessage.mockReset().mockReturnValue({ content: CHEER_CONTENT, files: [] });
  getUsersWithBirthday.mockReset().mockReturnValue([]);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("runBirthdaySweep", () => {
  it("congratulates and gifts a single birthday", async () => {
    birthdays([user({ userId: "user-1" })]);

    await runBirthdaySweep(at("2026-03-15"));

    expect(claimBirthdayGift).toHaveBeenCalledWith("guild-1", "user-1", 2026, BIRTHDAY_GIFT_POINTS);
    expect(send).toHaveBeenCalledTimes(1);
    expect(sentContents()[0]).toContain(CHEER_CONTENT);
  });

  it("mentions the gift amount alongside the cheer", async () => {
    birthdays([user({ userId: "user-1" })]);

    await runBirthdaySweep(at("2026-03-15"));

    expect(sentContents()[0]).toContain(String(BIRTHDAY_GIFT_POINTS));
  });

  // Requirement: several birthdays on the same day share one announcement.
  it("announces several same-day birthdays in a single message", async () => {
    birthdays([user({ userId: "user-1" }), user({ userId: "user-2" }), user({ userId: "user-3" })]);

    await runBirthdaySweep(at("2026-03-15"));

    expect(send).toHaveBeenCalledTimes(1);
    expect(buildCheerMessage).toHaveBeenCalledWith("<@user-1>, <@user-2> y <@user-3>");
  });

  it("still gifts every one of them individually", async () => {
    birthdays([user({ userId: "user-1" }), user({ userId: "user-2" })]);

    await runBirthdaySweep(at("2026-03-15"));

    expect(claimBirthdayGift).toHaveBeenCalledTimes(2);
  });

  // Requirement: surviving restarts means the sweep can run twice in a day.
  it("stays silent when every gift was already claimed this year", async () => {
    claimBirthdayGift.mockReturnValue(false);
    birthdays([user({ userId: "user-1" }), user({ userId: "user-2" })]);

    await runBirthdaySweep(at("2026-03-15"));

    expect(send).not.toHaveBeenCalled();
  });

  it("announces only the users whose gift the claim actually granted", async () => {
    claimBirthdayGift.mockImplementation((_guild: string, userId: string) => userId === "user-2");
    birthdays([user({ userId: "user-1" }), user({ userId: "user-2" })]);

    await runBirthdaySweep(at("2026-03-15"));

    expect(buildCheerMessage).toHaveBeenCalledWith("<@user-2>");
  });

  it("gifts nobody when the guild has no main channel", async () => {
    getGuildSettings.mockReturnValue({ guildId: "guild-1", mainChannelId: null });
    birthdays([user({ userId: "user-1" })]);

    await runBirthdaySweep(at("2026-03-15"));

    expect(claimBirthdayGift).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
  });

  it("gifts nobody when the main channel cannot be sent to", async () => {
    fetchChannel.mockResolvedValue({ isSendable: () => false });
    birthdays([user({ userId: "user-1" })]);

    await runBirthdaySweep(at("2026-03-15"));

    expect(claimBirthdayGift).not.toHaveBeenCalled();
  });

  it("keeps going when one guild's channel fetch rejects", async () => {
    fetchChannel.mockRejectedValue(new Error("gone"));
    birthdays([user({ userId: "user-1" })]);

    await expect(runBirthdaySweep(at("2026-03-15"))).resolves.toBeUndefined();
  });

  it("sends each guild its own announcement", async () => {
    birthdays([user({ userId: "user-1" }), user({ guildId: "guild-2", userId: "user-2" })]);
    getGuildSettings.mockImplementation((guildId: string) => ({ guildId, mainChannelId: `channel-${guildId}` }));

    await runBirthdaySweep(at("2026-03-15"));

    expect(send).toHaveBeenCalledTimes(2);
    expect(fetchChannel).toHaveBeenCalledWith("channel-guild-1");
    expect(fetchChannel).toHaveBeenCalledWith("channel-guild-2");
  });

  it("does not pay out when only a warning is due", async () => {
    birthdays([], [user({ userId: "user-1", birthdayDay: 22, birthdayMonth: 3 })]);

    await runBirthdaySweep(at("2026-03-15"));

    expect(claimBirthdayGift).not.toHaveBeenCalled();
    expect(send).toHaveBeenCalledTimes(1);
    expect(sentContents()[0]).toContain(String(BIRTHDAY_WARNING_DAYS));
  });

  it("warns about several upcoming birthdays in one message", async () => {
    birthdays([], [user({ userId: "user-1" }), user({ userId: "user-2" })]);

    await runBirthdaySweep(at("2026-03-15"));

    expect(send).toHaveBeenCalledTimes(1);
    expect(sentContents()[0]).toContain("<@user-1> y <@user-2>");
  });

  it("claims each warning before the message goes out", async () => {
    birthdays([], [user({ userId: "user-1" }), user({ userId: "user-2" })]);

    await runBirthdaySweep(at("2026-03-15"));

    expect(claimBirthdayWarning).toHaveBeenCalledWith("guild-1", "user-1", 2026);
    expect(claimBirthdayWarning).toHaveBeenCalledWith("guild-1", "user-2", 2026);
    expect(claimBirthdayWarning.mock.invocationCallOrder[0]).toBeLessThan(send.mock.invocationCallOrder[0] ?? 0);
  });

  // The claim, not the snapshotted row, decides. Two overlapping sweeps both read
  // birthdayWarnedYear as null, so only the atomic claim can break the tie.
  it("stays silent when the warning was already claimed for that birthday", async () => {
    claimBirthdayWarning.mockReturnValue(false);
    birthdays([], [user({ userId: "user-1", birthdayWarnedYear: 2026 })]);

    await runBirthdaySweep(at("2026-03-15"));

    expect(send).not.toHaveBeenCalled();
  });

  it("warns only the users whose claim actually succeeded", async () => {
    claimBirthdayWarning.mockImplementation((_guild: string, userId: string) => userId === "user-2");
    birthdays([], [user({ userId: "user-1" }), user({ userId: "user-2" })]);

    await runBirthdaySweep(at("2026-03-15"));

    expect(sentContents()[0]).toContain("<@user-2>");
    expect(sentContents()[0]).not.toContain("<@user-1>");
  });

  // A warning sent in late December is for next year's birthday.
  it("stamps a year-crossing warning with the birthday's own year", async () => {
    birthdays([], [user({ userId: "user-1", birthdayDay: 4, birthdayMonth: 1 })]);

    await runBirthdaySweep(at("2026-12-28"));

    expect(claimBirthdayWarning).toHaveBeenCalledWith("guild-1", "user-1", 2027);
  });

  it("sends the cheer and the warning separately when both fall on one day", async () => {
    birthdays([user({ userId: "user-1" })], [user({ userId: "user-2" })]);

    await runBirthdaySweep(at("2026-03-15"));

    expect(send).toHaveBeenCalledTimes(2);
  });

  it("looks up the leap-day crowd on 28/02 of a non-leap year", async () => {
    birthdays([]);

    await runBirthdaySweep(at("2027-02-28"));

    expect(getUsersWithBirthday).toHaveBeenNthCalledWith(1, [
      { day: 28, month: 2 },
      { day: 29, month: 2 },
    ]);
  });

  it("looks a week ahead for the warning list", async () => {
    birthdays([]);

    await runBirthdaySweep(at("2026-03-15"));

    expect(getUsersWithBirthday).toHaveBeenNthCalledWith(2, [{ day: 22, month: 3 }]);
  });

  it("touches nothing when there are no birthdays at all", async () => {
    birthdays([]);

    await runBirthdaySweep(at("2026-03-15"));

    expect(fetchChannel).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
  });
});
