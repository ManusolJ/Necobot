import type { userStats } from "@infrastructure/database/schema/user.schema.js";

export type UserStats = typeof userStats.$inferSelect;
