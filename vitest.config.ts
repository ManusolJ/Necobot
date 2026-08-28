import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
    restoreMocks: true,
    env: {
      LOG_LEVEL: "fatal",
      BOT_TOKEN: "test-token",
      DATABASE_PATH: ":memory:",
      OLLAMA_URL: "http://localhost:11434",
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
