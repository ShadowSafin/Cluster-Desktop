export type AgentPhase = 'idle'|'planning'|'thinking'|'reading'|'editing'|'running'|'verifying'|'summarizing'|'waiting'|'done'|'error'|'cancelled';
export interface AgentState { phase: AgentPhase; label: string; iteration: number; maxIterations: number; }
export interface SessionSummary { id: string; title: string; projectRoot: string; model: string; createdAt: string; updatedAt: string; messageCount: number; toolCallCount: number; editCount: number; phase: string; }
export interface TimelineEntry { kind: 'message' | 'tool'; id: string; at: string; message?: any; call?: any; }
export interface TaskItem { id: string; title: string; status: 'pending'|'ready'|'running'|'done'|'failed'|'blocked'|'cancelled'|'paused'|'skipped'; priority?: string; agentRole?: string; dependsOn?: string[]; }
export interface TaskGraph { id: string; goal: string; status: string; tasks: Record<string, TaskItem>; rootIds?: string[]; createdAt?: string; updatedAt?: string; }
export interface Edit { id: string; path: string; diff: string; additions: number; deletions: number; createdAt: string; }
export interface BackgroundJob { id: string; command: string; cwd: string; status: 'running'|'done'|'failed'; pid?: number; exitCode?: number | null; output: string; startedAt: string; }
export interface VerificationResult { kind: string; command: string; passed: boolean; durationMs: number; summary: string; failures?: string[]; }
