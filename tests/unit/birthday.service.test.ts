import { BOT_TIMEZONE } from "@shared/consts/config.constants.js";
import { formatMessage } from "@shared/utils/format-message.util.js";

import { CHEER_MESSAGES } from "@features/cheer/cheer.messages.js";
import {
  BIRTHDAY_GIFT_NOTE,
  BIRTHDAY_MENTION_OVERFLOW,
  BIRTHDAY_WARNING_MESSAGES,
} from "@features/birthday/birthday.messages.js";
import {
  BIRTHDAY_GIFT_POINTS,
  BIRTHDAY_WARNING_DAYS,
  BIRTHDAY_MENTION_BUDGET,
  BIRTHDAY_MESSAGE_RESERVE,
} from "@features/birthday/birthday.constants.js";

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

/** Realistic 18-digit snowflakes, so mention lengths match production. */
function ids(count: number): string[] {
  return Array.from({ length: count }, (_, index) => `12345678901234567${String(index % 10)}`);
}

const MENTION_LENGTH = `<@${ids(1)[0] ?? ""}>`.length;

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

  it("leaves the list alone when it fits the budget", () => {
    expect(formatMentionList(["a", "b"], 100)).toBe("<@a> y <@b>");
  });

  it("trims to the overflow note when the list does not fit", () => {
    const result = formatMentionList(ids(10), 200);

    expect(result).toContain(BIRTHDAY_MENTION_OVERFLOW);
    expect(result.length).toBeLessThanOrEqual(200);
  });

  it("keeps as many mentions as the budget allows before the note", () => {
    const result = formatMentionList(ids(5), BIRTHDAY_MENTION_OVERFLOW.length + MENTION_LENGTH);

    expect(result).toBe(`<@${ids(1)[0] ?? ""}>${BIRTHDAY_MENTION_OVERFLOW}`);
  });

  // Degenerate, but the cap should still hold rather than being overshot.
  it("respects a budget smaller than the overflow note itself", () => {
    expect(formatMentionList(ids(5), 10).length).toBeLessThanOrEqual(10);
  });

  it("never exceeds the real budget even with a crowd", () => {
    const crowd = Array.from({ length: 500 }, (_, index) => `1234567890123456${String(index).padStart(2, "0")}`);

    expect(formatMentionList(crowd, BIRTHDAY_MENTION_BUDGET).length).toBeLessThanOrEqual(BIRTHDAY_MENTION_BUDGET);
  });
});

// Guards the flat reserve: a template long enough to eat into the mention budget
// fails here rather than overflowing a real message.
describe("BIRTHDAY_MESSAGE_RESERVE", () => {
  it("leaves room for the longest template, the gift note and the overflow tail", () => {
    const note = formatMessage(BIRTHDAY_GIFT_NOTE, { points: String(BIRTHDAY_GIFT_POINTS) });

    const longestCheer = Math.max(...CHEER_MESSAGES.map((template) => formatMessage(template, { user: "" }).length));

    const longestWarning = Math.max(
      ...BIRTHDAY_WARNING_MESSAGES.map(
        (template) => formatMessage(template, { days: String(BIRTHDAY_WARNING_DAYS), users: "" }).length,
      ),
    );

    const worstCase = Math.max(longestCheer + note.length + 2, longestWarning) + BIRTHDAY_MENTION_OVERFLOW.length;

    expect(worstCase).toBeLessThanOrEqual(BIRTHDAY_MESSAGE_RESERVE);
  });
});
