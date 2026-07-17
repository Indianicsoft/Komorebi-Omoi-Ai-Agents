import { randomUUID } from "node:crypto";
import { ModelProvider, ChatMessage, ToolDefinition, ModelResponse, ToolCall } from "./types.js";

export function sanitizeHistory(history: ChatMessage[], isWorking: boolean): ChatMessage[] {
  return history.map((msg) => {
    if (msg.toolResults && msg.toolResults.length > 0) {
      return {
        ...msg,
        toolResults: msg.toolResults.map((tr) => {
          const maxChars = isWorking ? 1200 : 3000; // ~300 tokens when working, keeping total request strictly under 1k tokens limit
          if (tr.output && tr.output.length > maxChars) {
            const head = tr.output.slice(0, maxChars / 2);
            const tail = tr.output.slice(-maxChars / 2);
            return {
              ...tr,
              output: `${head}\n\n... [Output truncated to save context/API costs. Original size: ${tr.output.length} characters] ...\n\n${tail}`,
            };
          }
          return tr;
        }),
      };
    }
    return msg;
  });
}

/**
 * GeminiModelProvider wraps the official @google/generative-ai SDK.
 * It translates generic ReAct loop frames to Gemini's native API models.
 */
export class GeminiModelProvider implements ModelProvider {
  public readonly id = "gemini";
  private genAI: any = null;
  private modelName: string;
  private apiKey: string;

  constructor(apiKey: string, modelName: string = "gemini-1.5-flash") {
    this.apiKey = apiKey;
    this.modelName = modelName.includes("3.5") ? "gemini-1.5-flash" : modelName; 
  }

  public async generate(
    systemPrompt: string,
    history: ChatMessage[],
    tools: ToolDefinition[],
    onChunk?: (chunk: { text?: string; toolCalls?: any[] }) => Promise<void> | void,
    options?: { maxInputTokens?: number; maxOutputTokens?: number }
  ): Promise<ModelResponse> {
    // If executing in a dry-run test mode, return pre-baked mock responses
    if (this.apiKey === "dummy" || this.apiKey === "mock-key" || !this.apiKey) {
      return this.generateMockResponse(history);
    }

    if (!this.genAI) {
      const { GoogleGenerativeAI } = await import("@google/generative-ai");
      this.genAI = new GoogleGenerativeAI(this.apiKey);
    }

    const maxInputTokens = options?.maxInputTokens ?? 15000;
    const maxOutputTokens = options?.maxOutputTokens ?? 4000;

    const model = this.genAI.getGenerativeModel({
      model: this.modelName,
      systemInstruction: systemPrompt,
      generationConfig: { maxOutputTokens },
    });

    const prunedHistory = pruneHistoryToLimit(systemPrompt, history, tools, maxInputTokens);
    const sanitizedHistory = sanitizeHistory(prunedHistory, false);

    const contents = sanitizedHistory.map((msg) => {
      const parts: any[] = [];
      if (msg.content) parts.push({ text: msg.content });
      if (msg.mediaParts && msg.mediaParts.length > 0) {
        for (const mp of msg.mediaParts) {
          parts.push({ inlineData: { mimeType: mp.mimeType, data: mp.data } });
        }
      }
      if (msg.toolCalls && msg.toolCalls.length > 0) {
        for (const tc of msg.toolCalls) {
          parts.push({ functionCall: { name: tc.name, args: tc.arguments } });
        }
      }
      if (msg.toolResults && msg.toolResults.length > 0) {
        const validToolNames = new Set<string>();
        for (const m of history) {
          if (m.toolCalls) for (const tc of m.toolCalls) validToolNames.add(tc.name);
        }
        for (const tr of msg.toolResults) {
          if (validToolNames.has(tr.name)) {
            parts.push({ functionResponse: { name: tr.name, response: { result: tr.output } } });
          } else {
            parts.push({ text: `[System Notification: Tool execution result for '${tr.name}']\n${tr.output}` });
          }
        }
      }
      return { role: msg.role === "model" ? "model" : "user", parts };
    });

    const geminiTools = tools.length > 0
      ? [{ functionDeclarations: tools.map((t) => ({ name: t.name, description: t.description, parameters: t.parameters as any })) }]
      : undefined;

    // Use streaming if onChunk is provided
    if (onChunk) {
      const streamResult = await model.generateContentStream({ contents, tools: geminiTools });
      let fullText = "";
      const toolCalls: ToolCall[] = [];

      for await (const chunk of streamResult.stream) {
        const chunkText = chunk.text ? chunk.text() : "";
        if (chunkText) {
          fullText += chunkText;
          await onChunk({ text: chunkText });
        }
        const fcs = chunk.functionCalls?.();
        if (fcs && fcs.length > 0) {
          for (const fc of fcs) {
            toolCalls.push({ id: `call_${randomUUID().slice(0, 8)}`, name: fc.name, arguments: fc.args as Record<string, any> });
          }
        }
      }

      // Finalize: merge any function calls from the final response
      const finalResp = await streamResult.response;
      const finalFcs = finalResp.functionCalls?.();
      if (finalFcs && finalFcs.length > 0 && toolCalls.length === 0) {
        for (const fc of finalFcs) {
          toolCalls.push({ id: `call_${randomUUID().slice(0, 8)}`, name: fc.name, arguments: fc.args as Record<string, any> });
        }
      }

      return {
        content: fullText || undefined,
        toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      };
    }

    // Non-streaming fallback
    const result = await model.generateContent({ contents, tools: geminiTools });
    const response = await result.response;
    const text = response.text();
    const functionCalls = response.functionCalls();
    const toolCalls: ToolCall[] = [];
    if (functionCalls && functionCalls.length > 0) {
      for (const fc of functionCalls) {
        toolCalls.push({ id: `call_${randomUUID().slice(0, 8)}`, name: fc.name, arguments: fc.args as Record<string, any> });
      }
    }
    return { content: text || undefined, toolCalls: toolCalls.length > 0 ? toolCalls : undefined };
  }

