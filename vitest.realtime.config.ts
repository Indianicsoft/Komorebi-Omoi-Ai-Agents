import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/realtime/**/*.test.ts"],
    environment: "node",
    pool: "forks",
    maxWorkers: 1
  }
});
