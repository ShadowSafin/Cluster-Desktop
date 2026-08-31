import { randomBytes } from 'node:crypto';

const ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyz';

/**
 * Short, sortable-ish, collision-resistant id. Short ids matter here because
 * they are printed in the TUI next to tool calls.
 */
export function createId(prefix?: string): string {
  const bytes = randomBytes(12);
  let out = '';
  for (let i = 0; i < bytes.length; i += 1) {
    out += ALPHABET[bytes[i]! % ALPHABET.length];
  }
  return prefix ? `${prefix}_${out}` : out;
}

/** Monotonic timestamp suitable for ordering appended records. */
export function nowIso(): string {
  return new Date().toISOString();
}
