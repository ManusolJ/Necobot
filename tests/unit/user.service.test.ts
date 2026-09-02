import { GuildUserPersistError } from "@infrastructure/errors/domain.errors.js";

import type { GuildUser } from "@shared/types/guild-user.type.js";

import { beforeEach, describe, expect, it, vi } from "vitest";

const findGuildUser = vi.hoisted(() => vi.fn());
const recordBegAttempt = vi.hoisted(() => vi.fn());
const applyGuildUserDelta = vi.hoisted(() => vi.fn());
const recordMonsterDrink = vi.hoisted(() => vi.fn());
const deductGuildUserPoints = vi.hoisted(() => vi.fn());
const setGuildUserExclusion = vi.hoisted(() => vi.fn());
const setGuildUserUwufication = vi.hoisted(() => vi.fn());
const consumeGuildUserUwufication = vi.hoisted(() => vi.fn());

vi.mock("@core/repositories/user.repository.js", () => ({
  findGuildUser,
  recordBegAttempt,
  applyGuildUserDelta,
  recordMonsterDrink,
  deductGuildUserPoints,
  setGuildUserExclusion,
  setGuildUserUwufication,
  consumeGuildUserUwufication,
}));

const {
  recordBeg,
  recordSlap,
  getGuildUser,
  recordDrink,
  recordMineHit,
  isUserExcluded,
  isUserUwufied,
  sumPointsToUser,
  setUserExclusion,
  setUserUwufication,
  consumeUwufiedMessage,
  subtractPointsFromUser,
  confiscatePointsPercent,
} = await import("@core/services/user.service.js");

const GUILD = "guild-1";
const USER = "user-1";

function guildUser(overrides: Partial<GuildUser> = {}): GuildUser {
  return {
    guildId: GUILD,
    userId: USER,
    points: 0,
    isUwufied: 0,
    timesBegged: 0,
    timesSlapped: 0,
    scannedThings: 0,
    activatedMines: 0,
    monstersDrinked: 0,
    historicalPoints: 0,
    lastBeggedAt: null,
    lastDrinkedAt: null,
    excludedAt: null,
    ...overrides,
  };
}

beforeEach(() => {
  findGuildUser.mockReset();
  recordBegAttempt.mockReset();
  applyGuildUserDelta.mockReset();
  recordMonsterDrink.mockReset();
  deductGuildUserPoints.mockReset();
  setGuildUserExclusion.mockReset();
  setGuildUserUwufication.mockReset();
  consumeGuildUserUwufication.mockReset();
});

describe("getGuildUser", () => {
  // Normal case: the service is a thin read-through, so the stored row must come back untouched.
  it("returns the row the repository found", () => {
    const row = guildUser({ points: 42 });
    findGuildUser.mockReturnValue(row);

    expect(getGuildUser(GUILD, USER)).toBe(row);
    expect(findGuildUser).toHaveBeenCalledWith(GUILD, USER);
  });

  // Edge case: a user who has never interacted with the bot has no row, and that absence must survive the call.
  it("returns undefined for a user with no row", () => {
    findGuildUser.mockReturnValue(undefined);

    expect(getGuildUser(GUILD, USER)).toBeUndefined();
  });
});

describe("isUserExcluded", () => {
  // Normal case: an exclusion timestamp is the marker the moderation flow sets, so any date means excluded.
  it("reports an excluded user when the timestamp is set", () => {
    findGuildUser.mockReturnValue(guildUser({ excludedAt: new Date("2026-01-01T00:00:00Z") }));

    expect(isUserExcluded(GUILD, USER)).toBe(true);
  });

  // Normal case: a row that exists but was never excluded (or was re-included) must read as allowed.
  it("reports a user with a null timestamp as not excluded", () => {
    findGuildUser.mockReturnValue(guildUser({ excludedAt: null }));

    expect(isUserExcluded(GUILD, USER)).toBe(false);
  });

  // Edge case: an unknown user must default to allowed rather than throwing on the optional chain.
  it("treats a missing user as not excluded", () => {
    findGuildUser.mockReturnValue(undefined);

    expect(isUserExcluded(GUILD, USER)).toBe(false);
  });
});

