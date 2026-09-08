import { UWUFY_MAX_INPUT_LENGTH } from "@features/uwufier/uwufier.constants.js";

import type { Message } from "discord.js";

import { ChannelType, Collection } from "discord.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const CHANNEL = "main-channel";
const GUILD = "guild-1";

const uwuifyText = vi.hoisted(() => vi.fn());
const isUserUwufied = vi.hoisted(() => vi.fn());
const isUserExcluded = vi.hoisted(() => vi.fn());
const consumeUwufiedMessage = vi.hoisted(() => vi.fn());
const botCanRewriteMessages = vi.hoisted(() => vi.fn());

vi.mock("@features/uwufier/uwufier.service.js", () => ({ uwuifyText }));
vi.mock("@core/services/user.service.js", () => ({ isUserUwufied, isUserExcluded, consumeUwufiedMessage }));
vi.mock("@shared/utils/verify-bot-permissions.util.js", () => ({ botCanRewriteMessages }));

const { TransformMessageListener } = await import("@features/uwufier/listeners/transform-message.listener.js");

const listener = new TransformMessageListener(
  { store: { name: "listeners" }, path: "x.ts", name: "TransformMessage", root: process.cwd() } as never,
  { event: "messageCreate" },
);

let send: ReturnType<typeof vi.fn>;
let deleteMessage: ReturnType<typeof vi.fn>;
let fetchWebhooks: ReturnType<typeof vi.fn>;
let createWebhook: ReturnType<typeof vi.fn>;
let order: string[];

function stubMessage(overrides: Partial<Record<string, unknown>> = {}): Message {
  const base = {
    content: "Hello World",
    guildId: GUILD,
    channelId: CHANNEL,
    id: "message-1",
    webhookId: null,
    author: { id: "user-1", bot: false, username: "User", displayAvatarURL: () => "avatar" },
    member: { displayName: "Usuario" },
    guild: { members: { me: {} } },
    inGuild: () => true,
    delete: deleteMessage,
    channel: {
      id: CHANNEL,
      type: ChannelType.GuildText,
      client: { user: { id: "bot-1" } },
      fetchWebhooks,
      createWebhook,
    },
    ...overrides,
  };

  return base as unknown as Message;
}

