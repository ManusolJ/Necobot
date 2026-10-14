import { guildState, guildSettings } from "@infrastructure/database/schema/guild.schema.js";

import { db } from "./pglite-client.js";

import { sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/pglite/migrator";

let migrated: Promise<void> | undefined;

export async function useMigratedDatabase(): Promise<void> {
  migrated ??= migrate(db, { migrationsFolder: "./db/migrations" });

  await migrated;
}

export async function resetDatabase(): Promise<void> {
  await db.execute(sql`TRUNCATE guild_settings, copypasta_posts RESTART IDENTITY CASCADE`);
}

export async function seedGuild(guildId: string, overrides: { mainChannelId?: string } = {}): Promise<void> {
  await db.insert(guildSettings).values({ guildId, mainChannelId: overrides.mainChannelId ?? "main-channel" });
  await db.insert(guildState).values({ guildId });
}
