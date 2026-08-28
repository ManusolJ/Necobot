import type { guildChannels } from "@infrastructure/database/schema/guild.schema.js";

export type GuildChannel = typeof guildChannels.$inferSelect;