  /**
   * Generates mock replies for test scripts to verify the ReAct loop flows
   * without invoking actual remote model requests.
   */
  private async generateMockResponse(history: ChatMessage[]): Promise<ModelResponse> {
    const lastMsg = history[history.length - 1];
    
    // Check if the agent just received tool results
    const hasToolResult = lastMsg.toolResults && lastMsg.toolResults.length > 0;
    
    if (hasToolResult) {
      const toolOut = lastMsg.toolResults![0].output;
      return {
        content: `I received the search result: "${toolOut}". Based on this, the Komorebi Omoi agentic runtime workspace and configuration are completely configured and valid.`,
      };
    }

    // Default mock response: execute a test tool call first
    return {
      toolCalls: [
        {
          id: "call_mock_1",
          name: "web_search",
          arguments: { query: "Komorebi Omoi agentic AI runtime" },
        },
      ],
    };
  }
}

export class OpenAiCompatibleModelProvider implements ModelProvider {
  public readonly id = "openai";
  constructor(
    private readonly apiKey: string,
    private readonly modelName: string,
    private readonly baseUrl: string
  ) {}

  public async generate(
    systemPrompt: string,
    history: ChatMessage[],
    tools: ToolDefinition[],
    onChunk?: (chunk: { text?: string; toolCalls?: any[] }) => Promise<void> | void,
    options?: { maxInputTokens?: number; maxOutputTokens?: number }
  ): Promise<ModelResponse> {
    if (this.apiKey === "dummy" || this.apiKey === "mock-key" || !this.apiKey) {
      return this.generateMockResponse(history);
    }

    const messages: any[] = [];
    if (systemPrompt) messages.push({ role: "system", content: systemPrompt });

    const maxInputTokens = options?.maxInputTokens ?? 15000;
    const maxOutputTokens = options?.maxOutputTokens ?? 4000;

    const prunedHistory = pruneHistoryToLimit(systemPrompt, history, tools, maxInputTokens);
    const sanitizedHistory = sanitizeHistory(prunedHistory, false);
    for (const msg of sanitizedHistory) {
      if (msg.role === "system") {
        messages.push({ role: "system", content: msg.content });
      } else if (msg.role === "user") {
        if (msg.content) messages.push({ role: "user", content: msg.content });
        if (msg.toolResults && msg.toolResults.length > 0) {
          const validToolCallIds = new Set<string>();
          for (const m of history) {
            if (m.toolCalls) for (const tc of m.toolCalls) validToolCallIds.add(tc.id);
          }
          for (const tr of msg.toolResults) {
            if (tr.toolCallId && validToolCallIds.has(tr.toolCallId)) {
              messages.push({ role: "tool", tool_call_id: tr.toolCallId, name: tr.name, content: tr.output });
            } else {
              messages.push({ role: "user", content: `[System Notification: Tool execution result for '${tr.name}']\n${tr.output}` });
            }
          }
        }
      } else if (msg.role === "model") {
        const assistantMsg: any = { role: "assistant", content: msg.content || null };
        if (msg.toolCalls && msg.toolCalls.length > 0) {
          assistantMsg.tool_calls = msg.toolCalls.map((tc) => ({
            id: tc.id,
            type: "function",
            function: { name: tc.name, arguments: typeof tc.arguments === "string" ? tc.arguments : JSON.stringify(tc.arguments) },
          }));
        }
        messages.push(assistantMsg);
      }
    }

    const openAiTools = tools.length > 0
      ? tools.map((t) => ({ type: "function", function: { name: t.name, description: t.description, parameters: t.parameters } }))
      : undefined;

    const url = `${this.baseUrl.replace(/\/$/, "")}/chat/completions`;
    console.log(`[OpenAiCompatibleModelProvider] Calling API: ${url} (model: ${this.modelName}, stream: ${!!onChunk})`);
    console.log(`[OpenAiCompatibleModelProvider] Messages: ${messages.length}, maxOutput: ${maxOutputTokens}`);

    // ── Streaming path ────────────────────────────────────────────────────────
    if (onChunk) {
      const streamBody: any = { model: this.modelName, messages, max_tokens: maxOutputTokens, stream: true };
      if (openAiTools) streamBody.tools = openAiTools;

      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${this.apiKey}` },
        body: JSON.stringify(streamBody),
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`OpenAI stream request failed ${res.status}: ${errorText}`);
      }

      let fullText = "";
      const toolCallAccum: Map<number, { id: string; name: string; arguments: string }> = new Map();

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data:")) continue;
          const data = trimmed.slice(5).trim();
          if (data === "[DONE]") break;
          try {
            const parsed = JSON.parse(data);
            const choice = parsed.choices?.[0];
            const delta = choice?.delta;
            if (!delta) continue;

            // Text chunk
            if (delta.content) {
              fullText += delta.content;
              await onChunk({ text: delta.content });
            }

            // Tool call accumulation
            if (delta.tool_calls) {
              for (const tc of delta.tool_calls) {
                const idx = tc.index ?? 0;
                if (!toolCallAccum.has(idx)) {
                  toolCallAccum.set(idx, { id: tc.id || `call_${randomUUID().slice(0, 8)}`, name: tc.function?.name || "", arguments: "" });
                }
                const acc = toolCallAccum.get(idx)!;
                if (tc.id) acc.id = tc.id;
                if (tc.function?.name) acc.name += tc.function.name;
                if (tc.function?.arguments) acc.arguments += tc.function.arguments;
              }
            }
          } catch {
            // Skip malformed SSE lines
          }
        }
      }

      const toolCalls: ToolCall[] = [];
      for (const [, acc] of toolCallAccum) {
        let parsedArgs: Record<string, any> = {};
        try { parsedArgs = JSON.parse(acc.arguments || "{}"); } catch {}
        toolCalls.push({ id: acc.id, name: acc.name, arguments: parsedArgs });
      }

      return { content: fullText || undefined, toolCalls: toolCalls.length > 0 ? toolCalls : undefined };
    }

    // ── Non-streaming path ────────────────────────────────────────────────────
    const requestBody: any = { model: this.modelName, messages, max_tokens: maxOutputTokens };
    if (openAiTools) requestBody.tools = openAiTools;

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${this.apiKey}` },
      body: JSON.stringify(requestBody),
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`OpenAI API request failed with status ${res.status}: ${errorText}`);
    }

    const data = await res.json() as any;
    const choice = data.choices?.[0];
    const message = choice?.message;
    const content = message?.content || undefined;

    const toolCalls: ToolCall[] = [];
    if (message?.tool_calls && message.tool_calls.length > 0) {
      for (const tc of message.tool_calls) {
        if (tc.type === "function") {
          let parsedArgs = {};
          try { parsedArgs = typeof tc.function.arguments === "string" ? JSON.parse(tc.function.arguments) : tc.function.arguments; } catch {}
          toolCalls.push({ id: tc.id || `call_${randomUUID().slice(0, 8)}`, name: tc.function.name, arguments: parsedArgs });
        }
      }
    }

    return { content, toolCalls: toolCalls.length > 0 ? toolCalls : undefined };
  }

  private async generateMockResponse(history: ChatMessage[]): Promise<ModelResponse> {
    const lastMsg = history[history.length - 1];
    const hasToolResult = lastMsg.toolResults && lastMsg.toolResults.length > 0;
    if (hasToolResult) {
      return { content: `Tool result received. Komorebi Omoi runtime is operating correctly.` };
    }
    return { toolCalls: [{ id: "call_mock_1", name: "web_search", arguments: { query: "Komorebi Omoi agentic AI runtime" } }] };
  }
}

