import { db } from "@infrastructure/database/client.js";
import { guildUsers } from "@infrastructure/database/schema/user.schema.js";
import type { GuildUser, GuildUserInsert } from "@infrastructure/database/schema/user.schema.js";

import type { GuildUserCounterDeltas } from "@shared/types/counter-deltas.type.js";

import { and, eq, sql } from "drizzle-orm";

export function findGuildUser(guildId: string, userId: string): GuildUser | undefined {
  return db
    .select()
    .from(guildUsers)
    .where(and(eq(guildUsers.guildId, guildId), eq(guildUsers.userId, userId)))
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
  lastActiveAt?: Date;
}): GuildUser | undefined {
  const { guildId, userId, deltas, lastActiveAt } = input;

  const initialValues: GuildUserInsert = {
    guildId,
    userId,
    ...deltas,
    ...(lastActiveAt ? { lastActiveAt } : {}),
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

  if (lastActiveAt) {
    setClause.lastActiveAt = lastActiveAt;
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
