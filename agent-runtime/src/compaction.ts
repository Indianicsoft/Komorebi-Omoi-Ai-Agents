import { ChatMessage } from "./types.js";

/**
 * Heuristic token estimation (chars / 4).
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * 2. Context Window Guards
 * Refuses to operate if context is below 16K. Warns if below 32K.
 */
export function enforceContextGuards(configuredLimit: number): void {
  if (configuredLimit < 16000) {
    throw new Error(`Refusing to operate: configured context window (${configuredLimit} tokens) is below the minimum floor of 16K tokens.`);
  }
  if (configuredLimit < 32000) {
    console.warn(`[Context Guard] WARNING: Configured context window (${configuredLimit} tokens) is below the recommended 32K tokens threshold. Performance may degrade.`);
  }
}

/**
 * 3. Tool Result Guard
 * Scrapes history and inserts synthesized error placeholder results for orphaned tool calls.
 */
export function repairOrphanedToolCalls(history: ChatMessage[]): ChatMessage[] {
  const repaired: ChatMessage[] = [];

  for (let i = 0; i < history.length; i++) {
    const msg = history[i];
    repaired.push(msg);

    if (msg.role === "model" && msg.toolCalls && msg.toolCalls.length > 0) {
      // Check if next turn is user message containing matching tool results
      const nextMsg = history[i + 1];
      const hasResults = nextMsg && nextMsg.role === "user" && nextMsg.toolResults && nextMsg.toolResults.length > 0;

      if (!hasResults) {
        // Synthesize placeholder tool results for all requested calls
        console.warn(`[Tool Result Guard] Orphaned tool call detected for:`, msg.toolCalls.map(t => t.name).join(", "));
        repaired.push({
          role: "user",
          toolResults: msg.toolCalls.map(tc => ({
            toolCallId: tc.id,
            name: tc.name,
            output: "Error: [tool execution interrupted]",
            isError: true
          }))
        });
      }
    }
  }

  return repaired;
}

/**
 * 4. Turn-Based Trimming
 * Trims history starting from index, cutting only at user turn boundaries (never mid-turn).
 */
export function trimOnUserBoundaries(history: ChatMessage[], keepCount: number): ChatMessage[] {
  if (history.length <= keepCount) {
    return history;
  }

  let cutIndex = history.length - keepCount;
  // Advance until we find a user message that does not contain tool results
  while (cutIndex < history.length) {
    const msg = history[cutIndex];
    if (msg.role === "user" && (!msg.toolResults || msg.toolResults.length === 0)) {
      break;
    }
    cutIndex++;
  }

  return history.slice(cutIndex);
}

/**
 * 5. Cache-Aware Pruning
 * Prunes the contents of tool results to small markers if the turn is older than the prompt-cache TTL.
 */
export function pruneExpiredCacheToolResults(
  history: ChatMessage[],
  cacheTTLMs: number,
  sessionStartTime: number
): ChatMessage[] {
  const elapsed = Date.now() - sessionStartTime;
  if (elapsed < cacheTTLMs) {
    return history; // Within cache window, preserve details
  }

  return history.map(msg => {
    if (msg.role === "user" && msg.toolResults && msg.toolResults.length > 0) {
      return {
        ...msg,
        toolResults: msg.toolResults.map(tr => ({
          ...tr,
          output: `[pruned tool output - cache window expired] (Original size: ${tr.output.length} chars)`
        }))
      };
    }
    return msg;
  });
}

/**
 * 6. Head/Tail Preservation
 * Keeps first and last tokens intact, summarizing/trimming only the middle.
 */
export function preserveHeadTail(text: string, headTokens = 500, tailTokens = 500): { head: string; middle: string; tail: string } {
  const headChars = headTokens * 4;
  const tailChars = tailTokens * 4;

  if (text.length <= headChars + tailChars) {
    return { head: text, middle: "", tail: "" };
  }

  return {
    head: text.slice(0, headChars),
    middle: text.slice(headChars, text.length - tailChars),
    tail: text.slice(text.length - tailChars)
  };
}

/**
 * 7. Adaptive Chunk Sizing
 * Groups long text strings into chunks dynamically sized based on sentences/messages lengths.
 */
export function adaptiveChunkText(text: string, maxChunkTokens = 2000): string[] {
  const sentences = text.split("\n");
  const chunks: string[] = [];
  let currentChunk: string[] = [];
  let currentSize = 0;

  for (const s of sentences) {
    const tokens = estimateTokens(s);
    if (currentSize + tokens > maxChunkTokens && currentChunk.length > 0) {
      chunks.push(currentChunk.join("\n"));
      currentChunk = [];
      currentSize = 0;
    }
    currentChunk.push(s);
    currentSize += tokens;
  }

  if (currentChunk.length > 0) {
    chunks.push(currentChunk.join("\n"));
  }

  return chunks;
}

/**
 * 8. Staged Summarization
 * Sequential summarizer chunking, reducing context footprint.
 */
export async function runStagedSummarization(
  text: string,
  modelGenerate: (prompt: string, history: ChatMessage[]) => Promise<string>,
  maxChunkTokens = 3000
): Promise<string> {
  const chunks = adaptiveChunkText(text, maxChunkTokens);
  if (chunks.length === 0) return "";
  if (chunks.length === 1) {
    return await modelGenerate("Summarize the following text accurately:\n" + chunks[0], []);
  }

  console.log(`[Compaction] Staged Summarization: processing ${chunks.length} chunks...`);
  const summaries: string[] = [];
  for (let i = 0; i < chunks.length; i++) {
    const chunkSummary = await modelGenerate(
      `Summarize part ${i + 1} of the text history:\n` + chunks[i],
      []
    );
    summaries.push(chunkSummary);
  }

  // Combine summaries
  return await modelGenerate(
    "Synthesize these partial summaries into one coherent, complete summary:\n" + summaries.join("\n\n"),
    []
  );
}
