import { ChatMessage, ToolDefinition, ModelResponse, ToolCall } from "../types.js";
import { ModelProvider } from "./index.js";
import { pruneHistoryToLimit, sanitizeHistory } from "../model.js";

export class AnthropicModelProvider implements ModelProvider {
  public readonly id = "anthropic";

  constructor(
    private readonly apiKey: string,
    private readonly modelName: string = "claude-3-5-sonnet-20241022",
    private readonly options?: { temperature?: number; maxOutputTokens?: number }
  ) {}

  public async generate(
    systemPrompt: string,
    history: ChatMessage[],
    tools: ToolDefinition[],
    onChunk?: (chunk: { text?: string; toolCalls?: any[] }) => void,
    options?: { maxInputTokens?: number; maxOutputTokens?: number }
  ): Promise<ModelResponse> {
    if (this.apiKey === "dummy" || this.apiKey === "mock-key" || !this.apiKey) {
      return this.generateMockResponse(history);
    }

    const maxInputTokens = options?.maxInputTokens ?? 30000;
    const maxOutputTokens = options?.maxOutputTokens ?? 4000;

    const prunedHistory = pruneHistoryToLimit(systemPrompt, history, tools, maxInputTokens);
    const sanitizedHistory = sanitizeHistory(prunedHistory, false);

    const messages: any[] = [];
    const sentToolCallIds = new Set<string>();
    for (const msg of sanitizedHistory) {
      if (msg.role === "user") {
        const content: any[] = [];
        if (msg.content) content.push({ type: "text", text: msg.content });
        if (msg.toolResults && msg.toolResults.length > 0) {
          for (const tr of msg.toolResults) {
            const toolId = tr.toolCallId || tr.name;
            if (sentToolCallIds.has(toolId)) {
              console.warn(`[AnthropicModelProvider] Skipping duplicate tool result for ID: ${toolId}`);
              continue;
            }
            sentToolCallIds.add(toolId);
            content.push({ type: "tool_result", tool_use_id: toolId, content: tr.output });
          }
        }
        if (content.length > 0) messages.push({ role: "user", content });
      } else if (msg.role === "model") {
        const content: any[] = [];
        if (msg.content) content.push({ type: "text", text: msg.content });
        if (msg.toolCalls && msg.toolCalls.length > 0) {
          for (const tc of msg.toolCalls) {
            content.push({ type: "tool_use", id: tc.id, name: tc.name, input: tc.arguments });
          }
        }
        if (content.length > 0) messages.push({ role: "assistant", content });
      }
    }

    const anthropicTools = tools.length > 0
      ? tools.map(t => ({ name: t.name, description: t.description, input_schema: t.parameters }))
      : undefined;

    const requestBody: any = {
      model: this.modelName,
      max_tokens: maxOutputTokens,
      system: systemPrompt,
      messages,
    };
    if (this.options?.temperature !== undefined) {
      requestBody.temperature = this.options.temperature;
    }
    if (anthropicTools) requestBody.tools = anthropicTools;

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(requestBody),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Anthropic API error ${res.status}: ${errText}`);
    }

    const data = await res.json() as any;
    let textContent: string | undefined;
    const toolCalls: ToolCall[] = [];

    for (const block of data.content || []) {
      if (block.type === "text") {
        textContent = (textContent || "") + block.text;
      } else if (block.type === "tool_use") {
        toolCalls.push({ id: block.id, name: block.name, arguments: block.input as Record<string, any> });
      }
    }
    if (onChunk && textContent) {
      onChunk({ text: textContent });
    }
    for (const tc of toolCalls) {
      if (onChunk) onChunk({ toolCalls: [tc] });
    }

    return { content: textContent, toolCalls: toolCalls.length > 0 ? toolCalls : undefined };
  }

  private async generateMockResponse(history: ChatMessage[]): Promise<ModelResponse> {
    const lastMsg = history[history.length - 1];
    if (lastMsg.toolResults && lastMsg.toolResults.length > 0) {
      return { content: `Tool result received. Komorebi Omoi runtime is operating correctly.` };
    }
    return { toolCalls: [{ id: "call_mock_1", name: "web_search", arguments: { query: "Komorebi Omoi agentic AI" } }] };
  }
}
