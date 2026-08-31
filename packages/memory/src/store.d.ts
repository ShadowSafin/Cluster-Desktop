import { type MemoryEntry, type MemoryCategory, type MemoryScope, type ProjectMemory, type SessionMemory } from '@cluster/shared';
export interface MemoryStoreOptions {
    projectRoot?: string;
    sessionId?: string;
}
export declare class MemoryStore {
    private projectRoot;
    private sessionId;
    private projectMemory;
    private sessionMemory;
    private initialized;
    constructor(options?: MemoryStoreOptions);
    /** Load or create memory stores. */
    init(): Promise<void>;
    /** Ensure init completed, else auto-init. */
    private ensureInit;
    /** Add a memory entry. Caps total entries to avoid noise. */
    add(entry: Omit<MemoryEntry, 'id' | 'createdAt' | 'updatedAt' | 'hits' | 'relevance'> & Partial<Pick<MemoryEntry, 'relevance'>>): Promise<MemoryEntry>;
    /** Retrieve entries filtered and ranked. */
    recall(filter?: {
        scope?: MemoryScope;
        category?: MemoryCategory;
        query?: string;
        limit?: number;
        tags?: string[];
    }): Promise<MemoryEntry[]>;
    update(id: string, patch: Partial<Pick<MemoryEntry, 'value' | 'relevance' | 'tags'>>): Promise<MemoryEntry | null>;
    remove(id: string): Promise<boolean>;
    /** Important files list */
    addImportantFile(filePath: string, reason: string): Promise<void>;
    getImportantFiles(): Promise<Array<{
        path: string;
        reason: string;
        addedAt: string;
    }>>;
    addConvention(pattern: string, description: string): Promise<void>;
    addArchitectureNote(note: string): Promise<void>;
    appendTaskHistory(taskId: string, title: string, status: string): Promise<void>;
    getSessionMemory(): Promise<SessionMemory | null>;
    getProjectMemory(): Promise<ProjectMemory | null>;
    /** Inspectable summary. */
    summarize(): Promise<string>;
    clear(scope: MemoryScope): Promise<void>;
    /** Persist both stores. */
    persist(): Promise<void>;
    /** Resume: load existing memory for a session. */
    static resume(projectRoot: string, sessionId: string): Promise<MemoryStore>;
    static forProject(projectRoot: string): Promise<MemoryStore>;
}
//# sourceMappingURL=store.d.ts.map