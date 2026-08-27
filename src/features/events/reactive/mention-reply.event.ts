import { logger } from "@infrastructure/config/logger.config.js";

import { isUserExcluded } from "@core/services/user.service.js";
import { generateChatReply } from "@core/services/conversation.service.js";

import { AI_FALLBACK_REPLY, AI_REPLY_MAX_LENGTH, AI_USER_COOLDOWN_MS } from "@shared/consts/ai.constants.js";

import type { Message } from "discord.js";

import { Events, Listener } from "@sapphire/framework";

const lastRequestAt = new Map<string, number>();

const mentionPatterns = new Map<string, RegExp>();

function mentionPattern(botId: string): RegExp {
  let pattern = mentionPatterns.get(botId);
  if (!pattern) {
    pattern = new RegExp(`<@!?${botId}>`, "gu");
    mentionPatterns.set(botId, pattern);
  }
  return pattern;
}

function pruneExpiredCooldowns(now: number): void {
  for (const [key, at] of lastRequestAt) {
    if (now - at >= AI_USER_COOLDOWN_MS) {
      lastRequestAt.delete(key);
    }
  }
}

export class MentionReplyListener extends Listener<typeof Events.MessageCreate> {
  public constructor(context: Listener.LoaderContext, options: Listener.Options) {
    super(context, { ...options, event: Events.MessageCreate });
  }

  public override async run(message: Message): Promise<void> {
    if (!message.inGuild() || message.author.bot) {
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
    const cooldownKey = `${message.guildId}:${message.author.id}`;
    const last = lastRequestAt.get(cooldownKey);
    if (last !== undefined && now - last < AI_USER_COOLDOWN_MS) {
      return;
    }
    pruneExpiredCooldowns(now);
    lastRequestAt.set(cooldownKey, now);

    const text = message.content.replaceAll(mentionPattern(botId), "").trim() || "(te menciona sin decir nada)";
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
