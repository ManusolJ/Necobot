import type { GuildUser } from "@infrastructure/database/schema/user.schema.js";
import { GuildUserPersistError } from "@infrastructure/errors/domain.errors.js";

import { applyGuildUserDelta, findGuildUser, upsertGuildUser } from "@core/repositories/user.repository.js";

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
    lastActiveAt: new Date(),
  });

  if (!result) {
    throw new GuildUserPersistError(input.guildId, input.userId);
  }

  return result;
}
