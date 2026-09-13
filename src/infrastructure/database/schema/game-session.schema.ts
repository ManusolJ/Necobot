import { guildSettings } from "./guild.schema.js";

import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const gameSessions = sqliteTable("game_sessions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  guildId: text("guild_id")
    .notNull()
    .references(() => guildSettings.guildId, { onDelete: "cascade" }),
  kind: text("kind").notNull(),
  challengerId: text("challenger_id").notNull(),
  challengedId: text("challenged_id"),
  challengerStake: integer("challenger_stake").notNull().default(0),
  challengedStake: integer("challenged_stake").notNull().default(0),
  channelId: text("channel_id"),
  messageId: text("message_id"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  completedAt: integer("completed_at", { mode: "timestamp" }),
});
