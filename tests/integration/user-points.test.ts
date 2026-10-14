import { db } from "@infrastructure/database/client.js";
import { userData, userState, userStats } from "@infrastructure/database/schema/user.schema.js";

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

beforeAll(async () => {
  await useMigratedDatabase();
});

beforeEach(async () => {
  await resetDatabase();
  await seedGuild(GUILD);
});

describe("point arithmetic", () => {
  it("creates a user on first credit", async () => {
    expect((await sumPointsToUser(GUILD, USER, 50)).points).toBe(50);
  });

  it("accumulates across credits", async () => {
    await sumPointsToUser(GUILD, USER, 50);
    expect((await sumPointsToUser(GUILD, USER, 25)).points).toBe(75);
  });

  it("deducts when the balance covers it", async () => {
    await sumPointsToUser(GUILD, USER, 50);
    expect((await subtractPointsFromUser(GUILD, USER, 30))?.points).toBe(20);
  });

  it("allows spending the balance down to exactly zero", async () => {
    await sumPointsToUser(GUILD, USER, 50);
    expect((await subtractPointsFromUser(GUILD, USER, 50))?.points).toBe(0);
  });

  it("refuses to deduct more than the balance", async () => {
    await sumPointsToUser(GUILD, USER, 10);

    expect(await subtractPointsFromUser(GUILD, USER, 11)).toBeUndefined();
    expect((await getGuildUser(GUILD, USER))?.points).toBe(10);
  });

  it("refuses to deduct from a user that does not exist", async () => {
    expect(await subtractPointsFromUser(GUILD, "ghost", 1)).toBeUndefined();
  });
});

describe("the split user rows", () => {
  // Reads join data, state and stats, so a member missing any of the three would vanish.
  it("creates the data, state and stats rows together on a member's first write", async () => {
    await sumPointsToUser(GUILD, USER, 5);

    const member = (table: typeof userData | typeof userState | typeof userStats) =>
      db
        .select({ userId: table.userId })
        .from(table)
        .where(and(eq(table.guildId, GUILD), eq(table.userId, USER)));

    expect(await member(userData)).toHaveLength(1);
    expect(await member(userState)).toHaveLength(1);
    expect(await member(userStats)).toHaveLength(1);
  });

  it("keeps a balance and a lifetime counter in their own tables", async () => {
    await grantPointsToUser(GUILD, USER, 7);

    const [state] = await db.select().from(userState).where(eq(userState.userId, USER));
    const [stats] = await db.select().from(userStats).where(eq(userStats.userId, USER));

    expect(state?.points).toBe(7);
    expect(stats?.historicalPoints).toBe(7);
  });
});

describe("transferPoints", () => {
  it("moves the amount and reports the sender's new balance", async () => {
    await sumPointsToUser(GUILD, USER, 50);

    expect((await transferPoints(GUILD, USER, "friend", 20))?.points).toBe(30);
    expect((await getGuildUser(GUILD, "friend"))?.points).toBe(20);
  });

  it("writes nothing when the sender cannot cover it", async () => {
    await sumPointsToUser(GUILD, USER, 10);

    expect(await transferPoints(GUILD, USER, "friend", 20)).toBeUndefined();
    expect((await getGuildUser(GUILD, USER))?.points).toBe(10);
    expect(await getGuildUser(GUILD, "friend")).toBeUndefined();
  });

  // A transfer is not a grant, so the receiver's lifetime total must not move.
  it("does not count towards the receiver's historical points", async () => {
    await sumPointsToUser(GUILD, USER, 50);
    await transferPoints(GUILD, USER, "friend", 20);

    expect((await getGuildUser(GUILD, "friend"))?.historicalPoints).toBe(0);
  });
});

