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
      BOT_TOKEN: "test-token",
      DATABASE_PATH: ":memory:",
      LOG_LEVEL: "fatal",
    },
    coverage: {
      include: ["src/**/*.ts"],
      exclude: ["src/app.ts", "src/**/*.constants.ts", "src/**/*.type.ts"],
    },
  },
});
