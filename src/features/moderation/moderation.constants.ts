import { ThreadAutoArchiveDuration } from "discord.js";

export const PUNISH_PERCENT = 0.5;

export const CLEANUP_MESSAGE_COUNT = 30;
export const CLEANUP_MAX_MESSAGES = 100;

export const CLEANUP_CONFIRM_TIMEOUT_MS = 60_000;

export const MESSAGE_ID_PATTERN = /^\d{17,20}$/u;

export const ARCHIVE_CHANNEL_PURPOSE = "archive";
export const ARCHIVE_THREAD_NAME_MAX_LENGTH = 100;
export const ARCHIVE_THREAD_AUTO_ARCHIVE = ThreadAutoArchiveDuration.OneWeek;

export const ARCHIVE_LINE_TRUNCATION = "…";
export const ARCHIVE_EMPTY_CONTENT = "*(sin texto)*";
