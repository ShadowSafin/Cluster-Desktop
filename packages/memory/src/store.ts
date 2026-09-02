import path from 'node:path';
import {
  createId,
  nowIso,
  type MemoryEntry,
  type MemoryCategory,
  type MemoryScope,
  createMemoryEntry,
  type ProjectMemory,
  type SessionMemory,
  type MemoryStats,
  type MemoryRetrievalLog,
  type ContextualRetrievalOptions,
} from '@cluster/shared';
import { MemoryDatabase, type MemoryFilter, type VectorSearchResult } from './database.js';
import { MemoryExtractor, type TaskOutcomeContext } from './extraction.js';
import { MemoryRetriever } from './retrieval.js';

let defaultDatabase: MemoryDatabase | null = null;

export function getDefaultMemoryDatabase(): MemoryDatabase {
  if (!defaultDatabase) {
    defaultDatabase = new MemoryDatabase();
  }
  return defaultDatabase;
}

export interface MemoryStoreOptions {
  projectRoot?: string;
  sessionId?: string;
  database?: MemoryDatabase;
}

export interface MemoryAddInput {
  id?: string;
  key: string;
  value: string;
  category?: MemoryCategory;
  scope?: MemoryScope;
  title?: string;
  summary?: string;
  source?: MemoryEntry['source'];
  projectRoot?: string;
  sessionId?: string;
  importance?: number;
  confidence?: number;
  pinned?: boolean;
  archived?: boolean;
  relevance?: number;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

export class MemoryStore {
  private projectRoot: string | null;
  private sessionId: string | null;
  private db: MemoryDatabase;
  private extractor: MemoryExtractor;
  private retriever: MemoryRetriever;
  private initialized = false;

  constructor(options: MemoryStoreOptions = {}) {
    this.projectRoot = options.projectRoot ? path.resolve(options.projectRoot) : null;
    this.sessionId = options.sessionId ?? null;
    this.db = options.database || getDefaultMemoryDatabase();
    this.extractor = new MemoryExtractor(this.db);
    this.retriever = new MemoryRetriever(this.db);
  }

  get database(): MemoryDatabase {
    return this.db;
  }

  /** Initialize the SQLite and vector memory database. */
  async init(): Promise<void> {
    if (this.initialized) return;
    await this.db.init();
    this.initialized = true;
  }

  private async ensureInit(): Promise<void> {
    if (!this.initialized) await this.init();
  }

  /** Add or update a structured memory entry. */
  async add(entry: MemoryAddInput): Promise<MemoryEntry> {
    await this.ensureInit();
    const id = entry.id || createId('mem');
    const now = new Date().toISOString();
    const title = entry.title || entry.key.replace(/^[^:]+:/, '').replace(/[-_]/g, ' ');
    const summary = entry.summary || (entry.value.length > 140 ? entry.value.slice(0, 137) + '...' : entry.value);

    const full: MemoryEntry = {
      id,
      title: title.charAt(0).toUpperCase() + title.slice(1),
      summary,
      scope: entry.scope ?? 'project',
      category: entry.category ?? 'note',
      key: entry.key,
      value: entry.value,
      source: entry.source ?? 'auto',
      projectRoot: entry.projectRoot ?? this.projectRoot ?? undefined,
      sessionId: entry.sessionId ?? this.sessionId ?? undefined,
      importance: entry.importance ?? 0.5,
      confidence: entry.confidence ?? 0.8,
      pinned: entry.pinned ?? false,
      archived: entry.archived ?? false,
      hits: 0,
      relevance: entry.relevance ?? 0.5,
      tags: entry.tags ?? [],
      metadata: entry.metadata,
      createdAt: now,
      updatedAt: now,
    };

    return this.db.insert(full);
  }

  /** Recall memories matching filters. */
  async recall(options: {
    category?: MemoryCategory | 'all';
    scope?: MemoryScope | 'all';
    pinned?: boolean;
    archived?: boolean;
    search?: string;
    limit?: number;
  } = {}): Promise<MemoryEntry[]> {
    await this.ensureInit();
    return this.db.list({
      projectRoot: this.projectRoot ?? undefined,
      sessionId: this.sessionId ?? undefined,
      category: options.category,
      scope: options.scope,
      pinned: options.pinned,
      archived: options.archived,
      search: options.search,
      limit: options.limit ?? 50,
    });
  }

  /** Hybrid vector similarity search. */
  async search(queryText: string, limit = 10): Promise<VectorSearchResult[]> {
    await this.ensureInit();
    return this.retriever.retrieve({
      queryText,
      projectRoot: this.projectRoot ?? undefined,
      sessionId: this.sessionId ?? undefined,
      limit,
    });
  }

  /** Pin or unpin a memory. */
  async pin(id: string, pinned = true): Promise<boolean> {
    await this.ensureInit();
    return this.db.pin(id, pinned);
  }

  /** Archive or unarchive a memory. */
  async archive(id: string, archived = true): Promise<boolean> {
    await this.ensureInit();
    return this.db.archive(id, archived);
  }

  /** Delete a memory entry. */
  async delete(id: string): Promise<boolean> {
    await this.ensureInit();
    return this.db.delete(id);
  }

