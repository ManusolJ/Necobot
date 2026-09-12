import type { ArchivedMessage } from "@shared/types/archived-message.type.js";

import { ARCHIVE_EMPTY_CONTENT, ARCHIVE_THREAD_NAME_MAX_LENGTH } from "@features/moderation/moderation.constants.js";
import {
  chunkArchiveLines,
  formatArchivedMessage,
  buildArchiveThreadName,
} from "@features/moderation/moderation.service.js";

import { describe, expect, it } from "vitest";

function archived(overrides: Partial<ArchivedMessage> = {}): ArchivedMessage {
  return {
    authorTag: "neco",
    createdAt: new Date(1_700_000_000_000),
    content: "hola",
    attachments: [],
    ...overrides,
  };
}

describe("formatArchivedMessage", () => {
  // Normal case: a plain text message becomes one line with a Discord timestamp, the author, and the content.
  it("renders the timestamp, author and content on one line", () => {
    expect(formatArchivedMessage(archived())).toBe("<t:1700000000:f> **neco**: hola");
  });

  // Edge case: a message that only carried files has no text, so a placeholder keeps the line readable.
  it("uses a placeholder when the message had no text", () => {
    expect(formatArchivedMessage(archived({ content: "" }))).toContain(ARCHIVE_EMPTY_CONTENT);
  });

  // Normal case: attachments are lost on deletion, so at least their names are listed under the message.
  it("lists each attachment name on its own line", () => {
    const line = formatArchivedMessage(archived({ attachments: ["a.png", "b.txt"] }));

    expect(line.split("\n")).toEqual(["<t:1700000000:f> **neco**: hola", "📎 a.png", "📎 b.txt"]);
  });

  // Edge case: the timestamp is whole seconds, since Discord rejects fractional epoch values in <t:> markup.
  it("floors the timestamp to whole seconds", () => {
    expect(formatArchivedMessage(archived({ createdAt: new Date(1_700_000_000_999) }))).toContain("<t:1700000000:f>");
  });
});

describe("chunkArchiveLines", () => {
  // Normal case: everything that fits in one Discord message is sent together, joined by newlines.
  it("joins lines that fit into a single chunk", () => {
    expect(chunkArchiveLines(["a", "b", "c"], 10)).toEqual(["a\nb\nc"]);
  });

  // Normal case: a line that would push the chunk over the limit starts a new chunk instead.
  it("starts a new chunk when the next line would overflow", () => {
    expect(chunkArchiveLines(["aaaa", "bbbb", "cccc"], 9)).toEqual(["aaaa\nbbbb", "cccc"]);
  });

  // Edge case: the newline separator counts toward the limit, so two lines that only fit without it are split.
  it("accounts for the newline separator", () => {
    expect(chunkArchiveLines(["aaaa", "bbbb"], 8)).toEqual(["aaaa", "bbbb"]);
  });

  // Edge case: a single line beyond the limit can never be sent whole, so it is truncated with a marker.
  it("truncates a single line longer than the limit", () => {
    const [chunk] = chunkArchiveLines(["abcdefghij"], 5);

    expect(chunk).toHaveLength(5);
    expect(chunk?.endsWith("…")).toBe(true);
  });

  // Edge case: no lines means nothing to send, not an empty message that Discord would reject.
  it("returns no chunks for no lines", () => {
    expect(chunkArchiveLines([])).toEqual([]);
  });

  // Normal case: the default limit is Discord's message cap, so realistic archives split without configuration.
  it("defaults to the Discord message limit", () => {
    const line = "x".repeat(1_500);

    expect(chunkArchiveLines([line, line])).toHaveLength(2);
  });
});

describe("buildArchiveThreadName", () => {
  // Normal case: the thread name identifies the cleaned channel and when the cleanup happened.
  it("includes the channel name and the date", () => {
    const name = buildArchiveThreadName("general", "11/09/2026 14:05");

    expect(name).toContain("#general");
    expect(name).toContain("11/09/2026 14:05");
  });

  // Edge case: Discord caps thread names, so a very long channel name must be cut rather than rejected.
  it("caps the name at the Discord thread name limit", () => {
    const name = buildArchiveThreadName("c".repeat(200), "11/09/2026 14:05");

    expect(name).toHaveLength(ARCHIVE_THREAD_NAME_MAX_LENGTH);
  });
});
