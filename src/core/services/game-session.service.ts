import { db } from "@infrastructure/database/client.js";
import { GameSessionPersistError } from "@infrastructure/errors/domain.errors.js";

import { deductGuildUserPoints, applyGuildUserDelta } from "@core/repositories/user.repository.js";
import {
  findGameSession,
  insertGameSession,
  completeGameSession,
  findOpenGameSessions,
  setGameSessionMessage,
  setGameSessionChallengedStake,
} from "@core/repositories/game-session.repository.js";

import type { GameKind } from "@shared/types/game-kind.type.js";
import type { GameSession } from "@shared/types/game-session.type.js";

function credit(guildId: string, userId: string, points: number): void {
  if (points <= 0) {
    return;
  }

  if (!applyGuildUserDelta({ guildId, userId, deltas: { points } })) {
    throw new GameSessionPersistError({ guildId });
  }
}

export function openGameSession(input: {
  guildId: string;
  kind: GameKind;
  challengerId: string;
  challengedId?: string;
  stake: number;
}): GameSession | undefined {
  const { guildId, kind, challengerId, challengedId, stake } = input;

  return db.transaction(() => {
    if (!deductGuildUserPoints(guildId, challengerId, stake)) {
      return undefined;
    }

    const session = insertGameSession({
      guildId,
      kind,
      challengerId,
      challengedId: challengedId ?? null,
      challengerStake: stake,
      createdAt: new Date(),
    });

    if (!session) {
      throw new GameSessionPersistError({ guildId });
    }

    return session;
  });
}

export function stakeChallenged(sessionId: number, stake: number): boolean {
  return db.transaction(() => {
    const session = findGameSession(sessionId);

    if (!session?.challengedId || session.completedAt !== null) {
      return false;
    }

    if (!deductGuildUserPoints(session.guildId, session.challengedId, stake)) {
      return false;
    }

    if (!setGameSessionChallengedStake(sessionId, stake)) {
      throw new GameSessionPersistError({ guildId: session.guildId, sessionId });
    }

    return true;
  });
}

export function attachGameSessionMessage(sessionId: number, channelId: string, messageId: string): void {
  setGameSessionMessage(sessionId, channelId, messageId);
}

export function settleGameSession(sessionId: number, payouts: Record<string, number>): GameSession {
  return db.transaction(() => {
    const session = completeGameSession(sessionId, new Date());

    if (!session) {
      throw new GameSessionPersistError({ guildId: "unknown", sessionId });
    }

    for (const [userId, points] of Object.entries(payouts)) {
      credit(session.guildId, userId, points);
    }

    return session;
  });
}

function refundPayouts(session: GameSession): Record<string, number> {
  const payouts: Record<string, number> = { [session.challengerId]: session.challengerStake };

  if (session.challengedId && session.challengedStake > 0) {
    payouts[session.challengedId] = (payouts[session.challengedId] ?? 0) + session.challengedStake;
  }

  return payouts;
}

export function refundGameSession(sessionId: number): GameSession | undefined {
  const session = findGameSession(sessionId);

  if (!session || session.completedAt !== null) {
    return undefined;
  }

  return settleGameSession(sessionId, refundPayouts(session));
}

export function recoverOpenGameSessions(): GameSession[] {
  return findOpenGameSessions().map((session) => settleGameSession(session.id, refundPayouts(session)));
}
