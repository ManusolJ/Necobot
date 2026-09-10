import type { Birthday } from "@shared/types/birthday.type.js";

export const BIRTHDAY_WARNING_DAYS = 7;

export const BIRTHDAY_GIFT_POINTS = 350;

export const BIRTHDAY_SWEEP_HOUR = 9;

export const BIRTHDAY_CRON = `0 ${String(BIRTHDAY_SWEEP_HOUR)} * * *`;

export const BIRTHDAY_RETRY_ATTEMPTS = 3;
export const BIRTHDAY_RETRY_DELAY_MS = 300_000;

export const BIRTHDAY_PATTERN = /^(\d{1,2})\/(\d{1,2})$/;

export const BIRTHDAY_LEAP_REFERENCE_YEAR = 2024;

export const LEAP_DAY: Birthday = { day: 29, month: 2 };

export const LEAP_DAY_FALLBACK: Birthday = { day: 28, month: 2 };
