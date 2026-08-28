import { BOT_TIMEZONE } from "@shared/consts/config.constants.js";

import { DateTime } from "luxon";

export function isSameCalendarDay(a: Date, b: Date): boolean {
  return DateTime.fromJSDate(a, { zone: BOT_TIMEZONE }).hasSame(DateTime.fromJSDate(b, { zone: BOT_TIMEZONE }), "day");
}

export function isFriday(now: Date = new Date()): boolean {
  return DateTime.fromJSDate(now, { zone: BOT_TIMEZONE }).weekday === 5;
}
