import type { gameSessions } from "@infrastructure/database/schema/game-session.schema.js";

export type GameSession = typeof gameSessions.$inferSelect;
