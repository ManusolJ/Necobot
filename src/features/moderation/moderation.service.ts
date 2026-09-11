import type { ArchivedMessage } from "@shared/types/archived-message.type.js";

import { formatMessage } from "@shared/utils/format-message.util.js";
import { DISCORD_MAX_MESSAGE_LENGTH } from "@shared/consts/config.constants.js";

import { ARCHIVE_THREAD_NAME } from "./moderation.messages.js";
import {
  ARCHIVE_EMPTY_CONTENT,
  ARCHIVE_LINE_TRUNCATION,
  ARCHIVE_THREAD_NAME_MAX_LENGTH,
} from "./moderation.constants.js";

import type { Message } from "discord.js";

export function toArchivedMessage(message: Message): ArchivedMessage {
  return {
    authorTag: message.author.tag,
    createdAt: message.createdAt,
    content: message.content,
    attachments: message.attachments.map((attachment) => attachment.name),
  };
}

export function formatArchivedMessage(message: ArchivedMessage): string {
  const timestamp = `<t:${String(Math.floor(message.createdAt.getTime() / 1000))}:f>`;
  const body = message.content.length > 0 ? message.content : ARCHIVE_EMPTY_CONTENT;
  const files = message.attachments.map((name) => `📎 ${name}`);

  return [`${timestamp} **${message.authorTag}**: ${body}`, ...files].join("\n");
}

export function chunkArchiveLines(lines: readonly string[], limit = DISCORD_MAX_MESSAGE_LENGTH): string[] {
  const chunks: string[] = [];
  let current = "";

  for (const rawLine of lines) {
    const line =
      rawLine.length > limit
        ? `${rawLine.slice(0, limit - ARCHIVE_LINE_TRUNCATION.length)}${ARCHIVE_LINE_TRUNCATION}`
        : rawLine;

    if (current.length === 0) {
      current = line;
      continue;
    }

    if (current.length + 1 + line.length > limit) {
      chunks.push(current);
      current = line;
      continue;
    }

    current = `${current}\n${line}`;
  }

  if (current.length > 0) {
    chunks.push(current);
  }

  return chunks;
}

export function buildArchiveThreadName(channelName: string, date: string): string {
  const name = formatMessage(ARCHIVE_THREAD_NAME, { channel: channelName, date });

  return name.length > ARCHIVE_THREAD_NAME_MAX_LENGTH ? name.slice(0, ARCHIVE_THREAD_NAME_MAX_LENGTH) : name;
}
