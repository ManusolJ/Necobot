import { logger } from "@infrastructure/config/logger.config.js";

import type { RedditPost } from "@shared/types/reddit-post.type.js";
import type { RedditTimeframe } from "@shared/types/reddit-timeframe.type.js";
import type { RedditListingResponse } from "@shared/types/reddit-listing-response.type.js";

import { getSession, invalidateSession, buildAndroidHeaders } from "./reddit-auth.js";
import { REDDIT_API_BASE, REDDIT_TIMEOUT_MS, REDDIT_CACHE_TTL_MS } from "./reddit.constants.js";

let lastGoodPosts: RedditPost[] | undefined;
let lastGoodFetchedAt = 0;

function toPosts(payload: RedditListingResponse): RedditPost[] {
  const children = payload.data?.children ?? [];

  return children.flatMap((child) => {
    const post = child.data;

    if (!post?.id || !post.title || post.stickied) {
      return [];
    }

    return [
      {
        id: post.id,
        title: post.title,
        selftext: post.selftext ?? "",
        permalink: post.permalink ?? "",
      },
    ];
  });
}

async function requestListing(
  subreddit: string,
  timeframe: RedditTimeframe,
  limit: number,
): Promise<RedditPost[] | "unauthorized" | undefined> {
  const session = await getSession();

  if (!session) {
    return undefined;
  }

  const url = `${REDDIT_API_BASE}/r/${subreddit}/top?t=${timeframe}&limit=${String(limit)}&raw_json=1`;

  try {
    const response = await fetch(url, {
      headers: {
        ...buildAndroidHeaders(session),
        Authorization: `Bearer ${session.accessToken}`,
      },
      signal: AbortSignal.timeout(REDDIT_TIMEOUT_MS),
    });

    if (response.status === 401) {
      return "unauthorized";
    }

    if (!response.ok) {
      logger.error(
        { subreddit, status: response.status, body: await response.text() },
        "Reddit listing request failed",
      );
      return undefined;
    }

    return toPosts((await response.json()) as RedditListingResponse);
  } catch (error) {
    logger.error({ err: error, subreddit }, "Reddit listing request errored");
    return undefined;
  }
}

/**
 * Reads the top posts of a subreddit through the Android client emulation.
 *
 * Falls back to the last successful listing when Reddit refuses the request, so a
 * transient block costs freshness rather than the whole feature. Returns undefined
 * only when there is nothing cached to fall back to.
 */
export async function fetchTopPosts(
  subreddit: string,
  timeframe: RedditTimeframe,
  limit: number,
): Promise<RedditPost[] | undefined> {
  let result = await requestListing(subreddit, timeframe, limit);

  if (result === "unauthorized") {
    // The token expired early or was dropped server-side; mint a fresh one and retry once.
    invalidateSession();
    result = await requestListing(subreddit, timeframe, limit);
  }

  if (result !== undefined && result !== "unauthorized" && result.length > 0) {
    lastGoodPosts = result;
    lastGoodFetchedAt = Date.now();
    return result;
  }

  if (lastGoodPosts && Date.now() - lastGoodFetchedAt < REDDIT_CACHE_TTL_MS) {
    logger.warn({ subreddit }, "Reddit fetch failed; serving the last successful listing");
    return lastGoodPosts;
  }

  return undefined;
}

export function clearPostCache(): void {
  lastGoodPosts = undefined;
  lastGoodFetchedAt = 0;
}
