import { GuildSettingsPersistError } from "@infrastructure/errors/domain.errors.js";

import type { GuildSettings, GuildSettingsInsert } from "@infrastructure/database/schema/guild.schema.js";

import { findGuildSettings, upsertGuildSettings } from "@core/repositories/guild.repository.js";

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
