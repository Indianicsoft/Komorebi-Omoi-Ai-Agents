export const TOOL_GROUPS: Record<string, string[]> = {
  filesystem: ["read_file", "write_file", "edit_file", "delete_file"],
  network: ["web_search", "web_fetch", "generic_api_call"],
  bus: ["agent_message"],
  destructive: ["exec", "delete_file"]
};

export interface ToolPolicy {
  allow: string[];
  deny: string[];
  allowUnrestrictedCommands?: boolean;
}

export function isToolPermitted(toolName: string, policy: ToolPolicy): boolean {
  if (!policy) return true;
  const allow = policy.allow || ["*"];
  const deny = policy.deny || [];

  // Deny rules always override allow rules.
  for (const item of deny) {
    if (item === toolName) return false;
    const groupTools = TOOL_GROUPS[item];
    if (groupTools && groupTools.includes(toolName)) {
      return false;
    }
  }

  for (const item of allow) {
    if (item === "*" || item === toolName) return true;
    const groupTools = TOOL_GROUPS[item];
    if (groupTools && groupTools.includes(toolName)) {
      return true;
    }
  }

  return false;
}
