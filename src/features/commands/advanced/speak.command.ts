import { logger } from "@infrastructure/config/logger.config.js";
import { GuildMemberNotFound } from "@infrastructure/errors/discord.errors.js";
import {
  BotVoiceBusyError,
  UserNotInVoiceError,
  BotVoicePermissionError,
} from "@infrastructure/errors/domain.errors.js";

import { subtractPointsFromUser, sumPointsToUser } from "@core/services/user.service.js";

import { getUserErrorMessage } from "@shared/utils/error-messages.util.js";
import { playAudioInVoiceChannel } from "@shared/utils/voice-playback.util.js";
import { AUDIO_CHOICES, resolveAudioPath } from "@shared/utils/audio-files.util.js";
import { botCanSpeakInChannel } from "@shared/utils/verify-bot-permissions.util.js";

import type { ChatInputCommandInteraction, GuildMember } from "discord.js";
import type { ApplicationCommandRegistry, Awaitable } from "@sapphire/framework";

import { Command } from "@sapphire/framework";
import { getVoiceConnection } from "@discordjs/voice";

const SPEAK_POINTS_COST = 45;

export class SpeakCommand extends Command {
  public constructor(context: Command.LoaderContext, options: Command.Options) {
    super(context, {
      ...options,
      preconditions: ["GuildConfigured", "NotExcluded"],
    });
  }

  public override registerApplicationCommands(registry: ApplicationCommandRegistry): Awaitable<void> {
    registry.registerChatInputCommand((builder) =>
      builder
        .setName("speak")
        .setDescription("Me uno a tu canal de voz y digo una de mis frases (45pts).")
        .addStringOption((option) =>
          option
            .setName("audio")
            .setDescription("La frase que quieres que diga.")
            .setRequired(true)
            .addChoices(...AUDIO_CHOICES),
        ),
    );
  }

  public override async chatInputRun(interaction: ChatInputCommandInteraction): Promise<void> {
    const guildId = interaction.guildId!;
    const member = interaction.member as GuildMember | null;
    const audioFile = interaction.options.getString("audio", true);

    if (!member) {
      throw new GuildMemberNotFound(guildId);
    }

    const voiceChannel = member.voice.channel;
    if (!voiceChannel) {
      throw new UserNotInVoiceError(interaction.user.id);
    }

    if (getVoiceConnection(guildId)) {
      throw new BotVoiceBusyError(guildId);
    }

    const bot = await interaction.guild?.members.fetchMe();
    if (!botCanSpeakInChannel(bot, voiceChannel)) {
      throw new BotVoicePermissionError(voiceChannel.id);
    }

    const audioPath = resolveAudioPath(audioFile);
    if (!audioPath) {
      throw new Error(`Audio file not in catalog: ${audioFile}`);
    }

    const charged = subtractPointsFromUser(guildId, member.id, SPEAK_POINTS_COST);
    if (!charged) {
      await interaction.reply(
        `Huh?! ¿Quieres que diga algo? ¿Qué te parece esto?: "No tienes suficientes puntos para hacerme hablar, nyahaha!" Consigue **${SPEAK_POINTS_COST}** puntos y hablamos.`,
      );
      return;
    }

    await interaction.deferReply();

    try {
      await playAudioInVoiceChannel(voiceChannel, audioPath);
    } catch (error) {
      logger.error({ err: error, guildId, audioFile }, "Failed to play audio in voice channel");
      sumPointsToUser(guildId, member.id, SPEAK_POINTS_COST);
      await interaction.editReply(
        `${getUserErrorMessage("voice_connection_failed")} Te he devuelto los **${SPEAK_POINTS_COST}** puntos.`,
      );
      return;
    }

    const label = AUDIO_CHOICES.find((choice) => choice.value === audioFile)?.name ?? audioFile;

    await interaction.editReply(
      `Reproduciendo **${label}** en <#${voiceChannel.id}>. Te ha costado **${SPEAK_POINTS_COST}** puntos; te quedan **${charged.points}**.`,
    );
  }
}
