/**
 * Explicit state machines for agent/task lifecycle.
 *
 * Event-driven updates: the UI consumes state updates rather than owning logic.
 * Persistence is durable and the state model is serialisable.
 */
export function createStateMachine(initial, allowedTransitions) {
    const allowed = new Map();
    for (const [from, tos] of Object.entries(allowedTransitions)) {
        allowed.set(from, new Set(tos));
    }
    const machine = {
        current: initial,
        history: [],
        allowed,
        canTransition(to) {
            const set = this.allowed.get(this.current);
            return set ? set.has(to) : false;
        },
        transition(to, event, meta) {
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
export const TASK_TRANSITIONS = {
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
export const AGENT_TRANSITIONS = {
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
export const SESSION_TRANSITIONS = {
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
//# sourceMappingURL=stateMachine.js.map