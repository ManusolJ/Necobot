import { logger } from "@infrastructure/config/logger.config.js";

import type { RedditPost } from "@shared/types/reddit-post.type.js";
import type { RedditTimeframe } from "@shared/types/reddit-timeframe.type.js";
import type { RedditListingResponse } from "@shared/types/reddit-listing-response.type.js";

import { getSession, invalidateSession, buildAndroidHeaders } from "./reddit-auth.js";
import {
  REDDIT_API_BASE,
  REDDIT_TIMEOUT_MS,
  REDDIT_CACHE_TTL_MS,
  REDDIT_ERROR_BODY_LOG_LIMIT,
} from "./reddit.constants.js";

const lastGoodListings = new Map<string, { posts: RedditPost[]; fetchedAt: number }>();

function listingKey(subreddit: string, timeframe: RedditTimeframe, limit: number): string {
  return `${subreddit}:${timeframe}:${String(limit)}`;
}

function toPosts(payload: RedditListingResponse): RedditPost[] {
  const children = payload.data?.children ?? [];

  return children.flatMap((child) => {
    const post = child.data;

    if (!post?.id || !post.title || post.stickied || post.over_18) {
      return [];
    }

    return [
      {
        id: post.id,
        title: post.title,
        selftext: post.selftext ?? "",
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
      const body = await response.text();
      logger.error(
        { subreddit, status: response.status, body: body.slice(0, REDDIT_ERROR_BODY_LOG_LIMIT) },
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

export async function fetchTopPosts(
  subreddit: string,
  timeframe: RedditTimeframe,
  limit: number,
): Promise<RedditPost[] | undefined> {
  let result = await requestListing(subreddit, timeframe, limit);

  if (result === "unauthorized") {
    invalidateSession();
    result = await requestListing(subreddit, timeframe, limit);
  }

  const key = listingKey(subreddit, timeframe, limit);

  if (result !== undefined && result !== "unauthorized" && result.length > 0) {
    lastGoodListings.set(key, { posts: result, fetchedAt: Date.now() });
    return result;
  }

  const cached = lastGoodListings.get(key);

  if (cached && Date.now() - cached.fetchedAt < REDDIT_CACHE_TTL_MS) {
    logger.warn({ subreddit }, "Reddit fetch failed; serving the last successful listing");
    return cached.posts;
  }

  return undefined;
}

export function clearPostCache(): void {
  lastGoodListings.clear();
}
