import fs from 'node:fs/promises';
import path from 'node:path';
import { Low } from 'lowdb';
import { JSONFile } from 'lowdb/node';
import {
  createEmptySession,
  createId,
  getLogger,
  toPosix,
  type AgentState,
  type CommandRun,
  type Edit,
  type ErrorEvent,
  type Message,
  type Plan,
  type Session,
  type ToolCall,
  type WorkspaceInfo,
} from '@cluster/shared';
import { resolveStoragePaths, type StoragePaths } from './paths.js';
import { emptyDatabase, migrate, type Database } from './schema.js';

/**
 * Session persistence.
 *
 * Writes are debounced: the agent emits many small updates per turn and we do
 * not want a full JSON rewrite for each one. `flush()` is awaited at the end
 * of every agent turn and on shutdown, so at most one turn of work is ever at
 * risk.
 */

const MAX_STORED_OUTPUT = 64 * 1024;
const WRITE_DEBOUNCE_MS = 150;

export interface SessionSummary {
  id: string;
  title: string;
  projectRoot: string;
  model: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
  toolCallCount: number;
  editCount: number;
  phase: AgentState['phase'];
}

export interface StoreOptions {
  home?: string;
  /** Disable writing to disk (used by tests). */
  readOnly?: boolean;
}

function cap(value: string, max = MAX_STORED_OUTPUT): string {
  if (value.length <= max) return value;
  const hidden = value.length - max;
  return `${value.slice(0, max)}\n… ${hidden} more characters truncated in session log …`;
}

function touch(session: Session): void {
  session.updatedAt = new Date().toISOString();
}

export class SessionStore {
  private readonly db: Low<Database>;
  private readonly readOnly: boolean;
  private writeTimer: NodeJS.Timeout | null = null;
  private pendingWrite: Promise<void> | null = null;
  private dirty = false;

  private constructor(db: Low<Database>, readonly paths: StoragePaths, readOnly: boolean) {
    this.db = db;
    this.readOnly = readOnly;
  }

  static async open(options: StoreOptions = {}): Promise<SessionStore> {
    const paths = resolveStoragePaths(options.home);
    await fs.mkdir(paths.home, { recursive: true });

    const adapter = new JSONFile<Database>(paths.databaseFile);
    const db = new Low<Database>(adapter, emptyDatabase());

    try {
      await db.read();
    } catch (error) {
      // A corrupt database must not prevent the app from starting. Quarantine
      // the file and continue with an empty one.
      const logger = getLogger('storage');
      logger.warn({ error }, 'Session database could not be parsed; quarantining it');
      const quarantine = `${paths.databaseFile}.corrupt-${Date.now()}`;
      try {
        await fs.rename(paths.databaseFile, quarantine);
      } catch {
        // Nothing more we can do; fall through with an empty database.
      }
      db.data = emptyDatabase();
    }

    db.data = migrate(db.data ?? emptyDatabase());
    return new SessionStore(db, paths, options.readOnly ?? false);
  }

  /* ---------------------------------------------------------------------- */
  /* Persistence                                                             */
  /* ---------------------------------------------------------------------- */

  private markDirty(): void {
    if (this.readOnly) return;
    this.dirty = true;
    if (this.writeTimer) clearTimeout(this.writeTimer);
    this.writeTimer = setTimeout(() => {
      void this.flush();
    }, WRITE_DEBOUNCE_MS);
    // Do not hold the event loop open just for a pending write.
    this.writeTimer.unref?.();
  }

  /** Persist any pending changes immediately. */
  async flush(): Promise<void> {
    if (this.readOnly || !this.dirty) return;
    if (this.writeTimer) {
      clearTimeout(this.writeTimer);
      this.writeTimer = null;
    }
    if (this.pendingWrite) {
      await this.pendingWrite;
    }
    this.dirty = false;
    this.pendingWrite = this.db.write().catch((error) => {
      getLogger('storage').error({ error }, 'Failed to write session database');
    });
    await this.pendingWrite;
    this.pendingWrite = null;
  }