describe("setUserExclusion", () => {
  // Normal case: excluding stamps the current time, so the repository must receive a Date rather than a boolean.
  it("stores a timestamp when excluding", () => {
    const row = guildUser({ excludedAt: new Date() });
    setGuildUserExclusion.mockReturnValue(row);

    expect(setUserExclusion(GUILD, USER, true)).toBe(row);
    expect(setGuildUserExclusion).toHaveBeenCalledWith(GUILD, USER, expect.any(Date));
  });

  // Normal case: re-including clears the marker, which the repository expects as an explicit null.
  it("stores null when re-including", () => {
    const row = guildUser();
    setGuildUserExclusion.mockReturnValue(row);

    expect(setUserExclusion(GUILD, USER, false)).toBe(row);
    expect(setGuildUserExclusion).toHaveBeenCalledWith(GUILD, USER, null);
  });

  // Error handling: a write that returns no row means the upsert did not land, which must surface as a domain error.
  it("throws when the write returns no row", () => {
    setGuildUserExclusion.mockReturnValue(undefined);

    expect(() => setUserExclusion(GUILD, USER, true)).toThrow(GuildUserPersistError);
  });

  // Error handling: the thrown error carries the ids so the command-error listener can log which write failed.
  it("puts the guild and user on the thrown error", () => {
    setGuildUserExclusion.mockReturnValue(undefined);

    expect(() => setUserExclusion(GUILD, USER, true)).toThrow(
      expect.objectContaining({
        code: "guild_user_persist_failed",
        context: { guildId: GUILD, userId: USER },
      }),
    );
  });
});

describe("isUserUwufied", () => {
  // Normal case: a positive counter means the target still owes uwufied messages.
  it("reports a user with messages left as uwufied", () => {
    findGuildUser.mockReturnValue(guildUser({ isUwufied: 3 }));

    expect(isUserUwufied(GUILD, USER)).toBe(true);
  });

  // Normal case: a spent counter means the debuff is over.
  it("reports a user with a spent counter as not uwufied", () => {
    findGuildUser.mockReturnValue(guildUser({ isUwufied: 0 }));

    expect(isUserUwufied(GUILD, USER)).toBe(false);
  });

  // Edge case: an unknown user has nothing pending, and must never default to uwufied.
  it("treats a missing user as not uwufied", () => {
    findGuildUser.mockReturnValue(undefined);

    expect(isUserUwufied(GUILD, USER)).toBe(false);
  });

  // Edge case: a counter that somehow went negative is still nothing left to spend.
  it("treats a negative counter as not uwufied", () => {
    findGuildUser.mockReturnValue(guildUser({ isUwufied: -1 }));

    expect(isUserUwufied(GUILD, USER)).toBe(false);
  });
});

describe("setUserUwufication", () => {
  // Normal case: the purchased message count is handed straight to the repository.
  it("stores the requested message count", () => {
    const row = guildUser({ isUwufied: 5 });
    setGuildUserUwufication.mockReturnValue(row);

    expect(setUserUwufication(GUILD, USER, 5)).toBe(row);
    expect(setGuildUserUwufication).toHaveBeenCalledWith(GUILD, USER, 5);
  });

  // Edge case: zero clears the debuff, which the same write has to support.
  it("supports clearing the counter", () => {
    setGuildUserUwufication.mockReturnValue(guildUser({ isUwufied: 0 }));

    expect(setUserUwufication(GUILD, USER, 0).isUwufied).toBe(0);
  });

  // Error handling: the command refunds on a throw, so a failed write must not look successful.
  it("throws when the write returns no row", () => {
    setGuildUserUwufication.mockReturnValue(undefined);

    expect(() => setUserUwufication(GUILD, USER, 5)).toThrow(GuildUserPersistError);
  });
});

