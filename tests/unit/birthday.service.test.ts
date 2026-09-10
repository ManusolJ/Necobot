import { BOT_TIMEZONE } from "@shared/consts/config.constants.js";

import { DateTime } from "luxon";
import { describe, expect, it, vi } from "vitest";

vi.mock("@core/services/user.service.js", () => ({
  claimBirthdayGift: vi.fn(),
  claimBirthdayWarning: vi.fn(),
  getUsersWithBirthday: vi.fn(),
}));

vi.mock("@core/services/guild.service.js", () => ({ getGuildSettings: vi.fn() }));

const { formatBirthday, formatMentionList, getBirthdayKeysForDate, isLeapDay, parseBirthday } =
  await import("@features/birthday/birthday.service.js");

function at(iso: string): DateTime {
  return DateTime.fromISO(iso, { zone: BOT_TIMEZONE });
}

describe("parseBirthday", () => {
  it("parses DD/MM with and without leading zeros", () => {
    expect(parseBirthday("09/12")).toEqual({ day: 9, month: 12 });
    expect(parseBirthday("9/12")).toEqual({ day: 9, month: 12 });
    expect(parseBirthday("31/01")).toEqual({ day: 31, month: 1 });
  });

  it("ignores surrounding whitespace", () => {
    expect(parseBirthday("  09/12  ")).toEqual({ day: 9, month: 12 });
  });

  // 29/02 is a real birthday even though it is not a real date every year.
  it("accepts the leap day", () => {
    expect(parseBirthday("29/02")).toEqual({ day: 29, month: 2 });
  });

  it("rejects days that the month does not have", () => {
    expect(parseBirthday("30/02")).toBeUndefined();
    expect(parseBirthday("31/02")).toBeUndefined();
    expect(parseBirthday("31/04")).toBeUndefined();
    expect(parseBirthday("31/06")).toBeUndefined();
    expect(parseBirthday("31/09")).toBeUndefined();
    expect(parseBirthday("31/11")).toBeUndefined();
  });

  it("rejects out-of-range days and months", () => {
    expect(parseBirthday("00/01")).toBeUndefined();
    expect(parseBirthday("32/01")).toBeUndefined();
    expect(parseBirthday("01/00")).toBeUndefined();
    expect(parseBirthday("01/13")).toBeUndefined();
    expect(parseBirthday("99/99")).toBeUndefined();
  });

  it("rejects anything that is not DD/MM", () => {
    expect(parseBirthday("")).toBeUndefined();
    expect(parseBirthday("hoy")).toBeUndefined();
    expect(parseBirthday("09-12")).toBeUndefined();
    expect(parseBirthday("09/12/1999")).toBeUndefined();
    expect(parseBirthday("009/12")).toBeUndefined();
    expect(parseBirthday("09 / 12")).toBeUndefined();
  });
});

describe("formatBirthday", () => {
  it("pads both halves to two digits", () => {
    expect(formatBirthday({ day: 9, month: 2 })).toBe("09/02");
    expect(formatBirthday({ day: 31, month: 12 })).toBe("31/12");
  });
});

describe("isLeapDay", () => {
  it("only matches 29/02", () => {
    expect(isLeapDay({ day: 29, month: 2 })).toBe(true);
    expect(isLeapDay({ day: 28, month: 2 })).toBe(false);
    expect(isLeapDay({ day: 29, month: 3 })).toBe(false);
  });
});

describe("getBirthdayKeysForDate", () => {
  it("returns just the day itself on an ordinary date", () => {
    expect(getBirthdayKeysForDate(at("2027-03-15"))).toEqual([{ day: 15, month: 3 }]);
  });

  // The leap-day fallback: in a non-leap year, 28/02 covers both crowds.
  it("folds 29/02 into 28/02 in a non-leap year", () => {
    expect(getBirthdayKeysForDate(at("2027-02-28"))).toEqual([
      { day: 28, month: 2 },
      { day: 29, month: 2 },
    ]);
  });

  it("leaves 28/02 alone in a leap year", () => {
    expect(getBirthdayKeysForDate(at("2028-02-28"))).toEqual([{ day: 28, month: 2 }]);
  });

  it("matches 29/02 directly in a leap year", () => {
    expect(getBirthdayKeysForDate(at("2028-02-29"))).toEqual([{ day: 29, month: 2 }]);
  });

  it("does not fold on 01/03 of a non-leap year", () => {
    expect(getBirthdayKeysForDate(at("2027-03-01"))).toEqual([{ day: 1, month: 3 }]);
  });
});

describe("formatMentionList", () => {
  it("returns an empty string for nobody", () => {
    expect(formatMentionList([])).toBe("");
  });

  it("returns a bare mention for one user", () => {
    expect(formatMentionList(["a"])).toBe("<@a>");
  });

  // Several birthdays on one day get folded into a single readable list.
  it("joins two users with 'y'", () => {
    expect(formatMentionList(["a", "b"])).toBe("<@a> y <@b>");
  });

  it("comma-separates all but the last of three or more", () => {
    expect(formatMentionList(["a", "b", "c"])).toBe("<@a>, <@b> y <@c>");
  });
});
