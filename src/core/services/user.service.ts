import { GuildUserPersistError } from "@infrastructure/errors/domain.errors.js";

import {
  findGuildUser,
  recordBegAttempt,
  applyGuildUserDelta,
  recordMonsterDrink,
  deductGuildUserPoints,
  setGuildUserExclusion,
} from "@core/repositories/user.repository.js";

import type { GuildUser } from "@shared/types/guild-user.type.js";

export function getGuildUser(guildId: string, userId: string): GuildUser | undefined {
  return findGuildUser(guildId, userId);
}

export function isUserExcluded(guildId: string, userId: string): boolean {
  return findGuildUser(guildId, userId)?.excludedAt != null;
}

export function setUserExclusion(guildId: string, userId: string, excluded: boolean): GuildUser {
  const result = setGuildUserExclusion(guildId, userId, excluded ? new Date() : null);

  if (!result) {
    throw new GuildUserPersistError(guildId, userId);
  }

  return result;
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

export function recordDrink(guildId: string, userId: string, pointsDelta: number): GuildUser {
  const result = recordMonsterDrink({ guildId, userId, pointsDelta });

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
