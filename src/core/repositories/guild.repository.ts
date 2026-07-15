import type {
  GuildChannel,
  GuildSettings,
  GuildChannelInsert,
  GuildSettingsInsert,
} from "@infrastructure/database/schema/guild.schema.js";

import { db } from "@infrastructure/database/client.js";
import { guildChannels, guildSettings } from "@infrastructure/database/schema/guild.schema.js";

import { and, eq, gt, sql } from "drizzle-orm";

export function findGuildSettings(guildId: string): GuildSettings | undefined {
  return db.select().from(guildSettings).where(eq(guildSettings.guildId, guildId)).get();
}

export function incrementGuildMines(guildId: string, count: number): GuildSettings | undefined {
  return db
    .update(guildSettings)
    .set({ activeMines: sql`${guildSettings.activeMines} + ${count}` })
    .where(eq(guildSettings.guildId, guildId))
    .returning()
    .get();
}

/**
 * Atomically consumes one mine. The `active_mines > 0` guard means two
 * near-simultaneous triggers can never detonate the same mine twice.
 * Returns undefined when no mines are armed.
 */
export function consumeGuildMine(guildId: string): GuildSettings | undefined {
  return db
    .update(guildSettings)
    .set({ activeMines: sql`${guildSettings.activeMines} - 1` })
    .where(and(eq(guildSettings.guildId, guildId), gt(guildSettings.activeMines, 0)))
    .returning()
    .get();
}

export function upsertGuildSettings(settings: GuildSettingsInsert): GuildSettings | undefined {
  const updated = db
    .insert(guildSettings)
    .values(settings)
    .onConflictDoUpdate({
      target: guildSettings.guildId,
      set: settings,
    })
    .returning();

  return updated.get();
}

export function findGuildChannels(guildId: string): GuildChannel[] {
  return db.select().from(guildChannels).where(eq(guildChannels.guildId, guildId)).all();
}

export function upsertGuildChannel(channel: GuildChannelInsert): GuildChannel | undefined {
  const updated = db
    .insert(guildChannels)
    .values(channel)
    .onConflictDoUpdate({
      target: [guildChannels.guildId, guildChannels.purpose],
      set: { channelId: channel.channelId },
    })
    .returning();

  return updated.get();
}
