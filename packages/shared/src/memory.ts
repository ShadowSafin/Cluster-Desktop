/**
 * Persistent memory and project knowledge types.
 *
 * Two layers:
 * - Session memory: short-lived, per conversation
 * - Project memory: long-lived, per workspace
 */

export type MemoryScope = 'session' | 'project' | 'global';

export type MemoryCategory =
  | 'project'
  | 'session'
  | 'user_preference'
  | 'task'
  | 'bug'
  | 'architecture'
  | 'file'
  | 'command'
  | 'provider_model'
  | 'checkpoint'
  | 'global'
  | 'fact'
  | 'convention'
  | 'pattern'
  | 'note'
  | 'important-file'
  | 'ui_style'
  | 'workflow';

export interface ContextualRetrievalOptions {
  queryText: string;
  projectRoot?: string;
  sessionId?: string;
  limit?: number;
  minScore?: number;
  activeFiles?: string[];
  taskCategory?: string;
  agentRole?: string;
  providerModel?: string;
}

export interface MemoryEntry {
  id: string;
  title: string;
  summary: string;
  key: string;
  value: string;
  category: MemoryCategory;
  scope: MemoryScope;
  projectRoot?: string;
  sessionId?: string;
  source: 'auto' | 'user' | 'agent' | 'extraction' | 'checkpoint' | 'diff' | 'system';
  importance: number;
  confidence: number;
  pinned: boolean;
  archived: boolean;
  hits: number;
  relevance: number;
  similarity?: number;
  tags?: string[];
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  lastAccessedAt?: string;
}

export interface MemoryStats {
  total: number;
  pinned: number;
  archived: number;
  byCategory: Record<string, number>;
  byScope: Record<string, number>;
}

export interface MemoryRetrievalLog {
  id: string;
  sessionId: string;
  taskGoal: string;
  memoryId: string;
  similarityScore: number;
  category: string;
  createdAt: string;
}

export interface ProjectMemory {
  projectRoot: string;
  entries: MemoryEntry[];
  /** Files that are frequently referenced or explicitly marked important. */
  importantFiles: Array<{ path: string; reason: string; addedAt: string }>;
  /** Known commands and conventions for this project. */
  conventions: Array<{ pattern: string; description: string }>;
  /** Architecture notes. */
  architectureNotes: string[];
  updatedAt: string;
}

export interface SessionMemory {
  sessionId: string;
  projectRoot: string;
  entries: MemoryEntry[];
  /** Task history for this session. */
  taskHistory: Array<{ taskId: string; title: string; status: string; at: string }>;
  createdAt: string;
  updatedAt: string;
}

export function createMemoryEntry(init: {
  id: string;
  title?: string;
  summary?: string;
  key: string;
  value: string;
  category?: MemoryCategory;
  scope?: MemoryScope;
  source?: MemoryEntry['source'];
  projectRoot?: string;
  sessionId?: string;
  importance?: number;
  confidence?: number;
  pinned?: boolean;
  archived?: boolean;
  tags?: string[];
  metadata?: Record<string, unknown>;
}): MemoryEntry {
  const now = new Date().toISOString();
  const summary = init.summary || (init.value.length > 140 ? init.value.slice(0, 137) + '...' : init.value);
  const title = init.title || init.key.replace(/^[^:]+:/, '').replace(/[-_]/g, ' ');

  return {
    id: init.id,
    title: title.charAt(0).toUpperCase() + title.slice(1),
    summary,
    key: init.key,
    value: init.value,
    category: init.category ?? 'note',
    scope: init.scope ?? 'project',
    source: init.source ?? 'auto',
    projectRoot: init.projectRoot,
    sessionId: init.sessionId,
    importance: init.importance ?? 0.5,
    confidence: init.confidence ?? 0.8,
    pinned: init.pinned ?? false,
    archived: init.archived ?? false,
    hits: 0,
    relevance: 0.5,
    tags: init.tags ?? [],
    metadata: init.metadata,
    createdAt: now,
    updatedAt: now,
  };
}
