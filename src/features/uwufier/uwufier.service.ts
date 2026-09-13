import type { Segment } from "@shared/types/uwu-segment.type.js";

import { UWUFY_WORDS_CHANCE, UWUFY_SPACES_CHANCE, UWUFY_EXCLAMATIONS_CHANCE } from "./uwufier.constants.js";

import Uwuifier from "uwuifier";

const PRESERVED_PATTERN =
  /```[\s\S]*?```|`[^`\n]*`|https?:\/\/\S+|<a?:\w+:\d+>|<\/[\w -]+:\d+>|<t:\d+(?::[tTdDfFR])?>|<@[!&]?\d+>|<#\d+>/gu;

const PADDING_PATTERN = /^(\s*)([\s\S]*?)(\s*)$/u;

const uwuifier = new Uwuifier({
  words: UWUFY_WORDS_CHANCE,
  spaces: UWUFY_SPACES_CHANCE,
  exclamations: UWUFY_EXCLAMATIONS_CHANCE,
});

export function splitPreserved(text: string): Segment[] {
  let cursor = 0;
  const segments: Segment[] = [];

  for (const match of text.matchAll(PRESERVED_PATTERN)) {
    const start = match.index;

    if (start > cursor) {
      segments.push({ text: text.slice(cursor, start), preserved: false });
    }

    segments.push({ text: match[0], preserved: true });
    cursor = start + match[0].length;
  }

  if (cursor < text.length) {
    segments.push({ text: text.slice(cursor), preserved: false });
  }

  return segments;
}

function hasRewritableText(segments: readonly Segment[]): boolean {
  return segments.some((segment) => !segment.preserved && /\p{L}/u.test(segment.text));
}

function uwuifyProse(text: string): string {
  const match = PADDING_PATTERN.exec(text);

  if (!match) {
    return text;
  }

  const [, leading = "", body = "", trailing = ""] = match;

  return body.length === 0 ? text : `${leading}${uwuifier.uwuifySentence(body)}${trailing}`;
}

export function uwuifyText(text: string): string | undefined {
  const segments = splitPreserved(text);

  if (!hasRewritableText(segments)) {
    return undefined;
  }

  const rewritten = segments
    .map((segment) => (segment.preserved ? segment.text : uwuifyProse(segment.text)))
    .join("")
    .trim();

  return rewritten.length === 0 ? undefined : rewritten;
}
