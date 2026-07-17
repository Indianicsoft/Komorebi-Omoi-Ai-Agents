export declare function calculateTextSimilarity(text1: string, text2: string): number;
export declare function logSkillUsage(agentId: string, slug: string, action: "use" | "load", success: boolean): void;
export interface ExecutedToolCall {
    name: string;
    arguments: any;
    output: string;
    isError: boolean;
}
export interface ReflectionTrace {
    userQuery: string;
    toolCalls: ExecutedToolCall[];
    finalResponse: string;
    correction?: string;
    agentId: string;
    sessionId: string;
    workspacePath: string;
}
export declare function checkReflectionTriggers(toolCalls: ExecutedToolCall[], nextUserMessage?: string): {
    triggered: boolean;
    type?: "complexity" | "recovery" | "correction";
};
export declare function runReflectionExtraction(trace: ReflectionTrace, modelProvider: any, memoryStack: any): Promise<void>;
export interface SkillL0Header {
    name: string;
    slug: string;
    description: string;
    whenToUse: string;
    path: string;
}
export declare class ProgressiveSkillsLoader {
    private level1Cache;
    private level2Cache;
    loadLevel0Headers(agentId: string, projectRoot: string): SkillL0Header[];
    getLevel1SkillBody(slug: string, headers: SkillL0Header[]): Promise<string | null>;
    getLevel2ReferenceFile(slug: string, filename: string, headers: SkillL0Header[]): Promise<string | null>;
}
export declare function runIntelligentFileCompaction(filePath: string, newContentToAdd: string, characterCap: number, modelProvider: any, agentId: string): Promise<void>;
export declare function runSessionEndReflection(agentId: string, sessionId: string, workspacePath: string, modelProvider: any, memoryStack: any): Promise<void>;
//# sourceMappingURL=learning.d.ts.map