/**
 * Structured event log for Phase 2.
 *
 * Separate from the minimal emitter; this is a durable, queryable log
 * that separates UI, orchestration, tool runtime, and persistence.
 */
export function createEventLog(maxSize = 5000) {
    return { events: [], maxSize };
}
export function appendEvent(log, event) {
    log.events.push(event);
    if (log.events.length > log.maxSize) {
        log.events.splice(0, log.events.length - log.maxSize);
    }
}
export function queryEvents(log, filter) {
    return log.events.filter((e) => {
        if (filter.kind && e.kind !== filter.kind)
            return false;
        if (filter.sessionId && e.sessionId !== filter.sessionId)
            return false;
        if (filter.taskId && e.taskId !== filter.taskId)
            return false;
        return true;
    });
}
//# sourceMappingURL=events2.js.map