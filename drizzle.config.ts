import "dotenv/config";

import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "sqlite",
  out: "./db/migrations",
  schema: "./src/infrastructure/database/schema.ts",
  dbCredentials: {
    url: process.env.DATABASE_PATH ?? "./db/data.sqlite",
  },
});
