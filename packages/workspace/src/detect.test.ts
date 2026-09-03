import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { detectProjectRoot } from './detect.js';

describe('detectProjectRoot', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'cluster-workspace-test-'));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => null);
  });

  it('detects package.json root from subdirectories', async () => {
    const pkgJson = path.join(tmpDir, 'package.json');
    await fs.writeFile(pkgJson, JSON.stringify({ name: 'test-app' }), 'utf8');

    const subDir = path.join(tmpDir, 'src', 'components');
    await fs.mkdir(subDir, { recursive: true });

    const result = await detectProjectRoot(subDir);
    expect(result.fallback).toBe(false);
    expect(result.marker).toBe('package.json');
    expect(path.resolve(result.root)).toBe(path.resolve(tmpDir));
  });

  it('detects .git root when present', async () => {
    const gitDir = path.join(tmpDir, '.git');
    await fs.mkdir(gitDir, { recursive: true });

    const nested = path.join(tmpDir, 'deep', 'nested', 'folder');
    await fs.mkdir(nested, { recursive: true });

    const result = await detectProjectRoot(nested);
    expect(result.fallback).toBe(false);
    expect(result.marker).toBe('.git');
    expect(path.resolve(result.root)).toBe(path.resolve(tmpDir));
  });

  it('falls back to startDir when no root marker exists', async () => {
    const emptyFolder = path.join(tmpDir, 'standalone');
    await fs.mkdir(emptyFolder, { recursive: true });

    const result = await detectProjectRoot(emptyFolder);
    expect(path.resolve(result.root)).toBe(path.resolve(emptyFolder));
  });
});
