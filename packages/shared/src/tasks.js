/**
 * Task graph types for Phase 2 orchestration.
 *
 * Task graphs are DAGs: tasks with dependencies, parallel execution,
 * retry, cancellation, pause/resume, and lifecycle status.
 */
export function createTask(init) {
    const now = new Date().toISOString();
    return {
        id: init.id,
        parentId: init.parentId ?? null,
        title: init.title,
        description: init.description,
        status: init.dependsOn && init.dependsOn.length > 0 ? 'blocked' : 'pending',
        priority: init.priority ?? 'normal',
        agentRole: init.agentRole ?? null,
        dependsOn: init.dependsOn ?? [],
        dependents: [],
        retry: {
            maxAttempts: init.maxAttempts ?? 2,
            attempts: 0,
            backoffMs: 1000,
        },
        createdAt: now,
        updatedAt: now,
        startedAt: null,
        finishedAt: null,
        error: null,
        subtasks: [],
        toolCallIds: [],
        result: null,
        complexity: init.complexity ?? 2,
        files: [],
    };
}
export function createTaskGraph(init) {
    const now = new Date().toISOString();
    return {
        id: init.id,
        goal: init.goal,
        createdAt: now,
        updatedAt: now,
        tasks: {},
        rootIds: [],
        status: 'pending',
    };
}
//# sourceMappingURL=tasks.js.map