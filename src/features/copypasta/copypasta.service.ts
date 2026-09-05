import type { RedditPost } from "@shared/types/reddit-post.type.js";

import {
  DISCORD_MAX_LENGTH,
  RECENT_POSTS_MEMORY,
  COPYPASTA_MIN_LENGTH,
  COPYPASTA_MAX_LENGTH,
} from "./copypasta.constants.js";

const recentPostIds: string[] = [];

function cleanBody(selftext: string): string {
  return selftext.replace(/\^\(.*?\)\s?/gu, "").trim();
}

function remember(id: string): void {
  recentPostIds.push(id);

  while (recentPostIds.length > RECENT_POSTS_MEMORY) {
    recentPostIds.shift();
  }
}

export function pickCopypasta(posts: RedditPost[]): RedditPost | undefined {
  const eligible = posts
    .map((post) => ({ ...post, selftext: cleanBody(post.selftext) }))
    .filter((post) => post.selftext.length >= COPYPASTA_MIN_LENGTH && !recentPostIds.includes(post.id));

  const preferred = eligible.filter((post) => post.selftext.length <= COPYPASTA_MAX_LENGTH);
  const pool = preferred.length > 0 ? preferred : eligible;

  const chosen = pool[Math.floor(Math.random() * pool.length)];

  if (!chosen) {
    return undefined;
  }

  remember(chosen.id);
  return chosen;
}

export function formatCopypasta(post: RedditPost): string {
  const header = `**${post.title}**\n\n`;
  const room = DISCORD_MAX_LENGTH - header.length;
  const body = room > 3 && post.selftext.length > room ? `${post.selftext.slice(0, room - 3)}...` : post.selftext;

  return `${header}${body}`.slice(0, DISCORD_MAX_LENGTH);
}

export function resetRecentPosts(): void {
  recentPostIds.length = 0;
}
