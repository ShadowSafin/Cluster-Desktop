/**
 * Explicit state machines for agent/task lifecycle.
 *
 * Event-driven updates: the UI consumes state updates rather than owning logic.
 * Persistence is durable and the state model is serialisable.
 */

export type TaskLifecycleState =
  | 'created'
  | 'queued'
  | 'assigned'
  | 'running'
  | 'awaiting_review'
  | 'verifying'
  | 'completed'
  | 'failed'
  | 'retrying'
  | 'paused'
  | 'cancelled';

export type AgentLifecycleState =
  | 'idle'
  | 'planning'
  | 'dispatching'
  | 'executing'
  | 'reviewing'
  | 'verifying'
  | 'merging'
  | 'done'
  | 'error';

export type SessionLifecycleState =
  | 'initialized'
  | 'planning'
  | 'running'
  | 'awaiting_approval'
  | 'verifying'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'paused';

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

export function createStateMachine<S extends string>(initial: S, allowedTransitions: Record<string, string[]>): StateMachine<S> {
  const allowed = new Map<S, Set<S>>();
  for (const [from, tos] of Object.entries(allowedTransitions)) {
    allowed.set(from as S, new Set(tos as S[]));
  }

  const machine: StateMachine<S> = {
    current: initial,
    history: [],
    allowed,
    canTransition(to: S): boolean {
      const set = this.allowed.get(this.current);
      return set ? set.has(to) : false;
    },
    transition(to: S, event: string, meta?: Record<string, unknown>): S {
      if (!this.canTransition(to)) {
        throw new Error(`Invalid transition from ${this.current} to ${to} via ${event}`);
      }
      const from = this.current;
      this.history.push({ from, to, event, at: new Date().toISOString(), meta });
      this.current = to;
      return this.current;
    },
  };
  return machine;
}

/** Task lifecycle state machine definition. */
export const TASK_TRANSITIONS: Record<TaskLifecycleState, TaskLifecycleState[]> = {
  created: ['queued'],
  queued: ['assigned', 'cancelled'],
  assigned: ['running', 'cancelled'],
  running: ['awaiting_review', 'verifying', 'completed', 'failed', 'paused', 'cancelled'],
  awaiting_review: ['verifying', 'completed', 'failed', 'retrying'],
  verifying: ['completed', 'failed', 'retrying'],
  completed: [],
  failed: ['retrying', 'cancelled'],
  retrying: ['queued', 'running'],
  paused: ['queued', 'cancelled'],
  cancelled: [],
};

/** Agent lifecycle state machine definition. */
export const AGENT_TRANSITIONS: Record<AgentLifecycleState, AgentLifecycleState[]> = {
  idle: ['planning', 'dispatching'],
  planning: ['dispatching', 'error', 'done'],
  dispatching: ['executing', 'error'],
  executing: ['reviewing', 'verifying', 'merging', 'error', 'done'],
  reviewing: ['verifying', 'merging', 'error'],
  verifying: ['merging', 'error', 'done'],
  merging: ['done', 'error'],
  done: ['idle'],
  error: ['idle', 'planning'],
};

/** Session lifecycle. */
export const SESSION_TRANSITIONS: Record<SessionLifecycleState, SessionLifecycleState[]> = {
  initialized: ['planning', 'running', 'cancelled'],
  planning: ['running', 'failed', 'cancelled'],
  running: ['awaiting_approval', 'verifying', 'completed', 'failed', 'paused', 'cancelled'],
  awaiting_approval: ['running', 'verifying', 'cancelled'],
  verifying: ['completed', 'failed', 'running'],
  completed: ['running', 'paused'],
  failed: ['running', 'cancelled'],
  cancelled: ['running', 'planning'],
  paused: ['running', 'cancelled'],
};
