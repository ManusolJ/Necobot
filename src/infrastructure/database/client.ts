import { env } from "@infrastructure/config/env.js";

import * as schema from "./schema/index.js";

import Database from "better-sqlite3";

import { drizzle } from "drizzle-orm/better-sqlite3";

const sqlite = new Database(env.DATABASE_PATH);

sqlite.pragma("foreign_keys = ON");
sqlite.pragma("journal_mode = WAL");

export const db = drizzle(sqlite, { schema });
