import { logger } from "@infrastructure/config/logger.config.js";

import type { VoiceBasedChannel } from "discord.js";
import type { VoiceConnection } from "@discordjs/voice";

import {
  entersState,
  createAudioPlayer,
  joinVoiceChannel,
  AudioPlayerStatus,
  createAudioResource,
  VoiceConnectionStatus,
} from "@discordjs/voice";

const JOIN_TIMEOUT_MS = 10_000;
const PLAY_START_TIMEOUT_MS = 10_000;

export async function playAudioInVoiceChannel(channel: VoiceBasedChannel, filePath: string): Promise<void> {
  const connection = joinVoiceChannel({
    channelId: channel.id,
    guildId: channel.guild.id,
    adapterCreator: channel.guild.voiceAdapterCreator,
    selfDeaf: true,
  });

  try {
    await entersState(connection, VoiceConnectionStatus.Ready, JOIN_TIMEOUT_MS);

    const player = createAudioPlayer();
    const resource = createAudioResource(filePath);

    connection.subscribe(player);
    player.play(resource);

    player.on(AudioPlayerStatus.Idle, () => {
      destroySafely(connection);
    });

    player.on("error", (error) => {
      logger.error({ err: error, filePath }, "Voice playback error");
      destroySafely(connection);
    });

    connection.on(VoiceConnectionStatus.Disconnected, () => {
      destroySafely(connection);
    });

    await entersState(player, AudioPlayerStatus.Playing, PLAY_START_TIMEOUT_MS);
  } catch (error) {
    destroySafely(connection);
    throw error;
  }
}

function destroySafely(connection: VoiceConnection): void {
  if (connection.state.status !== VoiceConnectionStatus.Destroyed) {
    connection.destroy();
  }
}
