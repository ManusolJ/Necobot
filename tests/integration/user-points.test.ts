import { db } from "@infrastructure/database/client.js";
import { guildUsers } from "@infrastructure/database/schema/user.schema.js";

import {
  recordBeg,
  recordDrink,
  getGuildUser,
  claimDailyBeg,
  recordMineHit,
  isUserExcluded,
  claimDailyDrink,
  sumPointsToUser,
  transferPoints,
  setUserExclusion,
  grantPointsToUser,
  releaseDailyDrink,
  subtractPointsFromUser,
  confiscatePointsPercent,
} from "@core/services/user.service.js";

import { resetDatabase, seedGuild, useMigratedDatabase } from "../helpers/database.js";

import { and, eq } from "drizzle-orm";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

const GUILD = "guild-1";
const USER = "user-1";

beforeAll(() => {
  useMigratedDatabase();
});

beforeEach(() => {
  resetDatabase();
  seedGuild(GUILD);
});

describe("point arithmetic", () => {
  it("creates a user on first credit", () => {
    expect(sumPointsToUser(GUILD, USER, 50).points).toBe(50);
  });

  it("accumulates across credits", () => {
    sumPointsToUser(GUILD, USER, 50);
    expect(sumPointsToUser(GUILD, USER, 25).points).toBe(75);
  });

  it("deducts when the balance covers it", () => {
    sumPointsToUser(GUILD, USER, 50);
    expect(subtractPointsFromUser(GUILD, USER, 30)?.points).toBe(20);
  });

  it("allows spending the balance down to exactly zero", () => {
    sumPointsToUser(GUILD, USER, 50);
    expect(subtractPointsFromUser(GUILD, USER, 50)?.points).toBe(0);
  });

  it("refuses to deduct more than the balance", () => {
    sumPointsToUser(GUILD, USER, 10);

    expect(subtractPointsFromUser(GUILD, USER, 11)).toBeUndefined();
    expect(getGuildUser(GUILD, USER)?.points).toBe(10);
  });

  it("refuses to deduct from a user that does not exist", () => {
    expect(subtractPointsFromUser(GUILD, "ghost", 1)).toBeUndefined();
  });
});

describe("transferPoints", () => {
  it("moves the amount and reports the sender's new balance", () => {
    sumPointsToUser(GUILD, USER, 50);

    expect(transferPoints(GUILD, USER, "friend", 20)?.points).toBe(30);
    expect(getGuildUser(GUILD, "friend")?.points).toBe(20);
  });

  it("writes nothing when the sender cannot cover it", () => {
    sumPointsToUser(GUILD, USER, 10);

    expect(transferPoints(GUILD, USER, "friend", 20)).toBeUndefined();
    expect(getGuildUser(GUILD, USER)?.points).toBe(10);
    expect(getGuildUser(GUILD, "friend")).toBeUndefined();
  });

  // A transfer is not a grant, so the receiver's lifetime total must not move.
  it("does not count towards the receiver's historical points", () => {
    sumPointsToUser(GUILD, USER, 50);
    transferPoints(GUILD, USER, "friend", 20);

    expect(getGuildUser(GUILD, "friend")?.historicalPoints).toBe(0);
  });
});

describe("recordMineHit", () => {
  // Regression: deltas are absolute values on the INSERT path, so a first-time
  // user used to be created with a negative balance, which then slipped past the
  // balance guard protecting every deduction.
  it("does not create a first-time user with a negative balance", () => {
    const user = recordMineHit(GUILD, "fresh", 50);

    expect(user.points).toBe(0);
    expect(user.activatedMines).toBe(1);
  });

  it("leaves a fresh victim unable to overdraw afterwards", () => {
    recordMineHit(GUILD, "fresh", 50);
    expect(subtractPointsFromUser(GUILD, "fresh", 1)).toBeUndefined();
  });

  it("subtracts from an existing balance", () => {
    sumPointsToUser(GUILD, USER, 80);
    expect(recordMineHit(GUILD, USER, 50).points).toBe(30);
  });

  // Intended: penalties are debt. Only a first-time user is clamped (see above); an existing
  // balance may go negative and stays there until the user earns it back.
  it("lets an existing user go into debt", () => {
    sumPointsToUser(GUILD, USER, 10);
    expect(recordMineHit(GUILD, USER, 50).points).toBe(-40);
  });

  it("blocks spending while in debt", () => {
    sumPointsToUser(GUILD, USER, 10);
    recordMineHit(GUILD, USER, 50);

    expect(subtractPointsFromUser(GUILD, USER, 1)).toBeUndefined();
  });

  it("counts the hit even when no points are taken", () => {
    sumPointsToUser(GUILD, USER, 80);
    const user = recordMineHit(GUILD, USER, 0);

    expect(user.points).toBe(80);
    expect(user.activatedMines).toBe(1);
  });
});

describe("recordBeg", () => {
  it("credits the reward and stamps the attempt", () => {
    const user = recordBeg(GUILD, USER, 30);

    expect(user.points).toBe(30);
    expect(user.timesBegged).toBe(1);
    expect(user.historicalPoints).toBe(30);
    expect(user.lastBeggedAt).toBeInstanceOf(Date);
  });

  it("counts a failed attempt without moving points", () => {
    recordBeg(GUILD, USER, 30);
    const user = recordBeg(GUILD, USER, 0);

    expect(user.points).toBe(30);
    expect(user.timesBegged).toBe(2);
  });
});

