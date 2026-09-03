import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { VerificationEngine } from './verificationEngine.js';

describe('VerificationEngine & Single-Agent Completion Gate', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'cluster-verif-test-'));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => null);
  });

  it('detects empty files and merge conflict markers', async () => {
    const emptyFile = path.join(tmpDir, 'empty.ts');
    await fs.writeFile(emptyFile, '', 'utf8');

    const conflictFile = path.join(tmpDir, 'conflict.ts');
    await fs.writeFile(
      conflictFile,
      '<<<<<<< HEAD\nconst x = 1;\n=======\nconst x = 2;\n>>>>>>> main\n',
      'utf8'
    );

    const engine = new VerificationEngine({
      projectRoot: tmpDir,
      sessionId: 'test-session',
    });

    const report = await engine.runVerificationPass(
      [emptyFile, conflictFile],
      'Create utility files',
      'turn-1'
    );

    expect(report.gateAccepted).toBe(false);
    expect(report.status).toBe('failed');

    const emptyCheck = report.checks.find((c) => c.title === 'Empty File Check');
    expect(emptyCheck).toBeDefined();
    expect(emptyCheck?.status).toBe('failed');

    const conflictCheck = report.checks.find((c) => c.title === 'Git Conflict Markers');
    expect(conflictCheck).toBeDefined();
    expect(conflictCheck?.status).toBe('failed');
  });

  it('detects broken local imports and missing references', async () => {
    const mainFile = path.join(tmpDir, 'service.ts');
    await fs.writeFile(
      mainFile,
      'import { helper } from "./nonExistentHelper.js";\nexport function run() { return helper(); }\n',
      'utf8'
    );

    const engine = new VerificationEngine({
      projectRoot: tmpDir,
      sessionId: 'test-session',
    });

    const report = await engine.runVerificationPass(
      [mainFile],
      'Implement service logic',
      'turn-1'
    );

    expect(report.gateAccepted).toBe(false);
    const brokenImportCheck = report.checks.find((c) => c.title === 'Broken Module Import');
    expect(brokenImportCheck).toBeDefined();
    expect(brokenImportCheck?.status).toBe('failed');
    expect(brokenImportCheck?.message).toContain('nonExistentHelper');
  });

  it('passes cleanly on valid component and resolves imports', async () => {
    const utilFile = path.join(tmpDir, 'math.ts');
    await fs.writeFile(utilFile, 'export function add(a: number, b: number) { return a + b; }\n', 'utf8');

    const compFile = path.join(tmpDir, 'Component.tsx');
    await fs.writeFile(
      compFile,
      'import { add } from "./math.js";\nexport function Component() { return <div className="p-4">{add(1, 2)}</div>; }\n',
      'utf8'
    );

    const engine = new VerificationEngine({
      projectRoot: tmpDir,
      sessionId: 'test-session',
    });

    const report = await engine.runVerificationPass(
      [utilFile, compFile],
      'Add UI math component',
      'turn-1'
    );

    expect(report.gateAccepted).toBe(true);
    expect(report.status).toBe('passed');
    expect(report.critiques.length).toBeGreaterThanOrEqual(5);

    // Verify self-critique items
    const usabilityCritique = report.critiques.find((c) => c.aspect === 'usability');
    expect(usabilityCritique).toBeDefined();
    expect(usabilityCritique?.passed).toBe(true);
  });

  it('identifies UI overlap hazards (large negative margins)', async () => {
    const uiFile = path.join(tmpDir, 'Header.tsx');
    await fs.writeFile(
      uiFile,
      'export function Header() { return <div className="-mt-12 -mb-16 bg-zinc-900">Header</div>; }\n',
      'utf8'
    );

    const engine = new VerificationEngine({
      projectRoot: tmpDir,
      sessionId: 'test-session',
    });

    const report = await engine.runVerificationPass(
      [uiFile],
      'Create Header component',
      'turn-1'
    );

    const overlapCheck = report.checks.find((c) => c.title.includes('Negative Margins'));
    expect(overlapCheck).toBeDefined();
    expect(overlapCheck?.status).toBe('warning');
  });
});
