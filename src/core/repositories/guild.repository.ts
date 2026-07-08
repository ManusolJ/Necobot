import type {
  GuildChannel,
  GuildSettings,
  GuildChannelInsert,
  GuildSettingsInsert,
} from "@infrastructure/database/schema/guild.schema.js";

import { db } from "@infrastructure/database/client.js";
import { guildChannels, guildSettings } from "@infrastructure/database/schema/guild.schema.js";

import { eq } from "drizzle-orm";

export function findGuildSettings(guildId: string): GuildSettings | undefined {
  return db.select().from(guildSettings).where(eq(guildSettings.guildId, guildId)).get();
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
