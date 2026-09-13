import {
  openGameSession,
  stakeChallenged,
  refundGameSession,
  settleGameSession,
  attachGameSessionMessage,
} from "@core/services/game-session.service.js";

import type { RpsChoice } from "@shared/types/rps-choice.type.js";
import type { RpsOutcome } from "@shared/types/rps-outcome.type.js";
import type { GameSession } from "@shared/types/game-session.type.js";

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

export function openDuel(
  guildId: string,
  challengerId: string,
  targetId: string,
  bet: number,
): GameSession | undefined {
  return openGameSession({ guildId, kind: "duel", challengerId, challengedId: targetId, stake: bet });
}

export function acceptDuel(sessionId: number, bet: number): boolean {
  return stakeChallenged(sessionId, bet);
}

export function attachDuelMessage(sessionId: number, channelId: string, messageId: string): void {
  attachGameSessionMessage(sessionId, channelId, messageId);
}

export function cancelDuel(sessionId: number): void {
  refundGameSession(sessionId);
}

export function settleDuelDraw(sessionId: number, challengerId: string, targetId: string, bet: number): void {
  settleGameSession(sessionId, { [challengerId]: bet, [targetId]: bet });
}

export function settleDuelWin(sessionId: number, winnerId: string, bet: number): void {
  settleGameSession(sessionId, { [winnerId]: bet * 2 });
}

export function settleDuelAbandoned(sessionId: number, chooserIds: readonly string[], bet: number): void {
  settleGameSession(sessionId, Object.fromEntries(chooserIds.map((id) => [id, bet])));
}
