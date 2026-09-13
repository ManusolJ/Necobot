import type * as DuelService from "@features/duel/duel.service.js";

import { DUEL_DEFAULT_BET } from "@features/duel/duel.constants.js";

import type { ChatInputCommandInteraction } from "discord.js";

import { ChannelType } from "discord.js";
import { container } from "@sapphire/framework";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const GUILD = "guild-1";
const BOT = "bot-1";
const CHALLENGER = "challenger-1";
const TARGET = "target-1";
const MAIN_CHANNEL = "main-1";
const SESSION_ID = 7;

const getGuildUser = vi.hoisted(() => vi.fn());
const isUserExcluded = vi.hoisted(() => vi.fn());
const grantPointsToUser = vi.hoisted(() => vi.fn());
const getGuildSettings = vi.hoisted(() => vi.fn());
const botCanSendMessagesInChannel = vi.hoisted(() => vi.fn());
const openDuel = vi.hoisted(() => vi.fn());
const acceptDuel = vi.hoisted(() => vi.fn());
const cancelDuel = vi.hoisted(() => vi.fn());
const attachDuelMessage = vi.hoisted(() => vi.fn());
const channelFetch = vi.hoisted(() => vi.fn());

vi.mock("@core/services/user.service.js", () => ({ getGuildUser, isUserExcluded, grantPointsToUser }));
vi.mock("@core/services/guild.service.js", () => ({ getGuildSettings }));
vi.mock("@shared/utils/verify-bot-permissions.util.js", () => ({ botCanSendMessagesInChannel }));
vi.mock("@shared/utils/guild-context.util.js", () => ({
  requireGuildMember: () => ({ guildId: GUILD, member: { id: CHALLENGER, displayName: "Retador" } }),
}));
vi.mock("@features/duel/duel.service.js", async (importOriginal) => ({
  ...(await importOriginal<typeof DuelService>()),
  openDuel,
  acceptDuel,
  cancelDuel,
  attachDuelMessage,
}));

container.client = { options: {}, user: { id: BOT }, channels: { fetch: channelFetch } } as never;

const { DuelCommand } = await import("@features/duel/commands/duel.command.js");

const command = new DuelCommand(
  { store: { name: "commands" }, path: "duel.command.ts", name: "duel", root: process.cwd() } as never,
  {},
);

type Reply = { content?: string; flags?: number };

let reply: ReturnType<typeof vi.fn>;
let send: ReturnType<typeof vi.fn>;

function stubInteraction(): ChatInputCommandInteraction {
  return {
    guildId: GUILD,
    guild: { members: { fetchMe: vi.fn().mockResolvedValue({ id: BOT }) } },
    options: {
      getUser: () => ({ id: TARGET, bot: false }),
      getInteger: () => DUEL_DEFAULT_BET,
    },
    reply,
  } as unknown as ChatInputCommandInteraction;
}

function replyPayload(): Reply {
  const payload: unknown = reply.mock.calls[0]?.[0];
  return typeof payload === "string" ? { content: payload } : (payload as Reply);
}

beforeEach(() => {
  reply = vi.fn().mockResolvedValue(undefined);
  send = vi.fn().mockResolvedValue({
    id: "message-1",
    channelId: MAIN_CHANNEL,
    createMessageComponentCollector: () => ({ on: vi.fn() }),
  });

  getGuildUser.mockReset().mockReturnValue({ points: 100 });
  isUserExcluded.mockReset().mockReturnValue(false);
  grantPointsToUser.mockReset();
  getGuildSettings.mockReset().mockReturnValue({ mainChannelId: MAIN_CHANNEL });
  botCanSendMessagesInChannel.mockReset().mockReturnValue(true);
  openDuel.mockReset().mockReturnValue({ id: SESSION_ID });
  acceptDuel.mockReset().mockReturnValue(true);
  cancelDuel.mockReset();
  attachDuelMessage.mockReset();
  channelFetch.mockReset().mockResolvedValue({ id: MAIN_CHANNEL, type: ChannelType.GuildText, send });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("DuelCommand versus a user", () => {
  it("reserves the challenger's stake and remembers the invite message", async () => {
    await command.chatInputRun(stubInteraction());

    expect(openDuel).toHaveBeenCalledWith(GUILD, CHALLENGER, TARGET, DUEL_DEFAULT_BET);
    expect(attachDuelMessage).toHaveBeenCalledWith(SESSION_ID, MAIN_CHANNEL, "message-1");
    expect(cancelDuel).not.toHaveBeenCalled();
    expect(replyPayload().content).toContain("reservada");
  });

  // Regression: the stake used to be taken before the invite was sent, so a failed send burned it.
  it("refunds the stake and rethrows when the invite cannot be sent", async () => {
    const failure = new Error("Missing Permissions");
    send.mockRejectedValue(failure);

    await expect(command.chatInputRun(stubInteraction())).rejects.toBe(failure);

    expect(cancelDuel).toHaveBeenCalledWith(SESSION_ID);
    expect(attachDuelMessage).not.toHaveBeenCalled();
  });

  // isSendable() only checks the channel type, so the permission check has to be explicit.
  it("does not take a stake when the bot cannot post in the main channel", async () => {
    botCanSendMessagesInChannel.mockReturnValue(false);

    await command.chatInputRun(stubInteraction());

    expect(openDuel).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
    expect(replyPayload().content).toContain("permisos");
  });

  it("does not take a stake when the main channel is not a text channel", async () => {
    channelFetch.mockResolvedValue({ id: MAIN_CHANNEL, type: ChannelType.GuildVoice });

    await command.chatInputRun(stubInteraction());

    expect(openDuel).not.toHaveBeenCalled();
  });

  it("cancels before sending anything when the target cannot cover the bet", async () => {
    getGuildUser.mockReturnValue({ points: DUEL_DEFAULT_BET - 1 });

    await command.chatInputRun(stubInteraction());

    expect(openDuel).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
  });

  it("cancels when the challenger cannot cover the bet", async () => {
    openDuel.mockReturnValue(undefined);

    await command.chatInputRun(stubInteraction());

    expect(send).not.toHaveBeenCalled();
    expect(replyPayload().content).toContain("sin tenerlos");
  });

  it("refuses an excluded target without touching any stake", async () => {
    isUserExcluded.mockReturnValue(true);

    await command.chatInputRun(stubInteraction());

    expect(openDuel).not.toHaveBeenCalled();
    expect(replyPayload().content).toContain("excluido");
  });
});
