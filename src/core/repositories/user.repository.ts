import { db } from "@infrastructure/database/client.js";
import { userData, userState, userStats } from "@infrastructure/database/schema/user.schema.js";

import type { Birthday } from "@shared/types/birthday.type.js";
import type { GuildUser } from "@shared/types/guild-user.type.js";
import type { DbExecutor } from "@shared/types/db-executor.type.js";
import type { DailyStampColumn } from "@shared/types/daily-stamp-column.type.js";
import type { GuildUserCounterDeltas } from "@shared/types/counter-deltas.type.js";

import type { SQL } from "drizzle-orm";
import type { PgTable, PgUpdateSetSource } from "drizzle-orm/pg-core";

import { and, eq, gt, gte, isNull, lt, ne, or, sql } from "drizzle-orm";

type UserTable = typeof userData | typeof userState | typeof userStats;

type RowWrite<TTable extends UserTable> = {
  values: Omit<TTable["$inferInsert"], "guildId" | "userId">;
  set?: PgUpdateSetSource<TTable>;
  setWhere?: SQL;
};

type GuildUserWrite = {
  data?: RowWrite<typeof userData> | undefined;
  state?: RowWrite<typeof userState> | undefined;
  stats?: RowWrite<typeof userStats> | undefined;
};

const STATS_COUNTERS = ["timesBegged", "timesSlapped", "scannedThings", "activatedMines", "monstersDrinked"] as const;

const GUILD_USER_COLUMNS = {
  guildId: userData.guildId,
  userId: userData.userId,
  birthdayDay: userData.birthdayDay,
  birthdayMonth: userData.birthdayMonth,
  birthdayCheeredYear: userData.birthdayCheeredYear,
  birthdayWarnedYear: userData.birthdayWarnedYear,
  excludedAt: userData.excludedAt,
  points: userState.points,
  isUwufied: userState.isUwufied,
  lastBeggedAt: userState.lastBeggedAt,
  lastDrinkedAt: userState.lastDrinkedAt,
  historicalPoints: userStats.historicalPoints,
  timesBegged: userStats.timesBegged,
  timesSlapped: userStats.timesSlapped,
  scannedThings: userStats.scannedThings,
  activatedMines: userStats.activatedMines,
  monstersDrinked: userStats.monstersDrinked,
};

function memberOf(table: UserTable, guildId: string, userId: string): SQL | undefined {
  return and(eq(table.guildId, guildId), eq(table.userId, userId));
}

function selectGuildUsers(executor: DbExecutor) {
  return executor
    .select(GUILD_USER_COLUMNS)
    .from(userData)
    .innerJoin(userState, and(eq(userState.guildId, userData.guildId), eq(userState.userId, userData.userId)))
    .innerJoin(userStats, and(eq(userStats.guildId, userData.guildId), eq(userStats.userId, userData.userId)));
}

async function upsertRow<TTable extends UserTable>(
  executor: DbExecutor,
  table: TTable,
  guildId: string,
  userId: string,
  write: RowWrite<TTable> | undefined,
): Promise<boolean> {
  const target: PgTable = table;

  if (!write) {
    await executor.insert(target).values({ guildId, userId }).onConflictDoNothing();

    return true;
  }

  const set: Record<string, unknown> = write.set ?? write.values;

  const written = await executor
    .insert(target)
    .values({ guildId, userId, ...write.values })
    .onConflictDoUpdate({
      target: [table.guildId, table.userId],
      set,
      ...(write.setWhere ? { setWhere: write.setWhere } : {}),
    })
    .returning({ userId: table.userId });

  return written.length > 0;
}

async function writeGuildUser(
  guildId: string,
  userId: string,
  write: GuildUserWrite,
  executor: DbExecutor,
): Promise<GuildUser | undefined> {
  return executor.transaction(async (tx) => {
    const data = await upsertRow(tx, userData, guildId, userId, write.data);
    const state = await upsertRow(tx, userState, guildId, userId, write.state);
    const stats = await upsertRow(tx, userStats, guildId, userId, write.stats);

    if (!data || !state || !stats) {
      return undefined;
    }

    return findGuildUser(guildId, userId, tx);
  });
}

export async function findGuildUser(
  guildId: string,
  userId: string,
  executor: DbExecutor = db,
): Promise<GuildUser | undefined> {
  const [row] = await selectGuildUsers(executor).where(memberOf(userData, guildId, userId));

  return row;
}

