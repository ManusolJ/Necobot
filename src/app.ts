import { env } from "@infrastructure/config/env.js";

import { logger } from "@infrastructure/config/logger.js";

import { getLogLevel } from "@shared/utils/get-log-level.util.js";

import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { GatewayIntentBits } from "discord.js";

import { SapphireClient } from "@sapphire/framework";

import "@sapphire/plugin-scheduled-tasks/register";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { db } from "@infrastructure/database/client.js";

const currentPath = dirname(fileURLToPath(import.meta.url));

const guardsPath = join(currentPath, "shared", "guards");
const commandPath = join(currentPath, "features", "commands");
const eventsPath = join(currentPath, "features", "events", "reactive");
const scheduledPath = join(currentPath, "features", "events", "scheduled");

const logLevel = getLogLevel(env.LOG_LEVEL);

const client = new SapphireClient({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildPresences,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessageReactions,
  ],
  logger: {
    level: logLevel,
  },
  baseUserDirectory: null,
  tasks: {
    bull: {
      connection: {
        host: env.REDIS_HOST,
        port: Number(env.REDIS_PORT),
      },
    },
  },
});

client.stores.get("commands").registerPath(commandPath);
client.stores.get("listeners").registerPath(eventsPath);
client.stores.get("preconditions").registerPath(guardsPath);
client.stores.get("scheduled-tasks").registerPath(scheduledPath);

migrate(db, { migrationsFolder: "./db/migrations" });

try {
  await client.login(env.BOT_TOKEN);
} catch (error) {
  logger.fatal({ error }, "Failed to start the bot");
  process.exit(1);
}
