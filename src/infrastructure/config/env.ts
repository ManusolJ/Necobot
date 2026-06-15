import {
  DEV_ENV,
  DEBUG_LOG_LEVEL,
  REDIS_DEFAULT_HOST,
  REDIS_DEFAULT_PORT,
  DATABASE_DEFAULT_PATH,
} from "@shared/consts/config.constants.js";

import "dotenv/config";

import { s } from "@sapphire/shapeshift";

const ENVIRONMENT_SCHEMA = s.object({
  NODE_ENV: s.string().default(DEV_ENV),
  LOG_LEVEL: s.string().default(DEBUG_LOG_LEVEL),

  DISCORD_DEV_GUILD_ID: s.string().optional(),
  DISCORD_TOKEN: s.string().lengthGreaterThan(0),
  DISCORD_APP_ID: s.string().lengthGreaterThan(0),

  DATABASE_PATH: s.string().default(DATABASE_DEFAULT_PATH),

  REDIS_PORT: s.string().default(REDIS_DEFAULT_PORT),
  REDIS_HOST: s.string().default(REDIS_DEFAULT_HOST),
});

export const env = ENVIRONMENT_SCHEMA.parse({
  NODE_ENV: process.env.NODE_ENV,
  LOG_LEVEL: process.env.LOG_LEVEL,

  DISCORD_TOKEN: process.env.DISCORD_TOKEN,
  DISCORD_APP_ID: process.env.DISCORD_APP_ID,
  DISCORD_DEV_GUILD_ID: process.env.DISCORD_DEV_GUILD_ID,

  DATABASE_PATH: process.env.DATABASE_PATH,

  REDIS_HOST: process.env.REDIS_HOST,
  REDIS_PORT: process.env.REDIS_PORT,
});
