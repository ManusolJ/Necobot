import type { GuildUser, GuildUserInsert } from "@infrastructure/database/schema/user.schema.js";

import { db } from "@infrastructure/database/client.js";
import { guildUsers } from "@infrastructure/database/schema/user.schema.js";

import type { GuildUserCounterDeltas } from "@shared/types/counter-deltas.type.js";

import { and, eq, gte, sql } from "drizzle-orm";

export function findGuildUser(guildId: string, userId: string): GuildUser | undefined {
  return db
    .select()
    .from(guildUsers)
    .where(and(eq(guildUsers.guildId, guildId), eq(guildUsers.userId, userId)))
    .get();
}

export function deductGuildUserPoints(guildId: string, userId: string, amount: number): GuildUser | undefined {
  return db
    .update(guildUsers)
    .set({ points: sql`${guildUsers.points} - ${amount}` })
    .where(and(eq(guildUsers.guildId, guildId), eq(guildUsers.userId, userId), gte(guildUsers.points, amount)))
    .returning()
    .get();
}

export function upsertGuildUser(values: GuildUserInsert): GuildUser | undefined {
  const updated = db
    .insert(guildUsers)
    .values(values)
    .onConflictDoUpdate({
      target: [guildUsers.guildId, guildUsers.userId],
      set: values,
    })
    .returning();

  return updated.get();
}

export function applyGuildUserDelta(input: {
  guildId: string;
  userId: string;
  deltas: GuildUserCounterDeltas;
}): GuildUser | undefined {
  const { guildId, userId, deltas } = input;

  const initialValues: GuildUserInsert = {
    guildId,
    userId,
    ...deltas,
  };

  const setClause: Record<string, unknown> = {};

  if (deltas.points !== undefined) {
    setClause.points = sql`${guildUsers.points} + ${deltas.points}`;
  }

  if (deltas.historicalPoints !== undefined) {
    setClause.historicalPoints = sql`${guildUsers.historicalPoints} + ${deltas.historicalPoints}`;
  }

  if (deltas.triviaWins !== undefined) {
    setClause.triviaWins = sql`${guildUsers.triviaWins} + ${deltas.triviaWins}`;
  }

  if (deltas.timesBegged !== undefined) {
    setClause.timesBegged = sql`${guildUsers.timesBegged} + ${deltas.timesBegged}`;
  }

  if (deltas.activatedMines !== undefined) {
    setClause.activatedMines = sql`${guildUsers.activatedMines} + ${deltas.activatedMines}`;
  }

  const updated = db
    .insert(guildUsers)
    .values(initialValues)
    .onConflictDoUpdate({
      target: [guildUsers.guildId, guildUsers.userId],
      set: setClause,
    })
    .returning();

  return updated.get();
}

export function setGuildUserExclusion(guildId: string, userId: string, excludedAt: Date | null): GuildUser | undefined {
  const updated = db
    .insert(guildUsers)
    .values({ guildId, userId, excludedAt })
    .onConflictDoUpdate({
      target: [guildUsers.guildId, guildUsers.userId],
      set: { excludedAt },
    })
    .returning();

  return updated.get();
}

export function recordBegAttempt(input: {
  guildId: string;
  userId: string;
  pointsEarned: number;
}): GuildUser | undefined {
  const { guildId, userId, pointsEarned } = input;
  const now = new Date();

  const initialValues: GuildUserInsert = {
    guildId,
    userId,
    points: pointsEarned,
    historicalPoints: pointsEarned,
    timesBegged: 1,
    lastBeggedAt: now,
  };

  const updated = db
    .insert(guildUsers)
    .values(initialValues)
    .onConflictDoUpdate({
      target: [guildUsers.guildId, guildUsers.userId],
      set: {
        points: sql`${guildUsers.points} + ${pointsEarned}`,
        historicalPoints: sql`${guildUsers.historicalPoints} + ${pointsEarned}`,
        timesBegged: sql`${guildUsers.timesBegged} + 1`,
        lastBeggedAt: now,
      },
    })
    .returning();

  return updated.get();
}
