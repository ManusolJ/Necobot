import type { guildChannels } from "@infrastructure/database/schema/guild.schema.js";

export type GuildChannelInsert = typeof guildChannels.$inferInsert;
