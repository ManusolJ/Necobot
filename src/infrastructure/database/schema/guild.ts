import {
  text,
  integer,
  primaryKey,
  sqliteTable,
} from "drizzle-orm/sqlite-core";

export const guildSettings = sqliteTable("guild_settings", {
  guildId: text("guild_id").primaryKey(),
  prefix: text("prefix").notNull().default("!"),
  mainChannelId: text("main_channel_id"),
  setupCompletedAt: integer("setup_completed_at", { mode: "timestamp" }),
});

export const guildChannels = sqliteTable(
  "guild_channels",
  {
    guildId: text("guild_id")
      .notNull()
      .references(() => guildSettings.guildId, { onDelete: "cascade" }),
    purpose: text("purpose").notNull(),
    channelId: text("channel_id").notNull(),
  },
  (table) => [primaryKey({ columns: [table.guildId, table.purpose] })],
);