export async function deductGuildUserPoints(
  guildId: string,
  userId: string,
  amount: number,
  executor: DbExecutor = db,
): Promise<GuildUser | undefined> {
  const [charged] = await executor
    .update(userState)
    .set({ points: sql`${userState.points} - ${amount}` })
    .where(and(memberOf(userState, guildId, userId), gte(userState.points, amount)))
    .returning({ userId: userState.userId });

  return charged ? findGuildUser(guildId, userId, executor) : undefined;
}

export async function applyGuildUserDelta(
  input: {
    guildId: string;
    userId: string;
    deltas: GuildUserCounterDeltas;
  },
  executor: DbExecutor = db,
): Promise<GuildUser | undefined> {
  const { guildId, userId, deltas } = input;

  const state: RowWrite<typeof userState> | undefined =
    deltas.points === undefined
      ? undefined
      : {
          values: { points: Math.max(0, deltas.points) },
          set: { points: sql`${userState.points} + ${deltas.points}` },
        };

  const statsValues: RowWrite<typeof userStats>["values"] = {};
  const statsSet: PgUpdateSetSource<typeof userStats> = {};

  if (deltas.historicalPoints !== undefined) {
    statsValues.historicalPoints = Math.max(0, deltas.historicalPoints);
    statsSet.historicalPoints = sql`${userStats.historicalPoints} + ${deltas.historicalPoints}`;
  }

  for (const counter of STATS_COUNTERS) {
    const delta = deltas[counter];

    if (delta !== undefined) {
      statsValues[counter] = delta;
      statsSet[counter] = sql`${userStats[counter]} + ${delta}`;
    }
  }

  const stats = Object.keys(statsSet).length === 0 ? undefined : { values: statsValues, set: statsSet };

  return writeGuildUser(guildId, userId, { state, stats }, executor);
}

export async function setGuildUserExclusion(
  guildId: string,
  userId: string,
  excludedAt: Date | null,
  executor: DbExecutor = db,
): Promise<GuildUser | undefined> {
  return writeGuildUser(guildId, userId, { data: { values: { excludedAt } } }, executor);
}

export async function setGuildUserUwufication(
  guildId: string,
  userId: string,
  numberOfMessages: number,
  executor: DbExecutor = db,
): Promise<GuildUser | undefined> {
  return writeGuildUser(guildId, userId, { state: { values: { isUwufied: numberOfMessages } } }, executor);
}

export async function consumeGuildUserUwufication(
  guildId: string,
  userId: string,
  executor: DbExecutor = db,
): Promise<GuildUser | undefined> {
  const [consumed] = await executor
    .update(userState)
    .set({ isUwufied: sql`${userState.isUwufied} - 1` })
    .where(and(memberOf(userState, guildId, userId), gt(userState.isUwufied, 0)))
    .returning({ userId: userState.userId });

  return consumed ? findGuildUser(guildId, userId, executor) : undefined;
}

export async function restoreGuildUserUwufication(
  guildId: string,
  userId: string,
  executor: DbExecutor = db,
): Promise<GuildUser | undefined> {
  const [restored] = await executor
    .update(userState)
    .set({ isUwufied: sql`${userState.isUwufied} + 1` })
    .where(memberOf(userState, guildId, userId))
    .returning({ userId: userState.userId });

  return restored ? findGuildUser(guildId, userId, executor) : undefined;
}

export async function setGuildUserBirthday(
  guildId: string,
  userId: string,
  birthday: Birthday,
  executor: DbExecutor = db,
): Promise<GuildUser | undefined> {
  return writeGuildUser(
    guildId,
    userId,
    { data: { values: { birthdayDay: birthday.day, birthdayMonth: birthday.month } } },
    executor,
  );
}

export async function findGuildUsersByBirthday(
  keys: readonly Birthday[],
  executor: DbExecutor = db,
): Promise<GuildUser[]> {
  if (keys.length === 0) {
    return [];
  }

  const matches = keys.map((key) => and(eq(userData.birthdayDay, key.day), eq(userData.birthdayMonth, key.month)));

  return selectGuildUsers(executor).where(and(or(...matches), isNull(userData.excludedAt)));
}

