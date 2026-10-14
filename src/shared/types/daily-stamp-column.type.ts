import type { userState } from "@infrastructure/database/schema/user.schema.js";

export type DailyStampColumn = typeof userState.lastDrinkedAt | typeof userState.lastBeggedAt;
