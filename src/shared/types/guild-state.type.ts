import type { guildState } from "@infrastructure/database/schema/guild.schema.js";

export type GuildState = typeof guildState.$inferSelect;