describe("recordMineHit", () => {
  // Regression: deltas are absolute values on the INSERT path, so a first-time
  // user used to be created with a negative balance, which then slipped past the
  // balance guard protecting every deduction.
  it("does not create a first-time user with a negative balance", async () => {
    const user = await recordMineHit(GUILD, "fresh", 50);

    expect(user.points).toBe(0);
    expect(user.activatedMines).toBe(1);
  });

  it("leaves a fresh victim unable to overdraw afterwards", async () => {
    await recordMineHit(GUILD, "fresh", 50);
    expect(await subtractPointsFromUser(GUILD, "fresh", 1)).toBeUndefined();
  });

  it("subtracts from an existing balance", async () => {
    await sumPointsToUser(GUILD, USER, 80);
    expect((await recordMineHit(GUILD, USER, 50)).points).toBe(30);
  });

  // Intended: penalties are debt. Only a first-time user is clamped (see above); an existing
  // balance may go negative and stays there until the user earns it back.
  it("lets an existing user go into debt", async () => {
    await sumPointsToUser(GUILD, USER, 10);
    expect((await recordMineHit(GUILD, USER, 50)).points).toBe(-40);
  });

  it("blocks spending while in debt", async () => {
    await sumPointsToUser(GUILD, USER, 10);
    await recordMineHit(GUILD, USER, 50);

    expect(await subtractPointsFromUser(GUILD, USER, 1)).toBeUndefined();
  });

  it("counts the hit even when no points are taken", async () => {
    await sumPointsToUser(GUILD, USER, 80);
    const user = await recordMineHit(GUILD, USER, 0);

    expect(user.points).toBe(80);
    expect(user.activatedMines).toBe(1);
  });
});

describe("recordBeg", () => {
  it("credits the reward and stamps the attempt", async () => {
    const user = await recordBeg(GUILD, USER, 30);

    expect(user.points).toBe(30);
    expect(user.timesBegged).toBe(1);
    expect(user.historicalPoints).toBe(30);
    expect(user.lastBeggedAt).toBeInstanceOf(Date);
  });

  it("counts a failed attempt without moving points", async () => {
    await recordBeg(GUILD, USER, 30);
    const user = await recordBeg(GUILD, USER, 0);

    expect(user.points).toBe(30);
    expect(user.timesBegged).toBe(2);
  });
});

describe("recordDrink", () => {
  it("credits a Friday drink and counts it towards historical points", async () => {
    const user = await recordDrink(GUILD, USER, 15);

    expect(user.points).toBe(15);
    expect(user.historicalPoints).toBe(15);
    expect(user.monstersDrinked).toBe(1);
    expect(user.lastDrinkedAt).toBeInstanceOf(Date);
  });

  // Intended: a weekday drink is a penalty and may overdraw an existing balance.
  it("lets a weekday drink overdraw an existing balance", async () => {
    await sumPointsToUser(GUILD, USER, 3);
    const user = await recordDrink(GUILD, USER, -15);

    expect(user.points).toBe(-12);
    expect(user.historicalPoints).toBe(0);
  });
});

describe("grantPointsToUser", () => {
  it("counts a grant towards historical points, unlike a plain credit", async () => {
    await sumPointsToUser(GUILD, USER, 10);
    const user = await grantPointsToUser(GUILD, USER, 5);

    expect(user.points).toBe(15);
    expect(user.historicalPoints).toBe(5);
  });
});

async function stampDrink(userId: string, at: Date | null): Promise<void> {
  await db
    .update(userState)
    .set({ lastDrinkedAt: at })
    .where(and(eq(userState.guildId, GUILD), eq(userState.userId, userId)));
}

async function stampBeg(userId: string, at: Date | null): Promise<void> {
  await db
    .update(userState)
    .set({ lastBeggedAt: at })
    .where(and(eq(userState.guildId, GUILD), eq(userState.userId, userId)));
}

const YESTERDAY = new Date(Date.now() - 36 * 60 * 60 * 1_000);

