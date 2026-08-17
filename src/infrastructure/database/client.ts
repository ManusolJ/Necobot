import { env } from "@infrastructure/config/env.config.js";

import { DATABASE_BUSY_TIMEOUT_MS } from "@shared/consts/config.constants.js";

import * as schema from "./schema/index.js";

import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";

mkdirSync(dirname(env.DATABASE_PATH), { recursive: true });

const sqlite = new Database(env.DATABASE_PATH);

sqlite.pragma("foreign_keys = ON");
sqlite.pragma("journal_mode = WAL");
sqlite.pragma(`busy_timeout = ${DATABASE_BUSY_TIMEOUT_MS}`);

export const db = drizzle(sqlite, { schema });

export function closeDatabase(): void {
  sqlite.close();
}
