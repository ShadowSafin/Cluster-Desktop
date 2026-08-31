import fs from 'node:fs/promises';
import path from 'node:path';
import { createId, nowIso, clusterHome, createMemoryEntry, } from '@cluster/shared';
/**
 * Persistent memory and project knowledge.
 *
 * Two layers:
 * - Session memory: short-lived per conversation, richer state for resume
 * - Project memory: long-lived, preserved across sessions, inspectable/editable
 *
 * Storage: JSON files under ~/.cluster/memory/<projectHash> and sessions.
 * Keeps memory bounded and useful, not noisy.
 */
function projectHash(root) {
    // Simple stable hash: replace separators, keep alphanum
    return root.replace(/[^a-zA-Z0-9]/g, '_').slice(-60) || 'default';
}
function memoryDir(root) {
    const base = path.join(clusterHome(), 'memory');
    if (!root)
        return base;
    return path.join(base, projectHash(path.resolve(root)));
}
async function ensureDir(dir) {
    await fs.mkdir(dir, { recursive: true });
}
async function readJson(file, fallback) {
    try {
        const raw = await fs.readFile(file, 'utf8');
        return JSON.parse(raw);
    }
    catch {
        return fallback;
    }
}
async function writeJson(file, data) {
    await ensureDir(path.dirname(file));
    await fs.writeFile(file, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}
export class MemoryStore {
    projectRoot;
    sessionId;
    projectMemory = null;
    sessionMemory = null;
    initialized = false;
    constructor(options = {}) {
        this.projectRoot = options.projectRoot ? path.resolve(options.projectRoot) : null;
        this.sessionId = options.sessionId ?? null;
    }
    /** Load or create memory stores. */
    async init() {
        if (this.initialized)
            return;
        if (this.projectRoot) {
            const file = path.join(memoryDir(this.projectRoot), 'project.json');
            const data = await readJson(file, null);
            if (data) {
                this.projectMemory = data;
            }
            else {
                this.projectMemory = {
                    projectRoot: this.projectRoot,
                    entries: [],
                    importantFiles: [],
                    conventions: [],
                    architectureNotes: [],
                    updatedAt: nowIso(),
                };
            }
        }
        if (this.sessionId && this.projectRoot) {
            const file = path.join(memoryDir(this.projectRoot), `session-${this.sessionId}.json`);
            const data = await readJson(file, null);
            if (data) {
                this.sessionMemory = data;
            }
            else {
                this.sessionMemory = {
                    sessionId: this.sessionId,
                    projectRoot: this.projectRoot,
                    entries: [],
                    taskHistory: [],
                    createdAt: nowIso(),
                    updatedAt: nowIso(),
                };
            }
        }
        this.initialized = true;
    }
    /** Ensure init completed, else auto-init. */
    async ensureInit() {
        if (!this.initialized)
            await this.init();
    }
    /** Add a memory entry. Caps total entries to avoid noise. */
    async add(entry) {
        await this.ensureInit();
        const full = createMemoryEntry({
            id: createId('mem'),
            scope: entry.scope,
            category: entry.category,
            key: entry.key,
            value: entry.value.slice(0, 4000),
            source: entry.source ?? 'auto',
            projectRoot: entry.projectRoot ?? this.projectRoot ?? undefined,
            sessionId: entry.sessionId ?? this.sessionId ?? undefined,
            tags: entry.tags,
        });
        if (entry.relevance !== undefined)
            full.relevance = entry.relevance;
        const target = entry.scope === 'project' ? this.projectMemory : this.sessionMemory;
        if (!target)
            throw new Error(`Memory scope ${entry.scope} not initialized`);
        // Deduplicate by key: update existing rather than duplicate
        const existingIdx = target.entries.findIndex((e) => e.key === full.key && e.category === full.category);
        if (existingIdx >= 0) {
            const existing = target.entries[existingIdx];
            existing.value = full.value;
            existing.updatedAt = nowIso();
            existing.relevance = Math.max(existing.relevance, full.relevance);
            await this.persist();
            return existing;
        }
        // Bound memory: max 100 project entries, 40 session entries
        const max = entry.scope === 'project' ? 100 : 40;
        if (target.entries.length >= max) {
            // Evict lowest relevance
            target.entries.sort((a, b) => a.relevance - b.relevance);
            target.entries.shift();
        }
        target.entries.push(full);
        target.updatedAt = nowIso();
        await this.persist();
        return full;
    }
    /** Retrieve entries filtered and ranked. */
    async recall(filter = {}) {
        await this.ensureInit();
        const scopes = [];
        if (!filter.scope || filter.scope === 'project') {
            if (this.projectMemory)
                scopes.push(...this.projectMemory.entries);
        }
        if (!filter.scope || filter.scope === 'session') {
            if (this.sessionMemory)
                scopes.push(...this.sessionMemory.entries);
        }
        let results = scopes.filter((entry) => {
            if (filter.category && entry.category !== filter.category)
                return false;
            if (filter.tags && filter.tags.length > 0) {
                if (!entry.tags || !filter.tags.some((t) => entry.tags.includes(t)))
                    return false;
            }
            return true;
        });
        if (filter.query) {
            const q = filter.query.toLowerCase();
            results = results
                .map((entry) => ({
                entry,
                score: (entry.key.toLowerCase().includes(q) ? 10 : 0) + (entry.value.toLowerCase().includes(q) ? 5 : 0) + entry.relevance * 3 + entry.hits * 0.5,
            }))
                .sort((a, b) => b.score - a.score)
                .map((scored) => scored.entry);
            // bump hits for recalled
            for (const e of results.slice(0, 5))
                e.hits += 1;
            if (results.slice(0, 5).some((e) => e.hits % 3 === 0))
                await this.persist();
        }
        else {
            results.sort((a, b) => b.relevance - a.relevance || b.hits - a.hits || b.updatedAt.localeCompare(a.updatedAt));
        }
        return results.slice(0, filter.limit ?? 20);
    }
    async update(id, patch) {
        await this.ensureInit();
        const all = [this.projectMemory, this.sessionMemory].filter(Boolean);
        for (const store of all) {
            const entry = store.entries.find((e) => e.id === id);
            if (entry) {
                if (patch.value !== undefined)
                    entry.value = patch.value.slice(0, 4000);
                if (patch.relevance !== undefined)
                    entry.relevance = patch.relevance;
                if (patch.tags !== undefined)
                    entry.tags = patch.tags;
                entry.updatedAt = nowIso();
                store.updatedAt = nowIso();
                await this.persist();
                return entry;
            }
        }
        return null;
    }
    async remove(id) {
        await this.ensureInit();
        for (const store of [this.projectMemory, this.sessionMemory]) {
            if (!store)
                continue;
            const idx = store.entries.findIndex((e) => e.id === id);
            if (idx >= 0) {
                store.entries.splice(idx, 1);
                store.updatedAt = nowIso();
                await this.persist();
                return true;
            }
        }
        return false;
    }
    /** Important files list */
    async addImportantFile(filePath, reason) {
        await this.ensureInit();
        if (!this.projectMemory)
            return;
        const existing = this.projectMemory.importantFiles.find((f) => f.path === filePath);
        if (existing) {
            existing.reason = reason;
        }
        else {
            this.projectMemory.importantFiles.push({ path: filePath, reason, addedAt: nowIso() });
            if (this.projectMemory.importantFiles.length > 30)
                this.projectMemory.importantFiles.shift();
        }
        this.projectMemory.updatedAt = nowIso();
        await this.persist();
    }
    async getImportantFiles() {
        await this.ensureInit();
        return this.projectMemory?.importantFiles ?? [];
    }
    async addConvention(pattern, description) {
        await this.ensureInit();
        if (!this.projectMemory)
            return;
        this.projectMemory.conventions.push({ pattern, description });
        if (this.projectMemory.conventions.length > 50)
            this.projectMemory.conventions.shift();
        this.projectMemory.updatedAt = nowIso();
        await this.persist();
    }
    async addArchitectureNote(note) {
        await this.ensureInit();
        if (!this.projectMemory)
            return;
        this.projectMemory.architectureNotes.push(note.slice(0, 2000));
        if (this.projectMemory.architectureNotes.length > 30)
            this.projectMemory.architectureNotes.shift();
        this.projectMemory.updatedAt = nowIso();
        await this.persist();
    }
    async appendTaskHistory(taskId, title, status) {
        await this.ensureInit();
        if (!this.sessionMemory)
            return;
        this.sessionMemory.taskHistory.push({ taskId, title, status, at: nowIso() });
        this.sessionMemory.updatedAt = nowIso();
        await this.persist();
    }
    async getSessionMemory() {
        await this.ensureInit();
        return this.sessionMemory;
    }
    async getProjectMemory() {
        await this.ensureInit();
        return this.projectMemory;
    }
    /** Inspectable summary. */
    async summarize() {
        await this.ensureInit();
        const parts = [];
        if (this.projectMemory) {
            parts.push(`Project memory (${this.projectMemory.entries.length} entries):`);
            for (const e of this.projectMemory.entries.slice(0, 6))
                parts.push(`  [${e.category}] ${e.key}: ${e.value.slice(0, 80)}`);
            if (this.projectMemory.importantFiles.length > 0)
                parts.push(`Important files: ${this.projectMemory.importantFiles.map((f) => f.path).join(', ')}`);
            if (this.projectMemory.architectureNotes.length > 0)
                parts.push(`Architecture: ${this.projectMemory.architectureNotes.slice(-2).join(' | ')}`);
        }
        if (this.sessionMemory) {
            parts.push(`Session memory (${this.sessionMemory.entries.length} entries, ${this.sessionMemory.taskHistory.length} tasks):`);
            for (const e of this.sessionMemory.entries.slice(0, 4))
                parts.push(`  [${e.category}] ${e.key}: ${e.value.slice(0, 80)}`);
        }
        return parts.join('\n') || '(no memory yet)';
    }
    async clear(scope) {
        await this.ensureInit();
        if (scope === 'project' && this.projectMemory) {
            this.projectMemory.entries = [];
            this.projectMemory.importantFiles = [];
            this.projectMemory.conventions = [];
            this.projectMemory.architectureNotes = [];
            this.projectMemory.updatedAt = nowIso();
        }
        if (scope === 'session' && this.sessionMemory) {
            this.sessionMemory.entries = [];
            this.sessionMemory.taskHistory = [];
            this.sessionMemory.updatedAt = nowIso();
        }
        await this.persist();
    }
    /** Persist both stores. */
    async persist() {
        if (this.projectMemory && this.projectRoot) {
            const file = path.join(memoryDir(this.projectRoot), 'project.json');
            await writeJson(file, this.projectMemory);
        }
        if (this.sessionMemory && this.sessionId && this.projectRoot) {
            const file = path.join(memoryDir(this.projectRoot), `session-${this.sessionId}.json`);
            await writeJson(file, this.sessionMemory);
        }
    }
    /** Resume: load existing memory for a session. */
    static async resume(projectRoot, sessionId) {
        const store = new MemoryStore({ projectRoot, sessionId });
        await store.init();
        return store;
    }
    static async forProject(projectRoot) {
        const store = new MemoryStore({ projectRoot });
        await store.init();
        return store;
    }
}
//# sourceMappingURL=store.js.map