beforeEach(() => {
  order = [];
  send = vi.fn().mockImplementation(() => {
    order.push("send");
    return Promise.resolve(undefined);
  });
  deleteMessage = vi.fn().mockImplementation(() => {
    order.push("delete");
    return Promise.resolve(undefined);
  });
  fetchWebhooks = vi.fn().mockResolvedValue(new Collection());
  createWebhook = vi.fn().mockResolvedValue({ send, token: "t", owner: { id: "bot-1" } });

  uwuifyText.mockReset().mockResolvedValue("hewwo wowwd");
  isUserUwufied.mockReset().mockReturnValue(true);
  isUserExcluded.mockReset().mockReturnValue(false);
  consumeUwufiedMessage.mockReset().mockReturnValue(true);
  botCanRewriteMessages.mockReset().mockReturnValue(true);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("TransformMessageListener", () => {
  // Normal case: an eligible message is reposted through the webhook and the original removed.
  it("reposts the rewritten text and deletes the original", async () => {
    await listener.run(stubMessage());

    expect(send).toHaveBeenCalledWith(expect.objectContaining({ content: "hewwo wowwd" }));
    expect(deleteMessage).toHaveBeenCalled();
  });

  // The send has to land first: deleting first would destroy the message if the send then failed.
  it("sends before deleting", async () => {
    await listener.run(stubMessage());

    expect(order).toEqual(["send", "delete"]);
  });

  // A failed send must leave the original message in place rather than losing its content.
  it("keeps the original when the send fails", async () => {
    send.mockRejectedValue(new Error("webhook gone"));

    await listener.run(stubMessage());

    expect(deleteMessage).not.toHaveBeenCalled();
  });

  // Normal case: the repost wears the author's name and avatar, which is the point of the webhook.
  it("posts as the original author", async () => {
    await listener.run(stubMessage());

    expect(send).toHaveBeenCalledWith(expect.objectContaining({ username: "Usuario", avatarURL: "avatar" }));
  });

  // Security: a webhook does not inherit the author's restrictions, so nothing may be pinged.
  it("suppresses every mention in the repost", async () => {
    await listener.run(stubMessage({ content: "@everyone hello" }));

    expect(send).toHaveBeenCalledWith(expect.objectContaining({ allowedMentions: { parse: [] } }));
  });

  // The loop guard: the bot's own repost arrives as a new message and must not be rewritten again.
  it("ignores its own webhook repost", async () => {
    await listener.run(stubMessage({ webhookId: "webhook-1" }));

    expect(uwuifyText).not.toHaveBeenCalled();
  });

  // Other bots are ignored for the same reason, matching the other MessageCreate listeners.
  it("ignores other bots", async () => {
    await listener.run(stubMessage({ author: { id: "bot-2", bot: true } }));

    expect(uwuifyText).not.toHaveBeenCalled();
  });

  // Opt-out is first-class here: an excluded user's messages are never rewritten.
  it("ignores an excluded user", async () => {
    isUserExcluded.mockReturnValue(true);

    await listener.run(stubMessage());

    expect(uwuifyText).not.toHaveBeenCalled();
  });

  // The debuff is targeted and paid for, so an untargeted user is never touched.
  it("ignores a user with no uwufied messages pending", async () => {
    isUserUwufied.mockReturnValue(false);

    await listener.run(stubMessage());

    expect(uwuifyText).not.toHaveBeenCalled();
    expect(consumeUwufiedMessage).not.toHaveBeenCalled();
  });

  // Normal case: a rewrite that landed spends exactly one of the messages the buyer paid for.
  it("spends one pending message after a successful rewrite", async () => {
    await listener.run(stubMessage());

    expect(consumeUwufiedMessage).toHaveBeenCalledTimes(1);
    expect(consumeUwufiedMessage).toHaveBeenCalledWith(GUILD, "user-1");
  });

  // The buyer must not lose a paid message when the rewrite never reached the channel.
  it("does not spend a message when the rewrite fails", async () => {
    send.mockRejectedValue(new Error("webhook gone"));

    await listener.run(stubMessage());

    expect(consumeUwufiedMessage).not.toHaveBeenCalled();
  });

  // A failed API call is not the user's message being rewritten, so nothing is spent.
  it("does not spend a message when the API returns nothing", async () => {
    uwuifyText.mockResolvedValue(undefined);

    await listener.run(stubMessage());

    expect(consumeUwufiedMessage).not.toHaveBeenCalled();
  });

  // Missing permissions must not quietly burn through the messages someone paid for.
  it("does not spend a message without the required permissions", async () => {
    botCanRewriteMessages.mockReturnValue(false);

    await listener.run(stubMessage());

    expect(consumeUwufiedMessage).not.toHaveBeenCalled();
  });

  // Edge case: an over-long message is skipped before the API call, not after.
  it("skips a message longer than the input limit", async () => {
    await listener.run(stubMessage({ content: "a".repeat(UWUFY_MAX_INPUT_LENGTH + 1) }));

    expect(uwuifyText).not.toHaveBeenCalled();
  });

  // Edge case: an empty message (an attachment-only post) has nothing to rewrite.
  it("skips a message with no text", async () => {
    await listener.run(stubMessage({ content: "" }));

    expect(uwuifyText).not.toHaveBeenCalled();
  });

  // Missing permissions must stop the attempt before the API is called.
  it("does nothing without the required permissions", async () => {
    botCanRewriteMessages.mockReturnValue(false);

    await listener.run(stubMessage());

    expect(uwuifyText).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
  });

  // Webhooks belong to real text channels, so a thread must be skipped rather than erroring.
  it("skips channels that are not plain text channels", async () => {
    const message = stubMessage();
    (message.channel as { type: number }).type = ChannelType.PublicThread;

    await listener.run(message);

    expect(uwuifyText).not.toHaveBeenCalled();
  });

  // A failed rewrite from the API leaves the original message untouched.
  it("leaves the message alone when the API returns nothing", async () => {
    uwuifyText.mockResolvedValue(undefined);

    await listener.run(stubMessage());

    expect(send).not.toHaveBeenCalled();
    expect(deleteMessage).not.toHaveBeenCalled();
  });

  // Reusing an owned webhook keeps the channel from filling up with one webhook per rewrite.
  it("reuses a webhook it already owns", async () => {
    fetchWebhooks.mockResolvedValue(new Collection([["w1", { send, token: "t", owner: { id: "bot-1" } }]]));

    await listener.run(stubMessage());

    expect(createWebhook).not.toHaveBeenCalled();
    expect(send).toHaveBeenCalled();
  });

  // A webhook made by somebody else has no usable token, so it cannot be borrowed.
  it("creates its own webhook rather than borrowing a foreign one", async () => {
    fetchWebhooks.mockResolvedValue(new Collection([["w1", { send: vi.fn(), token: null, owner: { id: "someone" } }]]));

    await listener.run(stubMessage());

    expect(createWebhook).toHaveBeenCalled();
  });
});
