import { randomUUID } from "node:crypto";
import { ChatMessage, ToolDefinition, ModelResponse, ToolCall } from "../types.js";
import { ModelProvider } from "./index.js";
import { pruneHistoryToLimit, sanitizeHistory } from "../model.js";

export class OpenAiCompatibleModelProvider implements ModelProvider {
  public readonly id = "openai";

  constructor(
    private readonly apiKey: string,
    private readonly modelName: string,
    private readonly baseUrl: string,
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

    if (systemPrompt) {
      messages.push({ role: "system", content: systemPrompt });
    }

    for (const msg of sanitizedHistory) {
      if (msg.role === "system") {
        messages.push({ role: "system", content: msg.content });
      } else if (msg.role === "user") {
        if (msg.content) {
          messages.push({ role: "user", content: msg.content });
        }
        if (msg.toolResults && msg.toolResults.length > 0) {
          const validToolCallIds = new Set<string>();
          for (const m of history) {
            if (m.toolCalls) {
              for (const tc of m.toolCalls) {
                validToolCallIds.add(tc.id);
              }
            }
          }

          for (const tr of msg.toolResults) {
            if (tr.toolCallId && validToolCallIds.has(tr.toolCallId)) {
              if (sentToolCallIds.has(tr.toolCallId)) {
                console.warn(`[OpenAiCompatibleModelProvider] Skipping duplicate tool result for tool call ID: ${tr.toolCallId}`);
                continue;
              }
              sentToolCallIds.add(tr.toolCallId);
              messages.push({
                role: "tool",
                tool_call_id: tr.toolCallId,
                name: tr.name,
                content: tr.output,
              });
            } else {
              messages.push({
                role: "user",
                content: `[System Notification: Tool execution result for '${tr.name}']\n${tr.output}`,
              });
            }
          }
        }
      } else if (msg.role === "model") {
        const assistantMsg: any = {
          role: "assistant",
          content: msg.content || null,
        };
        if (msg.toolCalls && msg.toolCalls.length > 0) {
          assistantMsg.tool_calls = msg.toolCalls.map((tc) => ({
            id: tc.id,
            type: "function",
            function: {
              name: tc.name,
              arguments: typeof tc.arguments === "string" ? tc.arguments : JSON.stringify(tc.arguments),
            },
          }));
        }
        messages.push(assistantMsg);
      }
    }

    const openAiTools =
      tools.length > 0
        ? tools.map((t) => ({
            type: "function",
            function: {
              name: t.name,
              description: t.description,
              parameters: t.parameters,
            },
          }))
        : undefined;

    const requestBody: any = {
      model: this.modelName,
      messages,
      max_tokens: maxOutputTokens,
    };
    if (openAiTools) {
      requestBody.tools = openAiTools;
    }
    if (this.options?.temperature !== undefined) {
      requestBody.temperature = this.options.temperature;
    }

    const url = `${this.baseUrl.replace(/\/$/, "")}/chat/completions`;
    console.log(`[OpenAiCompatibleModelProvider] Calling API: ${url} (model: ${this.modelName})`);

    if (onChunk) {
      requestBody.stream = true;
      const resStream = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(requestBody),
      });

      if (!resStream.ok) {
        const errorText = await resStream.text();
        throw new Error(`OpenAI API request failed with status ${resStream.status}: ${errorText}`);
      }

      const reader = resStream.body?.getReader();
      if (!reader) {
        throw new Error("Response body is not readable.");
      }

      const decoder = new TextDecoder("utf-8");
      let textAccumulator = "";
      const toolCallsMap = new Map<number, { id?: string; name?: string; arguments: string }>();

      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const cleaned = line.trim();
          if (!cleaned || cleaned === "data: [DONE]") continue;

          if (cleaned.startsWith("data: ")) {
            try {
              const parsed = JSON.parse(cleaned.slice(6));
              const delta = parsed.choices?.[0]?.delta;
              if (delta) {
                if (delta.content) {
                  textAccumulator += delta.content;
                  onChunk({ text: delta.content });
                }
                if (delta.tool_calls) {
                  for (const tcDelta of delta.tool_calls) {
                    const idx = tcDelta.index;
                    let existing = toolCallsMap.get(idx);
                    if (!existing) {
                      existing = { arguments: "" };
                      toolCallsMap.set(idx, existing);
                    }
                    if (tcDelta.id) existing.id = tcDelta.id;
                    if (tcDelta.function?.name) existing.name = tcDelta.function.name;
                    if (tcDelta.function?.arguments) existing.arguments += tcDelta.function.arguments;
                  }
                }
              }
            } catch {}
          }
        }
      }

      const toolCalls: ToolCall[] = [];
      for (const [idx, item] of toolCallsMap.entries()) {
        if (item.name) {
          let parsedArgs = {};
          try {
            parsedArgs = JSON.parse(item.arguments);
          } catch {}
          const tc = {
            id: item.id || `call_${randomUUID().slice(0, 8)}`,
            name: item.name,
            arguments: parsedArgs
          };
          toolCalls.push(tc);
          onChunk({ toolCalls: [tc] });
        }
      }

      return {
        content: textAccumulator || undefined,
        toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      };
    }

    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
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
          try {
            parsedArgs =
              typeof tc.function.arguments === "string"
                ? JSON.parse(tc.function.arguments)
                : tc.function.arguments;
          } catch (err) {
            console.error("Failed to parse tool arguments:", tc.function.arguments);
          }
          toolCalls.push({
            id: tc.id || `call_${randomUUID().slice(0, 8)}`,
            name: tc.function.name,
            arguments: parsedArgs,
          });
        }
      }
    }

    return {
      content,
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
    };
  }

  private async generateMockResponse(history: ChatMessage[]): Promise<ModelResponse> {
    const lastMsg = history[history.length - 1];
    const hasToolResult = lastMsg.toolResults && lastMsg.toolResults.length > 0;

    if (hasToolResult) {
      const toolOut = lastMsg.toolResults![0].output;
      return {
        content: `I received the search result: "${toolOut}". Based on this, the Komorebi Omoi agentic runtime workspace and configuration are completely configured and valid.`,
      };
    }

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
