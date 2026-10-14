import { guildSettings } from "./guild.schema.js";

import { integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const gameSessions = pgTable("game_sessions", {
  id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
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
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
});
