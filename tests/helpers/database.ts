import { db } from "@infrastructure/database/client.js";
import { guildUsers } from "@infrastructure/database/schema/user.schema.js";
import { guildChannels, guildSettings } from "@infrastructure/database/schema/guild.schema.js";

import { migrate } from "drizzle-orm/better-sqlite3/migrator";

let migrated = false;

export function useMigratedDatabase(): void {
  if (!migrated) {
    migrate(db, { migrationsFolder: "./db/migrations" });
    migrated = true;
  }
}

export function resetDatabase(): void {
  db.delete(guildUsers).run();
  db.delete(guildChannels).run();
  db.delete(guildSettings).run();
}

export function seedGuild(guildId: string, overrides: { mainChannelId?: string; prefix?: string } = {}): void {
  db.insert(guildSettings)
    .values({ guildId, mainChannelId: overrides.mainChannelId ?? "main-channel", ...overrides })
    .run();
}
