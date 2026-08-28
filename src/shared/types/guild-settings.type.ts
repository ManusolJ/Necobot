import type { guildSettings } from "@infrastructure/database/schema/guild.schema.js";

export type GuildSettings = typeof guildSettings.$inferSelect;
