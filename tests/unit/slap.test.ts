import { TargetIsExcluded } from "@infrastructure/errors/domain.errors.js";

import { assetPath } from "@shared/utils/asset-path.util.js";

import { NO_POINTS_MESSAGE, SLAP_COST, SLAP_RESOLUTIONS } from "@features/slap/slap.constants.js";

import type { ChatInputCommandInteraction } from "discord.js";

import { existsSync } from "node:fs";
import { container } from "@sapphire/framework";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const GUILD = "guild-1";
const SLAPPER = "slapper-1";
const TARGET = "target-1";

const recordSlap = vi.hoisted(() => vi.fn());
const isUserExcluded = vi.hoisted(() => vi.fn());
const sumPointsToUser = vi.hoisted(() => vi.fn());
const subtractPointsFromUser = vi.hoisted(() => vi.fn());

vi.mock("@core/services/user.service.js", () => ({
  recordSlap,
  isUserExcluded,
  sumPointsToUser,
  subtractPointsFromUser,
}));

vi.mock("@shared/utils/guild-context.util.js", () => ({
  requireGuildMember: () => ({ guildId: GUILD, member: { id: SLAPPER, displayName: "Slapper" } }),
}));

container.client = { options: {} } as never;

const { SlapCommand } = await import("@features/slap/commands/slap.command.js");

const command = new SlapCommand(
  { store: { name: "commands" }, path: "slap.command.ts", name: "slap", root: process.cwd() } as never,
  {},
);

type Reply = { content?: string; files?: unknown[]; flags?: number };

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
  recordSlap.mockReset().mockReturnValue({ userId: TARGET });
  isUserExcluded.mockReset().mockReturnValue(false);
  sumPointsToUser.mockReset().mockReturnValue({ userId: SLAPPER });
  subtractPointsFromUser.mockReset().mockReturnValue({ userId: SLAPPER, points: 10 });
  reply = vi.fn().mockResolvedValue(undefined);

  // pickRandom floors Math.random, so this pins the resolution to the first entry.
  vi.spyOn(Math, "random").mockReturnValue(0);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("slap resolutions", () => {
  // Regression: the images once lacked their .jpg extension, so every slap charged and then failed.
  it.each(SLAP_RESOLUTIONS)("ships the image file for $image", ({ image }) => {
    expect(existsSync(assetPath("img", image))).toBe(true);
  });

  // Every message is run through formatMessage, so each needs the placeholder to name its target.
  it.each(SLAP_RESOLUTIONS)("puts a {user} placeholder in the message for $image", ({ message }) => {
    expect(message).toContain("{user}");
  });

  // Edge case: pickRandom would throw on an empty pool, so the list must never be emptied.
  it("has at least one resolution", () => {
    expect(SLAP_RESOLUTIONS.length).toBeGreaterThan(0);
  });

  // A zero or negative cost would make the charge meaningless or hand out points.
  it("charges a positive cost", () => {
    expect(SLAP_COST).toBeGreaterThan(0);
  });
});

describe("SlapCommand", () => {
  // Normal case: the slapper pays the advertised cost up front.
  it("charges the slapper", async () => {
    await command.chatInputRun(stubInteraction());

    expect(subtractPointsFromUser).toHaveBeenCalledWith(GUILD, SLAPPER, SLAP_COST);
  });

  // The counter belongs to the person receiving the slap, not the one throwing it.
  it("records the slap against the target, not the slapper", async () => {
    await command.chatInputRun(stubInteraction());

    expect(recordSlap).toHaveBeenCalledWith(GUILD, TARGET);
    expect(recordSlap).not.toHaveBeenCalledWith(GUILD, SLAPPER);
  });

  // Normal case: the {user} placeholder has to resolve to a real mention before it reaches Discord.
  it("mentions the target instead of leaving the placeholder", async () => {
    await command.chatInputRun(stubInteraction());

    expect(replyPayload().content).toContain(`<@${TARGET}>`);
    expect(replyPayload().content).not.toContain("{user}");
  });

  // Normal case: the reply carries the resolution's image as an attachment.
  it("attaches the resolution image", async () => {
    await command.chatInputRun(stubInteraction());

    expect(replyPayload().files).toHaveLength(1);
  });

  // Normal case: a successful slap must not hand the points back.
  it("does not refund on the happy path", async () => {
    await command.chatInputRun(stubInteraction());

    expect(sumPointsToUser).not.toHaveBeenCalled();
  });

  // Error handling: an excluded target is rejected before the slapper is charged anything.
  it("throws for an excluded target without charging", async () => {
    isUserExcluded.mockReturnValue(true);

    await expect(command.chatInputRun(stubInteraction())).rejects.toThrow(TargetIsExcluded);
    expect(subtractPointsFromUser).not.toHaveBeenCalled();
    expect(recordSlap).not.toHaveBeenCalled();
  });

  // Edge case: a slapper who cannot pay gets a private refusal, and nothing is recorded.
  it("refuses privately when the slapper cannot pay", async () => {
    subtractPointsFromUser.mockReturnValue(undefined);

    await command.chatInputRun(stubInteraction());

    expect(replyPayload().content).toBe(NO_POINTS_MESSAGE);
    expect(replyPayload().flags).toBeDefined();
    expect(recordSlap).not.toHaveBeenCalled();
  });

  // Error handling: the slapper has already paid, so a failed reply has to return the points.
  it("refunds and rethrows when the reply fails", async () => {
    const failure = new Error("discord is down");
    reply.mockRejectedValue(failure);

    await expect(command.chatInputRun(stubInteraction())).rejects.toThrow(failure);
    expect(sumPointsToUser).toHaveBeenCalledWith(GUILD, SLAPPER, SLAP_COST);
  });

  // Error handling: a failed write also refunds, and must not leave a half-sent reply behind.
  it("refunds and rethrows when recording fails", async () => {
    const failure = new Error("db is down");
    recordSlap.mockImplementation(() => {
      throw failure;
    });

    await expect(command.chatInputRun(stubInteraction())).rejects.toThrow(failure);
    expect(sumPointsToUser).toHaveBeenCalledWith(GUILD, SLAPPER, SLAP_COST);
    expect(reply).not.toHaveBeenCalled();
  });

  // Error handling: a broken refund must not replace the real error with a misleading one.
  it("still reports the original error when the refund itself fails", async () => {
    const failure = new Error("discord is down");
    reply.mockRejectedValue(failure);
    sumPointsToUser.mockImplementation(() => {
      throw new Error("refund exploded");
    });

    await expect(command.chatInputRun(stubInteraction())).rejects.toThrow(failure);
  });

  // The command is only usable behind the guards that make its assumptions hold.
  it("runs behind the guild, exclusion, bot and self preconditions", () => {
    const names = command.preconditions.entries.map((entry) => (entry as unknown as { name: string }).name);

    expect(names).toEqual(["GuildConfigured", "NotExcluded", "NotABot", "NotSelf"]);
  });
});