export function createModelProvider(
  providerId: string,
  apiKey: string,
  modelName: string,
  providerConfig?: any
): ModelProvider {
  const apiType = providerConfig?.api || (providerId === "gemini" ? "gemini" : providerId === "anthropic" ? "anthropic" : "openai");
  const baseUrl = providerConfig?.baseUrl;

  if (apiType === "gemini") {
    return new GeminiModelProvider(apiKey, modelName);
  } else if (apiType === "anthropic") {
    return new AnthropicModelProvider(apiKey, modelName);
  } else {
    return new OpenAiCompatibleModelProvider(
      apiKey,
      modelName,
      baseUrl || "https://api.openai.com/v1"
    );
  }
}

/**
 * AnthropicModelProvider — wraps the Anthropic Messages API.
 * Supports Claude 3.5 Sonnet, Claude 3.5 Haiku, Claude 3 Opus
 * with full tool_use (function calling) support.
 */
export class AnthropicModelProvider implements ModelProvider {
  public readonly id = "anthropic";
  constructor(
    private readonly apiKey: string,
    private readonly modelName: string = "claude-3-5-sonnet-20241022"
  ) {}

  public async generate(
    systemPrompt: string,
    history: ChatMessage[],
    tools: ToolDefinition[],
    onChunk?: (chunk: { text?: string; toolCalls?: any[] }) => Promise<void> | void,
    options?: { maxInputTokens?: number; maxOutputTokens?: number }
  ): Promise<ModelResponse> {
    if (this.apiKey === "dummy" || this.apiKey === "mock-key" || !this.apiKey) {
      return this.generateMockResponse(history);
    }

    const messages: any[] = [];
    const maxInputTokens = options?.maxInputTokens ?? 15000;
    const maxOutputTokens = options?.maxOutputTokens ?? 4000;

    const prunedHistory = pruneHistoryToLimit(systemPrompt, history, tools, maxInputTokens);
    const sanitizedHistory = sanitizeHistory(prunedHistory, false);
    for (const msg of sanitizedHistory) {
      if (msg.role === "user") {
        const content: any[] = [];
        if (msg.content) content.push({ type: "text", text: msg.content });
        if (msg.toolResults && msg.toolResults.length > 0) {
          for (const tr of msg.toolResults) {
            content.push({ type: "tool_result", tool_use_id: tr.toolCallId || tr.name, content: tr.output });
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

    const requestBody: any = { model: this.modelName, max_tokens: maxOutputTokens, system: systemPrompt, messages };
    if (anthropicTools) requestBody.tools = anthropicTools;

    // ── Streaming path ────────────────────────────────────────────────────────
    if (onChunk) {
      requestBody.stream = true;
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": this.apiKey, "anthropic-version": "2023-06-01" },
        body: JSON.stringify(requestBody),
      });
      if (!res.ok) throw new Error(`Anthropic stream error ${res.status}: ${await res.text()}`);

      let fullText = "";
      const toolCalls: ToolCall[] = [];
      const toolAccum: Map<number, { id: string; name: string; input: string }> = new Map();

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data:")) continue;
          try {
            const parsed = JSON.parse(trimmed.slice(5).trim());
            if (parsed.type === "content_block_delta") {
              const delta = parsed.delta;
              if (delta?.type === "text_delta" && delta.text) {
                fullText += delta.text;
                await onChunk({ text: delta.text });
              } else if (delta?.type === "input_json_delta" && delta.partial_json) {
                const idx = parsed.index ?? 0;
                const acc = toolAccum.get(idx);
                if (acc) acc.input += delta.partial_json;
              }
            } else if (parsed.type === "content_block_start" && parsed.content_block?.type === "tool_use") {
              const idx = parsed.index ?? toolAccum.size;
              toolAccum.set(idx, { id: parsed.content_block.id, name: parsed.content_block.name, input: "" });
            }
          } catch {}
        }
      }
      for (const [, acc] of toolAccum) {
        let parsedInput: Record<string, any> = {};
        try { parsedInput = JSON.parse(acc.input || "{}"); } catch {}
        toolCalls.push({ id: acc.id, name: acc.name, arguments: parsedInput });
      }
      return { content: fullText || undefined, toolCalls: toolCalls.length > 0 ? toolCalls : undefined };
    }

    // ── Non-streaming path ────────────────────────────────────────────────────
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": this.apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify(requestBody),
    });
    if (!res.ok) throw new Error(`Anthropic API error ${res.status}: ${await res.text()}`);

    const data = await res.json() as any;
    let textContent: string | undefined;
    const toolCalls: ToolCall[] = [];
    for (const block of data.content || []) {
      if (block.type === "text") textContent = (textContent || "") + block.text;
      else if (block.type === "tool_use") toolCalls.push({ id: block.id, name: block.name, arguments: block.input as Record<string, any> });
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

export function pruneHistoryToLimit(
  systemPrompt: string,
  history: ChatMessage[],
  tools: ToolDefinition[],
  maxInputTokens = 1000
): ChatMessage[] {
  let baselineText = systemPrompt || "";
  for (const t of tools) {
    baselineText += ` ${t.name} ${t.description} ${JSON.stringify(t.parameters)}`;
  }

  const estimateTokens = (text: string) => Math.ceil(text.length / 4);
  let currentTokens = estimateTokens(baselineText);
  if (currentTokens >= maxInputTokens - 50) {
    if (history.length > 0) {
      return [history[history.length - 1]];
    }
    return [];
  }

  const pruned: ChatMessage[] = [];
  for (let i = history.length - 1; i >= 0; i--) {
    const msg = history[i];
    let msgText = `${msg.role} ${msg.content || ""}`;
    if (msg.toolCalls) msgText += ` ${JSON.stringify(msg.toolCalls)}`;
    if (msg.toolResults) msgText += ` ${JSON.stringify(msg.toolResults)}`;

    const msgTokens = estimateTokens(msgText);
    if (currentTokens + msgTokens > maxInputTokens) {
      if (pruned.length > 0) {
        break;
      }
    }
    currentTokens += msgTokens;
    pruned.unshift(msg);
  }
  return pruned;
}
