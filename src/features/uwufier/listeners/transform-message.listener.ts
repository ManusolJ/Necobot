import { logger } from "@infrastructure/config/logger.config.js";

import { consumeUwufiedMessage, isUserExcluded, isUserUwufied } from "@core/services/user.service.js";

import { BOT_DISPLAY_NAME } from "@shared/consts/branding.constants.js";
import { botCanRewriteMessages } from "@shared/utils/verify-bot-permissions.util.js";

import { uwuifyText } from "../uwufier.service.js";
import { UWUFY_MAX_INPUT_LENGTH, UWUFY_MAX_OUTPUT_LENGTH } from "../uwufier.constants.js";

import type { Message, TextChannel, Webhook } from "discord.js";

import { ChannelType } from "discord.js";
import { Events, Listener } from "@sapphire/framework";

export class TransformMessageListener extends Listener<typeof Events.MessageCreate> {
  public constructor(context: Listener.LoaderContext, options: Listener.Options) {
    super(context, { ...options, event: Events.MessageCreate });
  }

  public override async run(message: Message): Promise<void> {
    if (!message.inGuild() || message.author.bot || message.webhookId !== null) {
      return;
    }

    if (message.content.length === 0 || message.content.length > UWUFY_MAX_INPUT_LENGTH) {
      return;
    }

    if (!isUserUwufied(message.guildId, message.author.id)) {
      return;
    }

    if (isUserExcluded(message.guildId, message.author.id)) {
      return;
    }

    if (message.channel.type !== ChannelType.GuildText) {
      return;
    }

    if (!botCanRewriteMessages(message.guild.members.me ?? undefined, message.channel)) {
      return;
    }

    const uwu = await uwuifyText(message.content);

    if (uwu === undefined || uwu.length > UWUFY_MAX_OUTPUT_LENGTH) {
      return;
    }

    if (await this.rewrite(message, message.channel, uwu)) {
      consumeUwufiedMessage(message.guildId, message.author.id);
    }
  }

  private async rewrite(message: Message<true>, channel: TextChannel, content: string): Promise<boolean> {
    try {
      const webhook = await this.resolveWebhook(channel);

      await webhook.send({
        content,
        username: message.member?.displayName ?? message.author.username,
        avatarURL: message.author.displayAvatarURL(),
        allowedMentions: { parse: [] },
      });

      await message.delete();

      return true;
    } catch (error) {
      logger.error(
        { err: error, guildId: message.guildId, channelId: channel.id, messageId: message.id },
        "Failed to rewrite a message through the webhook",
      );

      return false;
    }
  }

  private async resolveWebhook(channel: TextChannel): Promise<Webhook> {
    const existing = await channel.fetchWebhooks();
    const owned = existing.find((hook) => hook.owner?.id === channel.client.user.id && hook.token !== null);

    return owned ?? (await channel.createWebhook({ name: BOT_DISPLAY_NAME }));
  }
}
