import { db } from "@infrastructure/database/client.js";
import { GuildUserPersistError } from "@infrastructure/errors/domain.errors.js";

import {
  findGuildUser,
  recordBegAttempt,
  applyGuildUserDelta,
  recordMonsterDrink,
  setGuildUserBirthday,
  deductGuildUserPoints,
  setGuildUserExclusion,
  findGuildUsersByBirthday,
  setGuildUserUwufication,
  claimGuildUserBirthdayGift,
  consumeGuildUserUwufication,
  restoreGuildUserUwufication,
  claimGuildUserDailyBeg,
  claimGuildUserDailyDrink,
  setGuildUserLastDrinkedAt,
  claimGuildUserBirthdayWarning,
} from "@core/repositories/user.repository.js";

import type { Birthday } from "@shared/types/birthday.type.js";
import type { GuildUser } from "@shared/types/guild-user.type.js";

import { nowInBotZone } from "@shared/utils/calendar.util.js";

export async function getGuildUser(guildId: string, userId: string): Promise<GuildUser | undefined> {
  return findGuildUser(guildId, userId);
}

export async function isUserExcluded(guildId: string, userId: string): Promise<boolean> {
  return (await findGuildUser(guildId, userId))?.excludedAt != null;
}

export async function isUserUwufied(guildId: string, userId: string): Promise<boolean> {
  return ((await findGuildUser(guildId, userId))?.isUwufied ?? 0) > 0;
}

export async function setUserExclusion(guildId: string, userId: string, excluded: boolean): Promise<GuildUser> {
  const result = await setGuildUserExclusion(guildId, userId, excluded ? new Date() : null);

  if (!result) {
    throw new GuildUserPersistError(guildId, userId);
  }

  return result;
}

export async function setUserUwufication(
  guildId: string,
  userId: string,
  numberOfMessages: number,
): Promise<GuildUser> {
  const result = await setGuildUserUwufication(guildId, userId, numberOfMessages);

  if (!result) {
    throw new GuildUserPersistError(guildId, userId);
  }

  return result;
}

export async function consumeUwufiedMessage(guildId: string, userId: string): Promise<boolean> {
  return (await consumeGuildUserUwufication(guildId, userId)) !== undefined;
}

export async function restoreUwufiedMessage(guildId: string, userId: string): Promise<void> {
  await restoreGuildUserUwufication(guildId, userId);
}

export async function setUserBirthday(guildId: string, userId: string, birthday: Birthday): Promise<GuildUser> {
  const result = await setGuildUserBirthday(guildId, userId, birthday);

  if (!result) {
    throw new GuildUserPersistError(guildId, userId);
  }

  return result;
}

export async function getUsersWithBirthday(keys: readonly Birthday[]): Promise<GuildUser[]> {
  return findGuildUsersByBirthday(keys);
}

export async function claimBirthdayGift(
  guildId: string,
  userId: string,
  year: number,
  points: number,
): Promise<boolean> {
  return (await claimGuildUserBirthdayGift(guildId, userId, year, points)) !== undefined;
}

export async function claimBirthdayWarning(guildId: string, userId: string, year: number): Promise<boolean> {
  return (await claimGuildUserBirthdayWarning(guildId, userId, year)) !== undefined;
}

export async function recordMineHit(guildId: string, userId: string, pointPenalty: number): Promise<GuildUser> {
  const result = await applyGuildUserDelta({
    guildId,
    userId,
    deltas: {
      points: -pointPenalty,
      activatedMines: 1,
    },
  });

  if (!result) {
    throw new GuildUserPersistError(guildId, userId);
  }

  return result;
}

export async function recordBeg(guildId: string, userId: string, pointsEarned: number): Promise<GuildUser> {
  const result = await recordBegAttempt({ guildId, userId, pointsEarned });

  if (!result) {
    throw new GuildUserPersistError(guildId, userId);
  }

  return result;
}

function startOfToday(): Date {
  return nowInBotZone().startOf("day").toJSDate();
}

export async function claimDailyDrink(guildId: string, userId: string): Promise<{ previous: Date | null } | undefined> {
  const previous = (await findGuildUser(guildId, userId))?.lastDrinkedAt ?? null;

  return (await claimGuildUserDailyDrink(guildId, userId, startOfToday())) ? { previous } : undefined;
}

export async function releaseDailyDrink(guildId: string, userId: string, previous: Date | null): Promise<void> {
  await setGuildUserLastDrinkedAt(guildId, userId, previous);
}

/** Claims today's beg attempt. False means the user already begged today. */
export async function claimDailyBeg(guildId: string, userId: string): Promise<boolean> {
  return (await claimGuildUserDailyBeg(guildId, userId, startOfToday())) !== undefined;
}

export async function recordDrink(guildId: string, userId: string, pointsDelta: number): Promise<GuildUser> {
  const result = await recordMonsterDrink({ guildId, userId, pointsDelta });

  if (!result) {
    throw new GuildUserPersistError(guildId, userId);
  }

  return result;
}

export async function recordScan(guildId: string, userId: string): Promise<GuildUser> {
  const result = await applyGuildUserDelta({
    guildId,
    userId,
    deltas: {
      scannedThings: 1,
    },
  });

  if (!result) {
    throw new GuildUserPersistError(guildId, userId);
  }

  return result;
}

export async function recordSlap(guildId: string, userId: string): Promise<GuildUser> {
  const result = await applyGuildUserDelta({
    guildId,
    userId,
    deltas: {
      timesSlapped: 1,
    },
  });

  if (!result) {
    throw new GuildUserPersistError(guildId, userId);
  }

  return result;
}

export async function subtractPointsFromUser(
  guildId: string,
  userId: string,
  points: number,
): Promise<GuildUser | undefined> {
  return deductGuildUserPoints(guildId, userId, points);
}

export async function transferPoints(
  guildId: string,
  fromId: string,
  toId: string,
  points: number,
): Promise<GuildUser | undefined> {
  return db.transaction(async (tx) => {
    const charged = await deductGuildUserPoints(guildId, fromId, points, tx);

    if (!charged) {
      return undefined;
    }

    if (!(await applyGuildUserDelta({ guildId, userId: toId, deltas: { points } }, tx))) {
      throw new GuildUserPersistError(guildId, toId);
    }

    return charged;
  });
}

export async function sumPointsToUser(guildId: string, userId: string, points: number): Promise<GuildUser> {
  const result = await applyGuildUserDelta({
    guildId,
    userId,
    deltas: { points },
  });

  if (!result) {
    throw new GuildUserPersistError(guildId, userId);
  }

  return result;
}

export async function grantPointsToUser(guildId: string, userId: string, points: number): Promise<GuildUser> {
  const result = await applyGuildUserDelta({
    guildId,
    userId,
    deltas: { points, historicalPoints: points },
  });

  if (!result) {
    throw new GuildUserPersistError(guildId, userId);
  }

  return result;
}

export async function confiscatePointsPercent(
  guildId: string,
  userId: string,
  percent: number,
): Promise<{ taken: number; user: GuildUser } | undefined> {
  const current = await findGuildUser(guildId, userId);
  if (!current || current.points <= 0) {
    return undefined;
  }

  const taken = Math.floor(current.points * percent);
  if (taken <= 0) {
    return undefined;
  }

  const updated = await deductGuildUserPoints(guildId, userId, taken);
  if (!updated) {
    return undefined;
  }

  return { taken, user: updated };
}
