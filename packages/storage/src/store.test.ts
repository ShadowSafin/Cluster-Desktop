import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { SessionStore } from './store.js';

let tempDir = '';
let store: SessionStore;

beforeAll(async () => {
  tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'cluster-store-test-'));
  store = await SessionStore.open({ home: tempDir });
});

afterAll(async () => {
  await store.flush();
  await fs.rm(tempDir, { recursive: true, force: true });
});

describe('SessionStore', () => {
  it('creates and reads a session back', () => {
    const session = store.createSession({
      projectRoot: tempDir,
      model: 'gpt-test',
      title: 'Smoke test',
    });
    expect(session.id).toBeTruthy();
    expect(store.getSession(session.id)?.title).toBe('Smoke test');
  });

  it('appends messages and counts them', () => {
    const session = store.createSession({ projectRoot: tempDir, model: 'gpt-test', title: 'Msgs' });
    store.appendMessage(session.id, {
      id: 'm1',
      sessionId: session.id,
      role: 'user',
      content: 'hi',
      createdAt: new Date().toISOString(),
      kind: 'chat',
    });
    store.appendMessage(session.id, {
      id: 'm2',
      sessionId: session.id,
      role: 'assistant',
      content: 'hello',
      createdAt: new Date().toISOString(),
      kind: 'chat',
    });
    const fresh = store.getSession(session.id);
    expect(fresh?.messages.length).toBe(2);
    expect(fresh?.messages[0].content).toBe('hi');
  });

  it('lists sessions filtered by project root', () => {
    const a = store.createSession({ projectRoot: path.join(tempDir, 'a'), model: 'x', title: 'a' });
    store.createSession({ projectRoot: path.join(tempDir, 'b'), model: 'x', title: 'b' });
    const filtered = store.listSessions({ projectRoot: path.join(tempDir, 'a') });
    expect(filtered.length).toBeGreaterThanOrEqual(1);
    expect(filtered.some((s) => s.id === a.id)).toBe(true);
  });

  it('renames a session', () => {
    const session = store.createSession({ projectRoot: tempDir, model: 'x', title: 'old' });
    store.renameSession(session.id, 'new');
    expect(store.getSession(session.id)?.title).toBe('new');
  });

  it('returns null for unknown sessions', () => {
    expect(store.getSession('does-not-exist')).toBeNull();
  });

  it('updates state without losing prior fields', () => {
    const session = store.createSession({ projectRoot: tempDir, model: 'x', title: 'state' });
    store.updateState(session.id, { phase: 'reading' });
    store.updateState(session.id, { iteration: 2 });
    const fresh = store.getSession(session.id);
    expect(fresh?.state.phase).toBe('reading');
    expect(fresh?.state.iteration).toBe(2);
  });
});