describe("consumeUwufiedMessage", () => {
  // Normal case: the guarded update matched a row, so one paid message was spent.
  it("reports success when a message was spent", () => {
    consumeGuildUserUwufication.mockReturnValue(guildUser({ isUwufied: 4 }));

    expect(consumeUwufiedMessage(GUILD, USER)).toBe(true);
    expect(consumeGuildUserUwufication).toHaveBeenCalledWith(GUILD, USER);
  });

  // Edge case: with nothing left the guarded update matches no row, which must read as a plain false.
  it("reports failure when nothing was left to spend", () => {
    consumeGuildUserUwufication.mockReturnValue(undefined);

    expect(consumeUwufiedMessage(GUILD, USER)).toBe(false);
  });

  // The row is mapped to a boolean so callers can use it directly, matching tryConsumeMine.
  it("returns a boolean rather than the row", () => {
    consumeGuildUserUwufication.mockReturnValue(guildUser({ isUwufied: 0 }));

    expect(consumeUwufiedMessage(GUILD, USER)).toBe(true);
  });
});

describe("recordMineHit", () => {
  // Normal case: a mine costs points and counts a detonation, so the penalty must be sent as a negative delta.
  it("subtracts the penalty and counts the mine", () => {
    const row = guildUser({ points: 70, activatedMines: 1 });
    applyGuildUserDelta.mockReturnValue(row);

    expect(recordMineHit(GUILD, USER, 30)).toBe(row);
    expect(applyGuildUserDelta).toHaveBeenCalledWith({
      guildId: GUILD,
      userId: USER,
      deltas: { points: -30, activatedMines: 1 },
    });
  });

  // Edge case: a zero penalty still has to register the detonation while leaving the balance numerically untouched.
  it("still counts the mine when the penalty is zero", () => {
    applyGuildUserDelta.mockReturnValue(guildUser({ activatedMines: 1 }));

    recordMineHit(GUILD, USER, 0);

    const { deltas } = applyGuildUserDelta.mock.calls[0]?.[0] as {
      deltas: { points: number; activatedMines: number };
    };
    expect(deltas.activatedMines).toBe(1);
    expect(deltas.points === 0).toBe(true);
  });

  // Error handling: the minefield listener relies on this throwing so it can restore the mine it consumed.
  it("throws when the write returns no row", () => {
    applyGuildUserDelta.mockReturnValue(undefined);

    expect(() => recordMineHit(GUILD, USER, 30)).toThrow(GuildUserPersistError);
  });
});

describe("recordBeg", () => {
  // Normal case: begging credits points and bumps the counters the repository owns.
  it("forwards the earned points", () => {
    const row = guildUser({ points: 15, timesBegged: 1 });
    recordBegAttempt.mockReturnValue(row);

    expect(recordBeg(GUILD, USER, 15)).toBe(row);
    expect(recordBegAttempt).toHaveBeenCalledWith({ guildId: GUILD, userId: USER, pointsEarned: 15 });
  });

  // Edge case: an unlucky beg earns nothing, which must still be recorded so the cooldown timestamp advances.
  it("records a beg that earned nothing", () => {
    recordBegAttempt.mockReturnValue(guildUser({ timesBegged: 1 }));

    expect(recordBeg(GUILD, USER, 0).timesBegged).toBe(1);
    expect(recordBegAttempt).toHaveBeenCalledWith({ guildId: GUILD, userId: USER, pointsEarned: 0 });
  });

  // Error handling: a failed upsert must not be reported to the user as a successful beg.
  it("throws when the write returns no row", () => {
    recordBegAttempt.mockReturnValue(undefined);

    expect(() => recordBeg(GUILD, USER, 15)).toThrow(GuildUserPersistError);
  });
});

