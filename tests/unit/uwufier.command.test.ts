import { TargetIsExcluded } from "@infrastructure/errors/domain.errors.js";

import { UWUFY_NO_POINTS } from "@features/uwufier/uwufier.messages.js";
import { UWUFY_COST, UWUFY_MESSAGE_COUNT } from "@features/uwufier/uwufier.constants.js";

import type { ChatInputCommandInteraction } from "discord.js";

import { container } from "@sapphire/framework";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const GUILD = "guild-1";
const BUYER = "buyer-1";
const TARGET = "target-1";

const isUserExcluded = vi.hoisted(() => vi.fn());
const sumPointsToUser = vi.hoisted(() => vi.fn());
const setUserUwufication = vi.hoisted(() => vi.fn());
const subtractPointsFromUser = vi.hoisted(() => vi.fn());

vi.mock("@core/services/user.service.js", () => ({
  isUserExcluded,
  sumPointsToUser,
  setUserUwufication,
  subtractPointsFromUser,
}));

vi.mock("@shared/utils/guild-context.util.js", () => ({
  requireGuildMember: () => ({ guildId: GUILD, member: { id: BUYER, displayName: "Comprador" } }),
}));

container.client = { options: {} } as never;

const { UwufierCommand } = await import("@features/uwufier/commands/uwufier.command.js");

const command = new UwufierCommand(
  { store: { name: "commands" }, path: "uwufier.command.ts", name: "uwufier", root: process.cwd() } as never,
  {},
);

type Reply = { content?: string; flags?: number };

let reply: ReturnType<typeof vi.fn>;

function stubInteraction(): ChatInputCommandInteraction {
  return {
    guildId: GUILD,
    options: { getUser: () => ({ id: TARGET, bot: false }) },
    reply,
  } as unknown as ChatInputCommandInteraction;
}

function replyPayload(): Reply {
  return reply.mock.calls[0]?.[0] as Reply;
}

beforeEach(() => {
  isUserExcluded.mockReset().mockReturnValue(false);
  sumPointsToUser.mockReset().mockReturnValue({ userId: BUYER });
  setUserUwufication.mockReset().mockReturnValue({ userId: TARGET, isUwufied: UWUFY_MESSAGE_COUNT });
  subtractPointsFromUser.mockReset().mockReturnValue({ userId: BUYER, points: 10 });
  reply = vi.fn().mockResolvedValue(undefined);
  vi.spyOn(Math, "random").mockReturnValue(0);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("UwufierCommand", () => {
  // Normal case: the buyer pays the advertised cost.
  it("charges the buyer", async () => {
    await command.chatInputRun(stubInteraction());

    expect(subtractPointsFromUser).toHaveBeenCalledWith(GUILD, BUYER, UWUFY_COST);
  });

  // The debuff lands on the target, not on whoever paid for it.
  it("applies the message count to the target, not the buyer", async () => {
    await command.chatInputRun(stubInteraction());

    expect(setUserUwufication).toHaveBeenCalledWith(GUILD, TARGET, UWUFY_MESSAGE_COUNT);
    expect(setUserUwufication).not.toHaveBeenCalledWith(GUILD, BUYER, UWUFY_MESSAGE_COUNT);
  });

  // Normal case: the announcement names the target and the number of messages bought.
  it("announces the target and the count", async () => {
    await command.chatInputRun(stubInteraction());

    expect(replyPayload().content).toContain(`<@${TARGET}>`);
    expect(replyPayload().content).toContain(String(UWUFY_MESSAGE_COUNT));
    expect(replyPayload().content).not.toContain("{user}");
    expect(replyPayload().content).not.toContain("{count}");
  });

  // Error handling: an excluded target is refused before the buyer is charged anything.
  it("throws for an excluded target without charging", async () => {
    isUserExcluded.mockReturnValue(true);

    await expect(command.chatInputRun(stubInteraction())).rejects.toThrow(TargetIsExcluded);
    expect(subtractPointsFromUser).not.toHaveBeenCalled();
    expect(setUserUwufication).not.toHaveBeenCalled();
  });

  // Edge case: a buyer who cannot pay gets a private refusal and nothing is applied.
  it("refuses privately when the buyer cannot pay", async () => {
    subtractPointsFromUser.mockReturnValue(undefined);

    await command.chatInputRun(stubInteraction());

    expect(replyPayload().content).toBe(UWUFY_NO_POINTS);
    expect(replyPayload().flags).toBeDefined();
    expect(setUserUwufication).not.toHaveBeenCalled();
  });

  // Error handling: the buyer has already paid, so a failed write has to return the points.
  it("refunds and rethrows when applying the debuff fails", async () => {
    const failure = new Error("db is down");
    setUserUwufication.mockImplementation(() => {
      throw failure;
    });

    await expect(command.chatInputRun(stubInteraction())).rejects.toThrow(failure);
    expect(sumPointsToUser).toHaveBeenCalledWith(GUILD, BUYER, UWUFY_COST);
    expect(reply).not.toHaveBeenCalled();
  });

  // Error handling: a failed announcement also refunds, so the buyer is never silently charged.
  it("refunds and rethrows when the reply fails", async () => {
    const failure = new Error("discord is down");
    reply.mockRejectedValue(failure);

    await expect(command.chatInputRun(stubInteraction())).rejects.toThrow(failure);
    expect(sumPointsToUser).toHaveBeenCalledWith(GUILD, BUYER, UWUFY_COST);
  });

  // Error handling: a broken refund must not replace the real error with a misleading one.
  it("still reports the original error when the refund itself fails", async () => {
    const failure = new Error("db is down");
    setUserUwufication.mockImplementation(() => {
      throw failure;
    });
    sumPointsToUser.mockImplementation(() => {
      throw new Error("refund exploded");
    });

    await expect(command.chatInputRun(stubInteraction())).rejects.toThrow(failure);
  });

  // Normal case: a successful purchase must not hand the points back.
  it("does not refund on the happy path", async () => {
    await command.chatInputRun(stubInteraction());

    expect(sumPointsToUser).not.toHaveBeenCalled();
  });

  // The command is only usable behind the guards that make its assumptions hold.
  it("runs behind the guild, exclusion and bot preconditions", () => {
    const names = command.preconditions.entries.map((entry) => (entry as unknown as { name: string }).name);

    expect(names).toEqual(["GuildConfigured", "NotExcluded", "NotABot"]);
  });
});
