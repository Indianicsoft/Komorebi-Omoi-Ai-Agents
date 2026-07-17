import { ToolRegistry } from "./registry.js";
import { ModelProvider } from "./types.js";

export interface SubAgentContext {
  agentId: string;
  gatewayUrl: string;
  gatewayToken: string;
  workspacePath: string;
  modelProvider: ModelProvider;
  toolRegistry: ToolRegistry;
  rpcRequest?: (method: string, params: any) => Promise<any>;
  nestingDepth?: number;
}

export class SubAgentManager {
  public static activeCount = 0;

  /**
   * Spawns a short-lived sub-agent to execute a scoped task.
   */
  public static async runSubAgent(
    task: string,
    parentContext: SubAgentContext,
    denyTools: string[] = []
  ): Promise<string> {
    const depth = parentContext.nestingDepth || 1;
    if (depth >= 2) {
      throw new Error("Nesting depth limit of 2 exceeded.");
    }

    if (SubAgentManager.activeCount >= 3) {
      throw new Error("Concurrency limit of 3 exceeded. Cannot spawn sub-agent now.");
    }

    SubAgentManager.activeCount++;
    try {
      console.log(`[SubAgent] Spawning sub-agent helper. Active count: ${SubAgentManager.activeCount}, depth: ${depth + 1}`);

      // Inherit parent's policy allow/deny layers
      const parentPolicy = (parentContext.toolRegistry as any).policy;
      const subPolicy = {
        allow: [...(parentPolicy?.allow || ["*"])],
        deny: [...(parentPolicy?.deny || []), ...denyTools]
      };

      // Instantiate local restricted registry
      const subRegistry = new ToolRegistry(parentContext.workspacePath, subPolicy as any);
      
      // Copy tool references
      const definitions = parentContext.toolRegistry.getDefinitions();
      for (const def of definitions) {
        const toolObj = (parentContext.toolRegistry as any).tools.get(def.name);
        if (toolObj) {
          subRegistry.register(toolObj);
        }
      }

      const systemInstruction = `You are a short-lived, isolated sub-agent helper.
Your parent agent is "${parentContext.agentId}".
Your assigned scoped task is: "${task}"
Execute this task by reasoning and calling tools. Summarize your final answer clearly and concisely.`;

      const currentHistory: any[] = [{ role: "user", content: `Please execute task: ${task}` }];
      let iterations = 0;
      const maxIterations = 100;

      while (iterations < maxIterations) {
        const res = await parentContext.modelProvider.generate(
          systemInstruction,
          currentHistory,
          subRegistry.getDefinitions()
        );

        currentHistory.push({ role: "model", content: res.content, toolCalls: res.toolCalls });

        if (res.toolCalls && res.toolCalls.length > 0) {
          const toolResults = [];
          for (const tc of res.toolCalls) {
            const output = await subRegistry.execute(tc.name, tc.arguments, {
              agentId: `${parentContext.agentId}-sub`,
              sessionId: `sub_${Date.now()}`,
              workspacePath: parentContext.workspacePath,
              gatewayUrl: parentContext.gatewayUrl,
              gatewayToken: parentContext.gatewayToken,
              rpcRequest: parentContext.rpcRequest || (() => Promise.resolve({})),
              nestingDepth: depth + 1 // increment nesting depth
            } as any);

            toolResults.push({
              toolCallId: tc.id,
              name: tc.name,
              output
            });
          }

          currentHistory.push({ role: "user", toolResults });
          iterations++;
        } else {
          return res.content || "Task completed.";
        }
      }

      return currentHistory[currentHistory.length - 1]?.content || "Task completed.";
    } finally {
      SubAgentManager.activeCount--;
    }
  }
}
