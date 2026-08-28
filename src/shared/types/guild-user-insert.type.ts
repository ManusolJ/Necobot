import type { guildUsers } from "@infrastructure/database/schema/user.schema.js";

export type GuildUserInsert = typeof guildUsers.$inferInsert;
