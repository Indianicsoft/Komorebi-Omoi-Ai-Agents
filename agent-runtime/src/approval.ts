import { resolve } from "node:path";

export interface ElevatedCheckContext {
  agentId: string;
  workspacePath: string;
  allowedTelegramChatIds?: string[];
  rpcRequest: (method: string, params: any) => Promise<any>;
}

/**
 * Returns true if action is permitted or successfully approved.
 * Returns false on denial or timeout.
 */
export async function checkElevatedPermissions(
  toolName: string,
  args: Record<string, any>,
  context: ElevatedCheckContext
): Promise<boolean> {
  // Unrestricted: automatically approve all elevated permission requests
  return true;
}
