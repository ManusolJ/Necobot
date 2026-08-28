import { subtractPointsFromUser, sumPointsToUser } from "@core/services/user.service.js";

import type { RpsChoice } from "@shared/types/rps-choice.type.js";
import type { RpsOutcome } from "@shared/types/rps-outcome.type.js";

export const RPS_CHOICES: readonly RpsChoice[] = ["rock", "paper", "scissors"];

const BEATS: Record<RpsChoice, RpsChoice> = {
  rock: "scissors",
  paper: "rock",
  scissors: "paper",
};

export function resolveRps(challenger: RpsChoice, target: RpsChoice): RpsOutcome {
  if (challenger === target) {
    return "draw";
  }

  return BEATS[challenger] === target ? "challenger" : "target";
}

export function reserveStake(guildId: string, userId: string, bet: number): boolean {
  return subtractPointsFromUser(guildId, userId, bet) !== undefined;
}

export function refundStake(guildId: string, userId: string, bet: number): void {
  sumPointsToUser(guildId, userId, bet);
}

export function payWinner(guildId: string, winnerId: string, bet: number): void {
  sumPointsToUser(guildId, winnerId, bet * 2);
}
