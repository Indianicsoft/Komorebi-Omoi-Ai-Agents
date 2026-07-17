import { defineConfig } from "vitest/config";

const workers = process.env.KOMOREBI_E2E_WORKERS 
  ? parseInt(process.env.KOMOREBI_E2E_WORKERS, 10) 
  : undefined;

export default defineConfig({
  test: {
    include: ["tests/e2e/**/*.test.ts"],
    environment: "node",
    pool: "forks",
    setupFiles: ["tests/setup.ts"],
    maxWorkers: workers
  }
});
