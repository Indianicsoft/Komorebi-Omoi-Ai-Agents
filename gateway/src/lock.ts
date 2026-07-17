import { mkdirSync, rmdirSync, existsSync } from "node:fs";
import { dirname } from "node:path";

/**
 * Executes an async function under a file lock for concurrent write protection.
 * Uses atomic directory creation constraints.
 */
export async function withFileLock<T>(filePath: string, fn: () => Promise<T>): Promise<T> {
  const lockDir = `${filePath}.lock`;
  const maxRetries = 50;
  const retryInterval = 100;

  let acquired = false;
  for (let i = 0; i < maxRetries; i++) {
    try {
      mkdirSync(lockDir, { recursive: false });
      acquired = true;
      break;
    } catch (err: any) {
      if (err.code !== "EEXIST") {
        throw err;
      }
      // Wait and try again
      await new Promise((resolve) => setTimeout(resolve, retryInterval));
    }
  }

  if (!acquired) {
    throw new Error(`Timeout waiting to acquire file write lock on: ${filePath}`);
  }

  try {
    return await fn();
  } finally {
    try {
      rmdirSync(lockDir);
    } catch {
      // Ignore
    }
  }
}
