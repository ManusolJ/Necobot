import type { BookVolume } from "@shared/types/book-volume.type.js";
import type { BookRequest } from "@shared/types/book-request.type.js";
import type { EditionPick } from "@shared/types/edition-pick.type.js";

import {
  BOOK_MIN_LANGUAGE_HITS,
  BOOK_MIN_TITLE_COVERAGE,
  BOOK_LANGUAGE_STOPWORDS,
  BOOK_DERIVATIVE_PATTERN,
  BOOK_MIN_SYNOPSIS_LENGTH,
  BOOK_FUZZY_TOKEN_MIN_LENGTH,
  BOOK_AUTHOR_TOKEN_MIN_LENGTH,
  BOOK_MIN_SENTENCE_LANGUAGE_HITS,
} from "./book-info.constants.js";

interface RankedVolume {
  volume: BookVolume;
  index: number;
  coverage: number;
  exact: boolean;
  authorMatch: boolean;
  editions: number;
}

export function primaryLanguage(code: string | undefined): string | undefined {
  return code?.split("-")[0]?.toLowerCase() || undefined;
}

export function normalizeText(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function tokenize(text: string): string[] {
  const normalized = normalizeText(text);
  return normalized ? normalized.split(" ") : [];
}

export function stripEditionNotes(title: string): string {
  const stripped = title.replace(/\(.*?\)|\[.*?\]/gu, " ").split(/\s[/|]\s/u)[0] ?? title;
  return stripped.replace(/\s+/gu, " ").trim() || title.trim();
}

function tokensMatch(a: string, b: string): boolean {
  if (a === b) {
    return true;
  }

  const fuzzy = a.length >= BOOK_FUZZY_TOKEN_MIN_LENGTH && b.length >= BOOK_FUZZY_TOKEN_MIN_LENGTH;
  return fuzzy && (a.startsWith(b) || b.startsWith(a));
}

function sharesAuthor(names: string[], others: string[]): boolean {
  const theirs = tokenize(others.join(" ")).filter((token) => token.length >= BOOK_AUTHOR_TOKEN_MIN_LENGTH);

  return tokenize(names.join(" "))
    .filter((token) => token.length >= BOOK_AUTHOR_TOKEN_MIN_LENGTH)
    .some((token) => theirs.some((other) => tokensMatch(token, other)));
}

function isSameWork(volume: BookVolume, work: BookVolume): boolean {
  const sameTitle = normalizeText(stripEditionNotes(volume.title)) === normalizeText(stripEditionNotes(work.title));
  const authorsKnown = volume.authors.length > 0 && work.authors.length > 0;

  return sameTitle && (!authorsKnown || sharesAuthor(volume.authors, work.authors));
}

function rank(volume: BookVolume, index: number, volumes: BookVolume[], request: BookRequest): RankedVolume {
  const queryTokens = tokenize(request.title);
  const titleTokens = tokenize(`${volume.title} ${volume.subtitle ?? ""}`);
  const matched = queryTokens.filter((token) => titleTokens.some((candidate) => tokensMatch(token, candidate)));

  return {
    volume,
    index,
    coverage: queryTokens.length > 0 ? matched.length / queryTokens.length : 0,
    exact: normalizeText(stripEditionNotes(volume.title)) === normalizeText(request.title),
    authorMatch: request.author !== undefined && sharesAuthor([request.author], volume.authors),
    editions:
      volume.authors.length === 0
        ? 0
        : volumes.filter((other) => other.authors.length > 0 && isSameWork(other, volume)).length,
  };
}

function compareRanked(a: RankedVolume, b: RankedVolume): number {
  return (
    Number(b.authorMatch) - Number(a.authorMatch) ||
    b.coverage - a.coverage ||
    Number(b.exact) - Number(a.exact) ||
    b.editions - a.editions ||
    a.index - b.index
  );
}

export function detectLanguage(text: string, minHits: number = BOOK_MIN_LANGUAGE_HITS): string | undefined {
  const tokens = tokenize(text);
  const scores = Object.entries(BOOK_LANGUAGE_STOPWORDS)
    .map(([language, stopwords]) => ({ language, hits: tokens.filter((token) => stopwords.has(token)).length }))
    .sort((a, b) => b.hits - a.hits);

  const [best, runnerUp] = scores;

  if (!best || best.hits < minHits || best.hits === runnerUp?.hits) {
    return undefined;
  }

  return best.language;
}

function sentencesOf(text: string): string[] {
  return text.match(/[^.!?…]+(?:[.!?…]+["'»”)\]]*|$)\s*/gu) ?? [text];
}

export function detectSynopsisLanguage(description: string): string | undefined {
  let opening = "";

  for (const sentence of sentencesOf(description)) {
    opening += sentence;
    const detected = detectLanguage(opening);

    if (detected) {
      return detected;
    }
  }

  return undefined;
}

export function trimToLanguage(text: string, language: string): string {
  let kept = "";
  let pending = "";

  for (const sentence of sentencesOf(text)) {
    const detected = detectLanguage(sentence, BOOK_MIN_SENTENCE_LANGUAGE_HITS);

    if (detected === undefined) {
      pending += sentence;
      continue;
    }

    if (kept && detected !== language) {
      return kept.trim();
    }

    kept += pending + sentence;
    pending = "";
  }

  return (kept + pending).trim() || text;
}

export function preferredDescription(volumes: BookVolume[]): { volume: BookVolume; description: string } | undefined {
  const isStandard = (volume: BookVolume): boolean => stripEditionNotes(volume.title) === volume.title.trim();
  const isSubstantial = (description: string): boolean => description.length >= BOOK_MIN_SYNOPSIS_LENGTH;

  return volumes
    .flatMap((volume) => (volume.description ? [{ volume, description: volume.description }] : []))
    .sort(
      (a, b) =>
        Number(isSubstantial(b.description)) - Number(isSubstantial(a.description)) ||
        Number(isStandard(b.volume)) - Number(isStandard(a.volume)),
    )[0];
}

function hasSynopsisIn(volume: BookVolume, language: string): boolean {
  if (primaryLanguage(volume.language) !== language || !volume.description) {
    return false;
  }

  const detected = detectSynopsisLanguage(volume.description);
  return detected === undefined || detected === language;
}

export function pickEdition(volumes: BookVolume[], request: BookRequest): EditionPick | undefined {
  const wantsDerivative = BOOK_DERIVATIVE_PATTERN.test(normalizeText(request.title));
  const isDerivative = (volume: BookVolume): boolean =>
    BOOK_DERIVATIVE_PATTERN.test(normalizeText(`${volume.title} ${volume.subtitle ?? ""}`));

  const relevant = volumes
    .map((volume, index) => rank(volume, index, volumes, request))
    .filter((ranked) => ranked.coverage >= BOOK_MIN_TITLE_COVERAGE);
  const preferred = wantsDerivative ? relevant : relevant.filter((ranked) => !isDerivative(ranked.volume));
  const pool = preferred.length > 0 ? preferred : relevant;

  const work = pool.sort(compareRanked)[0]?.volume;

  if (!work) {
    return undefined;
  }

  const allowDerivatives = wantsDerivative || isDerivative(work);
  const related = volumes.filter((volume) => isSameWork(volume, work) && (allowDerivatives || !isDerivative(volume)));
  const edition = preferredDescription(related.filter((volume) => hasSynopsisIn(volume, request.language)))?.volume;

  return { work, related, edition };
}
