import { logger } from "@infrastructure/config/logger.config.js";

import type { RedditSession } from "@shared/types/reddit-session.type.js";

import {
  REDDIT_TOKEN_URL,
  ANDROID_CLIENT_ID,
  REDDIT_TIMEOUT_MS,
  ANDROID_OS_VERSIONS,
  REDDIT_MEDIA_CODECS,
  ANDROID_APP_VERSIONS,
  REDDIT_TOKEN_LEEWAY_MS,
} from "./reddit.constants.js";

import { randomUUID } from "node:crypto";

let cachedSession: RedditSession | undefined;

function pickRandom<T>(values: readonly [T, ...T[]]): T {
  const index = Math.floor(Math.random() * values.length);
  return values[index] ?? values[0];
}

/** Mirrors the connection-quality figure the Android app reports on every call. */
function randomQualityOfService(): string {
  return (Math.floor(Math.random() * 99_000 + 1_000) / 1_000).toFixed(3);
}

/**
 * Headers shared by the token request and every later API call. The device id and
 * User-Agent are fixed for the life of a session on purpose: rotating them per
 * request is what makes traffic look automated, which is how the previous
 * User-Agent-shuffling fetcher got itself blocked.
 */
export function buildAndroidHeaders(session: Omit<RedditSession, "accessToken" | "expiresAt">): Record<string, string> {
  const headers: Record<string, string> = {
    "User-Agent": session.userAgent,
    "client-vendor-id": session.deviceId,
    "X-Reddit-Device-Id": session.deviceId,
    "x-reddit-compression": "1",
    "x-reddit-retry": "algo=no-retries",
    "x-reddit-qos": randomQualityOfService(),
    "x-reddit-media-codecs": REDDIT_MEDIA_CODECS,
  };

  if (session.loid) {
    headers["x-reddit-loid"] = session.loid;
  }

  if (session.session) {
    headers["x-reddit-session"] = session.session;
  }

  return headers;
}

async function mintSession(): Promise<RedditSession | undefined> {
  const deviceId = randomUUID();
  const appVersion = pickRandom(ANDROID_APP_VERSIONS);
  const osVersion = pickRandom(ANDROID_OS_VERSIONS);
  const userAgent = `Reddit/${appVersion}/Android ${String(osVersion)}`;

  try {
    const response = await fetch(REDDIT_TOKEN_URL, {
      method: "POST",
      headers: {
        ...buildAndroidHeaders({ deviceId, userAgent, loid: undefined, session: undefined }),
        Authorization: `Basic ${Buffer.from(`${ANDROID_CLIENT_ID}:`).toString("base64")}`,
        "Content-Type": "application/json; charset=UTF-8",
      },
      body: JSON.stringify({ scopes: ["*", "email", "pii"] }),
      signal: AbortSignal.timeout(REDDIT_TIMEOUT_MS),
    });

    if (!response.ok) {
      logger.error({ status: response.status, body: await response.text() }, "Reddit token request failed");
      return undefined;
    }

    const data = (await response.json()) as { access_token?: string; expires_in?: number };

    if (!data.access_token || typeof data.expires_in !== "number") {
      logger.error({ data }, "Reddit token response was missing a token or an expiry");
      return undefined;
    }

    return {
      accessToken: data.access_token,
      expiresAt: Date.now() + Math.max(data.expires_in * 1_000 - REDDIT_TOKEN_LEEWAY_MS, 0),
      deviceId,
      userAgent,
      loid: response.headers.get("x-reddit-loid") ?? undefined,
      session: response.headers.get("x-reddit-session") ?? undefined,
    };
  } catch (error) {
    logger.error({ err: error }, "Reddit token request errored");
    return undefined;
  }
}

export async function getSession(): Promise<RedditSession | undefined> {
  if (cachedSession && Date.now() < cachedSession.expiresAt) {
    return cachedSession;
  }

  cachedSession = await mintSession();
  return cachedSession;
}

export function invalidateSession(): void {
  cachedSession = undefined;
}
