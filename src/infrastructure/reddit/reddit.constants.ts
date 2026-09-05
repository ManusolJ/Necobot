export const REDDIT_TOKEN_URL = "https://www.reddit.com/auth/v2/oauth/access-token/loid";
export const REDDIT_API_BASE = "https://oauth.reddit.com";

/**
 * Client id of the official Reddit Android app. Reddit deprecated the
 * unauthenticated `.json` endpoints in May 2026, so an anonymous device token
 * minted against this id is the only way left to read public listings without a
 * developer app. Same approach Redlib uses.
 */
export const ANDROID_CLIENT_ID = "ohXpoqrZYub1kg";

/**
 * App versions advertised in the User-Agent. These go stale as Reddit ships new
 * builds, and a stale pool is the first thing to suspect if requests start
 * coming back 403. Refresh from the tail of `ANDROID_APP_VERSION_LIST` in
 * https://github.com/redlib-org/redlib/blob/main/src/oauth_resources.rs
 * (they regenerate it with `scripts/update_oauth_resources.sh`).
 */
export const ANDROID_APP_VERSIONS = [
  "Version 2024.22.1/Build 1652272",
  "Version 2024.23.1/Build 1665606",
  "Version 2024.24.1/Build 1682520",
] as const;

export const ANDROID_OS_VERSIONS = [9, 10, 11, 12, 13, 14] as const;

export const REDDIT_MEDIA_CODECS = "available-codecs=video/avc, video/hevc";

export const REDDIT_TIMEOUT_MS = 10_000;

/** Mint a new token this long before the current one actually expires. */
export const REDDIT_TOKEN_LEEWAY_MS = 120_000;

/** How long a successful listing stays usable as a fallback after a failed fetch. */
export const REDDIT_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1_000;
