import { join } from "node:path";
import { mkdtempSync, rmSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { beforeAll, afterAll } from "vitest";

let tempHome = "";

beforeAll(() => {
  tempHome = mkdtempSync(join(tmpdir(), "komorebi-test-home-"));
  process.env.HOME = tempHome;
  process.env.USERPROFILE = tempHome;
  process.env.OPENKOMOREBI_GATEWAY_TOKEN = "test-token";

  // Create mock ~/.komorebi configuration structure
  const komorebiDir = join(tempHome, ".komorebi");
  mkdirSync(komorebiDir, { recursive: true });
  mkdirSync(join(komorebiDir, "agents"), { recursive: true });
});

afterAll(() => {
  if (tempHome) {
    try {
      rmSync(tempHome, { recursive: true, force: true });
    } catch {}
  }
});
