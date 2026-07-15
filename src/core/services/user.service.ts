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

/**
 * True when an admin has excluded this user from bot activities.
 */
export function isUserExcluded(guildId: string, userId: string): boolean {
  return findGuildUser(guildId, userId)?.excludedAt != null;
}

/**
 * Excludes a user from (or readmits them to) bot activities.
 */
export function setUserExclusion(guildId: string, userId: string, excluded: boolean): GuildUser {
  const result = setGuildUserExclusion(guildId, userId, excluded ? new Date() : null);

  if (!result) {
    throw new GuildUserPersistError(guildId, userId);
  }

  return result;
}

/**
 * Records a mine detonation on a user: bumps their activatedMines counter and
 * applies a point penalty (0 for the timeout branch). The penalty can push the
 * balance negative — stepping on a mine while broke is still punishable.
 */
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
