import { logger } from "@infrastructure/config/logger.config.js";
import {
  BotCannotCleanChannel,
  ArchiveChannelUnavailable,
  BotPermissionsNotVerified,
  CleanStartMessageNotFound,
} from "@infrastructure/errors/domain.errors.js";

import { getGuildChannel } from "@core/services/guild.service.js";

import { nowInBotZone } from "@shared/utils/calendar.util.js";
import { EMBED_COLOR } from "@shared/consts/branding.constants.js";
import { formatMessage } from "@shared/utils/format-message.util.js";
import { requireGuildMember } from "@shared/utils/guild-context.util.js";
import { botCanCleanChannel, botCanArchiveInChannel } from "@shared/utils/verify-bot-permissions.util.js";

import {
  chunkArchiveLines,
  toArchivedMessage,
  formatArchivedMessage,
  buildArchiveThreadName,
} from "../moderation.service.js";
import {
  MESSAGE_ID_PATTERN,
  CLEANUP_MAX_MESSAGES,
  CLEANUP_MESSAGE_COUNT,
  ARCHIVE_CHANNEL_PURPOSE,
  ARCHIVE_THREAD_AUTO_ARCHIVE,
  CLEANUP_CONFIRM_TIMEOUT_MS,
} from "../moderation.constants.js";
import {
  CLEAN_DONE,
  CLEAN_CANCELLED,
  CLEAN_TIMED_OUT,
  CLEAN_NO_MESSAGES,
  CLEAN_DONE_SKIPPED,
  CLEAN_CANCEL_BUTTON,
  CLEAN_CONFIRM_TITLE,
  CLEAN_DONE_ARCHIVED,
  CLEAN_CONFIRM_BUTTON,
  ARCHIVE_THREAD_HEADER,
  CLEAN_CONFIRM_DESCRIPTION,
} from "../moderation.messages.js";

import type { ApplicationCommandRegistry, Awaitable } from "@sapphire/framework";
import type { Message, GuildMember, TextChannel, ThreadChannel, ChatInputCommandInteraction } from "discord.js";

import { Command } from "@sapphire/framework";
import {
  ChannelType,
  ButtonStyle,
  EmbedBuilder,
  MessageFlags,
  ButtonBuilder,
  ComponentType,
  ActionRowBuilder,
  PermissionFlagsBits,
} from "discord.js";

const CONFIRM_ID = "clean-confirm";
const CANCEL_ID = "clean-cancel";

const THREAD_DATE_FORMAT = "dd/MM/yyyy HH:mm";

type CleanResult = { deleted: number; skipped: number; thread?: ThreadChannel };

export class CleanCommand extends Command {
  public constructor(context: Command.LoaderContext, options: Command.Options) {
    super(context, {
      ...options,
      preconditions: ["GuildConfigured"],
    });
  }

  public override registerApplicationCommands(registry: ApplicationCommandRegistry): Awaitable<void> {
    registry.registerChatInputCommand((builder) =>
      builder
        .setName("clean")
        .setDescription(`Borra los últimos mensajes de un canal (predeterminado: ${String(CLEANUP_MESSAGE_COUNT)})`)
        .addChannelOption((option) =>
          option
            .setName("channel")
            .setDescription("El canal a limpiar")
            .setRequired(true)
            .addChannelTypes(ChannelType.GuildText),
        )
        .addIntegerOption((option) =>
          option
            .setName("amount")
            .setDescription(`Cuántos mensajes borrar (predeterminado: ${String(CLEANUP_MESSAGE_COUNT)})`)
            .setRequired(false)
            .setMinValue(1)
            .setMaxValue(CLEANUP_MAX_MESSAGES),
        )
        .addStringOption((option) =>
          option
            .setName("from")
            .setDescription("ID del mensaje por el que empezar (incluido), hacia los más nuevos. Si no, los últimos")
            .setRequired(false),
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),
    );
  }

  public override async chatInputRun(interaction: ChatInputCommandInteraction): Promise<void> {
    const { guildId, member } = requireGuildMember(interaction);
    const channel = interaction.options.getChannel("channel", true, [ChannelType.GuildText]);
    const amount = interaction.options.getInteger("amount", false) ?? CLEANUP_MESSAGE_COUNT;
    const fromId = interaction.options.getString("from", false)?.trim() ?? null;

    if (fromId !== null && !MESSAGE_ID_PATTERN.test(fromId)) {
      throw new CleanStartMessageNotFound(channel.id, fromId);
    }

    const bot = await interaction.guild?.members.fetchMe();

    if (!bot) {
      throw new BotPermissionsNotVerified();
    }

    if (!botCanCleanChannel(bot, channel)) {
      throw new BotCannotCleanChannel(channel.id);
    }

    const archive = await this.resolveArchiveChannel(guildId, bot);

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const fetched = await this.fetchTargets(channel, amount, fromId);
    const messages = fetched.sort((a, b) => a.createdTimestamp - b.createdTimestamp);

    if (messages.length === 0) {
      await interaction.editReply(formatMessage(CLEAN_NO_MESSAGES, { channel: `<#${channel.id}>` }));
      return;
    }

    if (archive) {
      const thread = await this.archiveMessages(archive, channel, member, messages);
      const result = await this.deleteMessages(channel, messages);

      await interaction.editReply(this.describeResult(channel, { ...result, thread }));
      return;
    }

    await this.cleanWithConfirmation(interaction, channel, messages);
  }

