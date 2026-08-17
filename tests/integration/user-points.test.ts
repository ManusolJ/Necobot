import {
  recordBeg,
  getGuildUser,
  recordMineHit,
  isUserExcluded,
  sumPointsToUser,
  setUserExclusion,
  subtractPointsFromUser,
  confiscatePointsPercent,
} from "@core/services/user.service.js";

import { resetDatabase, seedGuild, useMigratedDatabase } from "../helpers/database.js";

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