describe("recordDrink", () => {
  // Normal case: a Friday monster is a credit, so the positive delta must reach the repository unchanged.
  it("forwards a positive delta", () => {
    const row = guildUser({ points: 20, monstersDrinked: 1 });
    recordMonsterDrink.mockReturnValue(row);

    expect(recordDrink(GUILD, USER, 20)).toBe(row);
    expect(recordMonsterDrink).toHaveBeenCalledWith({ guildId: GUILD, userId: USER, pointsDelta: 20 });
  });

  // Edge case: drinking on a non-Friday is a penalty, and the sign must not be normalised away by the service.
  it("forwards a negative delta unchanged", () => {
    recordMonsterDrink.mockReturnValue(guildUser({ monstersDrinked: 1 }));

    recordDrink(GUILD, USER, -20);

    expect(recordMonsterDrink).toHaveBeenCalledWith({ guildId: GUILD, userId: USER, pointsDelta: -20 });
  });

  // Error handling: without a row there is no cooldown timestamp, so the caller must learn the write failed.
  it("throws when the write returns no row", () => {
    recordMonsterDrink.mockReturnValue(undefined);

    expect(() => recordDrink(GUILD, USER, 20)).toThrow(GuildUserPersistError);
  });
});

describe("recordSlap", () => {
  // Normal case: a slap only bumps the counter, so that is the whole delta.
  it("increments the slap counter by one", () => {
    const row = guildUser({ timesSlapped: 1 });
    applyGuildUserDelta.mockReturnValue(row);

    expect(recordSlap(GUILD, USER)).toBe(row);
    expect(applyGuildUserDelta).toHaveBeenCalledWith({
      guildId: GUILD,
      userId: USER,
      deltas: { timesSlapped: 1 },
    });
  });

  // The cost is charged separately to the slapper, so recording must not move the target's points.
  it("does not touch points or any other counter", () => {
    applyGuildUserDelta.mockReturnValue(guildUser({ timesSlapped: 1 }));

    recordSlap(GUILD, USER);

    const { deltas } = applyGuildUserDelta.mock.calls[0]?.[0] as { deltas: Record<string, number> };
    expect(Object.keys(deltas)).toEqual(["timesSlapped"]);
  });

  // The counter belongs to whoever was slapped, so the id passed through is the one recorded.
  it("records against the user it was given", () => {
    applyGuildUserDelta.mockReturnValue(guildUser({ userId: "target-9" }));

    recordSlap(GUILD, "target-9");

    expect(applyGuildUserDelta).toHaveBeenCalledWith(expect.objectContaining({ userId: "target-9" }));
  });

  // Error handling: the command refunds on a throw, so a failed write must not look successful.
  it("throws when the write returns no row", () => {
    applyGuildUserDelta.mockReturnValue(undefined);

    expect(() => recordSlap(GUILD, USER)).toThrow(GuildUserPersistError);
  });
});

describe("sumPointsToUser", () => {
  // Normal case: a credit is expressed purely as a points delta, with no counter touched.
  it("sends the credit as a points delta", () => {
    const row = guildUser({ points: 50 });
    applyGuildUserDelta.mockReturnValue(row);

    expect(sumPointsToUser(GUILD, USER, 50)).toBe(row);
    expect(applyGuildUserDelta).toHaveBeenCalledWith({
      guildId: GUILD,
      userId: USER,
      deltas: { points: 50 },
    });
  });

  // Error handling: gifting reads the sender's deduction as final, so a failed credit must throw, not return silently.
  it("throws when the write returns no row", () => {
    applyGuildUserDelta.mockReturnValue(undefined);

    expect(() => sumPointsToUser(GUILD, USER, 50)).toThrow(GuildUserPersistError);
  });
});

