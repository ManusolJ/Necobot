import { integer, pgEnum, pgTable, primaryKey, text, timestamp } from "drizzle-orm/pg-core";

export const channelPurpose = pgEnum("channel_purpose", ["bot", "memes", "copypasta", "announcements", "archive"]);

export const guildSettings = pgTable("guild_settings", {
  guildId: text("guild_id").primaryKey(),
  mainChannelId: text("main_channel_id"),
  specialRoleId: text("special_role_id"),
  setupCompletedAt: timestamp("setup_completed_at", { withTimezone: true }),
});

export const guildState = pgTable("guild_state", {
  guildId: text("guild_id")
    .primaryKey()
    .references(() => guildSettings.guildId, { onDelete: "cascade" }),
  activeMines: integer("active_mines").notNull().default(0),
});

export const guildChannels = pgTable(
  "guild_channels",
  {
    guildId: text("guild_id")
      .notNull()
      .references(() => guildSettings.guildId, { onDelete: "cascade" }),
    purpose: channelPurpose("purpose").notNull(),
    channelId: text("channel_id").notNull(),
  },
  (table) => [primaryKey({ columns: [table.guildId, table.purpose] })],
);
