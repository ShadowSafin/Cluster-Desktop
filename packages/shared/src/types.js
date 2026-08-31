/**
 * Domain model for cluster.
 *
 * These types are the contract between the TUI, the agent core, the tool
 * runtime and the session store. They are intentionally plain serialisable
 * data structures so a session can be written to disk verbatim.
 */
/* -------------------------------------------------------------------------- */
/* Session                                                                     */
/* -------------------------------------------------------------------------- */
export const SESSION_SCHEMA_VERSION = 1;
export function createEmptySession(init) {
    const now = new Date().toISOString();
    return {
        id: init.id,
        schemaVersion: SESSION_SCHEMA_VERSION,
        title: init.title ?? 'New session',
        projectRoot: init.projectRoot,
        model: init.model,
        createdAt: now,
        updatedAt: now,
        messages: [],
        toolCalls: [],
        edits: [],
        commandRuns: [],
        errors: [],
        plan: null,
        state: {
            phase: 'idle',
            label: 'Ready',
            iteration: 0,
            maxIterations: 0,
            startedAt: null,
            finishedAt: null,
            usage: { prompt: 0, completion: 0, total: 0 },
            model: init.model,
        },
        workspace: null,
    };
}
//# sourceMappingURL=types.js.map