  /* ---------------------------------------------------------------------- */
  /* Queries                                                                 */
  /* ---------------------------------------------------------------------- */

  get sessions(): readonly Session[] {
    return this.db.data.sessions;
  }

  getSession(id: string): Session | null {
    return this.db.data.sessions.find((session) => session.id === id) ?? null;
  }

  listSessions(filter: { projectRoot?: string; limit?: number } = {}): SessionSummary[] {
    const root = filter.projectRoot ? toPosix(path.resolve(filter.projectRoot)) : undefined;

    return this.db.data.sessions
      .filter((session) => !root || toPosix(path.resolve(session.projectRoot)) === root)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .slice(0, filter.limit ?? 50)
      .map((session) => ({
        id: session.id,
        title: session.title,
        projectRoot: session.projectRoot,
        model: session.model,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
        messageCount: session.messages.length,
        toolCallCount: session.toolCalls.length,
        editCount: session.edits.length,
        phase: session.state.phase,
      }));
  }

  /** Most recently updated session for a project root, if any. */
  latestSession(projectRoot: string): Session | null {
    const root = toPosix(path.resolve(projectRoot));
    const matches = this.db.data.sessions
      .filter((session) => toPosix(path.resolve(session.projectRoot)) === root)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    return matches[0] ?? null;
  }

  /* ---------------------------------------------------------------------- */
  /* Mutations                                                               */
  /* ---------------------------------------------------------------------- */

  createSession(init: { projectRoot: string; model: string; title?: string; id?: string }): Session {
    const session = createEmptySession({
      id: init.id ?? createId('sess'),
      projectRoot: init.projectRoot,
      model: init.model,
      title: init.title,
    });
    this.db.data.sessions.push(session);
    this.markDirty();
    return session;
  }

  deleteSession(id: string): boolean {
    const index = this.db.data.sessions.findIndex((session) => session.id === id);
    if (index === -1) return false;
    this.db.data.sessions.splice(index, 1);
    this.markDirty();
    return true;
  }

  private mutate(id: string, fn: (session: Session) => void): void {
    const session = this.getSession(id);
    if (!session) return;
    fn(session);
    touch(session);
    this.markDirty();
  }

  appendMessage(id: string, message: Message): void {
    this.mutate(id, (session) => {
      session.messages.push(message);
    });
  }

  appendToolCall(id: string, toolCall: ToolCall): void {
    this.mutate(id, (session) => {
      session.toolCalls.push(toolCall);
    });
  }

  updateToolCall(id: string, toolCall: ToolCall): void {
    this.mutate(id, (session) => {
      const index = session.toolCalls.findIndex((entry) => entry.id === toolCall.id);
      if (index === -1) session.toolCalls.push(toolCall);
      else session.toolCalls[index] = toolCall;
    });
  }

  appendEdit(id: string, edit: Edit): void {
    this.mutate(id, (session) => {
      session.edits.push(edit);
    });
  }

  appendCommandRun(id: string, run: CommandRun): void {
    this.mutate(id, (session) => {
      session.commandRuns.push({ ...run, stdout: cap(run.stdout), stderr: cap(run.stderr) });
    });
  }

  appendError(id: string, event: ErrorEvent): void {
    this.mutate(id, (session) => {
      session.errors.push(event);
    });
  }

  setPlan(id: string, plan: Plan | null): void {
    this.mutate(id, (session) => {
      session.plan = plan;
    });
  }

  setWorkspace(id: string, workspace: WorkspaceInfo | null): void {
    this.mutate(id, (session) => {
      session.workspace = workspace;
    });
  }

  updateState(id: string, patch: Partial<AgentState>): void {
    this.mutate(id, (session) => {
      session.state = { ...session.state, ...patch };
    });
  }

  renameSession(id: string, title: string): void {
    this.mutate(id, (session) => {
      session.title = title;
    });
  }
}