describe("recordDrink", () => {
  it("credits a Friday drink and counts it towards historical points", () => {
    const user = recordDrink(GUILD, USER, 15);

    expect(user.points).toBe(15);
    expect(user.historicalPoints).toBe(15);
    expect(user.monstersDrinked).toBe(1);
    expect(user.lastDrinkedAt).toBeInstanceOf(Date);
  });

  // Intended: a weekday drink is a penalty and may overdraw an existing balance.
  it("lets a weekday drink overdraw an existing balance", () => {
    sumPointsToUser(GUILD, USER, 3);
    const user = recordDrink(GUILD, USER, -15);

    expect(user.points).toBe(-12);
    expect(user.historicalPoints).toBe(0);
  });
});

describe("grantPointsToUser", () => {
  it("counts a grant towards historical points, unlike a plain credit", () => {
    sumPointsToUser(GUILD, USER, 10);
    const user = grantPointsToUser(GUILD, USER, 5);

    expect(user.points).toBe(15);
    expect(user.historicalPoints).toBe(5);
  });
});

function stampDrink(userId: string, at: Date | null): void {
  db.update(guildUsers)
    .set({ lastDrinkedAt: at })
    .where(and(eq(guildUsers.guildId, GUILD), eq(guildUsers.userId, userId)))
    .run();
}

function stampBeg(userId: string, at: Date | null): void {
  db.update(guildUsers)
    .set({ lastBeggedAt: at })
    .where(and(eq(guildUsers.guildId, GUILD), eq(guildUsers.userId, userId)))
    .run();
}

const YESTERDAY = new Date(Date.now() - 36 * 60 * 60 * 1_000);

describe("claimDailyDrink", () => {
  it("claims for a first-time user and reports no previous stamp", () => {
    expect(claimDailyDrink(GUILD, USER)).toEqual({ previous: null });
    expect(getGuildUser(GUILD, USER)?.lastDrinkedAt).toBeInstanceOf(Date);
  });

  // The whole point of the claim: the second call must lose even before any slow work happens.
  it("refuses a second claim the same day", () => {
    claimDailyDrink(GUILD, USER);

    expect(claimDailyDrink(GUILD, USER)).toBeUndefined();
  });

  it("allows a claim when the last drink was before today", () => {
    sumPointsToUser(GUILD, USER, 0);
    stampDrink(USER, YESTERDAY);

    expect(claimDailyDrink(GUILD, USER)?.previous?.getTime()).toBe(Math.floor(YESTERDAY.getTime() / 1000) * 1000);
  });

  it("hands the attempt back when released", () => {
    sumPointsToUser(GUILD, USER, 0);
    stampDrink(USER, YESTERDAY);

    const claim = claimDailyDrink(GUILD, USER);
    releaseDailyDrink(GUILD, USER, claim?.previous ?? null);

    expect(claimDailyDrink(GUILD, USER)).toBeDefined();
  });
});

describe("claimDailyBeg", () => {
  it("claims once per day", () => {
    expect(claimDailyBeg(GUILD, USER)).toBe(true);
    expect(claimDailyBeg(GUILD, USER)).toBe(false);
  });

  it("allows a claim when the last beg was before today", () => {
    sumPointsToUser(GUILD, USER, 0);
    stampBeg(USER, YESTERDAY);

    expect(claimDailyBeg(GUILD, USER)).toBe(true);
  });
});

describe("confiscatePointsPercent", () => {
  it("takes the rounded-down share and reports it", () => {
    sumPointsToUser(GUILD, USER, 101);
    const result = confiscatePointsPercent(GUILD, USER, 0.5);

    expect(result?.taken).toBe(50);
    expect(result?.user.points).toBe(51);
  });

  it("declines when the user has nothing", () => {
    sumPointsToUser(GUILD, USER, 0);
    expect(confiscatePointsPercent(GUILD, USER, 0.5)).toBeUndefined();
  });

  it("declines when the user does not exist", () => {
    expect(confiscatePointsPercent(GUILD, "ghost", 0.5)).toBeUndefined();
  });

  it("declines when the share rounds down to nothing", () => {
    sumPointsToUser(GUILD, USER, 1);
    expect(confiscatePointsPercent(GUILD, USER, 0.4)).toBeUndefined();
  });

  it("never leaves a negative balance, even for a percent above one", () => {
    sumPointsToUser(GUILD, USER, 100);
    confiscatePointsPercent(GUILD, USER, 2);

    expect(getGuildUser(GUILD, USER)?.points).toBeGreaterThanOrEqual(0);
  });
});

describe("exclusion", () => {
  it("reports an unknown user as not excluded", () => {
    expect(isUserExcluded(GUILD, "ghost")).toBe(false);
  });

  it("round-trips exclusion and readmission", () => {
    setUserExclusion(GUILD, USER, true);
    expect(isUserExcluded(GUILD, USER)).toBe(true);

    setUserExclusion(GUILD, USER, false);
    expect(isUserExcluded(GUILD, USER)).toBe(false);
  });

  it("keeps the balance intact across exclusion", () => {
    sumPointsToUser(GUILD, USER, 40);
    setUserExclusion(GUILD, USER, true);

    expect(getGuildUser(GUILD, USER)?.points).toBe(40);
  });

  it("scopes state per guild", () => {
    seedGuild("guild-2");
    setUserExclusion(GUILD, USER, true);

    expect(isUserExcluded("guild-2", USER)).toBe(false);
  });
});
