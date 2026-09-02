import fs from 'node:fs/promises';
import path from 'node:path';
import {
  clusterHome,
  type MemoryEntry,
  type MemoryCategory,
  type MemoryScope,
  type MemoryStats,
  type MemoryRetrievalLog,
} from '@cluster/shared';
import {
  generateSemanticEmbedding,
  cosineSimilarity,
  getSqliteVecExtensionPath,
  DEFAULT_EMBEDDING_DIMENSIONS,
} from './vector.js';

export interface MemoryFilter {
  projectRoot?: string;
  sessionId?: string;
  category?: MemoryCategory | 'all';
  scope?: MemoryScope | 'all';
  pinned?: boolean;
  archived?: boolean;
  search?: string;
  limit?: number;
  offset?: number;
}

export interface VectorSearchResult extends MemoryEntry {
  similarity: number;
}

export class MemoryDatabase {
  private dbPath: string;
  private initialized = false;
  private useNativeSqlite = false;
  private nativeDb: any = null;
  private sqliteVecLoaded = false;

  // In-memory / transactional cache for fast reads and fallback
  private entries = new Map<string, MemoryEntry>();
  private embeddings = new Map<string, Float32Array>();
  private tags = new Map<string, Set<string>>();
  private retrievalLogs: MemoryRetrievalLog[] = [];

  constructor(customPath?: string) {
    this.dbPath = customPath || path.join(clusterHome(), 'cluster_memory.db');
  }

  async init(): Promise<void> {
    if (this.initialized) return;

    // Ensure parent directory exists
    await fs.mkdir(path.dirname(this.dbPath), { recursive: true });

    // 1. Try initializing native node:sqlite
    try {
      const sqliteModule = await import('node:sqlite').catch(() => null);
      if (sqliteModule && typeof sqliteModule.DatabaseSync === 'function') {
        this.nativeDb = new sqliteModule.DatabaseSync(this.dbPath, {
          allowExtension: true,
          enableForeignKeyConstraints: true,
        });
        this.useNativeSqlite = true;

        // Try loading sqlite-vec extension
        const vecPath = await getSqliteVecExtensionPath();
        if (vecPath) {
          try {
            this.nativeDb.loadExtension(vecPath);
            this.sqliteVecLoaded = true;
          } catch {
            // Extension loading disabled or incompatible platform
            this.sqliteVecLoaded = false;
          }
        }

        this.initNativeSchema();
      }
    } catch {
      this.useNativeSqlite = false;
    }

    // 2. Load existing data if file exists
    await this.loadPersistedData();
    this.initialized = true;
  }

