/**
 * Explicit state machines for agent/task lifecycle.
 *
 * Event-driven updates: the UI consumes state updates rather than owning logic.
 * Persistence is durable and the state model is serialisable.
 */
export type TaskLifecycleState = 'created' | 'queued' | 'assigned' | 'running' | 'awaiting_review' | 'verifying' | 'completed' | 'failed' | 'retrying' | 'paused' | 'cancelled';
export type AgentLifecycleState = 'idle' | 'planning' | 'dispatching' | 'executing' | 'reviewing' | 'verifying' | 'merging' | 'done' | 'error';
export type SessionLifecycleState = 'initialized' | 'planning' | 'running' | 'awaiting_approval' | 'verifying' | 'completed' | 'failed' | 'cancelled' | 'paused';
export interface StateTransition<S extends string> {
    from: S;
    to: S;
    event: string;
    at: string;
    meta?: Record<string, unknown>;
}
export interface StateMachine<S extends string> {
    current: S;
    history: Array<StateTransition<S>>;
    allowed: Map<S, Set<S>>;
    canTransition(to: S): boolean;
    transition(to: S, event: string, meta?: Record<string, unknown>): S;
}
export declare function createStateMachine<S extends string>(initial: S, allowedTransitions: Record<string, string[]>): StateMachine<S>;
/** Task lifecycle state machine definition. */
export declare const TASK_TRANSITIONS: Record<TaskLifecycleState, TaskLifecycleState[]>;
/** Agent lifecycle state machine definition. */
export declare const AGENT_TRANSITIONS: Record<AgentLifecycleState, AgentLifecycleState[]>;
/** Session lifecycle. */
export declare const SESSION_TRANSITIONS: Record<SessionLifecycleState, SessionLifecycleState[]>;
//# sourceMappingURL=stateMachine.d.ts.map