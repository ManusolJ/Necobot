import { logger } from "@infrastructure/config/logger.config.js";

import type { WorkSummary } from "@shared/types/work-summary.type.js";
import type { WikidataSearchResponse } from "@shared/types/wikidata-search-response.type.js";
import type { WikidataEntitiesResponse } from "@shared/types/wikidata-entities-response.type.js";
import type { WikipediaSummaryResponse } from "@shared/types/wikipedia-summary-response.type.js";

import {
  WIKIDATA_API_URL,
  WIKIMEDIA_USER_AGENT,
  WIKIMEDIA_TIMEOUT_MS,
  WIKIDATA_WORK_CLASSES,
  WIKIPEDIA_LANGUAGE_PATTERN,
} from "./wikipedia.constants.js";

async function getJson<T>(url: string): Promise<T | undefined> {
  const response = await fetch(url, {
    headers: { "User-Agent": WIKIMEDIA_USER_AGENT },
    signal: AbortSignal.timeout(WIKIMEDIA_TIMEOUT_MS),
  });

  if (!response.ok) {
    logger.warn({ url, status: response.status }, "Wikimedia request failed");
    return undefined;
  }

  return (await response.json()) as T;
}

async function findWorkEntity(title: string, author: string | undefined): Promise<string | undefined> {
  const surname = author?.trim().split(/\s+/u).at(-1);
  const classes = WIKIDATA_WORK_CLASSES.map((id) => `P31=${id}`).join("|");
  const search = [title, surname, `haswbstatement:${classes}`].filter(Boolean).join(" ");

  const payload = await getJson<WikidataSearchResponse>(
    `${WIKIDATA_API_URL}?action=query&format=json&formatversion=2&list=search&srlimit=1` +
      `&srsearch=${encodeURIComponent(search)}`,
  );

  return payload?.query?.search?.[0]?.title;
}

async function findArticleTitle(entityId: string, language: string): Promise<string | undefined> {
  const site = `${language}wiki`;
  const payload = await getJson<WikidataEntitiesResponse>(
    `${WIKIDATA_API_URL}?action=wbgetentities&format=json&props=sitelinks` +
      `&ids=${encodeURIComponent(entityId)}&sitefilter=${site}`,
  );

  return payload?.entities?.[entityId]?.sitelinks?.[site]?.title;
}

async function fetchArticleSummary(articleTitle: string, language: string): Promise<WorkSummary | undefined> {
  const payload = await getJson<WikipediaSummaryResponse>(
    `https://${language}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(articleTitle.replaceAll(" ", "_"))}`,
  );
  const extract = payload?.extract?.trim();

  if (payload?.type !== "standard" || !extract) {
    return undefined;
  }

  return {
    title: payload.title ?? articleTitle,
    extract,
    language,
    url: payload.content_urls?.desktop?.page,
    thumbnail: payload.thumbnail?.source,
  };
}

export async function fetchWorkSummary(
  title: string,
  author: string | undefined,
  language: string,
): Promise<WorkSummary | undefined> {
  if (!WIKIPEDIA_LANGUAGE_PATTERN.test(language)) {
    return undefined;
  }

  try {
    const entityId = await findWorkEntity(title, author);
    const articleTitle = entityId ? await findArticleTitle(entityId, language) : undefined;

    return articleTitle ? await fetchArticleSummary(articleTitle, language) : undefined;
  } catch (error) {
    logger.warn({ err: error, title, language }, "Wikipedia summary lookup errored");
    return undefined;
  }
}
