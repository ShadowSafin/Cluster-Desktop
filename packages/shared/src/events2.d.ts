/**
 * Structured event log for Phase 2.
 *
 * Separate from the minimal emitter; this is a durable, queryable log
 * that separates UI, orchestration, tool runtime, and persistence.
 */
export type SystemEventKind = 'session:created' | 'session:resumed' | 'task:created' | 'task:started' | 'task:completed' | 'task:failed' | 'task:cancelled' | 'agent:assigned' | 'agent:started' | 'agent:completed' | 'agent:error' | 'tool:start' | 'tool:end' | 'tool:output' | 'context:ranked' | 'context:chunked' | 'diff:created' | 'diff:reviewed' | 'diff:applied' | 'diff:reverted' | 'verification:started' | 'verification:completed' | 'verification:failed' | 'memory:added' | 'memory:recalled' | 'checkpoint:created' | 'checkpoint:restored' | 'error';
export interface SystemEvent {
    id: string;
    kind: SystemEventKind;
    timestamp: string;
    sessionId: string;
    taskId?: string;
    agentRole?: string;
    payload?: unknown;
    error?: string;
}
export interface EventLog {
    events: SystemEvent[];
    maxSize: number;
}
export declare function createEventLog(maxSize?: number): EventLog;
export declare function appendEvent(log: EventLog, event: SystemEvent): void;
export declare function queryEvents(log: EventLog, filter: Partial<{
    kind: SystemEventKind;
    sessionId: string;
    taskId: string;
}>): SystemEvent[];
//# sourceMappingURL=events2.d.ts.map