  /** Clear memories for current project. */
  async clearProject(): Promise<number> {
    if (!this.projectRoot) return 0;
    await this.ensureInit();
    return this.db.clearProject(this.projectRoot);
  }

  /** Extract memories automatically after a task finishes. */
  async extractTaskOutcome(ctx: Omit<TaskOutcomeContext, 'projectRoot' | 'sessionId'>): Promise<MemoryEntry[]> {
    await this.ensureInit();
    return this.extractor.extractFromTaskOutcome({
      ...ctx,
      projectRoot: this.projectRoot || process.cwd(),
      sessionId: this.sessionId || 'default',
    });
  }

  /** Automatically extract useful context from user prompt before execution. */
  async extractFromPrompt(prompt: string, opts?: { projectRoot?: string; sessionId?: string }): Promise<MemoryEntry[]> {
    await this.ensureInit();
    return this.extractor.extractFromPrompt(prompt, {
      projectRoot: opts?.projectRoot || this.projectRoot || process.cwd(),
      sessionId: opts?.sessionId || this.sessionId || undefined,
    });
  }

  /** Extract workflow insights, plans, touched files, and bug fixes on task completion. */
  async extractFromWorkflow(ctx: Omit<TaskOutcomeContext, 'projectRoot' | 'sessionId'> & { projectRoot?: string; sessionId?: string }): Promise<MemoryEntry[]> {
    await this.ensureInit();
    return this.extractor.extractFromTaskOutcome({
      ...ctx,
      projectRoot: ctx.projectRoot || this.projectRoot || process.cwd(),
      sessionId: ctx.sessionId || this.sessionId || 'default',
    });
  }

  /** Contextual retrieval matching project, active files, task category, and semantic query. */
  async retrieveContextual(options: ContextualRetrievalOptions): Promise<VectorSearchResult[]> {
    await this.ensureInit();
    return this.retriever.retrieve({
      ...options,
      projectRoot: options.projectRoot || this.projectRoot || undefined,
      sessionId: options.sessionId || this.sessionId || undefined,
    });
  }

  /** Extract user directives or preferences from message text. */
  async extractUserPreference(text: string): Promise<MemoryEntry | null> {
    await this.ensureInit();
    return this.extractor.extractFromUserInput(text, this.projectRoot || process.cwd(), this.sessionId || undefined);
  }

  /** Format relevant memories into prompt instructions. */
  async formatForPrompt(queryText?: string): Promise<string> {
    await this.ensureInit();
    if (queryText) {
      const recalled = await this.retriever.retrieve({
        queryText,
        projectRoot: this.projectRoot ?? undefined,
        sessionId: this.sessionId ?? undefined,
        limit: 5,
      });
      return this.retriever.formatForPrompt(recalled);
    }

    const pinnedOrRecent = await this.recall({ limit: 5 });
    return this.retriever.formatForPrompt(
      pinnedOrRecent.map((m) => ({ ...m, similarity: 0.8 })),
    );
  }

  /** Return memory stats for workspace. */
  async getStats(): Promise<MemoryStats> {
    await this.ensureInit();
    return this.db.getStats(this.projectRoot ?? undefined);
  }

  /** Return retrieval audit logs. */
  async getRetrievalLogs(limit = 20): Promise<MemoryRetrievalLog[]> {
    if (!this.sessionId) return [];
    await this.ensureInit();
    return this.db.getRetrievalLogs(this.sessionId, limit);
  }

  // Compatibility helpers
  async persist(): Promise<void> {
    // Database auto-persists on write
  }

  async recordTask(taskId: string, title: string, status: string): Promise<void> {
    await this.add({
      key: `task:${taskId}`,
      title: `Task: ${title}`,
      summary: `Status: ${status}`,
      value: `Task ${taskId} ("${title}") finished with status ${status}.`,
      category: 'task',
      scope: 'session',
    });
  }

  async appendTaskHistory(
    taskIdOrObj: string | { taskId: string; title: string; status: string; at?: string },
    title?: string,
    status?: string,
  ): Promise<void> {
    if (typeof taskIdOrObj === 'object') {
      await this.recordTask(taskIdOrObj.taskId, taskIdOrObj.title, taskIdOrObj.status);
    } else {
      await this.recordTask(taskIdOrObj, title || '', status || 'done');
    }
  }

  async addImportantFile(filePath: string, reason: string): Promise<void> {
    const basename = filePath.replace(/\\/g, '/').split('/').pop() || filePath;
    await this.add({
      key: `file:${basename}`,
      title: `File: ${basename}`,
      summary: reason,
      value: `${filePath}: ${reason}`,
      category: 'file',
      scope: 'project',
      tags: ['important-file'],
      metadata: { path: filePath },
    });
  }

  async addConvention(pattern: string, description: string): Promise<void> {
    await this.add({
      key: `conv:${pattern}`,
      title: `Convention: ${pattern}`,
      summary: description,
      value: `${pattern}: ${description}`,
      category: 'convention',
      scope: 'project',
      tags: ['convention'],
    });
  }

  async addArchitectureNote(note: string): Promise<void> {
    await this.add({
      key: `arch:${note.slice(0, 30)}`,
      title: 'Architecture Decision',
      summary: note.slice(0, 100),
      value: note,
      category: 'architecture',
      scope: 'project',
      tags: ['architecture'],
    });
  }
}
