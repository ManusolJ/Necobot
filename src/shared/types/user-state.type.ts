import type { userState } from "@infrastructure/database/schema/user.schema.js";

export type UserState = typeof userState.$inferSelect;
