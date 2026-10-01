import { env } from "@infrastructure/config/env.config.js";
import { logger } from "@infrastructure/config/logger.config.js";

import type { BookVolume } from "@shared/types/book-volume.type.js";
import type { GoogleBooksVolume } from "@shared/types/google-books-volume.type.js";
import type { GoogleBooksResponse } from "@shared/types/google-books-response.type.js";
import type { GoogleBooksVolumeInfo } from "@shared/types/google-books-volume-info.type.js";

import {
  GOOGLE_BOOKS_FIELDS,
  GOOGLE_BOOKS_API_BASE,
  GOOGLE_BOOKS_ATTEMPTS,
  GOOGLE_BOOKS_TIMEOUT_MS,
  GOOGLE_BOOKS_MAX_RESULTS,
  GOOGLE_BOOKS_RETRY_DELAY_MS,
  GOOGLE_BOOKS_ERROR_BODY_LOG_LIMIT,
} from "./google-books.constants.js";

import { setTimeout as sleep } from "node:timers/promises";

function toHttps(url: string | undefined): string | undefined {
  return url?.replace(/^http:/u, "https:");
}

function cleanCoverUrl(url: string | undefined): string | undefined {
  return toHttps(url)?.replace(/&edge=curl/u, "");
}

function cleanDescription(description: string | undefined): string | undefined {
  return (
    description
      ?.replace(/<br\s*\/?>|<\/p>/giu, "\n")
      .replace(/<[^>]+>/gu, "")
      .replace(/\n{3,}/gu, "\n\n")
      .trim() || undefined
  );
}

function pickIsbn(info: GoogleBooksVolumeInfo): string | undefined {
  const identifiers = info.industryIdentifiers ?? [];

  return (
    identifiers.find((entry) => entry.type === "ISBN_13")?.identifier ??
    identifiers.find((entry) => entry.type === "ISBN_10")?.identifier
  );
}

function toVolume(item: GoogleBooksVolume): BookVolume | undefined {
  const info = item.volumeInfo;

  if (!item.id || !info?.title) {
    return undefined;
  }

  return {
    id: item.id,
    title: info.title,
    subtitle: info.subtitle,
    authors: info.authors ?? [],
    publisher: info.publisher,
    publishedDate: info.publishedDate,
    description: cleanDescription(info.description),
    pageCount: info.pageCount,
    categories: info.categories ?? [],
    averageRating: info.averageRating,
    ratingsCount: info.ratingsCount,
    language: info.language,
    isbn: pickIsbn(info),
    thumbnail: cleanCoverUrl(info.imageLinks?.thumbnail),
    link: toHttps(info.infoLink),
  };
}

// TODO: Find better fix for Google's horrible API
async function fetchWithRetry(url: string, query: string): Promise<Response | undefined> {
  for (let attempt = 1; attempt <= GOOGLE_BOOKS_ATTEMPTS; attempt++) {
    if (attempt > 1) {
      await sleep(GOOGLE_BOOKS_RETRY_DELAY_MS * (attempt - 1));
    }

    try {
      const response = await fetch(url, {
        headers: { "X-Goog-Api-Key": env.GOOGLE_BOOKS_API_KEY },
        signal: AbortSignal.timeout(GOOGLE_BOOKS_TIMEOUT_MS),
      });

      if (response.status < 500) {
        return response;
      }

      logger.warn({ query, attempt, status: response.status }, "Google Books is unavailable");
    } catch (error) {
      logger.warn({ err: error, query, attempt }, "Google Books request errored");

      if (error instanceof Error && error.name === "TimeoutError") {
        return undefined;
      }
    }
  }

  return undefined;
}

export async function searchVolumes(query: string): Promise<BookVolume[] | undefined> {
  const params = new URLSearchParams({
    q: query,
    printType: "books",
    maxResults: String(GOOGLE_BOOKS_MAX_RESULTS),
    fields: GOOGLE_BOOKS_FIELDS,
  });

  const response = await fetchWithRetry(`${GOOGLE_BOOKS_API_BASE}/volumes?${params.toString()}`, query);

  if (!response) {
    return undefined;
  }

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    logger.error(
      { query, status: response.status, body: body.slice(0, GOOGLE_BOOKS_ERROR_BODY_LOG_LIMIT) },
      "Google Books request failed",
    );
    return undefined;
  }

  try {
    const payload = (await response.json()) as GoogleBooksResponse;

    return (payload.items ?? []).flatMap((item) => toVolume(item) ?? []);
  } catch (error) {
    logger.error({ err: error, query }, "Google Books returned an unreadable body");
    return undefined;
  }
}
