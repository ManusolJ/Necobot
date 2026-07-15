import { guildSettings } from "./guild.schema.js";

import { integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const guildUsers = sqliteTable(
  "guild_users",
  {
    guildId: text("guild_id")
      .notNull()
      .references(() => guildSettings.guildId, { onDelete: "cascade" }),
    userId: text("user_id").notNull(),
    points: integer("points").notNull().default(0),
    triviaWins: integer("trivia_wins").notNull().default(0),
    timesBegged: integer("times_begged").notNull().default(0),
    activatedMines: integer("activated_mines").notNull().default(0),
    historicalPoints: integer("historical_points").notNull().default(0),
    lastBeggedAt: integer("last_begged_at", { mode: "timestamp" }),
    excludedAt: integer("excluded_at", { mode: "timestamp" }),
  },
  (table) => [primaryKey({ columns: [table.guildId, table.userId] })],
);

export type GuildUser = typeof guildUsers.$inferSelect;
export type GuildUserInsert = typeof guildUsers.$inferInsert;
