import {
  createStateMachine,
  TASK_TRANSITIONS,
  AGENT_TRANSITIONS,
  SESSION_TRANSITIONS,
  type TaskLifecycleState,
  type AgentLifecycleState,
  type SessionLifecycleState,
} from '@cluster/shared';

/**
 * Explicit state machines for agent/task lifecycle.
 *
 * Separated from shared to allow agent-core to own transitions and
 * emit events the UI can render.
 */

export function createTaskStateMachine(initial: TaskLifecycleState = 'created') {
  return createStateMachine<TaskLifecycleState>(initial, TASK_TRANSITIONS);
}

export function createAgentStateMachine(initial: AgentLifecycleState = 'idle') {
  return createStateMachine<AgentLifecycleState>(initial, AGENT_TRANSITIONS);
}

export function createSessionStateMachine(initial: SessionLifecycleState = 'initialized') {
  return createStateMachine<SessionLifecycleState>(initial, SESSION_TRANSITIONS);
}

export type TaskMachine = ReturnType<typeof createTaskStateMachine>;
export type AgentMachine = ReturnType<typeof createAgentStateMachine>;
export type SessionMachine = ReturnType<typeof createSessionStateMachine>;
