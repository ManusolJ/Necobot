import { db } from "@infrastructure/database/client.js";
import type { GuildSettings, GuildSettingsInsert } from "@infrastructure/database/schema/guild.schema.js";
import { guildSettings } from "@infrastructure/database/schema/guild.schema.js";

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
