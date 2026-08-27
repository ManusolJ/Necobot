import { env } from "@infrastructure/config/env.config.js";
import { logger } from "@infrastructure/config/logger.config.js";
import { closeDatabase, db } from "@infrastructure/database/client.js";

import { getLogLevel } from "@shared/utils/get-log-level.util.js";

import "@sapphire/plugin-scheduled-tasks/register";

import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { GatewayIntentBits } from "discord.js";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { ApplicationCommandRegistries, RegisterBehavior, SapphireClient } from "@sapphire/framework";

ApplicationCommandRegistries.setDefaultBehaviorWhenNotIdentical(RegisterBehavior.BulkOverwrite);

const currentPath = dirname(fileURLToPath(import.meta.url));

const commandPath = join(currentPath, "features", "commands");
const migrationsPath = join(currentPath, "..", "db", "migrations");
const preconditionsPath = join(currentPath, "shared", "preconditions");
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
        port: env.REDIS_PORT,
      },
    },
  },
});

let shuttingDown = false;

async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;

  logger.info({ signal }, "Shutting down");

  try {
    await client.destroy();
    closeDatabase();
  } catch (error) {
    logger.error({ err: error }, "Shutdown did not complete cleanly");
    process.exit(1);
  }

  process.exit(0);
}

client.stores.get("commands").registerPath(commandPath);
client.stores.get("listeners").registerPath(eventsPath);
client.stores.get("scheduled-tasks").registerPath(scheduledPath);
client.stores.get("preconditions").registerPath(preconditionsPath);

process.on("unhandledRejection", (reason) => {
  logger.error({ err: reason }, "Unhandled promise rejection");
});

process.on("uncaughtException", (error) => {
  logger.fatal({ err: error }, "Uncaught exception");
  process.exit(1);
});

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));

try {
  migrate(db, { migrationsFolder: migrationsPath });
} catch (error) {
  logger.fatal({ err: error }, "Database migration failed");
  process.exit(1);
}

try {
  await client.login(env.BOT_TOKEN);
} catch (error) {
  logger.fatal({ err: error }, "Failed to start the bot");
  process.exit(1);
}
