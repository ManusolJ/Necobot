import { db } from "@infrastructure/database/client.js";
import { guildChannels, guildSettings } from "@infrastructure/database/schema/guild.schema.js";

import type { GuildChannel } from "@shared/types/guild-channel.type.js";
import type { GuildSettings } from "@shared/types/guild-settings.type.js";
import type { GuildChannelInsert } from "@shared/types/guild-channel-insert.type.js";
import type { GuildSettingsInsert } from "@shared/types/guild-settings-insert.type.js";

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

export function consumeGuildMine(guildId: string): GuildSettings | undefined {
  return db
    .update(guildSettings)
    .set({ activeMines: sql`${guildSettings.activeMines} - 1` })
    .where(and(eq(guildSettings.guildId, guildId), gt(guildSettings.activeMines, 0)))
    .returning()
    .get();
}

export function upsertGuildSettings(
  settings: GuildSettingsInsert,
  updates: Partial<GuildSettingsInsert>,
): GuildSettings | undefined {
  if (Object.keys(updates).length === 0) {
    return (
      db.insert(guildSettings).values(settings).onConflictDoNothing().returning().get() ??
      findGuildSettings(settings.guildId)
    );
  }

  return db
    .insert(guildSettings)
    .values(settings)
    .onConflictDoUpdate({
      target: guildSettings.guildId,
      set: updates,
    })
    .returning()
    .get();
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

export function findChannelsByPurpose(purpose: string): GuildChannel[] {
  return db.select().from(guildChannels).where(eq(guildChannels.purpose, purpose)).all();
}