  private initNativeSchema(): void {
    if (!this.nativeDb) return;

    this.nativeDb.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA synchronous = NORMAL;

      CREATE TABLE IF NOT EXISTS memories (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        summary TEXT NOT NULL,
        content TEXT NOT NULL,
        category TEXT NOT NULL,
        scope TEXT NOT NULL,
        project_root TEXT,
        session_id TEXT,
        source TEXT NOT NULL,
        importance REAL DEFAULT 0.5,
        confidence REAL DEFAULT 0.8,
        pinned INTEGER DEFAULT 0,
        archived INTEGER DEFAULT 0,
        hits INTEGER DEFAULT 0,
        relevance REAL DEFAULT 0.5,
        tags JSON,
        metadata JSON,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        last_accessed_at TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_mem_proj ON memories(project_root);
      CREATE INDEX IF NOT EXISTS idx_mem_cat ON memories(category);
      CREATE INDEX IF NOT EXISTS idx_mem_pinned ON memories(pinned);
      CREATE INDEX IF NOT EXISTS idx_mem_archived ON memories(archived);

      CREATE TABLE IF NOT EXISTS memory_retrieval_logs (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        task_goal TEXT,
        memory_id TEXT NOT NULL,
        similarity_score REAL,
        category TEXT,
        created_at TEXT NOT NULL
      );
    `);

    if (this.sqliteVecLoaded) {
      try {
        this.nativeDb.exec(`
          CREATE VIRTUAL TABLE IF NOT EXISTS vec_memories USING vec0(
            memory_id TEXT PRIMARY KEY,
            embedding float[${DEFAULT_EMBEDDING_DIMENSIONS}]
          );
        `);
      } catch {
        this.sqliteVecLoaded = false;
      }
    }
  }

  private async loadPersistedData(): Promise<void> {
    if (this.useNativeSqlite && this.nativeDb) {
      try {
        const rows = this.nativeDb.prepare('SELECT * FROM memories').all() as any[];
        for (const row of rows) {
          const entry: MemoryEntry = {
            id: row.id,
            title: row.title,
            summary: row.summary,
            key: row.id,
            value: row.content,
            category: row.category as MemoryCategory,
            scope: row.scope as MemoryScope,
            projectRoot: row.project_root ?? undefined,
            sessionId: row.session_id ?? undefined,
            source: row.source as any,
            importance: row.importance,
            confidence: row.confidence,
            pinned: Boolean(row.pinned),
            archived: Boolean(row.archived),
            hits: row.hits,
            relevance: row.relevance,
            tags: row.tags ? JSON.parse(row.tags) : [],
            metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
            lastAccessedAt: row.last_accessed_at ?? undefined,
          };
          this.entries.set(entry.id, entry);
          this.embeddings.set(entry.id, generateSemanticEmbedding(entry.title + ' ' + entry.value));
        }
        return;
      } catch {
        // Fall back to reading JSON dump
      }
    }

    // File-backed fallback for Electron / non-native runtimes
    const jsonPath = this.dbPath.endsWith('.db')
      ? this.dbPath.replace(/\.db$/, '.json')
      : this.dbPath + '.json';

    try {
      const raw = await fs.readFile(jsonPath, 'utf8');
      const parsed = JSON.parse(raw);
      if (parsed.entries && Array.isArray(parsed.entries)) {
        for (const e of parsed.entries) {
          this.entries.set(e.id, e);
          if (parsed.embeddings && parsed.embeddings[e.id]) {
            this.embeddings.set(e.id, new Float32Array(parsed.embeddings[e.id]));
          } else {
            this.embeddings.set(e.id, generateSemanticEmbedding(e.title + ' ' + e.value));
          }
        }
      }
      if (parsed.retrievalLogs && Array.isArray(parsed.retrievalLogs)) {
        this.retrievalLogs = parsed.retrievalLogs;
      }
    } catch {
      // Clean slate if file doesn't exist yet
    }
  }

  private async persist(): Promise<void> {
    const jsonPath = this.dbPath.endsWith('.db')
      ? this.dbPath.replace(/\.db$/, '.json')
      : this.dbPath + '.json';

    const dump = {
      version: 1,
      updatedAt: new Date().toISOString(),
      entries: Array.from(this.entries.values()),
      embeddings: Object.fromEntries(
        Array.from(this.embeddings.entries()).map(([k, v]) => [k, Array.from(v)]),
      ),
      retrievalLogs: this.retrievalLogs.slice(-200),
    };

    try {
      await fs.writeFile(jsonPath, JSON.stringify(dump, null, 2), 'utf8');
    } catch {
      // Ignore write errors if disk unwritable
    }
  }

  async insert(entry: MemoryEntry, customEmbedding?: Float32Array): Promise<MemoryEntry> {
    await this.init();

    const embedding = customEmbedding || generateSemanticEmbedding(entry.title + ' ' + entry.value);
    this.entries.set(entry.id, entry);
    this.embeddings.set(entry.id, embedding);

    if (this.useNativeSqlite && this.nativeDb) {
      try {
        const stmt = this.nativeDb.prepare(`
          INSERT OR REPLACE INTO memories (
            id, title, summary, content, category, scope, project_root, session_id,
            source, importance, confidence, pinned, archived, hits, relevance, tags, metadata,
            created_at, updated_at, last_accessed_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        stmt.run(
          entry.id,
          entry.title,
          entry.summary,
          entry.value,
          entry.category,
          entry.scope,
          entry.projectRoot ?? null,
          entry.sessionId ?? null,
          entry.source,
          entry.importance,
          entry.confidence,
          entry.pinned ? 1 : 0,
          entry.archived ? 1 : 0,
          entry.hits,
          entry.relevance,
          JSON.stringify(entry.tags ?? []),
          JSON.stringify(entry.metadata ?? {}),
          entry.createdAt,
          entry.updatedAt,
          entry.lastAccessedAt ?? null,
        );

        if (this.sqliteVecLoaded) {
          try {
            const vecStmt = this.nativeDb.prepare(
              'INSERT OR REPLACE INTO vec_memories (memory_id, embedding) VALUES (?, ?)',
            );
            vecStmt.run(entry.id, embedding);
          } catch {
            // Ignore vector table error
          }
        }
      } catch {
        // Fall back to in-memory + json persistence
      }
    }

    await this.persist();
    return entry;
  }

