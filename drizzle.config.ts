import "dotenv/config";

import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  out: "./db/migrations",
  schema: "./src/infrastructure/database/schema/index.ts",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "",
  },
  casing: "snake_case",
  breakpoints: true,
  migrations: {
    prefix: "index",
    table: "__drizzle_migrations",
    schema: "drizzle",
  },
  verbose: false,
  strict: false,
});
