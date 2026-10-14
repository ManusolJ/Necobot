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

async function points(userId: string): Promise<number> {
  return (await getGuildUser(GUILD, userId))?.points ?? 0;
}

async function open(): Promise<number> {
  const session = await openGameSession({
    guildId: GUILD,
    kind: "duel",
    challengerId: CHALLENGER,
    challengedId: CHALLENGED,
    stake: STAKE,
  });
  expect(session).toBeDefined();
  return session!.id;
}

beforeAll(async () => {
  await useMigratedDatabase();
});

beforeEach(async () => {
  await resetDatabase();
  await seedGuild(GUILD);
  await sumPointsToUser(GUILD, CHALLENGER, 100);
  await sumPointsToUser(GUILD, CHALLENGED, 100);
});

describe("openGameSession", () => {
  it("takes the challenger's stake and records it on the row", async () => {
    const id = await open();

    expect(await points(CHALLENGER)).toBe(75);
    expect(await findGameSession(id)).toMatchObject({
      kind: "duel",
      challengerId: CHALLENGER,
      challengedId: CHALLENGED,
      challengerStake: STAKE,
      challengedStake: 0,
      completedAt: null,
    });
  });

  it("refuses and leaves nothing behind when the challenger cannot cover the stake", async () => {
    const session = await openGameSession({
      guildId: GUILD,
      kind: "duel",
      challengerId: "broke",
      challengedId: CHALLENGED,
      stake: STAKE,
    });

    expect(session).toBeUndefined();
    expect(await findOpenGameSessions()).toHaveLength(0);
  });
});

describe("stakeChallenged", () => {
  it("takes the challenged player's stake once they accept", async () => {
    const id = await open();

    expect(await stakeChallenged(id, STAKE)).toBe(true);
    expect(await points(CHALLENGED)).toBe(75);
    expect((await findGameSession(id))?.challengedStake).toBe(STAKE);
  });

  it("refuses when the challenged player cannot cover the stake", async () => {
    const id = await open();
    await sumPointsToUser(GUILD, CHALLENGED, -90);

    expect(await stakeChallenged(id, STAKE)).toBe(false);
    expect(await points(CHALLENGED)).toBe(10);
    expect((await findGameSession(id))?.challengedStake).toBe(0);
  });

  it("refuses on a closed session", async () => {
    const id = await open();
    await refundGameSession(id);

    expect(await stakeChallenged(id, STAKE)).toBe(false);
    expect(await points(CHALLENGED)).toBe(100);
  });

  it("refuses on a session that does not exist", async () => {
    expect(await stakeChallenged(9_999, STAKE)).toBe(false);
  });
});

describe("settleGameSession", () => {
  it("pays the listed users and closes the session", async () => {
    const id = await open();
    await stakeChallenged(id, STAKE);

    await settleGameSession(id, { [CHALLENGED]: STAKE * 2 });

    expect(await points(CHALLENGER)).toBe(75);
    expect(await points(CHALLENGED)).toBe(125);
    expect((await findGameSession(id))?.completedAt).toBeInstanceOf(Date);
  });

  it("refuses to settle twice, so a payout cannot be duplicated", async () => {
    const id = await open();
    await settleGameSession(id, { [CHALLENGER]: STAKE });

    await expect(settleGameSession(id, { [CHALLENGER]: STAKE })).rejects.toThrow();
    expect(await points(CHALLENGER)).toBe(100);
  });
});

describe("refundGameSession", () => {
  it("returns only the challenger's stake before acceptance", async () => {
    const id = await open();
    await refundGameSession(id);

    expect(await points(CHALLENGER)).toBe(100);
    expect(await points(CHALLENGED)).toBe(100);
    expect(await findOpenGameSessions()).toHaveLength(0);
  });

  it("returns both stakes after acceptance", async () => {
    const id = await open();
    await stakeChallenged(id, STAKE);
    await refundGameSession(id);

    expect(await points(CHALLENGER)).toBe(100);
    expect(await points(CHALLENGED)).toBe(100);
  });

  // Every failure path calls this defensively, so a second call must be harmless.
  it("is a no-op on an already closed session", async () => {
    const id = await open();
    await refundGameSession(id);

    expect(await refundGameSession(id)).toBeUndefined();
    expect(await points(CHALLENGER)).toBe(100);
  });
});

describe("recoverOpenGameSessions", () => {
  // Simulates a crash: rows are left open with stakes taken, then the "next boot" recovers them.
  it("refunds every open session and reports them with their message", async () => {
    const invited = await open();
    await attachGameSessionMessage(invited, "channel-1", "message-1");

    const accepted = (await openGameSession({
      guildId: GUILD,
      kind: "duel",
      challengerId: CHALLENGED,
      challengedId: CHALLENGER,
      stake: 10,
    }))!.id;
    await stakeChallenged(accepted, 10);

    const recovered = await recoverOpenGameSessions();

    expect(recovered.map((session) => session.id).sort()).toEqual([invited, accepted].sort());
    expect(recovered.find((session) => session.id === invited)).toMatchObject({
      channelId: "channel-1",
      messageId: "message-1",
    });
    expect(await points(CHALLENGER)).toBe(100);
    expect(await points(CHALLENGED)).toBe(100);
    expect(await findOpenGameSessions()).toHaveLength(0);
  });

  it("leaves completed sessions alone", async () => {
    const id = await open();
    await settleGameSession(id, { [CHALLENGED]: STAKE * 2 });

    expect(await recoverOpenGameSessions()).toHaveLength(0);
    expect(await points(CHALLENGED)).toBe(150);
  });

  it("is idempotent", async () => {
    await open();
    await recoverOpenGameSessions();

    expect(await recoverOpenGameSessions()).toHaveLength(0);
    expect(await points(CHALLENGER)).toBe(100);
  });
});
