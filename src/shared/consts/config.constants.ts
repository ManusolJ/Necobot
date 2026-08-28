import type { LogLevelName } from "@shared/types/log-level-name.type.js";

export const LOG_LEVELS = [
  "trace",
  "debug",
  "info",
  "warn",
  "error",
  "fatal",
] as const satisfies readonly LogLevelName[];

export const DEBUG_LOG_LEVEL: LogLevelName = "debug";

export const BOT_TIMEZONE = "Europe/Madrid";

export const REDIS_DEFAULT_PORT = 6379;
export const REDIS_DEFAULT_HOST = "127.0.0.1";

export const DATABASE_DEFAULT_PATH = "./db/data/data.sqlite";
export const DATABASE_BUSY_TIMEOUT_MS = 5_000;