export async function claimGuildUserBirthdayGift(
  guildId: string,
  userId: string,
  year: number,
  points: number,
  executor: DbExecutor = db,
): Promise<GuildUser | undefined> {
  return executor.transaction(async (tx) => {
    const [claimed] = await tx
      .update(userData)
      .set({ birthdayCheeredYear: year })
      .where(
        and(
          memberOf(userData, guildId, userId),
          or(isNull(userData.birthdayCheeredYear), ne(userData.birthdayCheeredYear, year)),
        ),
      )
      .returning({ userId: userData.userId });

    if (!claimed) {
      return undefined;
    }

    await tx
      .update(userState)
      .set({ points: sql`${userState.points} + ${points}` })
      .where(memberOf(userState, guildId, userId));

    await tx
      .update(userStats)
      .set({ historicalPoints: sql`${userStats.historicalPoints} + ${points}` })
      .where(memberOf(userStats, guildId, userId));

    return findGuildUser(guildId, userId, tx);
  });
}

export async function claimGuildUserBirthdayWarning(
  guildId: string,
  userId: string,
  year: number,
  executor: DbExecutor = db,
): Promise<GuildUser | undefined> {
  const [claimed] = await executor
    .update(userData)
    .set({ birthdayWarnedYear: year })
    .where(
      and(
        memberOf(userData, guildId, userId),
        or(isNull(userData.birthdayWarnedYear), ne(userData.birthdayWarnedYear, year)),
      ),
    )
    .returning({ userId: userData.userId });

  return claimed ? findGuildUser(guildId, userId, executor) : undefined;
}

function notStampedSince(column: DailyStampColumn, since: Date): SQL {
  return sql`(${isNull(column)} OR ${lt(column, since)})`;
}

export async function claimGuildUserDailyDrink(
  guildId: string,
  userId: string,
  startOfDay: Date,
  executor: DbExecutor = db,
): Promise<GuildUser | undefined> {
  return writeGuildUser(
    guildId,
    userId,
    {
      state: {
        values: { lastDrinkedAt: new Date() },
        setWhere: notStampedSince(userState.lastDrinkedAt, startOfDay),
      },
    },
    executor,
  );
}

export async function setGuildUserLastDrinkedAt(
  guildId: string,
  userId: string,
  at: Date | null,
  executor: DbExecutor = db,
): Promise<GuildUser | undefined> {
  const [updated] = await executor
    .update(userState)
    .set({ lastDrinkedAt: at })
    .where(memberOf(userState, guildId, userId))
    .returning({ userId: userState.userId });

  return updated ? findGuildUser(guildId, userId, executor) : undefined;
}

export async function claimGuildUserDailyBeg(
  guildId: string,
  userId: string,
  startOfDay: Date,
  executor: DbExecutor = db,
): Promise<GuildUser | undefined> {
  return writeGuildUser(
    guildId,
    userId,
    {
      state: {
        values: { lastBeggedAt: new Date() },
        setWhere: notStampedSince(userState.lastBeggedAt, startOfDay),
      },
    },
    executor,
  );
}

export async function recordMonsterDrink(
  input: {
    guildId: string;
    userId: string;
    pointsDelta: number;
  },
  executor: DbExecutor = db,
): Promise<GuildUser | undefined> {
  const { guildId, userId, pointsDelta } = input;
  const now = new Date();
  const historicalGain = Math.max(0, pointsDelta);

  return writeGuildUser(
    guildId,
    userId,
    {
      state: {
        values: { points: Math.max(0, pointsDelta), lastDrinkedAt: now },
        set: { points: sql`${userState.points} + ${pointsDelta}`, lastDrinkedAt: now },
      },
      stats: {
        values: { historicalPoints: historicalGain, monstersDrinked: 1 },
        set: {
          historicalPoints: sql`${userStats.historicalPoints} + ${historicalGain}`,
          monstersDrinked: sql`${userStats.monstersDrinked} + 1`,
        },
      },
    },
    executor,
  );
}

export async function recordBegAttempt(
  input: {
    guildId: string;
    userId: string;
    pointsEarned: number;
  },
  executor: DbExecutor = db,
): Promise<GuildUser | undefined> {
  const { guildId, userId, pointsEarned } = input;
  const now = new Date();

  return writeGuildUser(
    guildId,
    userId,
    {
      state: {
        values: { points: pointsEarned, lastBeggedAt: now },
        set: { points: sql`${userState.points} + ${pointsEarned}`, lastBeggedAt: now },
      },
      stats: {
        values: { historicalPoints: pointsEarned, timesBegged: 1 },
        set: {
          historicalPoints: sql`${userStats.historicalPoints} + ${pointsEarned}`,
          timesBegged: sql`${userStats.timesBegged} + 1`,
        },
      },
    },
    executor,
  );
}
