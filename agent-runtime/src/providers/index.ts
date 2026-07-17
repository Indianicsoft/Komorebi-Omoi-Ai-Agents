import { ChatMessage, ToolDefinition, ModelResponse } from "../types.js";
import { OpenAiCompatibleModelProvider } from "./openai.js";
import { AnthropicModelProvider } from "./anthropic.js";

export interface ModelProvider {
  id: string;
  generate(
    systemPrompt: string,
    history: ChatMessage[],
    tools: ToolDefinition[],
    onChunk?: (chunk: { text?: string; toolCalls?: any[] }) => void,
    options?: { maxInputTokens?: number; maxOutputTokens?: number }
  ): Promise<ModelResponse>;
}

export function createModelProvider(
  providerId: string,
  apiKey: string,
  modelName: string,
  providerConfig?: any,
  options?: { temperature?: number; maxOutputTokens?: number }
): ModelProvider {
  const apiType = providerConfig?.api || (providerId === "anthropic" ? "anthropic" : "openai");
  const baseUrl = providerConfig?.baseUrl;

  if (apiType === "gemini" as string) {
    throw new Error("Native Gemini provider is deprecated and removed. Use openai-compatible provider instead.");
  } else if (apiType === "anthropic") {
    return new AnthropicModelProvider(apiKey, modelName, options);
  } else {
    return new OpenAiCompatibleModelProvider(
      apiKey,
      modelName,
      baseUrl || "https://api.openai.com/v1",
      options
    );
  }
}
