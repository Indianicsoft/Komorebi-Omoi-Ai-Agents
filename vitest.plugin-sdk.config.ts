import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/plugin-sdk/**/*.test.ts"],
    environment: "node",
    setupFiles: ["tests/setup.ts"]
  }
});
