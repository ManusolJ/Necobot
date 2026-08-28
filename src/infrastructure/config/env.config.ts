import {
  LOG_LEVELS,
  DEBUG_LOG_LEVEL,
  REDIS_DEFAULT_HOST,
  REDIS_DEFAULT_PORT,
  DATABASE_DEFAULT_PATH,
} from "@shared/consts/config.constants.js";

import "dotenv/config";

import { s } from "@sapphire/shapeshift";

const ENVIRONMENT_SCHEMA = s.object({
  LOG_LEVEL: s.enum(LOG_LEVELS).default(DEBUG_LOG_LEVEL),

  BOT_TOKEN: s.string().lengthGreaterThan(0),

  DISCORD_DEV_GUILD_ID: s
    .string()
    .regex(/^\d{17,20}$/u)
    .optional(),

  BOT_OWNER_ID: s
    .string()
    .regex(/^\d{17,20}$/u)
    .optional(),

  DATABASE_PATH: s.string().lengthGreaterThan(0).default(DATABASE_DEFAULT_PATH),

  REDIS_HOST: s.string().lengthGreaterThan(0).default(REDIS_DEFAULT_HOST),
  REDIS_PORT: s.number().int().greaterThanOrEqual(1).lessThanOrEqual(65535).default(REDIS_DEFAULT_PORT),

  OLLAMA_URL: s.string().url().lengthGreaterThan(0),
});

const read = (name: string): string | undefined => {
  const value = process.env[name];
  return value === undefined || value === "" ? undefined : value;
};

const readPort = (name: string): number | undefined => {
  const value = read(name);
  return value === undefined ? undefined : Number(value);
};

const readUrl = (name: string): string | undefined => read(name)?.replace(/\/+$/u, "");

function loadEnvironment(): ReturnType<typeof ENVIRONMENT_SCHEMA.parse> {
  try {
    return ENVIRONMENT_SCHEMA.parse({
      LOG_LEVEL: read("LOG_LEVEL"),

      BOT_TOKEN: read("BOT_TOKEN"),

      BOT_OWNER_ID: read("BOT_OWNER_ID"),
      DISCORD_DEV_GUILD_ID: read("DISCORD_DEV_GUILD_ID"),

      DATABASE_PATH: read("DATABASE_PATH"),

      REDIS_HOST: read("REDIS_HOST"),
      REDIS_PORT: readPort("REDIS_PORT"),

      OLLAMA_URL: readUrl("OLLAMA_URL"),
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    process.stderr.write(`Invalid environment configuration:\n${detail}\n`);
    process.exit(1);
  }
}

export const env = loadEnvironment();
