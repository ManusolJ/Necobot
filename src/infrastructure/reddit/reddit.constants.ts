export const REDDIT_API_BASE = "https://oauth.reddit.com";
export const REDDIT_TOKEN_URL = "https://www.reddit.com/auth/v2/oauth/access-token/loid";

export const ANDROID_CLIENT_ID = "ohXpoqrZYub1kg";

export const ANDROID_APP_VERSIONS = [
  "Version 2024.22.1/Build 1652272",
  "Version 2024.23.1/Build 1665606",
  "Version 2024.24.1/Build 1682520",
] as const;

export const ANDROID_OS_VERSIONS = [9, 10, 11, 12, 13, 14] as const;

export const REDDIT_MEDIA_CODECS = "available-codecs=video/avc, video/hevc";

export const REDDIT_TIMEOUT_MS = 10_000;

export const REDDIT_ERROR_BODY_LOG_LIMIT = 500;

export const REDDIT_TOKEN_LEEWAY_MS = 120_000;

export const REDDIT_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1_000;
