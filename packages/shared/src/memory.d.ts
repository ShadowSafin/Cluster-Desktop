/**
 * Persistent memory and project knowledge types.
 *
 * Two layers:
 * - Session memory: short-lived, per conversation
 * - Project memory: long-lived, per workspace
 */
export type MemoryScope = 'session' | 'project';
export type MemoryCategory = 'fact' | 'convention' | 'command' | 'architecture' | 'pattern' | 'note' | 'important-file';
export interface MemoryEntry {
    id: string;
    scope: MemoryScope;
    category: MemoryCategory;
    key: string;
    value: string;
    source: 'auto' | 'user' | 'agent';
    projectRoot?: string;
    sessionId?: string;
    createdAt: string;
    updatedAt: string;
    /** Relevance score for retrieval. */
    relevance: number;
    /** How many times this memory was useful. */
    hits: number;
    /** Optional tags for grouping. */
    tags?: string[];
}
export interface ProjectMemory {
    projectRoot: string;
    entries: MemoryEntry[];
    /** Files that are frequently referenced or explicitly marked important. */
    importantFiles: Array<{
        path: string;
        reason: string;
        addedAt: string;
    }>;
    /** Known commands and conventions for this project. */
    conventions: Array<{
        pattern: string;
        description: string;
    }>;
    /** Architecture notes. */
    architectureNotes: string[];
    updatedAt: string;
}
export interface SessionMemory {
    sessionId: string;
    projectRoot: string;
    entries: MemoryEntry[];
    /** Task history for this session. */
    taskHistory: Array<{
        taskId: string;
        title: string;
        status: string;
        at: string;
    }>;
    createdAt: string;
    updatedAt: string;
}
export declare function createMemoryEntry(init: {
    id: string;
    scope: MemoryScope;
    category: MemoryCategory;
    key: string;
    value: string;
    source?: MemoryEntry['source'];
    projectRoot?: string;
    sessionId?: string;
    tags?: string[];
}): MemoryEntry;
//# sourceMappingURL=memory.d.ts.map