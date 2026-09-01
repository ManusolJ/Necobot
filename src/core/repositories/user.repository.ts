import { db } from "@infrastructure/database/client.js";
import { guildUsers } from "@infrastructure/database/schema/user.schema.js";

import type { GuildUser } from "@shared/types/guild-user.type.js";
import type { GuildUserInsert } from "@shared/types/guild-user-insert.type.js";
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
    ...(deltas.points !== undefined ? { points: Math.max(0, deltas.points) } : {}),
    ...(deltas.historicalPoints !== undefined ? { historicalPoints: Math.max(0, deltas.historicalPoints) } : {}),
  };

  const setClause: Record<string, unknown> = {};

  if (deltas.points !== undefined) {
    setClause.points = sql`${guildUsers.points} + ${deltas.points}`;
  }

  if (deltas.historicalPoints !== undefined) {
    setClause.historicalPoints = sql`${guildUsers.historicalPoints} + ${deltas.historicalPoints}`;
  }

  if (deltas.timesBegged !== undefined) {
    setClause.timesBegged = sql`${guildUsers.timesBegged} + ${deltas.timesBegged}`;
  }

  if (deltas.activatedMines !== undefined) {
    setClause.activatedMines = sql`${guildUsers.activatedMines} + ${deltas.activatedMines}`;
  }

  if (deltas.monstersDrinked !== undefined) {
    setClause.monstersDrinked = sql`${guildUsers.monstersDrinked} + ${deltas.monstersDrinked}`;
  }

  if (deltas.scannedThings !== undefined) {
    setClause.scannedThings = sql`${guildUsers.scannedThings} + ${deltas.scannedThings}`;
  }

  if (Object.keys(setClause).length === 0) {
    return (
      db.insert(guildUsers).values(initialValues).onConflictDoNothing().returning().get() ??
      findGuildUser(guildId, userId)
    );
  }

  return db
    .insert(guildUsers)
    .values(initialValues)
    .onConflictDoUpdate({
      target: [guildUsers.guildId, guildUsers.userId],
      set: setClause,
    })
    .returning()
    .get();
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

export function recordMonsterDrink(input: {
  guildId: string;
  userId: string;
  pointsDelta: number;
}): GuildUser | undefined {
  const { guildId, userId, pointsDelta } = input;
  const now = new Date();
  const historicalGain = Math.max(0, pointsDelta);

  const initialValues: GuildUserInsert = {
    guildId,
    userId,
    points: Math.max(0, pointsDelta),
    historicalPoints: historicalGain,
    monstersDrinked: 1,
    lastDrinkedAt: now,
  };

  const updated = db
    .insert(guildUsers)
    .values(initialValues)
    .onConflictDoUpdate({
      target: [guildUsers.guildId, guildUsers.userId],
      set: {
        points: sql`${guildUsers.points} + ${pointsDelta}`,
        historicalPoints: sql`${guildUsers.historicalPoints} + ${historicalGain}`,
        monstersDrinked: sql`${guildUsers.monstersDrinked} + 1`,
        lastDrinkedAt: now,
      },
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