describe("claimDailyDrink", () => {
  it("claims for a first-time user and reports no previous stamp", async () => {
    expect(await claimDailyDrink(GUILD, USER)).toEqual({ previous: null });
    expect((await getGuildUser(GUILD, USER))?.lastDrinkedAt).toBeInstanceOf(Date);
  });

  // The whole point of the claim: the second call must lose even before any slow work happens.
  it("refuses a second claim the same day", async () => {
    await claimDailyDrink(GUILD, USER);

    expect(await claimDailyDrink(GUILD, USER)).toBeUndefined();
  });

  // timestamptz keeps microseconds, so the stamp comes back exactly as written.
  it("allows a claim when the last drink was before today", async () => {
    await sumPointsToUser(GUILD, USER, 0);
    await stampDrink(USER, YESTERDAY);

    expect((await claimDailyDrink(GUILD, USER))?.previous?.getTime()).toBe(YESTERDAY.getTime());
  });

  it("hands the attempt back when released", async () => {
    await sumPointsToUser(GUILD, USER, 0);
    await stampDrink(USER, YESTERDAY);

    const claim = await claimDailyDrink(GUILD, USER);
    await releaseDailyDrink(GUILD, USER, claim?.previous ?? null);

    expect(await claimDailyDrink(GUILD, USER)).toBeDefined();
  });
});

describe("claimDailyBeg", () => {
  it("claims once per day", async () => {
    expect(await claimDailyBeg(GUILD, USER)).toBe(true);
    expect(await claimDailyBeg(GUILD, USER)).toBe(false);
  });

  it("allows a claim when the last beg was before today", async () => {
    await sumPointsToUser(GUILD, USER, 0);
    await stampBeg(USER, YESTERDAY);

    expect(await claimDailyBeg(GUILD, USER)).toBe(true);
  });
});

describe("confiscatePointsPercent", () => {
  it("takes the rounded-down share and reports it", async () => {
    await sumPointsToUser(GUILD, USER, 101);
    const result = await confiscatePointsPercent(GUILD, USER, 0.5);

    expect(result?.taken).toBe(50);
    expect(result?.user.points).toBe(51);
  });

  it("declines when the user has nothing", async () => {
    await sumPointsToUser(GUILD, USER, 0);
    expect(await confiscatePointsPercent(GUILD, USER, 0.5)).toBeUndefined();
  });

  it("declines when the user does not exist", async () => {
    expect(await confiscatePointsPercent(GUILD, "ghost", 0.5)).toBeUndefined();
  });

  it("declines when the share rounds down to nothing", async () => {
    await sumPointsToUser(GUILD, USER, 1);
    expect(await confiscatePointsPercent(GUILD, USER, 0.4)).toBeUndefined();
  });

  it("never leaves a negative balance, even for a percent above one", async () => {
    await sumPointsToUser(GUILD, USER, 100);
    await confiscatePointsPercent(GUILD, USER, 2);

    expect((await getGuildUser(GUILD, USER))?.points).toBeGreaterThanOrEqual(0);
  });
});

describe("exclusion", () => {
  it("reports an unknown user as not excluded", async () => {
    expect(await isUserExcluded(GUILD, "ghost")).toBe(false);
  });

  it("round-trips exclusion and readmission", async () => {
    await setUserExclusion(GUILD, USER, true);
    expect(await isUserExcluded(GUILD, USER)).toBe(true);

    await setUserExclusion(GUILD, USER, false);
    expect(await isUserExcluded(GUILD, USER)).toBe(false);
  });

  it("keeps the balance intact across exclusion", async () => {
    await sumPointsToUser(GUILD, USER, 40);
    await setUserExclusion(GUILD, USER, true);

    expect((await getGuildUser(GUILD, USER))?.points).toBe(40);
  });

  it("scopes state per guild", async () => {
    await seedGuild("guild-2");
    await setUserExclusion(GUILD, USER, true);

    expect(await isUserExcluded("guild-2", USER)).toBe(false);
  });
});
