import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
    alias: [
      {
        find: /^@infrastructure\/database\/client\.js$/u,
        replacement: fileURLToPath(new URL("./tests/helpers/pglite-client.ts", import.meta.url)),
      },
    ],
  },
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
    restoreMocks: true,
    env: {
      LOG_LEVEL: "fatal",
      BOT_TOKEN: "test-token",
      DATABASE_URL: "postgres://test:test@localhost:5432/test",
      OLLAMA_URL: "http://localhost:11434",
      GOOGLE_BOOKS_API_KEY: "test-google-books-key",
    },
    coverage: {
      include: ["src/**/*.ts"],
      exclude: [
        "src/app.ts",
        "src/register-stores.ts",
        "src/**/*.constants.ts",
        "src/**/*.messages.ts",
        "src/**/*.types.ts",
      ],
    },
  },
});
