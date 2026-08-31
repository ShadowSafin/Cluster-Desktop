import type { Session } from '@cluster/shared';
import { SESSION_SCHEMA_VERSION } from '@cluster/shared';

export const DATABASE_VERSION = 1;

export interface Database {
  version: number;
  sessions: Session[];
}

export function emptyDatabase(): Database {
  return { version: DATABASE_VERSION, sessions: [] };
}

/**
 * Best-effort upgrade path for sessions written by an older build.
 * Unknown or future schema versions are returned untouched rather than
 * discarded, so data is never silently lost.
 */
export function migrate(database: Database): Database {
  if (database.version === DATABASE_VERSION) return database;
  return { version: DATABASE_VERSION, sessions: database.sessions ?? [] };
}

export function isSession(value: unknown): value is Session {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<Session>;
  return typeof candidate.id === 'string' && Array.isArray(candidate.messages);
}

export { SESSION_SCHEMA_VERSION };
