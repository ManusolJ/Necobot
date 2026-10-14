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

export async function openDuel(
  guildId: string,
  challengerId: string,
  targetId: string,
  bet: number,
): Promise<GameSession | undefined> {
  return openGameSession({ guildId, kind: "duel", challengerId, challengedId: targetId, stake: bet });
}

export async function acceptDuel(sessionId: number, bet: number): Promise<boolean> {
  return stakeChallenged(sessionId, bet);
}

export async function attachDuelMessage(sessionId: number, channelId: string, messageId: string): Promise<void> {
  await attachGameSessionMessage(sessionId, channelId, messageId);
}

export async function cancelDuel(sessionId: number): Promise<void> {
  await refundGameSession(sessionId);
}

export async function settleDuelDraw(
  sessionId: number,
  challengerId: string,
  targetId: string,
  bet: number,
): Promise<void> {
  await settleGameSession(sessionId, { [challengerId]: bet, [targetId]: bet });
}

export async function settleDuelWin(sessionId: number, winnerId: string, bet: number): Promise<void> {
  await settleGameSession(sessionId, { [winnerId]: bet * 2 });
}

export async function settleDuelAbandoned(
  sessionId: number,
  chooserIds: readonly string[],
  bet: number,
): Promise<void> {
  await settleGameSession(sessionId, Object.fromEntries(chooserIds.map((id) => [id, bet])));
}
