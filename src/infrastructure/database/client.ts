import { env } from "@infrastructure/config/env.config.js";
import { logger } from "@infrastructure/config/logger.config.js";

import {
  DATABASE_IDLE_TIMEOUT_MS,
  DATABASE_APPLICATION_NAME,
  DATABASE_CONNECTION_TIMEOUT_MS,
} from "@shared/consts/config.constants.js";

import * as schema from "./schema/index.js";

import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";

const pool = new pg.Pool({
  connectionString: env.DATABASE_URL,
  max: env.DATABASE_POOL_SIZE,
  idleTimeoutMillis: DATABASE_IDLE_TIMEOUT_MS,
  connectionTimeoutMillis: DATABASE_CONNECTION_TIMEOUT_MS,
  application_name: DATABASE_APPLICATION_NAME,
});

pool.on("error", (error) => {
  logger.warn({ err: error }, "Idle database connection lost");
});

export const db = drizzle({ client: pool, schema });

export async function closeDatabase(): Promise<void> {
  await pool.end();
}
