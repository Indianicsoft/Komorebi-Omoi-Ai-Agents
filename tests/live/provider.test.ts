import { describe, it, expect } from "vitest";
import { OpenAiCompatibleModelProvider } from "../../agent-runtime/src/providers/openai.js";

describe("Live Model Provider Verification Tests", () => {
  it("should successfully communicate with OpenAI Compatible Provider", async () => {
    const apiKey = process.env.GEMINI_API_KEY || "dummy";
    const provider = new OpenAiCompatibleModelProvider(
      apiKey,
      "gemini-1.5-flash",
      "https://generativelanguage.googleapis.com/v1beta/openai/"
    );
    
    if (apiKey === "dummy") {
      console.log("No real Gemini key found, skipping live provider request.");
      return;
    }

    try {
      const response = await provider.generate("System", [{ role: "user", content: "Say 'Komorebi test passed' in one word." }], []);
      expect(response.content?.toLowerCase()).toContain("komorebi");
    } catch (err: any) {
      console.error("Live call failed:", err.message);
      throw err;
    }
  });
});
