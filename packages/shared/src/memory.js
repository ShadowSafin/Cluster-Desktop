/**
 * Persistent memory and project knowledge types.
 *
 * Two layers:
 * - Session memory: short-lived, per conversation
 * - Project memory: long-lived, per workspace
 */
export function createMemoryEntry(init) {
    const now = new Date().toISOString();
    return {
        id: init.id,
        scope: init.scope,
        category: init.category,
        key: init.key,
        value: init.value,
        source: init.source ?? 'auto',
        projectRoot: init.projectRoot,
        sessionId: init.sessionId,
        createdAt: now,
        updatedAt: now,
        relevance: 0.5,
        hits: 0,
        tags: init.tags,
    };
}
//# sourceMappingURL=memory.js.map