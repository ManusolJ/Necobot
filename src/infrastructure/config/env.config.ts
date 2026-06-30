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

  BOT_TOKEN: s.string().lengthGreaterThan(0),

  DISCORD_DEV_GUILD_ID: s.string().optional(),

  DATABASE_PATH: s.string().default(DATABASE_DEFAULT_PATH),

  REDIS_PORT: s.string().regex(/^\d+$/).default(REDIS_DEFAULT_PORT),
  REDIS_HOST: s.string().default(REDIS_DEFAULT_HOST),
});

const emptyToUndefined = (value: string | undefined): string | undefined => (value === "" ? undefined : value);

export const env = ENVIRONMENT_SCHEMA.parse({
  NODE_ENV: emptyToUndefined(process.env.NODE_ENV),
  LOG_LEVEL: emptyToUndefined(process.env.LOG_LEVEL),

  BOT_TOKEN: emptyToUndefined(process.env.BOT_TOKEN),
  DISCORD_DEV_GUILD_ID: emptyToUndefined(process.env.DISCORD_DEV_GUILD_ID),

  DATABASE_PATH: emptyToUndefined(process.env.DATABASE_PATH),

  REDIS_HOST: emptyToUndefined(process.env.REDIS_HOST),
  REDIS_PORT: emptyToUndefined(process.env.REDIS_PORT),
});