  private async fetchTargets(channel: TextChannel, amount: number, fromId: string | null): Promise<Message[]> {
    if (fromId === null) {
      const latest = await channel.messages.fetch({ limit: amount });
      return [...latest.values()];
    }

    const start = await channel.messages.fetch(fromId).catch(() => null);

    if (!start) {
      throw new CleanStartMessageNotFound(channel.id, fromId);
    }

    if (amount === 1) {
      return [start];
    }

    const newer = await channel.messages.fetch({ after: fromId, limit: amount - 1 });
    return [start, ...newer.values()];
  }

  private async resolveArchiveChannel(guildId: string, bot: GuildMember): Promise<TextChannel | undefined> {
    const stored = getGuildChannel(guildId, ARCHIVE_CHANNEL_PURPOSE);

    if (!stored) {
      return undefined;
    }

    const channel = await this.container.client.channels.fetch(stored.channelId).catch(() => null);

    if (channel?.type !== ChannelType.GuildText || !botCanArchiveInChannel(bot, channel)) {
      throw new ArchiveChannelUnavailable(guildId, stored.channelId);
    }

    return channel;
  }

  private async cleanWithConfirmation(
    interaction: ChatInputCommandInteraction,
    channel: TextChannel,
    messages: readonly Message[],
  ): Promise<void> {
    const embed = new EmbedBuilder()
      .setColor(EMBED_COLOR)
      .setTitle(CLEAN_CONFIRM_TITLE)
      .setDescription(
        formatMessage(CLEAN_CONFIRM_DESCRIPTION, {
          count: messages.length,
          channel: `<#${channel.id}>`,
          seconds: Math.round(CLEANUP_CONFIRM_TIMEOUT_MS / 1000),
        }),
      );

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(CONFIRM_ID)
        .setLabel(CLEAN_CONFIRM_BUTTON)
        .setEmoji("🧹")
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId(CANCEL_ID).setLabel(CLEAN_CANCEL_BUTTON).setStyle(ButtonStyle.Secondary),
    );

    const prompt = await interaction.editReply({ embeds: [embed], components: [row] });

    const button = await prompt
      .awaitMessageComponent({
        componentType: ComponentType.Button,
        time: CLEANUP_CONFIRM_TIMEOUT_MS,
        filter: (press) => press.user.id === interaction.user.id,
      })
      .catch(() => null);

    if (!button) {
      await interaction.editReply({ content: CLEAN_TIMED_OUT, embeds: [], components: [] });
      return;
    }

    if (button.customId !== CONFIRM_ID) {
      await button.update({ content: CLEAN_CANCELLED, embeds: [], components: [] });
      return;
    }

    await button.deferUpdate();

    const result = await this.deleteMessages(channel, messages);

    await interaction.editReply({ content: this.describeResult(channel, result), embeds: [], components: [] });
  }

  private async archiveMessages(
    archive: TextChannel,
    source: TextChannel,
    moderator: GuildMember,
    messages: readonly Message[],
  ): Promise<ThreadChannel> {
    const thread = await archive.threads.create({
      name: buildArchiveThreadName(source.name, nowInBotZone().toFormat(THREAD_DATE_FORMAT)),
      autoArchiveDuration: ARCHIVE_THREAD_AUTO_ARCHIVE,
      reason: `Limpieza de #${source.name} por ${moderator.user.tag}`,
    });

    const header = formatMessage(ARCHIVE_THREAD_HEADER, {
      channel: `<#${source.id}>`,
      moderator: `<@${moderator.id}>`,
      count: messages.length,
    });

    const lines = messages.map((message) => formatArchivedMessage(toArchivedMessage(message)));

    for (const content of [header, ...chunkArchiveLines(lines)]) {
      await thread.send({ content, allowedMentions: { parse: [] } });
    }

    logger.info(
      { guildId: source.guildId, channelId: source.id, threadId: thread.id, count: messages.length },
      "Archived messages before cleaning",
    );

    return thread;
  }

  private async deleteMessages(channel: TextChannel, messages: readonly Message[]): Promise<CleanResult> {
    const deletable = messages.filter((message) => message.bulkDeletable);

    await channel.bulkDelete(deletable);

    return { deleted: deletable.length, skipped: messages.length - deletable.length };
  }

  private describeResult(channel: TextChannel, result: CleanResult): string {
    let done = formatMessage(CLEAN_DONE, { channel: `<#${channel.id}>`, deleted: result.deleted });

    if (result.thread) {
      done = formatMessage(CLEAN_DONE_ARCHIVED, { done, thread: `<#${result.thread.id}>` });
    }

    if (result.skipped > 0) {
      done = formatMessage(CLEAN_DONE_SKIPPED, { done, skipped: result.skipped });
    }

    return done;
  }
}
