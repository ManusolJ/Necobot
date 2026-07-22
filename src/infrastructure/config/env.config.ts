import {
  DEBUG_LOG_LEVEL,
  REDIS_DEFAULT_HOST,
  REDIS_DEFAULT_PORT,
  DATABASE_DEFAULT_PATH,
} from "@shared/consts/config.constants.js";

import "dotenv/config";

import { s } from "@sapphire/shapeshift";

const ENVIRONMENT_SCHEMA = s.object({
  LOG_LEVEL: s.string().default(DEBUG_LOG_LEVEL),

  BOT_TOKEN: s.string().lengthGreaterThan(0),

  DISCORD_DEV_GUILD_ID: s.string().optional(),

  DATABASE_PATH: s.string().default(DATABASE_DEFAULT_PATH),

  REDIS_PORT: s.string().regex(/^\d+$/).default(REDIS_DEFAULT_PORT),
  REDIS_HOST: s.string().default(REDIS_DEFAULT_HOST),

  OLLAMA_URL: s.string().optional(),
});

const emptyToUndefined = (value: string | undefined): string | undefined => (value === "" ? undefined : value);

export const env = ENVIRONMENT_SCHEMA.parse({
  LOG_LEVEL: emptyToUndefined(process.env.LOG_LEVEL),

  BOT_TOKEN: emptyToUndefined(process.env.BOT_TOKEN),
  DISCORD_DEV_GUILD_ID: emptyToUndefined(process.env.DISCORD_DEV_GUILD_ID),

  DATABASE_PATH: emptyToUndefined(process.env.DATABASE_PATH),

  REDIS_HOST: emptyToUndefined(process.env.REDIS_HOST),
  REDIS_PORT: emptyToUndefined(process.env.REDIS_PORT),

  OLLAMA_URL: emptyToUndefined(process.env.OLLAMA_URL),
});
