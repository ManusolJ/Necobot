import { logger } from "@infrastructure/config/logger.config.js";

import { getGuildSettings } from "@core/services/guild.service.js";
import { claimBirthdayGift, claimBirthdayWarning, getUsersWithBirthday } from "@core/services/user.service.js";

import type { Birthday } from "@shared/types/birthday.type.js";
import type { GuildUser } from "@shared/types/guild-user.type.js";

import { pickRandom } from "@shared/utils/pick-random.util.js";
import { formatMessage } from "@shared/utils/format-message.util.js";
import { daysInMonth, nowInBotZone } from "@shared/utils/calendar.util.js";

import { buildCheerMessage } from "@features/cheer/cheer.service.js";

import { BIRTHDAY_GIFT_NOTE, BIRTHDAY_WARNING_MESSAGES } from "./birthday.messages.js";
import {
  LEAP_DAY,
  BIRTHDAY_PATTERN,
  LEAP_DAY_FALLBACK,
  BIRTHDAY_GIFT_POINTS,
  BIRTHDAY_WARNING_DAYS,
  BIRTHDAY_LEAP_REFERENCE_YEAR,
} from "./birthday.constants.js";

import type { DateTime } from "luxon";
import type { SendableChannels } from "discord.js";

import { container } from "@sapphire/framework";

export function parseBirthday(input: string): Birthday | undefined {
  const match = BIRTHDAY_PATTERN.exec(input.trim());

  if (!match) {
    return undefined;
  }

  const day = Number(match[1]);
  const month = Number(match[2]);

  if (month < 1 || month > 12) {
    return undefined;
  }

  if (day < 1 || day > daysInMonth(month, BIRTHDAY_LEAP_REFERENCE_YEAR)) {
    return undefined;
  }

  return { day, month };
}

export function formatBirthday(birthday: Birthday): string {
  const day = String(birthday.day).padStart(2, "0");
  const month = String(birthday.month).padStart(2, "0");

  return `${day}/${month}`;
}

export function isLeapDay(birthday: Birthday): boolean {
  return birthday.day === LEAP_DAY.day && birthday.month === LEAP_DAY.month;
}

export function getBirthdayKeysForDate(date: DateTime): Birthday[] {
  const keys: Birthday[] = [{ day: date.day, month: date.month }];

  if (!date.isInLeapYear && date.day === LEAP_DAY_FALLBACK.day && date.month === LEAP_DAY_FALLBACK.month) {
    keys.push(LEAP_DAY);
  }

  return keys;
}

export function formatMentionList(userIds: readonly string[]): string {
  const mentions = userIds.map((userId) => `<@${userId}>`);

  if (mentions.length <= 1) {
    return mentions[0] ?? "";
  }

  return `${mentions.slice(0, -1).join(", ")} y ${String(mentions.at(-1))}`;
}

function groupByGuild(users: readonly GuildUser[]): Map<string, GuildUser[]> {
  const grouped = new Map<string, GuildUser[]>();

  for (const user of users) {
    const bucket = grouped.get(user.guildId) ?? [];
    bucket.push(user);
    grouped.set(user.guildId, bucket);
  }

  return grouped;
}

async function resolveMainChannel(guildId: string): Promise<SendableChannels | undefined> {
  const mainChannelId = getGuildSettings(guildId)?.mainChannelId;

  if (!mainChannelId) {
    logger.debug({ guildId }, "Guild has no main channel configured; skipping its birthdays");
    return undefined;
  }

  const channel = await container.client.channels.fetch(mainChannelId).catch(() => null);

  if (!channel?.isSendable()) {
    logger.warn({ guildId, mainChannelId }, "Main channel unavailable; skipping its birthdays");
    return undefined;
  }

  return channel;
}

async function announceBirthdays(channel: SendableChannels, users: readonly GuildUser[], year: number): Promise<void> {
  const claimed = users.filter((user) => claimBirthdayGift(user.guildId, user.userId, year, BIRTHDAY_GIFT_POINTS));

  if (claimed.length === 0) {
    return;
  }

  const message = buildCheerMessage(formatMentionList(claimed.map((user) => user.userId)));
  const note = formatMessage(BIRTHDAY_GIFT_NOTE, { points: String(BIRTHDAY_GIFT_POINTS) });

  await channel.send({ ...message, content: `${message.content}\n\n${note}` });

  logger.info({ guildId: claimed[0]?.guildId, users: claimed.length, year }, "Announced birthdays");
}

async function announceUpcoming(channel: SendableChannels, users: readonly GuildUser[], year: number): Promise<void> {
  const pending = users.filter((user) => user.birthdayWarnedYear !== year);

  if (pending.length === 0) {
    return;
  }

  const content = formatMessage(pickRandom(BIRTHDAY_WARNING_MESSAGES), {
    days: String(BIRTHDAY_WARNING_DAYS),
    users: formatMentionList(pending.map((user) => user.userId)),
  });

  await channel.send({ content });

  for (const user of pending) {
    claimBirthdayWarning(user.guildId, user.userId, year);
  }

  logger.info({ guildId: pending[0]?.guildId, users: pending.length, year }, "Warned about upcoming birthdays");
}

export async function runBirthdaySweep(now: DateTime = nowInBotZone()): Promise<void> {
  const today = now.startOf("day");
  const warningDay = today.plus({ days: BIRTHDAY_WARNING_DAYS });

  const celebrating = groupByGuild(getUsersWithBirthday(getBirthdayKeysForDate(today)));
  const upcoming = groupByGuild(getUsersWithBirthday(getBirthdayKeysForDate(warningDay)));

  const guildIds = new Set([...celebrating.keys(), ...upcoming.keys()]);

  if (guildIds.size === 0) {
    logger.debug({ date: today.toISODate() }, "No birthdays to handle today");
    return;
  }

  for (const guildId of guildIds) {
    const channel = await resolveMainChannel(guildId);

    if (!channel) {
      continue;
    }

    try {
      await announceBirthdays(channel, celebrating.get(guildId) ?? [], today.year);
      await announceUpcoming(channel, upcoming.get(guildId) ?? [], warningDay.year);
    } catch (error) {
      logger.warn({ err: error, guildId }, "Could not announce birthdays; skipping this guild");
    }
  }
}
