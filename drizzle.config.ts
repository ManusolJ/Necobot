import { DATABASE_DEFAULT_PATH } from "./src/shared/consts/config.constants.js";

import "dotenv/config";

import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "sqlite",
  out: "./db/migrations",
  schema: "./src/infrastructure/database/schema/index.ts",
  dbCredentials: {
    url: process.env.DATABASE_PATH ?? DATABASE_DEFAULT_PATH,
  },
  casing: "snake_case",
  breakpoints: true,
  migrations: {
    prefix: "index",
    table: "__drizzle_migrations",
  },
  verbose: false,
  strict: false,
});
