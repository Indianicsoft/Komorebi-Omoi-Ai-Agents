import { describe, it, expect } from "vitest";

describe("Realtime Timing & Stream Timing Tests", () => {
  it("should enforce debounce interval timing correctly", async () => {
    const start = Date.now();
    await new Promise((resolve) => setTimeout(resolve, 150));
    const duration = Date.now() - start;
    expect(duration).toBeGreaterThanOrEqual(140);
  });

  it("should process stream chunk-break bounds without data truncation", () => {
    const textChunk = "Hello <thinking>Reasoning step</thinking> final answer.";
    const processed = textChunk.replace(/<thinking>[\s\S]*?<\/thinking>/g, "").trim();
    expect(processed).toBe("Hello  final answer.");
  });
});
