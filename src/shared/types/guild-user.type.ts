import type { guildUsers } from "@infrastructure/database/schema/user.schema.js";

export type GuildUser = typeof guildUsers.$inferSelect;
