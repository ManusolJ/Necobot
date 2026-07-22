import { logger } from "@infrastructure/config/logger.config.js";
import { isOllamaConfigured } from "@infrastructure/ai/ollama.client.js";

import { isUserExcluded } from "@core/services/user.service.js";
import { generateChatReply } from "@core/services/conversation.service.js";

import { AI_FALLBACK_REPLY, AI_REPLY_MAX_LENGTH, AI_USER_COOLDOWN_MS } from "@shared/consts/ai.constants.js";

import type { Message } from "discord.js";

import { Events, Listener } from "@sapphire/framework";

const lastRequestAt = new Map<string, number>();

export class MentionReplyListener extends Listener<typeof Events.MessageCreate> {
  public constructor(context: Listener.LoaderContext, options: Listener.Options) {
    super(context, { ...options, event: Events.MessageCreate });
  }

  public override async run(message: Message): Promise<void> {
    if (!message.inGuild() || message.author.bot || !isOllamaConfigured()) {
      return;
    }

    const botId = this.container.client.user?.id;
    if (!botId) {
      return;
    }

    if (!message.mentions.has(botId, { ignoreEveryone: true, ignoreRoles: true })) {
      return;
    }

    if (isUserExcluded(message.guildId, message.author.id)) {
      return;
    }

    const now = Date.now();
    const last = lastRequestAt.get(message.author.id);
    if (last !== undefined && now - last < AI_USER_COOLDOWN_MS) {
      return;
    }
    lastRequestAt.set(message.author.id, now);

    const text =
      message.content.replaceAll(new RegExp(`<@!?${botId}>`, "gu"), "").trim() || "(te menciona sin decir nada)";
    const authorName = message.member?.displayName ?? message.author.username;

    try {
      await message.channel.sendTyping();
      const reply = await generateChatReply(message.channelId, authorName, text);

      await message.reply({
        content: (reply ?? AI_FALLBACK_REPLY).slice(0, AI_REPLY_MAX_LENGTH),
        allowedMentions: { parse: [], repliedUser: true },
      });
    } catch (error) {
      logger.error({ err: error, channelId: message.channelId, userId: message.author.id }, "Mention reply failed");
    }
  }
}
