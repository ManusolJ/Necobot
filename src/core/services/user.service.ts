import type { GuildUser } from "@infrastructure/database/schema/user.schema.js";

import { GuildUserPersistError } from "@infrastructure/errors/domain.errors.js";

import {
  findGuildUser,
  upsertGuildUser,
  recordBegAttempt,
  applyGuildUserDelta,
  deductGuildUserPoints,
  setGuildUserExclusion,
} from "@core/repositories/user.repository.js";

import type { EarnAction } from "@shared/types/earn-action.type.js";
import type { AwardInput } from "@shared/interfaces/award-input.interface.js";

const COUNTER_BY_ACTION = {
  beg: "timesBegged",
  trivia: "triviaWins",
  mine: "activatedMines",
} as const satisfies Record<EarnAction, string>;

export function getGuildUser(guildId: string, userId: string): GuildUser | undefined {
  return findGuildUser(guildId, userId);
}

export function ensureGuildUser(guildId: string, userId: string): GuildUser {
  const result = upsertGuildUser({ guildId, userId });
  if (!result) {
    throw new GuildUserPersistError(guildId, userId);
  }
  return result;
}

export function awardPoints(input: AwardInput): GuildUser {
  const counterKey = COUNTER_BY_ACTION[input.action];

  const result = applyGuildUserDelta({
    guildId: input.guildId,
    userId: input.userId,
    deltas: {
      points: input.amount,
      historicalPoints: input.amount,
      [counterKey]: 1,
    },
  });

  if (!result) {
    throw new GuildUserPersistError(input.guildId, input.userId);
  }

  return result;
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

/**
 * Confiscates a percentage of a user's current points (rounded down).
 * Returns what was taken and the updated row, or undefined when there is
 * nothing to take (no row, zero/negative balance, or a concurrent spend
 * emptied the account between read and write).
 */
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
