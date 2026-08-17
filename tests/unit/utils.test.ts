import { randomInt } from "@shared/utils/random-int.util.js";
import { pickRandom } from "@shared/utils/pick-random.util.js";
import { getLogLevel } from "@shared/utils/get-log-level.util.js";
import { formatMessage } from "@shared/utils/format-message.util.js";
import { isSameCalendarDay } from "@shared/utils/is-same-day.util.js";
import { FALLBACK_MESSAGE, getUserErrorMessage } from "@shared/utils/error-messages.util.js";

import { LogLevel } from "@sapphire/framework";
import { afterEach, describe, expect, it, vi } from "vitest";

describe("randomInt", () => {
  it("includes both bounds", () => {
    const seen = new Set<number>();
    for (let i = 0; i < 500; i += 1) {
      seen.add(randomInt(1, 3));
    }

    expect([...seen].sort()).toEqual([1, 2, 3]);
  });

  it("returns the bound when the range is a single value", () => {
    expect(randomInt(7, 7)).toBe(7);
  });

  it("returns the low bound when Math.random is at its floor", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    expect(randomInt(5, 10)).toBe(5);
  });

  it("returns the high bound when Math.random approaches one", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.999999);
    expect(randomInt(5, 10)).toBe(10);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });
});

describe("pickRandom", () => {
  it("returns an element of the array", () => {
    const items = ["a", "b", "c"] as const;
    expect(items).toContain(pickRandom(items));
  });

  it("returns the only element of a single-item array", () => {
    expect(pickRandom(["only"])).toBe("only");
  });

  it("can reach the last element", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.999999);
    expect(pickRandom(["a", "b", "c"])).toBe("c");
    vi.restoreAllMocks();
  });
});

describe("formatMessage", () => {
  it("substitutes every placeholder", () => {
    expect(formatMessage("{user} won {amount}", { user: "Neco", amount: 30 })).toBe("Neco won 30");
  });

  it("replaces repeated placeholders", () => {
    expect(formatMessage("{a} vs {a}", { a: "x" })).toBe("x vs x");
  });

  it("leaves unknown placeholders untouched", () => {
    expect(formatMessage("{known} {unknown}", { known: "yes" })).toBe("yes {unknown}");
  });

  it("does not treat replacement values as further templates", () => {
    expect(formatMessage("{a}", { a: "{b}" })).toBe("{b}");
  });
});

describe("isSameCalendarDay", () => {
  it("treats two times on the same local day as equal", () => {
    expect(isSameCalendarDay(new Date("2026-03-10T08:00:00Z"), new Date("2026-03-10T20:00:00Z"))).toBe(true);
  });

  it("separates consecutive days", () => {
    expect(isSameCalendarDay(new Date("2026-03-10T12:00:00Z"), new Date("2026-03-11T12:00:00Z"))).toBe(false);
  });

  it("uses the bot timezone rather than UTC", () => {
    const lateUtc = new Date("2026-01-10T23:30:00Z");
    const nextMorning = new Date("2026-01-11T09:00:00Z");

    expect(isSameCalendarDay(lateUtc, nextMorning)).toBe(true);
  });
});

describe("getUserErrorMessage", () => {
  it("resolves a known error code", () => {
    expect(getUserErrorMessage("guild_not_configured")).toContain("/settings");
  });

  it("falls back for an unknown code", () => {
    expect(getUserErrorMessage("no_such_code")).toBe(FALLBACK_MESSAGE);
  });
});

describe("getLogLevel", () => {
  it("maps each configured level onto the framework enum", () => {
    expect(getLogLevel("trace")).toBe(LogLevel.Trace);
    expect(getLogLevel("debug")).toBe(LogLevel.Debug);
    expect(getLogLevel("info")).toBe(LogLevel.Info);
    expect(getLogLevel("warn")).toBe(LogLevel.Warn);
    expect(getLogLevel("error")).toBe(LogLevel.Error);
    expect(getLogLevel("fatal")).toBe(LogLevel.Fatal);
  });
});
