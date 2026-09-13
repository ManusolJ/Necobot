import { getGuildUser, sumPointsToUser } from "@core/services/user.service.js";
import { findGameSession, findOpenGameSessions } from "@core/repositories/game-session.repository.js";
import {
  openGameSession,
  stakeChallenged,
  refundGameSession,
  settleGameSession,
  recoverOpenGameSessions,
  attachGameSessionMessage,
} from "@core/services/game-session.service.js";

import { resetDatabase, seedGuild, useMigratedDatabase } from "../helpers/database.js";

import { beforeAll, beforeEach, describe, expect, it } from "vitest";

const GUILD = "guild-1";
const CHALLENGER = "challenger-1";
const CHALLENGED = "challenged-1";
const STAKE = 25;

function points(userId: string): number {
  return getGuildUser(GUILD, userId)?.points ?? 0;
}

function open(): number {
  const session = openGameSession({
    guildId: GUILD,
    kind: "duel",
    challengerId: CHALLENGER,
    challengedId: CHALLENGED,
    stake: STAKE,
  });
  expect(session).toBeDefined();
  return session!.id;
}

beforeAll(() => {
  useMigratedDatabase();
});

beforeEach(() => {
  resetDatabase();
  seedGuild(GUILD);
  sumPointsToUser(GUILD, CHALLENGER, 100);
  sumPointsToUser(GUILD, CHALLENGED, 100);
});

describe("openGameSession", () => {
  it("takes the challenger's stake and records it on the row", () => {
    const id = open();

    expect(points(CHALLENGER)).toBe(75);
    expect(findGameSession(id)).toMatchObject({
      kind: "duel",
      challengerId: CHALLENGER,
      challengedId: CHALLENGED,
      challengerStake: STAKE,
      challengedStake: 0,
      completedAt: null,
    });
  });

  it("refuses and leaves nothing behind when the challenger cannot cover the stake", () => {
    const session = openGameSession({
      guildId: GUILD,
      kind: "duel",
      challengerId: "broke",
      challengedId: CHALLENGED,
      stake: STAKE,
    });

    expect(session).toBeUndefined();
    expect(findOpenGameSessions()).toHaveLength(0);
  });
});

describe("stakeChallenged", () => {
  it("takes the challenged player's stake once they accept", () => {
    const id = open();

    expect(stakeChallenged(id, STAKE)).toBe(true);
    expect(points(CHALLENGED)).toBe(75);
    expect(findGameSession(id)?.challengedStake).toBe(STAKE);
  });

  it("refuses when the challenged player cannot cover the stake", () => {
    const id = open();
    sumPointsToUser(GUILD, CHALLENGED, -90);

    expect(stakeChallenged(id, STAKE)).toBe(false);
    expect(points(CHALLENGED)).toBe(10);
    expect(findGameSession(id)?.challengedStake).toBe(0);
  });

  it("refuses on a closed session", () => {
    const id = open();
    refundGameSession(id);

    expect(stakeChallenged(id, STAKE)).toBe(false);
    expect(points(CHALLENGED)).toBe(100);
  });
});

describe("settleGameSession", () => {
  it("pays the listed users and closes the session", () => {
    const id = open();
    stakeChallenged(id, STAKE);

    settleGameSession(id, { [CHALLENGED]: STAKE * 2 });

    expect(points(CHALLENGER)).toBe(75);
    expect(points(CHALLENGED)).toBe(125);
    expect(findGameSession(id)?.completedAt).toBeInstanceOf(Date);
  });

  it("refuses to settle twice, so a payout cannot be duplicated", () => {
    const id = open();
    settleGameSession(id, { [CHALLENGER]: STAKE });

    expect(() => settleGameSession(id, { [CHALLENGER]: STAKE })).toThrow();
    expect(points(CHALLENGER)).toBe(100);
  });
});

describe("refundGameSession", () => {
  it("returns only the challenger's stake before acceptance", () => {
    const id = open();
    refundGameSession(id);

    expect(points(CHALLENGER)).toBe(100);
    expect(points(CHALLENGED)).toBe(100);
    expect(findOpenGameSessions()).toHaveLength(0);
  });

  it("returns both stakes after acceptance", () => {
    const id = open();
    stakeChallenged(id, STAKE);
    refundGameSession(id);

    expect(points(CHALLENGER)).toBe(100);
    expect(points(CHALLENGED)).toBe(100);
  });

  // Every failure path calls this defensively, so a second call must be harmless.
  it("is a no-op on an already closed session", () => {
    const id = open();
    refundGameSession(id);

    expect(refundGameSession(id)).toBeUndefined();
    expect(points(CHALLENGER)).toBe(100);
  });
});

describe("recoverOpenGameSessions", () => {
  // Simulates a crash: rows are left open with stakes taken, then the "next boot" recovers them.
  it("refunds every open session and reports them with their message", () => {
    const invited = open();
    attachGameSessionMessage(invited, "channel-1", "message-1");

    const accepted = openGameSession({
      guildId: GUILD,
      kind: "duel",
      challengerId: CHALLENGED,
      challengedId: CHALLENGER,
      stake: 10,
    })!.id;
    stakeChallenged(accepted, 10);

    const recovered = recoverOpenGameSessions();

    expect(recovered.map((session) => session.id).sort()).toEqual([invited, accepted].sort());
    expect(recovered.find((session) => session.id === invited)).toMatchObject({
      channelId: "channel-1",
      messageId: "message-1",
    });
    expect(points(CHALLENGER)).toBe(100);
    expect(points(CHALLENGED)).toBe(100);
    expect(findOpenGameSessions()).toHaveLength(0);
  });

  it("leaves completed sessions alone", () => {
    const id = open();
    settleGameSession(id, { [CHALLENGED]: STAKE * 2 });

    expect(recoverOpenGameSessions()).toHaveLength(0);
    expect(points(CHALLENGED)).toBe(150);
  });

  it("is idempotent", () => {
    open();
    recoverOpenGameSessions();

    expect(recoverOpenGameSessions()).toHaveLength(0);
    expect(points(CHALLENGER)).toBe(100);
  });
});
