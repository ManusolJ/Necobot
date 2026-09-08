import { getPostedCopypastaIds, markCopypastaPosted } from "@core/services/copypasta-history.service.js";

import type { RedditPost } from "@shared/types/reddit-post.type.js";

import { DISCORD_MAX_MESSAGE_LENGTH } from "@shared/consts/config.constants.js";

import { COPYPASTA_MIN_LENGTH, COPYPASTA_MAX_LENGTH, COPYPASTA_MEMORY_DAYS } from "./copypasta.constants.js";

const DAY_MS = 24 * 60 * 60 * 1_000;

function cleanBody(selftext: string): string {
  return selftext.replace(/\^\(.*?\)\s?/gu, "").trim();
}

export function pickCopypasta(posts: RedditPost[]): RedditPost | undefined {
  const recentPostIds = new Set(getPostedCopypastaIds(new Date(Date.now() - COPYPASTA_MEMORY_DAYS * DAY_MS)));

  const eligible = posts
    .map((post) => ({ ...post, selftext: cleanBody(post.selftext) }))
    .filter((post) => post.selftext.length >= COPYPASTA_MIN_LENGTH && !recentPostIds.has(post.id));

  const preferred = eligible.filter((post) => post.selftext.length <= COPYPASTA_MAX_LENGTH);
  const pool = preferred.length > 0 ? preferred : eligible;

  const chosen = pool[Math.floor(Math.random() * pool.length)];

  if (!chosen) {
    return undefined;
  }

  markCopypastaPosted(chosen.id);
  return chosen;
}

export function formatCopypasta(post: RedditPost): string {
  const header = `**${post.title}**\n\n`;
  const room = DISCORD_MAX_MESSAGE_LENGTH - header.length;
  const body = room > 3 && post.selftext.length > room ? `${post.selftext.slice(0, room - 3)}...` : post.selftext;

  return `${header}${body}`.slice(0, DISCORD_MAX_MESSAGE_LENGTH);
}
