import type { RedditPost } from "@shared/types/reddit-post.type.js";

import { DISCORD_MAX_MESSAGE_LENGTH } from "@shared/consts/config.constants.js";

import {
  COPYPASTA_MIN_LENGTH,
  COPYPASTA_MAX_LENGTH,
  COPYPASTA_MEMORY_DAYS,
} from "@features/copypasta/copypasta.constants.js";

import { beforeEach, describe, expect, it, vi } from "vitest";

const getPostedCopypastaIds = vi.hoisted(() => vi.fn());
const markCopypastaPosted = vi.hoisted(() => vi.fn());

vi.mock("@core/services/copypasta-history.service.js", () => ({
  getPostedCopypastaIds,
  markCopypastaPosted,
}));

const { pickCopypasta, formatCopypasta } = await import("@features/copypasta/copypasta.service.js");

function post(overrides: Partial<RedditPost> = {}): RedditPost {
  return {
    id: "a1",
    title: "Un titulo",
    selftext: "a".repeat(COPYPASTA_MIN_LENGTH + 50),
    ...overrides,
  };
}

beforeEach(() => {
  getPostedCopypastaIds.mockReturnValue([]);
  markCopypastaPosted.mockReset();
});

describe("pickCopypasta", () => {
  // Normal case: an eligible post comes back ready to format.
  it("picks an eligible post", () => {
    expect(pickCopypasta([post()])?.id).toBe("a1");
  });

  // Edge case: nothing to choose from must read as no pasta rather than throwing.
  it("returns undefined for an empty listing", () => {
    expect(pickCopypasta([])).toBeUndefined();
  });

  // Edge case: one-liners are not copypastas, so anything under the floor is ignored.
  it("ignores posts shorter than the minimum length", () => {
    expect(pickCopypasta([post({ selftext: "corto" })])).toBeUndefined();
  });

  // Edge case: link posts have no body at all and must never be picked.
  it("ignores posts with no body", () => {
    expect(pickCopypasta([post({ selftext: "" })])).toBeUndefined();
  });

  // Normal case: Reddit superscript markup renders as literal ^(...) in Discord, so it is stripped.
  it("strips reddit superscript markup from the body", () => {
    const body = `^(editado) ${"a".repeat(COPYPASTA_MIN_LENGTH + 50)}`;

    expect(pickCopypasta([post({ selftext: body })])?.selftext).toBe("a".repeat(COPYPASTA_MIN_LENGTH + 50));
  });

  // Edge case: markup must be counted out before the length check, not after.
  it("measures length after stripping markup", () => {
    const body = `${"^(nota) ".repeat(20)}${"a".repeat(COPYPASTA_MIN_LENGTH - 10)}`;

    expect(pickCopypasta([post({ selftext: body })])).toBeUndefined();
  });

  // Normal case: the same pasta must not come back while it is still in the retention window.
  it("does not pick a post that is already in the posted history", () => {
    getPostedCopypastaIds.mockReturnValue(["a1"]);

    expect(pickCopypasta([post()])).toBeUndefined();
  });

  // Picking is not posting: the history is written by the task once something was delivered,
  // otherwise a pick that never reached a channel would be burned for the retention window.
  it("does not record the post it picked", () => {
    pickCopypasta([post()]);

    expect(markCopypastaPosted).not.toHaveBeenCalled();
  });

  // This is what keeps the dedup window bounded by age instead of by a count that can deadlock.
  it("only considers history inside the retention window", () => {
    pickCopypasta([post()]);

    const since = getPostedCopypastaIds.mock.calls[0]?.[0] as Date;
    const days = (Date.now() - since.getTime()) / (24 * 60 * 60 * 1_000);

    expect(days).toBeCloseTo(COPYPASTA_MEMORY_DAYS, 1);
  });

  // Normal case: a pasta that fits in one message is preferred over one that needs truncating.
  it("prefers a post that fits over one that would be truncated", () => {
    const chosen = pickCopypasta([
      post({ id: "long", selftext: "a".repeat(COPYPASTA_MAX_LENGTH + 100) }),
      post({ id: "short" }),
    ]);

    expect(chosen?.id).toBe("short");
  });

  // Edge case: when every candidate is over-long, posting a truncated pasta beats posting nothing.
  it("falls back to an over-long post when nothing fits", () => {
    const chosen = pickCopypasta([post({ id: "long", selftext: "a".repeat(COPYPASTA_MAX_LENGTH + 100) })]);

    expect(chosen?.id).toBe("long");
  });
});

describe("formatCopypasta", () => {
  // Normal case: the title heads the message in bold, with the body underneath.
  it("puts the title above the body", () => {
    expect(formatCopypasta(post({ selftext: "cuerpo" }))).toBe("**Un titulo**\n\ncuerpo");
  });

  // Normal case: a body that already fits must be sent untouched.
  it("leaves a short body intact", () => {
    expect(formatCopypasta(post({ selftext: "cuerpo" }))).not.toContain("...");
  });

  // Error handling: Discord rejects messages over 2000 characters, so the cap is hard.
  it("never exceeds the Discord message limit", () => {
    const formatted = formatCopypasta(post({ selftext: "a".repeat(5_000) }));

    expect(formatted.length).toBe(DISCORD_MAX_MESSAGE_LENGTH);
  });

  // Normal case: a truncated body is marked as such rather than cut off mid-word silently.
  it("marks a truncated body with an ellipsis", () => {
    expect(formatCopypasta(post({ selftext: "a".repeat(5_000) }))).toMatch(/\.\.\.$/u);
  });

  // Edge case: the title eats into the budget, so a long title must still leave a valid message.
  it("stays within the limit when the title is long", () => {
    const formatted = formatCopypasta(post({ title: "T".repeat(300), selftext: "a".repeat(5_000) }));

    expect(formatted.length).toBe(DISCORD_MAX_MESSAGE_LENGTH);
    expect(formatted.startsWith(`**${"T".repeat(300)}**`)).toBe(true);
  });
});