describe("subtractPointsFromUser", () => {
  // Normal case: a covered deduction returns the updated row for the caller to report the new balance.
  it("returns the updated row when the balance covers it", () => {
    const row = guildUser({ points: 20 });
    deductGuildUserPoints.mockReturnValue(row);

    expect(subtractPointsFromUser(GUILD, USER, 30)).toBe(row);
    expect(deductGuildUserPoints).toHaveBeenCalledWith(GUILD, USER, 30);
  });

  // Error handling: an uncovered deduction is an expected outcome, so it returns undefined instead of throwing.
  it("returns undefined instead of throwing when funds are short", () => {
    deductGuildUserPoints.mockReturnValue(undefined);

    expect(subtractPointsFromUser(GUILD, USER, 999)).toBeUndefined();
  });
});

describe("confiscatePointsPercent", () => {
  // Normal case: the percentage is taken off the current balance and deducted in one follow-up write.
  it("takes the percentage of the current balance", () => {
    findGuildUser.mockReturnValue(guildUser({ points: 100 }));
    const updated = guildUser({ points: 75 });
    deductGuildUserPoints.mockReturnValue(updated);

    expect(confiscatePointsPercent(GUILD, USER, 0.25)).toEqual({ taken: 25, user: updated });
    expect(deductGuildUserPoints).toHaveBeenCalledWith(GUILD, USER, 25);
  });

  // Edge case: points are whole numbers, so a fractional share must be floored rather than rounded.
  it("floors a fractional share", () => {
    findGuildUser.mockReturnValue(guildUser({ points: 99 }));
    deductGuildUserPoints.mockReturnValue(guildUser({ points: 75 }));

    expect(confiscatePointsPercent(GUILD, USER, 0.25)?.taken).toBe(24);
    expect(deductGuildUserPoints).toHaveBeenCalledWith(GUILD, USER, 24);
  });

  // Edge case: a full confiscation must clear the balance exactly, with no rounding drift.
  it("takes the whole balance at one hundred percent", () => {
    findGuildUser.mockReturnValue(guildUser({ points: 77 }));
    deductGuildUserPoints.mockReturnValue(guildUser({ points: 0 }));

    expect(confiscatePointsPercent(GUILD, USER, 1)?.taken).toBe(77);
  });

  // Edge case: an unknown user has nothing to confiscate, and no write should be attempted for them.
  it("returns undefined for a missing user without writing", () => {
    findGuildUser.mockReturnValue(undefined);

    expect(confiscatePointsPercent(GUILD, USER, 0.25)).toBeUndefined();
    expect(deductGuildUserPoints).not.toHaveBeenCalled();
  });

  // Edge case: a broke user is skipped up front so the command can answer without touching the database.
  it("returns undefined for a zero balance without writing", () => {
    findGuildUser.mockReturnValue(guildUser({ points: 0 }));

    expect(confiscatePointsPercent(GUILD, USER, 0.25)).toBeUndefined();
    expect(deductGuildUserPoints).not.toHaveBeenCalled();
  });

  // Edge case: a balance that somehow went negative must not be treated as something worth confiscating.
  it("returns undefined for a negative balance", () => {
    findGuildUser.mockReturnValue(guildUser({ points: -10 }));

    expect(confiscatePointsPercent(GUILD, USER, 0.25)).toBeUndefined();
    expect(deductGuildUserPoints).not.toHaveBeenCalled();
  });

  // Edge case: a share that floors to zero is a no-op, so no pointless zero-value write should be issued.
  it("returns undefined when the share floors to zero", () => {
    findGuildUser.mockReturnValue(guildUser({ points: 3 }));

    expect(confiscatePointsPercent(GUILD, USER, 0.1)).toBeUndefined();
    expect(deductGuildUserPoints).not.toHaveBeenCalled();
  });

  // Error handling: the read and the write are not atomic, so a balance drained in between yields undefined, not a throw.
  it("returns undefined when the deduction loses a race", () => {
    findGuildUser.mockReturnValue(guildUser({ points: 100 }));
    deductGuildUserPoints.mockReturnValue(undefined);

    expect(confiscatePointsPercent(GUILD, USER, 0.25)).toBeUndefined();
  });
});