  async update(id: string, updates: Partial<MemoryEntry>): Promise<MemoryEntry | null> {
    await this.init();
    const existing = this.entries.get(id);
    if (!existing) return null;

    const updated: MemoryEntry = {
      ...existing,
      ...updates,
      id: existing.id,
      updatedAt: new Date().toISOString(),
    };

    let newEmbedding: Float32Array | undefined;
    if (updates.value || updates.title) {
      newEmbedding = generateSemanticEmbedding(updated.title + ' ' + updated.value);
    }

    return this.insert(updated, newEmbedding);
  }

  async delete(id: string): Promise<boolean> {
    await this.init();
    const existed = this.entries.delete(id);
    this.embeddings.delete(id);

    if (this.useNativeSqlite && this.nativeDb) {
      try {
        this.nativeDb.prepare('DELETE FROM memories WHERE id = ?').run(id);
        if (this.sqliteVecLoaded) {
          try {
            this.nativeDb.prepare('DELETE FROM vec_memories WHERE memory_id = ?').run(id);
          } catch {}
        }
      } catch {}
    }

    if (existed) await this.persist();
    return existed;
  }

  async get(id: string): Promise<MemoryEntry | null> {
    await this.init();
    return this.entries.get(id) ?? null;
  }

  async list(filter: MemoryFilter = {}): Promise<MemoryEntry[]> {
    await this.init();
    let result = Array.from(this.entries.values());

    if (filter.projectRoot) {
      const root = path.resolve(filter.projectRoot);
      result = result.filter(
        (e) => e.scope === 'global' || !e.projectRoot || path.resolve(e.projectRoot) === root,
      );
    }

    if (filter.sessionId) {
      result = result.filter((e) => !e.sessionId || e.sessionId === filter.sessionId);
    }

    if (filter.category && filter.category !== 'all') {
      result = result.filter((e) => e.category === filter.category);
    }

    if (filter.scope && filter.scope !== 'all') {
      result = result.filter((e) => e.scope === filter.scope);
    }

    if (filter.pinned !== undefined) {
      result = result.filter((e) => e.pinned === filter.pinned);
    }

    if (filter.archived !== undefined) {
      result = result.filter((e) => e.archived === filter.archived);
    } else {
      // By default hide archived unless explicitly asked
      result = result.filter((e) => !e.archived);
    }

    if (filter.search && filter.search.trim()) {
      const q = filter.search.toLowerCase();
      result = result.filter(
        (e) =>
          e.title.toLowerCase().includes(q) ||
          e.summary.toLowerCase().includes(q) ||
          e.value.toLowerCase().includes(q) ||
          (e.tags && e.tags.some((t) => t.toLowerCase().includes(q))),
      );
    }

    // Sort pinned first, then by updated date desc
    result.sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return b.updatedAt.localeCompare(a.updatedAt);
    });

    const offset = filter.offset ?? 0;
    const limit = filter.limit ?? 100;
    return result.slice(offset, offset + limit);
  }

  async searchVector(
    queryText: string,
    filter: MemoryFilter = {},
    limit = 10,
  ): Promise<VectorSearchResult[]> {
    await this.init();
    const queryVec = generateSemanticEmbedding(queryText);

    // Filter candidate entries
    const candidates = await this.list({ ...filter, limit: 1000 });
    const scored: VectorSearchResult[] = [];

    for (const entry of candidates) {
      const entryVec =
        this.embeddings.get(entry.id) ||
        generateSemanticEmbedding(entry.title + ' ' + entry.value);
      const similarity = cosineSimilarity(queryVec, entryVec);
      scored.push({
        ...entry,
        similarity: Math.round(similarity * 100) / 100,
      });
    }

    // Rank by combination of similarity, importance, and pin status
    scored.sort((a, b) => {
      const scoreA = a.similarity * 0.6 + a.importance * 0.2 + (a.pinned ? 0.2 : 0);
      const scoreB = b.similarity * 0.6 + b.importance * 0.2 + (b.pinned ? 0.2 : 0);
      return scoreB - scoreA;
    });

    return scored.slice(0, limit);
  }

  async pin(id: string, pinned: boolean): Promise<boolean> {
    const updated = await this.update(id, { pinned });
    return !!updated;
  }

  async archive(id: string, archived: boolean): Promise<boolean> {
    const updated = await this.update(id, { archived });
    return !!updated;
  }

  async clearProject(projectRoot: string): Promise<number> {
    await this.init();
    const root = path.resolve(projectRoot);
    let count = 0;
    for (const [id, entry] of this.entries.entries()) {
      if (entry.projectRoot && path.resolve(entry.projectRoot) === root) {
        this.entries.delete(id);
        this.embeddings.delete(id);
        count++;
      }
    }
    if (this.useNativeSqlite && this.nativeDb) {
      try {
        this.nativeDb.prepare('DELETE FROM memories WHERE project_root = ?').run(projectRoot);
      } catch {}
    }
    if (count > 0) await this.persist();
    return count;
  }

  async logRetrieval(log: MemoryRetrievalLog): Promise<void> {
    await this.init();
    this.retrievalLogs.push(log);
    if (this.retrievalLogs.length > 500) {
      this.retrievalLogs = this.retrievalLogs.slice(-300);
    }

    // Increment hit counter on the recalled memory
    const entry = this.entries.get(log.memoryId);
    if (entry) {
      entry.hits = (entry.hits || 0) + 1;
      entry.lastAccessedAt = new Date().toISOString();
    }

    if (this.useNativeSqlite && this.nativeDb) {
      try {
        this.nativeDb
          .prepare(
            `INSERT INTO memory_retrieval_logs (id, session_id, task_goal, memory_id, similarity_score, category, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
          )
          .run(
            log.id,
            log.sessionId,
            log.taskGoal,
            log.memoryId,
            log.similarityScore,
            log.category,
            log.createdAt,
          );
      } catch {}
    }

    await this.persist();
  }

  async getRetrievalLogs(sessionId: string, limit = 20): Promise<MemoryRetrievalLog[]> {
    await this.init();
    return this.retrievalLogs
      .filter((l) => l.sessionId === sessionId)
      .slice(-limit)
      .reverse();
  }

  async getStats(projectRoot?: string): Promise<MemoryStats> {
    await this.init();
    let entries = Array.from(this.entries.values());
    if (projectRoot) {
      const root = path.resolve(projectRoot);
      entries = entries.filter(
        (e) => e.scope === 'global' || !e.projectRoot || path.resolve(e.projectRoot) === root,
      );
    }

    const byCategory: Record<string, number> = {};
    const byScope: Record<string, number> = {};
    let pinned = 0;
    let archived = 0;

    for (const e of entries) {
      if (e.pinned) pinned++;
      if (e.archived) archived++;
      byCategory[e.category] = (byCategory[e.category] || 0) + 1;
      byScope[e.scope] = (byScope[e.scope] || 0) + 1;
    }

    return {
      total: entries.length,
      pinned,
      archived,
      byCategory,
      byScope,
    };
  }
}
