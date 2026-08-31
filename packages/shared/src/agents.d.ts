/**
 * Multi-agent definitions for Phase 2.
 *
 * Each agent has distinct responsibilities and tool access boundaries.
 */
import type { AgentRole } from './tasks.js';
export interface AgentDefinition {
    role: AgentRole;
    name: string;
    description: string;
    /** Tools this agent is allowed to use. Empty means all. */
    allowedTools: string[];
    /** Tools this agent is explicitly denied. */
    deniedTools?: string[];
    /** System prompt fragment for this agent. */
    systemPrompt: string;
    /** Whether this agent can run in parallel with others. */
    parallelizable: boolean;
    /** Maximum concurrent instances of this agent. */
    maxConcurrency: number;
    modelOverride?: string;
}
export interface AgentActivity {
    agentRole: AgentRole;
    agentId: string;
    taskId?: string;
    phase: 'idle' | 'thinking' | 'acting' | 'waiting' | 'done' | 'error';
    message: string;
    timestamp: string;
    toolCallId?: string;
}
export interface AgentResult {
    agentRole: AgentRole;
    taskId: string;
    success: boolean;
    summary: string;
    artifacts?: Array<{
        type: string;
        path?: string;
        content?: string;
    }>;
    error?: string;
    durationMs: number;
}
export declare const AGENT_DEFINITIONS: Record<AgentRole, AgentDefinition>;
export declare function allowedToolsForRole(role: AgentRole): string[];
export declare function canUseTool(role: AgentRole, toolName: string): boolean;
export declare function isParallelizable(role: AgentRole): boolean;
//# sourceMappingURL=agents.d.ts.map