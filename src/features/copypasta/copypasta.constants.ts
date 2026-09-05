import type { RedditTimeframe } from "@shared/types/reddit-timeframe.type.js";

export const COPYPASTA_SUBREDDIT = "copypasta_es";

export const COPYPASTA_TIMEFRAME: RedditTimeframe = "week";

export const COPYPASTA_FETCH_LIMIT = 50;

export const COPYPASTA_CHANNEL_PURPOSE = "copypasta";

export const COPYPASTA_CRON = "0 22 * * *";

export const COPYPASTA_RETRY_ATTEMPTS = 3;
export const COPYPASTA_RETRY_DELAY_MS = 300_000;

export const COPYPASTA_MIN_LENGTH = 100;

export const COPYPASTA_MAX_LENGTH = 1_800;

export const DISCORD_MAX_LENGTH = 2_000;

export const RECENT_POSTS_MEMORY = 50;
