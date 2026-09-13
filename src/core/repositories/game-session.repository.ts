import { db } from "@infrastructure/database/client.js";
import { gameSessions } from "@infrastructure/database/schema/game-session.schema.js";

import type { GameSession } from "@shared/types/game-session.type.js";
import type { GameSessionInsert } from "@shared/types/game-session-insert.type.js";

import { and, eq, isNull } from "drizzle-orm";

export function insertGameSession(session: GameSessionInsert): GameSession | undefined {
  return db.insert(gameSessions).values(session).returning().get();
}

export function findGameSession(id: number): GameSession | undefined {
  return db.select().from(gameSessions).where(eq(gameSessions.id, id)).get();
}

export function findOpenGameSessions(): GameSession[] {
  return db.select().from(gameSessions).where(isNull(gameSessions.completedAt)).all();
}

export function setGameSessionChallengedStake(id: number, stake: number): GameSession | undefined {
  return db
    .update(gameSessions)
    .set({ challengedStake: stake })
    .where(and(eq(gameSessions.id, id), isNull(gameSessions.completedAt)))
    .returning()
    .get();
}

export function setGameSessionMessage(id: number, channelId: string, messageId: string): GameSession | undefined {
  return db
    .update(gameSessions)
    .set({ channelId, messageId })
    .where(and(eq(gameSessions.id, id), isNull(gameSessions.completedAt)))
    .returning()
    .get();
}

export function completeGameSession(id: number, completedAt: Date): GameSession | undefined {
  return db
    .update(gameSessions)
    .set({ completedAt })
    .where(and(eq(gameSessions.id, id), isNull(gameSessions.completedAt)))
    .returning()
    .get();
}
