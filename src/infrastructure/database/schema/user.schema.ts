import { guildSettings } from "./guild.schema.js";

import { foreignKey, integer, pgTable, primaryKey, text, timestamp } from "drizzle-orm/pg-core";

export const userData = pgTable(
  "user_data",
  {
    guildId: text("guild_id")
      .notNull()
      .references(() => guildSettings.guildId, { onDelete: "cascade" }),
    userId: text("user_id").notNull(),
    birthdayDay: integer("birthday_day"),
    birthdayMonth: integer("birthday_month"),
    birthdayCheeredYear: integer("birthday_cheered_year"),
    birthdayWarnedYear: integer("birthday_warned_year"),
    excludedAt: timestamp("excluded_at", { withTimezone: true }),
  },
  (table) => [primaryKey({ columns: [table.guildId, table.userId] })],
);

export const userState = pgTable(
  "user_state",
  {
    guildId: text("guild_id").notNull(),
    userId: text("user_id").notNull(),
    points: integer("points").notNull().default(0),
    isUwufied: integer("is_uwufied").notNull().default(0),
    lastBeggedAt: timestamp("last_begged_at", { withTimezone: true }),
    lastDrinkedAt: timestamp("last_drinked_at", { withTimezone: true }),
  },
  (table) => [
    primaryKey({ columns: [table.guildId, table.userId] }),
    foreignKey({
      columns: [table.guildId, table.userId],
      foreignColumns: [userData.guildId, userData.userId],
    }).onDelete("cascade"),
  ],
);

export const userStats = pgTable(
  "user_stats",
  {
    guildId: text("guild_id").notNull(),
    userId: text("user_id").notNull(),
    historicalPoints: integer("historical_points").notNull().default(0),
    timesBegged: integer("times_begged").notNull().default(0),
    timesSlapped: integer("times_slapped").notNull().default(0),
    scannedThings: integer("scanned_things").notNull().default(0),
    activatedMines: integer("activated_mines").notNull().default(0),
    monstersDrinked: integer("monsters_drinked").notNull().default(0),
  },
  (table) => [
    primaryKey({ columns: [table.guildId, table.userId] }),
    foreignKey({
      columns: [table.guildId, table.userId],
      foreignColumns: [userData.guildId, userData.userId],
    }).onDelete("cascade"),
  ],
);
