import type {
  GuildChannel,
  GuildChannelInsert,
  GuildSettings,
  GuildSettingsInsert,
} from "@infrastructure/database/schema/guild.schema.js";

import { GuildChannelPersistError, GuildSettingsPersistError } from "@infrastructure/errors/domain.errors.js";

import {
  consumeGuildMine,
  findGuildSettings,
  incrementGuildMines,
  upsertGuildChannel,
  upsertGuildSettings,
} from "@core/repositories/guild.repository.js";

export function getGuildSettings(guildId: string): GuildSettings | undefined {
  return findGuildSettings(guildId);
}

export function completeGuildSetup(input: GuildSettingsInsert): GuildSettings {
  const settings: GuildSettingsInsert = {
    ...input,
    prefix: input.prefix ?? "!",
    setupCompletedAt: new Date(),
  };

  const result = upsertGuildSettings(settings);

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
