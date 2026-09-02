import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { SkillsStore } from './store.js';
import { SkillsRuntime } from './runtime.js';
import { validateSkillManifest, createSkillManifest } from './manifest.js';
import { MARKETPLACE_CATALOG } from './catalog.js';

describe('Skills System', () => {
  let tmpDir: string;
  let store: SkillsStore;
  let runtime: SkillsRuntime;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'cluster-skills-test-'));
    store = new SkillsStore(tmpDir);
    await store.init();
    runtime = new SkillsRuntime(store);
  });

  afterEach(async () => {
    try {
      await fs.rm(tmpDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  it('validates skill manifests correctly', () => {
    const valid = createSkillManifest({
      id: 'custom-linter',
      name: 'custom-linter',
      displayName: 'Custom Linter',
      category: 'coding',
      invocationName: 'lint',
      instructions: 'Run eslint on changed files.',
    });

    const res = validateSkillManifest(valid);
    expect(res.ok).toBe(true);

    const invalid = validateSkillManifest({ id: '' });
    expect(invalid.ok).toBe(false);
  });

  it('seeds default installed skills from built-in catalog', async () => {
    const installed = await store.listInstalled();
    expect(installed.length).toBeGreaterThanOrEqual(6);

    const refactor = installed.find((s) => s.manifest.id === 'refactor-clean');
    expect(refactor).toBeDefined();
    expect(refactor?.manifest.invocationName).toBe('refactor');
    expect(refactor?.pinned).toBe(true);
  });

  it('searches and filters marketplace catalog across categories', async () => {
    const all = await store.listMarketplace();
    expect(all.length).toBeGreaterThanOrEqual(16);

    const refactorSkills = await store.listMarketplace({ category: 'refactor' });
    expect(refactorSkills.length).toBeGreaterThanOrEqual(1);
    expect(refactorSkills[0].category).toBe('refactor');

    const searchResults = await store.listMarketplace({ search: 'Vitest' });
    expect(searchResults.length).toBeGreaterThanOrEqual(1);
    expect(searchResults[0].id).toBe('test-suite-gen');
  });

  it('installs, uninstalls, toggles, and pins skills', async () => {
    // Install a marketplace skill
    const installRes = await store.install('performance-profiler');
    expect(installRes.ok).toBe(true);

    let installed = await store.listInstalled();
    expect(installed.some((s) => s.manifest.id === 'performance-profiler')).toBe(true);

    // Toggle disabled
    await store.toggle('performance-profiler', false);
    let item = await store.getInstalled('performance-profiler');
    expect(item?.enabled).toBe(false);

    // Pin
    await store.pin('performance-profiler', true);
    item = await store.getInstalled('performance-profiler');
    expect(item?.pinned).toBe(true);

    // Uninstall
    const uninstalled = await store.uninstall('performance-profiler');
    expect(uninstalled).toBe(true);

    installed = await store.listInstalled();
    expect(installed.some((s) => s.manifest.id === 'performance-profiler')).toBe(false);
  });

  it('creates custom user skills', async () => {
    const custom = await store.createCustom({
      displayName: 'My Custom Deployer',
      invocationName: 'my-deploy',
      category: 'deployment',
      instructions: 'Deploy application to staging server via SSH.',
    });

    expect(custom.manifest.id).toContain('my-deploy');
    expect(custom.manifest.installSource).toBe('custom');

    const found = await store.getInstalled('my-deploy');
    expect(found).toBeDefined();
    expect(found?.manifest.displayName).toBe('My Custom Deployer');
  });

  it('resolves slash commands to installed skills', async () => {
    const resolution = await runtime.resolveCommand('/refactor src/components/Header.tsx');
    expect(resolution.type).toBe('skill');
    if (resolution.type === 'skill') {
      expect(resolution.skill.manifest.id).toBe('refactor-clean');
      expect(resolution.rawArgs).toBe('src/components/Header.tsx');
      expect(resolution.instructions).toContain('Clean Architecture Refactoring');
    }
  });

  it('detects missing skills and suggests marketplace installations', async () => {
    // Ensure performance-profiler is not installed
    await store.uninstall('performance-profiler');

    const resolution = await runtime.resolveCommand('/perf');
    expect(resolution.type).toBe('missing');
    if (resolution.type === 'missing') {
      expect(resolution.command).toBe('perf');
      expect(resolution.suggestion?.id).toBe('performance-profiler');
    }
  });

  it('handles system slash commands', async () => {
    expect((await runtime.resolveCommand('/skills')).type).toBe('system');
    expect((await runtime.resolveCommand('/marketplace')).type).toBe('system');

    const installCmd = await runtime.resolveCommand('/install performance-profiler');
    expect(installCmd.type).toBe('system');
    if (installCmd.type === 'system') {
      expect(installCmd.action).toBe('install');
      expect(installCmd.target).toBe('performance-profiler');
    }
  });

  it('records invocation history and updates stats', async () => {
    await store.recordInvocation('refactor-clean', { target: 'Header.tsx' }, '/refactor Header.tsx', 'sess-1');

    const history = await store.getHistory();
    expect(history.length).toBe(1);
    expect(history[0].skillId).toBe('refactor-clean');
    expect(history[0].rawCommand).toBe('/refactor Header.tsx');

    const stats = await store.stats();
    expect(stats.totalInvocations).toBe(1);
  });
});
