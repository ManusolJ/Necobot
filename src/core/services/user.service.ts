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

export function getGuildUser(guildId: string, userId: string): GuildUser | undefined {
  return findGuildUser(guildId, userId);
}

export function isUserExcluded(guildId: string, userId: string): boolean {
  return findGuildUser(guildId, userId)?.excludedAt != null;
}

export function isUserUwufied(guildId: string, userId: string): boolean {
  return (findGuildUser(guildId, userId)?.isUwufied ?? 0) > 0;
}

export function setUserExclusion(guildId: string, userId: string, excluded: boolean): GuildUser {
  const result = setGuildUserExclusion(guildId, userId, excluded ? new Date() : null);

  if (!result) {
    throw new GuildUserPersistError(guildId, userId);
  }

  return result;
}

export function setUserUwufication(guildId: string, userId: string, numberOfMessages: number): GuildUser {
  const result = setGuildUserUwufication(guildId, userId, numberOfMessages);

  if (!result) {
    throw new GuildUserPersistError(guildId, userId);
  }

  return result;
}

export function consumeUwufiedMessage(guildId: string, userId: string): boolean {
  return consumeGuildUserUwufication(guildId, userId) !== undefined;
}

export function restoreUwufiedMessage(guildId: string, userId: string): void {
  restoreGuildUserUwufication(guildId, userId);
}

export function setUserBirthday(guildId: string, userId: string, birthday: Birthday): GuildUser {
  const result = setGuildUserBirthday(guildId, userId, birthday);

  if (!result) {
    throw new GuildUserPersistError(guildId, userId);
  }

  return result;
}

export function getUsersWithBirthday(keys: readonly Birthday[]): GuildUser[] {
  return findGuildUsersByBirthday(keys);
}

export function claimBirthdayGift(guildId: string, userId: string, year: number, points: number): boolean {
  return claimGuildUserBirthdayGift(guildId, userId, year, points) !== undefined;
}

export function claimBirthdayWarning(guildId: string, userId: string, year: number): boolean {
  return claimGuildUserBirthdayWarning(guildId, userId, year) !== undefined;
}

export function recordMineHit(guildId: string, userId: string, pointPenalty: number): GuildUser {
  const result = applyGuildUserDelta({
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

export function recordBeg(guildId: string, userId: string, pointsEarned: number): GuildUser {
  const result = recordBegAttempt({ guildId, userId, pointsEarned });

  if (!result) {
    throw new GuildUserPersistError(guildId, userId);
  }

  return result;
}

function startOfToday(): Date {
  return nowInBotZone().startOf("day").toJSDate();
}

/**
 * Claims today's monster attempt before any slow work happens. Returns what `lastDrinkedAt` was so
 * the caller can hand the attempt back with `releaseDailyDrink` if the picture turns out not to count.
 */
export function claimDailyDrink(guildId: string, userId: string): { previous: Date | null } | undefined {
  const previous = findGuildUser(guildId, userId)?.lastDrinkedAt ?? null;

  return claimGuildUserDailyDrink(guildId, userId, startOfToday()) ? { previous } : undefined;
}

export function releaseDailyDrink(guildId: string, userId: string, previous: Date | null): void {
  setGuildUserLastDrinkedAt(guildId, userId, previous);
}

/** Claims today's beg attempt. False means the user already begged today. */
export function claimDailyBeg(guildId: string, userId: string): boolean {
  return claimGuildUserDailyBeg(guildId, userId, startOfToday()) !== undefined;
}

export function recordDrink(guildId: string, userId: string, pointsDelta: number): GuildUser {
  const result = recordMonsterDrink({ guildId, userId, pointsDelta });

  if (!result) {
    throw new GuildUserPersistError(guildId, userId);
  }

  return result;
}

export function recordScan(guildId: string, userId: string): GuildUser {
  const result = applyGuildUserDelta({
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

export function recordSlap(guildId: string, userId: string): GuildUser {
  const result = applyGuildUserDelta({
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

export function subtractPointsFromUser(guildId: string, userId: string, points: number): GuildUser | undefined {
  return deductGuildUserPoints(guildId, userId, points);
}

/**
 * Moves points between two users atomically. Returns the sender's updated row, or undefined when
 * they cannot cover the amount, in which case nothing was written.
 */
export function transferPoints(guildId: string, fromId: string, toId: string, points: number): GuildUser | undefined {
  return db.transaction(() => {
    const charged = deductGuildUserPoints(guildId, fromId, points);

    if (!charged) {
      return undefined;
    }

    if (!applyGuildUserDelta({ guildId, userId: toId, deltas: { points } })) {
      throw new GuildUserPersistError(guildId, toId);
    }

    return charged;
  });
}

export function sumPointsToUser(guildId: string, userId: string, points: number): GuildUser {
  const result = applyGuildUserDelta({
    guildId,
    userId,
    deltas: { points },
  });

  if (!result) {
    throw new GuildUserPersistError(guildId, userId);
  }

  return result;
}

/** A grant from the bot itself (rewards, prizes): counts towards `historicalPoints`, unlike transfers or refunds. */
export function grantPointsToUser(guildId: string, userId: string, points: number): GuildUser {
  const result = applyGuildUserDelta({
    guildId,
    userId,
    deltas: { points, historicalPoints: points },
  });

  if (!result) {
    throw new GuildUserPersistError(guildId, userId);
  }

  return result;
}

export function confiscatePointsPercent(
  guildId: string,
  userId: string,
  percent: number,
): { taken: number; user: GuildUser } | undefined {
  const current = findGuildUser(guildId, userId);
  if (!current || current.points <= 0) {
    return undefined;
  }

  const taken = Math.floor(current.points * percent);
  if (taken <= 0) {
    return undefined;
  }

  const updated = deductGuildUserPoints(guildId, userId, taken);
  if (!updated) {
    return undefined;
  }

  return { taken, user: updated };
}
