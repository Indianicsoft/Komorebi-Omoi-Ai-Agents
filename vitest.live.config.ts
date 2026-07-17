import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: process.env.LIVE === "1" ? ["tests/live/**/*.test.ts"] : [],
    environment: "node",
    setupFiles: ["tests/setup.ts"]
  }
});
