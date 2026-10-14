import type { userData } from "@infrastructure/database/schema/user.schema.js";

export type UserData = typeof userData.$inferSelect;
