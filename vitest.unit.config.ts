import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/unit/**/*.test.ts"],
    environment: "node",
    setupFiles: ["tests/setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      exclude: [
        "cli/**",
        "gateway/src/telegram.ts",
        "gateway/src/server.ts",
        "**/*.d.ts",
        "tests/**"
      ]
    }
  }
});
