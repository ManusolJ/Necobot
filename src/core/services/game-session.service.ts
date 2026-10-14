import { db } from "@infrastructure/database/client.js";
import { GameSessionPersistError } from "@infrastructure/errors/domain.errors.js";

import { deductGuildUserPoints, applyGuildUserDelta } from "@core/repositories/user.repository.js";
import {
  findGameSession,
  insertGameSession,
  completeGameSession,
  findOpenGameSessions,
  setGameSessionMessage,
  findGameSessionForUpdate,
  setGameSessionChallengedStake,
} from "@core/repositories/game-session.repository.js";

import type { GameKind } from "@shared/types/game-kind.type.js";
import type { DbExecutor } from "@shared/types/db-executor.type.js";
import type { GameSession } from "@shared/types/game-session.type.js";

async function credit(guildId: string, userId: string, points: number, executor: DbExecutor): Promise<void> {
  if (points <= 0) {
    return;
  }

  if (!(await applyGuildUserDelta({ guildId, userId, deltas: { points } }, executor))) {
    throw new GameSessionPersistError({ guildId });
  }
}

export async function openGameSession(input: {
  guildId: string;
  kind: GameKind;
  challengerId: string;
  challengedId?: string;
  stake: number;
}): Promise<GameSession | undefined> {
  const { guildId, kind, challengerId, challengedId, stake } = input;

  return db.transaction(async (tx) => {
    if (!(await deductGuildUserPoints(guildId, challengerId, stake, tx))) {
      return undefined;
    }

    const session = await insertGameSession(
      {
        guildId,
        kind,
        challengerId,
        challengedId: challengedId ?? null,
        challengerStake: stake,
        createdAt: new Date(),
      },
      tx,
    );

    if (!session) {
      throw new GameSessionPersistError({ guildId });
    }

    return session;
  });
}

export async function stakeChallenged(sessionId: number, stake: number): Promise<boolean> {
  return db.transaction(async (tx) => {
    const session = await findGameSessionForUpdate(sessionId, tx);

    if (!session?.challengedId || session.completedAt !== null) {
      return false;
    }

    if (!(await deductGuildUserPoints(session.guildId, session.challengedId, stake, tx))) {
      return false;
    }

    if (!(await setGameSessionChallengedStake(sessionId, stake, tx))) {
      throw new GameSessionPersistError({ guildId: session.guildId, sessionId });
    }

    return true;
  });
}

export async function attachGameSessionMessage(sessionId: number, channelId: string, messageId: string): Promise<void> {
  await setGameSessionMessage(sessionId, channelId, messageId);
}

export async function settleGameSession(sessionId: number, payouts: Record<string, number>): Promise<GameSession> {
  return db.transaction(async (tx) => {
    const session = await completeGameSession(sessionId, new Date(), tx);

    if (!session) {
      throw new GameSessionPersistError({ guildId: "unknown", sessionId });
    }

    for (const [userId, points] of Object.entries(payouts)) {
      await credit(session.guildId, userId, points, tx);
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

export async function refundGameSession(sessionId: number): Promise<GameSession | undefined> {
  const session = await findGameSession(sessionId);

  if (!session || session.completedAt !== null) {
    return undefined;
  }

  return settleGameSession(sessionId, refundPayouts(session));
}

export async function recoverOpenGameSessions(): Promise<GameSession[]> {
  const recovered: GameSession[] = [];

  for (const session of await findOpenGameSessions()) {
    recovered.push(await settleGameSession(session.id, refundPayouts(session)));
  }

  return recovered;
}
