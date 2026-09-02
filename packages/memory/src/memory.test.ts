import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { MemoryDatabase } from './database.js';
import { generateSemanticEmbedding, cosineSimilarity } from './vector.js';
import { MemoryExtractor } from './extraction.js';
import { MemoryRetriever } from './retrieval.js';
import { MemoryStore } from './store.js';

describe('Cluster Diverse Memory System', () => {
  let tmpDir: string;
  let dbPath: string;
  let db: MemoryDatabase;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'cluster-memory-test-'));
    dbPath = path.join(tmpDir, 'test_memory.db');
    db = new MemoryDatabase(dbPath);
    await db.init();
  });

  afterEach(async () => {
    try {
      await fs.rm(tmpDir, { recursive: true, force: true });
    } catch {}
  });

  it('generates 128-dimensional semantic embeddings with cosine similarity', () => {
    const vec1 = generateSemanticEmbedding('React components with Framer Motion animations');
    const vec2 = generateSemanticEmbedding('Framer motion animated React website');
    const vec3 = generateSemanticEmbedding('Python machine learning PyTorch training');

    expect(vec1.length).toBe(128);
    expect(vec2.length).toBe(128);

    const simRelated = cosineSimilarity(vec1, vec2);
    const simUnrelated = cosineSimilarity(vec1, vec3);

    // Related React/Framer Motion sentences should have higher similarity than Python/PyTorch
    expect(simRelated).toBeGreaterThan(simUnrelated);
    expect(simRelated).toBeGreaterThan(0.6);
  });

  it('stores, lists, and queries memories across diverse categories', async () => {
    await db.insert({
      id: 'mem_1',
      title: 'Vite and Framer Motion Setup',
      summary: 'Project uses Vite and Framer Motion',
      key: 'arch:stack',
      value: 'Project is built using Vite, TailwindCSS, and Framer Motion.',
      category: 'architecture',
      scope: 'project',
      projectRoot: '/test/workspace',
      source: 'agent',
      importance: 0.8,
      confidence: 0.9,
      pinned: true,
      archived: false,
      hits: 0,
      relevance: 0.8,
      tags: ['vite', 'architecture'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    await db.insert({
      id: 'mem_2',
      title: 'ProductModal Scale Fix',
      summary: 'Fix syntax error scale: 1.02',
      key: 'bug:scale-syntax',
      value: 'Framer Motion whileHover requires scale: 1.02 instead of scale1.02',
      category: 'bug',
      scope: 'project',
      projectRoot: '/test/workspace',
      source: 'extraction',
      importance: 0.9,
      confidence: 0.95,
      pinned: false,
      archived: false,
      hits: 0,
      relevance: 0.9,
      tags: ['bug-fix', 'framer-motion'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const all = await db.list({ projectRoot: '/test/workspace' });
    expect(all.length).toBe(2);
    expect(all[0].pinned).toBe(true); // Pinned items sort first

    // Filter by category
    const bugs = await db.list({ projectRoot: '/test/workspace', category: 'bug' });
    expect(bugs.length).toBe(1);
    expect(bugs[0].category).toBe('bug');
    expect(bugs[0].title).toContain('ProductModal');

    // Stats
    const stats = await db.getStats('/test/workspace');
    expect(stats.total).toBe(2);
    expect(stats.pinned).toBe(1);
    expect(stats.byCategory['architecture']).toBe(1);
    expect(stats.byCategory['bug']).toBe(1);
  });

  it('performs semantic vector search and hybrid retrieval', async () => {
    const retriever = new MemoryRetriever(db);

    await db.insert({
      id: 'mem_arch',
      title: 'E-commerce Architecture',
      summary: 'Store uses Cart.jsx and ProductModal.jsx',
      key: 'arch:ecommerce',
      value: 'The e-commerce application has Cart and ProductModal modals using slide-in animations.',
      category: 'architecture',
      scope: 'project',
      projectRoot: '/test/workspace',
      source: 'extraction',
      importance: 0.8,
      confidence: 0.9,
      pinned: false,
      archived: false,
      hits: 0,
      relevance: 0.8,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const recalled = await retriever.retrieve({
      queryText: 'How is the shopping cart modal implemented in the store?',
      projectRoot: '/test/workspace',
      sessionId: 'sess_test',
    });

    expect(recalled.length).toBeGreaterThan(0);
    expect(recalled[0].id).toBe('mem_arch');
    expect(recalled[0].similarity).toBeGreaterThan(0.5);

    // Format for prompt
    const promptText = retriever.formatForPrompt(recalled);
    expect(promptText).toContain('## Recalled Project & User Memory');
    expect(promptText).toContain('[ARCHITECTURE]');
    expect(promptText).toContain('E-commerce Architecture');
  });

  it('extracts memories from task outcomes and deduplicates', async () => {
    const extractor = new MemoryExtractor(db);

    const extracted = await extractor.extractFromTaskOutcome({
      sessionId: 'sess_1',
      projectRoot: '/test/workspace',
      goal: 'Create an e-commerce website with Framer Motion',
      summary: 'Created Cart, ProductModal, and App components with animations',
      success: true,
      filesChanged: ['components/Cart.jsx', 'components/ProductModal.jsx'],
      commandsRun: ['npm install framer-motion lucide-react'],
      errorEncountered: 'Syntax error scale1.02 in whileHover',
      fixApplied: 'Changed scale1.02 to scale: 1.02',
    });

    expect(extracted.length).toBeGreaterThan(0);

    // Should have created bug fix memory and task memory
    const bugs = await db.list({ projectRoot: '/test/workspace', category: 'bug' });
    expect(bugs.length).toBe(1);
    expect(bugs[0].value).toContain('scale: 1.02');

    // Run extractor again with similar content - should deduplicate rather than clone
    await extractor.extractFromTaskOutcome({
      sessionId: 'sess_1',
      projectRoot: '/test/workspace',
      goal: 'Create an e-commerce website with Framer Motion',
      summary: 'Created Cart, ProductModal, and App components with animations',
      success: true,
    });

    const tasks = await db.list({ projectRoot: '/test/workspace', category: 'task' });
    expect(tasks.length).toBe(1); // Not duplicated!
  });

  it('pins, archives, and deletes memory entries', async () => {
    const store = new MemoryStore({ projectRoot: '/test/workspace', database: db });
    await store.init();

    const mem = await store.add({
      key: 'pref:dark-mode',
      title: 'Dark Theme Preference',
      summary: 'User prefers dark theme',
      value: 'Always generate dark mode styling with neutral dark backgrounds',
      category: 'user_preference',
      scope: 'project',
    });

    expect(mem.pinned).toBe(false);

    // Pin
    await store.pin(mem.id, true);
    let updated = await db.get(mem.id);
    expect(updated?.pinned).toBe(true);

    // Archive
    await store.archive(mem.id, true);
    updated = await db.get(mem.id);
    expect(updated?.archived).toBe(true);

    // Unarchived list should not include it
    const active = await store.recall();
    expect(active.some((e) => e.id === mem.id)).toBe(false);

    // Delete
    await store.delete(mem.id);
    const deleted = await db.get(mem.id);
    expect(deleted).toBeNull();
  });

  it('automatically extracts diverse memories from user prompts and rejects noise', async () => {
    const extractor = new MemoryExtractor(db);

    // Trivial greeting - should be rejected
    const trivial = await extractor.extractFromPrompt('hello there', { projectRoot: '/test/workspace' });
    expect(trivial.length).toBe(0);

    // Prompt with UI preference & project goal
    const prompt1 = 'I am building an analytics dashboard with charts and real-time metrics. Always use dark theme with tailwind.';
    const extracted1 = await extractor.extractFromPrompt(prompt1, { projectRoot: '/test/workspace' });
    expect(extracted1.length).toBeGreaterThanOrEqual(1);

    const uiStyle = await db.list({ projectRoot: '/test/workspace', category: 'ui_style' });
    expect(uiStyle.length).toBe(1);
    expect(uiStyle[0]?.title || '').toContain('UI Style');

    // Prompt with model preference
    const prompt2 = 'For this workspace please use model claude-3-5-sonnet';
    const extracted2 = await extractor.extractFromPrompt(prompt2, { projectRoot: '/test/workspace' });
    expect(extracted2.length).toBe(1);
    expect(extracted2[0].category).toBe('provider_model');
  });

  it('extracts user corrections and scores contextual relevance', async () => {
    const extractor = new MemoryExtractor(db);
    const retriever = new MemoryRetriever(db);

    // Workflow with explicit user correction
    await extractor.extractFromTaskOutcome({
      sessionId: 'sess_corr',
      projectRoot: '/test/workspace',
      goal: 'Setup animation library',
      summary: 'Switched animation system',
      success: true,
      userCorrection: 'Instead of css animations use framer-motion',
    });

    const corrections = await db.list({ projectRoot: '/test/workspace', category: 'user_preference' });
    expect(corrections.length).toBe(1);
    expect(corrections[0].pinned).toBe(true);
    expect(corrections[0].title).toContain('framer-motion');

    // Contextual retrieval with task category match
    const recalled = await retriever.retrieve({
      queryText: 'How should we animate components?',
      projectRoot: '/test/workspace',
      taskCategory: 'user_preference',
      limit: 3,
    });

    expect(recalled.length).toBeGreaterThan(0);
    expect(recalled[0].title).toContain('framer-motion');
  });
});
