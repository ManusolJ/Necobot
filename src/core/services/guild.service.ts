import { GuildChannelPersistError, GuildSettingsPersistError } from "@infrastructure/errors/domain.errors.js";

import {
  findGuildState,
  consumeGuildMine,
  findGuildChannel,
  findGuildSettings,
  incrementGuildMines,
  upsertGuildChannel,
  upsertGuildSettings,
  findChannelsByPurpose,
} from "@core/repositories/guild.repository.js";

import type { GuildState } from "@shared/types/guild-state.type.js";
import type { GuildChannel } from "@shared/types/guild-channel.type.js";
import type { GuildSettings } from "@shared/types/guild-settings.type.js";
import type { ChannelPurpose } from "@shared/types/channel-purpose.type.js";
import type { GuildChannelInsert } from "@shared/types/guild-channel-insert.type.js";
import type { GuildSettingsInsert } from "@shared/types/guild-settings-insert.type.js";

export async function getGuildSettings(guildId: string): Promise<GuildSettings | undefined> {
  return findGuildSettings(guildId);
}

export async function getGuildState(guildId: string): Promise<GuildState | undefined> {
  return findGuildState(guildId);
}

export async function completeGuildSetup(input: GuildSettingsInsert): Promise<GuildSettings> {
  const updates: Partial<GuildSettingsInsert> = {};

  if (input.mainChannelId !== undefined) {
    updates.mainChannelId = input.mainChannelId;
  }

  if (input.specialRoleId !== undefined) {
    updates.specialRoleId = input.specialRoleId;
  }

  const result = await upsertGuildSettings({ ...input, setupCompletedAt: new Date() }, updates);

  if (!result) {
    throw new GuildSettingsPersistError(input.guildId);
  }

  return result;
}

export async function registerGuildChannel(input: GuildChannelInsert): Promise<GuildChannel> {
  const result = await upsertGuildChannel(input);

  if (!result) {
    throw new GuildChannelPersistError(input.guildId, input.purpose);
  }

  return result;
}

export async function armMines(guildId: string, count: number): Promise<GuildState> {
  const result = await incrementGuildMines(guildId, count);

  if (!result) {
    throw new GuildSettingsPersistError(guildId);
  }

  return result;
}

export async function tryConsumeMine(guildId: string): Promise<boolean> {
  return (await consumeGuildMine(guildId)) !== undefined;
}

export async function restoreMine(guildId: string): Promise<void> {
  await incrementGuildMines(guildId, 1);
}

export async function getChannelsByPurpose(purpose: ChannelPurpose): Promise<GuildChannel[]> {
  return findChannelsByPurpose(purpose);
}

export async function getGuildChannel(guildId: string, purpose: ChannelPurpose): Promise<GuildChannel | undefined> {
  return findGuildChannel(guildId, purpose);
}
