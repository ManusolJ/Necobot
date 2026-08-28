import type { guildSettings } from "@infrastructure/database/schema/guild.schema.js";

export type GuildSettingsInsert = typeof guildSettings.$inferInsert;
