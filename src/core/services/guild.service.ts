import { GuildChannelPersistError, GuildSettingsPersistError } from "@infrastructure/errors/domain.errors.js";

import {
  consumeGuildMine,
  findGuildSettings,
  incrementGuildMines,
  upsertGuildChannel,
  upsertGuildSettings,
} from "@core/repositories/guild.repository.js";

import type { GuildChannel } from "@shared/types/guild-channel.type.js";
import type { GuildSettings } from "@shared/types/guild-settings.type.js";
import type { GuildChannelInsert } from "@shared/types/guild-channel-insert.type.js";
import type { GuildSettingsInsert } from "@shared/types/guild-settings-insert.type.js";

export function getGuildSettings(guildId: string): GuildSettings | undefined {
  return findGuildSettings(guildId);
}

export function completeGuildSetup(input: GuildSettingsInsert): GuildSettings {
  const updates: Partial<GuildSettingsInsert> = {};

  if (input.mainChannelId !== undefined) {
    updates.mainChannelId = input.mainChannelId;
  }

  if (input.prefix !== undefined) {
    updates.prefix = input.prefix;
  }

  if (input.begRetryRoleId !== undefined) {
    updates.begRetryRoleId = input.begRetryRoleId;
  }

  const result = upsertGuildSettings({ ...input, setupCompletedAt: new Date() }, updates);

  if (!result) {
    throw new GuildSettingsPersistError(input.guildId);
  }

  return result;
}

export function registerGuildChannel(input: GuildChannelInsert): GuildChannel {
  const result = upsertGuildChannel(input);

  if (!result) {
    throw new GuildChannelPersistError(input.guildId, input.purpose);
  }

  return result;
}

export function armMines(guildId: string, count: number): GuildSettings {
  const result = incrementGuildMines(guildId, count);

  if (!result) {
    throw new GuildSettingsPersistError(guildId);
  }

  return result;
}

export function tryConsumeMine(guildId: string): boolean {
  return consumeGuildMine(guildId) !== undefined;
}

export function restoreMine(guildId: string): void {
  incrementGuildMines(guildId, 1);
}
