import { db } from "@infrastructure/database/client.js";
import { guildUsers } from "@infrastructure/database/schema/user.schema.js";

import type { Birthday } from "@shared/types/birthday.type.js";
import type { GuildUser } from "@shared/types/guild-user.type.js";
import type { GuildUserInsert } from "@shared/types/guild-user-insert.type.js";
import type { GuildUserCounterDeltas } from "@shared/types/counter-deltas.type.js";

import type { SQL } from "drizzle-orm";

import { and, eq, gt, gte, isNull, lt, ne, or, sql } from "drizzle-orm";
import { DailyStampColumn } from "@shared/types/daily-stamp-column.type.js";

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

  if (deltas.timesSlapped !== undefined) {
    setClause.timesSlapped = sql`${guildUsers.timesSlapped} + ${deltas.timesSlapped}`;
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

export function setGuildUserUwufication(
  guildId: string,
  userId: string,
  numberOfMessages: number,
): GuildUser | undefined {
  const updated = db
    .insert(guildUsers)
    .values({ guildId, userId, isUwufied: numberOfMessages })
    .onConflictDoUpdate({
      target: [guildUsers.guildId, guildUsers.userId],
      set: { isUwufied: numberOfMessages },
    })
    .returning();

  return updated.get();
}

export function consumeGuildUserUwufication(guildId: string, userId: string): GuildUser | undefined {
  return db
    .update(guildUsers)
    .set({ isUwufied: sql`${guildUsers.isUwufied} - 1` })
    .where(and(eq(guildUsers.guildId, guildId), eq(guildUsers.userId, userId), gt(guildUsers.isUwufied, 0)))
    .returning()
    .get();
}

export function restoreGuildUserUwufication(guildId: string, userId: string): GuildUser | undefined {
  return db
    .update(guildUsers)
    .set({ isUwufied: sql`${guildUsers.isUwufied} + 1` })
    .where(and(eq(guildUsers.guildId, guildId), eq(guildUsers.userId, userId)))
    .returning()
    .get();
}

export function setGuildUserBirthday(guildId: string, userId: string, birthday: Birthday): GuildUser | undefined {
  const updated = db
    .insert(guildUsers)
    .values({ guildId, userId, birthdayDay: birthday.day, birthdayMonth: birthday.month })
    .onConflictDoUpdate({
      target: [guildUsers.guildId, guildUsers.userId],
      set: { birthdayDay: birthday.day, birthdayMonth: birthday.month },
    })
    .returning();

  return updated.get();
}

export function findGuildUsersByBirthday(keys: readonly Birthday[]): GuildUser[] {
  if (keys.length === 0) {
    return [];
  }

  const matches = keys.map((key) => and(eq(guildUsers.birthdayDay, key.day), eq(guildUsers.birthdayMonth, key.month)));

  return db
    .select()
    .from(guildUsers)
    .where(and(or(...matches), isNull(guildUsers.excludedAt)))
    .all();
}

export function claimGuildUserBirthdayGift(
  guildId: string,
  userId: string,
  year: number,
  points: number,
): GuildUser | undefined {
  return db
    .update(guildUsers)
    .set({
      points: sql`${guildUsers.points} + ${points}`,
      historicalPoints: sql`${guildUsers.historicalPoints} + ${points}`,
      birthdayCheeredYear: year,
    })
    .where(
      and(
        eq(guildUsers.guildId, guildId),
        eq(guildUsers.userId, userId),
        or(isNull(guildUsers.birthdayCheeredYear), ne(guildUsers.birthdayCheeredYear, year)),
      ),
    )
    .returning()
    .get();
}

/** Same guard as the gift, for the advance warning. The year is the birthday's, not today's. */
export function claimGuildUserBirthdayWarning(guildId: string, userId: string, year: number): GuildUser | undefined {
  return db
    .update(guildUsers)
    .set({ birthdayWarnedYear: year })
    .where(
      and(
        eq(guildUsers.guildId, guildId),
        eq(guildUsers.userId, userId),
        or(isNull(guildUsers.birthdayWarnedYear), ne(guildUsers.birthdayWarnedYear, year)),
      ),
    )
    .returning()
    .get();
}

function notStampedSince(column: DailyStampColumn, since: Date): SQL {
  return sql`(${isNull(column)} OR ${lt(column, since)})`;
}

export function claimGuildUserDailyDrink(guildId: string, userId: string, startOfDay: Date): GuildUser | undefined {
  const now = new Date();

  return db
    .insert(guildUsers)
    .values({ guildId, userId, lastDrinkedAt: now })
    .onConflictDoUpdate({
      target: [guildUsers.guildId, guildUsers.userId],
      set: { lastDrinkedAt: now },
      setWhere: notStampedSince(guildUsers.lastDrinkedAt, startOfDay),
    })
    .returning()
    .get();
}

export function setGuildUserLastDrinkedAt(guildId: string, userId: string, at: Date | null): GuildUser | undefined {
  return db
    .update(guildUsers)
    .set({ lastDrinkedAt: at })
    .where(and(eq(guildUsers.guildId, guildId), eq(guildUsers.userId, userId)))
    .returning()
    .get();
}

export function claimGuildUserDailyBeg(guildId: string, userId: string, startOfDay: Date): GuildUser | undefined {
  const now = new Date();

  return db
    .insert(guildUsers)
    .values({ guildId, userId, lastBeggedAt: now })
    .onConflictDoUpdate({
      target: [guildUsers.guildId, guildUsers.userId],
      set: { lastBeggedAt: now },
      setWhere: notStampedSince(guildUsers.lastBeggedAt, startOfDay),
    })
    .returning()
    .get();
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
