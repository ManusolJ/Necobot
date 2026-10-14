import { db } from "@infrastructure/database/client.js";
import { gameSessions } from "@infrastructure/database/schema/game-session.schema.js";

import type { DbExecutor } from "@shared/types/db-executor.type.js";
import type { GameSession } from "@shared/types/game-session.type.js";
import type { GameSessionInsert } from "@shared/types/game-session-insert.type.js";

import { and, eq, isNull } from "drizzle-orm";

export async function insertGameSession(
  session: GameSessionInsert,
  executor: DbExecutor = db,
): Promise<GameSession | undefined> {
  const [row] = await executor.insert(gameSessions).values(session).returning();

  return row;
}

export async function findGameSession(id: number, executor: DbExecutor = db): Promise<GameSession | undefined> {
  const [row] = await executor.select().from(gameSessions).where(eq(gameSessions.id, id));

  return row;
}

export async function findGameSessionForUpdate(id: number, executor: DbExecutor): Promise<GameSession | undefined> {
  const [row] = await executor.select().from(gameSessions).where(eq(gameSessions.id, id)).for("update");

  return row;
}

export async function findOpenGameSessions(executor: DbExecutor = db): Promise<GameSession[]> {
  return executor.select().from(gameSessions).where(isNull(gameSessions.completedAt));
}

export async function setGameSessionChallengedStake(
  id: number,
  stake: number,
  executor: DbExecutor = db,
): Promise<GameSession | undefined> {
  const [row] = await executor
    .update(gameSessions)
    .set({ challengedStake: stake })
    .where(and(eq(gameSessions.id, id), isNull(gameSessions.completedAt)))
    .returning();

  return row;
}

export async function setGameSessionMessage(
  id: number,
  channelId: string,
  messageId: string,
  executor: DbExecutor = db,
): Promise<GameSession | undefined> {
  const [row] = await executor
    .update(gameSessions)
    .set({ channelId, messageId })
    .where(and(eq(gameSessions.id, id), isNull(gameSessions.completedAt)))
    .returning();

  return row;
}

export async function completeGameSession(
  id: number,
  completedAt: Date,
  executor: DbExecutor = db,
): Promise<GameSession | undefined> {
  const [row] = await executor
    .update(gameSessions)
    .set({ completedAt })
    .where(and(eq(gameSessions.id, id), isNull(gameSessions.completedAt)))
    .returning();

  return row;
}
