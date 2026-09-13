import type { guildUsers } from "@infrastructure/database/schema/user.schema.js";

export type DailyStampColumn = typeof guildUsers.lastDrinkedAt | typeof guildUsers.lastBeggedAt;
