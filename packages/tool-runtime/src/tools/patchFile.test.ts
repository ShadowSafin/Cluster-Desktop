import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getLogger } from '@cluster/shared';
import { ToolRegistry } from '../registry.js';
import { patchFileTool, readFileTool, writeFileTool } from './index.js';
import type { ToolContext } from '../types.js';

let root: string;
let backupsDir: string;
let registry: ToolRegistry;

function makeContext(): ToolContext {
  return {
    projectRoot: root,
    workspace: null,
    signal: new AbortController().signal,
    logger: getLogger('test'),
    backupsDir,
    sessionId: 'test-session',
    alwaysConfirmCommands: false,
    confirm: async () => true,
    emitOutput: () => undefined,
    emitProgress: () => undefined,
  };
}

async function write(relative: string, content: string): Promise<void> {
  const absolute = path.join(root, relative);
  await fs.mkdir(path.dirname(absolute), { recursive: true });
  await fs.writeFile(absolute, content, 'utf8');
}

async function read(relative: string): Promise<string> {
  return fs.readFile(path.join(root, relative), 'utf8');
}

beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'cluster-tools-'));
  backupsDir = path.join(root, '.cluster', 'backups');
  registry = new ToolRegistry().registerAll([readFileTool, writeFileTool, patchFileTool]);
});

afterEach(async () => {
  await fs.rm(root, { recursive: true, force: true });
});

describe('read_file', () => {
  it('returns numbered lines', async () => {
    await write('src/a.ts', 'one\ntwo\nthree\n');
    const outcome = await registry.execute('read_file', { path: 'src/a.ts' }, makeContext());

    expect(outcome.result.ok).toBe(true);
    expect(outcome.result.output).toContain('1 | one');
    expect(outcome.result.output).toContain('3 | three');
  });

  it('reports a missing file with an actionable hint', async () => {
    const outcome = await registry.execute('read_file', { path: 'nope.ts' }, makeContext());
    expect(outcome.result.ok).toBe(false);
    expect(outcome.result.error?.code).toBe('ENOENT');
    expect(outcome.result.error?.hint).toBeTruthy();
  });

  it('refuses directories', async () => {
    await write('src/a.ts', 'x');
    const outcome = await registry.execute('read_file', { path: 'src' }, makeContext());
    expect(outcome.result.ok).toBe(false);
    expect(outcome.result.error?.code).toBe('EISDIR');
  });

  it('refuses to read binary files', async () => {
    const absolute = path.join(root, 'blob.bin');
    await fs.writeFile(absolute, Buffer.from([0x00, 0x01, 0x02, 0x00]));
    const outcome = await registry.execute('read_file', { path: 'blob.bin' }, makeContext());
    expect(outcome.result.ok).toBe(false);
    expect(outcome.result.error?.code).toBe('binary_file');
  });

  it('supports offset and limit', async () => {
    await write('a.txt', 'l1\nl2\nl3\nl4\nl5\n');
    const outcome = await registry.execute('read_file', { path: 'a.txt', offset: 2, limit: 2 }, makeContext());
    expect(outcome.result.output).toContain('3 | l3');
    expect(outcome.result.output).not.toContain('5 | l5');
  });
});

describe('patch_file', () => {
  it('applies a single exact replacement', async () => {
    await write('a.ts', 'const a = 1;\nconst b = 2;\n');
    const outcome = await registry.execute(
      'patch_file',
      { path: 'a.ts', edits: [{ oldText: 'const b = 2;', newText: 'const b = 3;' }] },
      makeContext(),
    );

    expect(outcome.result.ok).toBe(true);
    expect(await read('a.ts')).toBe('const a = 1;\nconst b = 3;\n');
    expect(outcome.result.data).toMatchObject({ additions: 1, deletions: 1 });
  });

  it('replaces every occurrence when replaceAll is set', async () => {
    await write('a.ts', 'x\nx\nx\n');
    const outcome = await registry.execute(
      'patch_file',
      { path: 'a.ts', edits: [{ oldText: 'x', newText: 'y', replaceAll: true }] },
      makeContext(),
    );
    expect(outcome.result.ok).toBe(true);
    expect(await read('a.ts')).toBe('y\ny\ny\n');
  });

  it('rejects an ambiguous match and explains why', async () => {
    await write('a.ts', 'x\nx\n');
    const outcome = await registry.execute(
      'patch_file',
      { path: 'a.ts', edits: [{ oldText: 'x', newText: 'y' }] },
      makeContext(),
    );
    expect(outcome.result.ok).toBe(false);
    expect(outcome.result.error?.code).toBe('invalid_patch');
    expect(outcome.result.error?.message).toMatch(/occurs 2 times/);
  });

  it('does not interpret $ patterns in the replacement', async () => {
    // `$&` would expand to the matched text with a string replacement.
    await write('a.ts', 'value = 1;\n');
    const outcome = await registry.execute(
      'patch_file',
      { path: 'a.ts', edits: [{ oldText: 'value = 1;', newText: "value = '$&$1`';" }] },
      makeContext(),
    );
    expect(outcome.result.ok).toBe(true);
    expect(await read('a.ts')).toBe("value = '$&$1`';\n");
  });

  it('reports a clear error when the text is not found', async () => {
    await write('a.ts', 'const a = 1;\n');
    const outcome = await registry.execute(
      'patch_file',
      { path: 'a.ts', edits: [{ oldText: 'const z = 9;', newText: 'x' }] },
      makeContext(),
    );
    expect(outcome.result.ok).toBe(false);
    expect(outcome.result.error?.message).toMatch(/was not found/);
  });

  it('applies a unified diff', async () => {
    await write('a.ts', 'one\ntwo\nthree\n');
    const outcome = await registry.execute(
      'patch_file',
      {
        path: 'a.ts',
        unifiedDiff: '--- a/a.ts\n+++ b/a.ts\n@@ -1,3 +1,3 @@\n one\n-two\n+TWO\n three\n',
      },
      makeContext(),
    );
    expect(outcome.result.ok).toBe(true);
    expect(await read('a.ts')).toBe('one\nTWO\nthree\n');
  });

  it('previews without writing in dry-run mode', async () => {
    await write('a.ts', 'one\n');
    const outcome = await registry.execute(
      'patch_file',
      { path: 'a.ts', edits: [{ oldText: 'one', newText: 'TWO' }], dryRun: true },
      makeContext(),
    );
    expect(outcome.result.ok).toBe(true);
    expect(await read('a.ts')).toBe('one\n');
    expect(outcome.result.output).toMatch(/dry run/i);
  });

  it('takes a backup before modifying the file', async () => {
    await write('a.ts', 'original\n');
    const outcome = await registry.execute(
      'patch_file',
      { path: 'a.ts', edits: [{ oldText: 'original', newText: 'changed' }] },
      makeContext(),
    );

    const backupPath = (outcome.result.data as { backupPath?: string }).backupPath;
    expect(backupPath).toBeTruthy();
    expect(await fs.readFile(backupPath!, 'utf8')).toBe('original\n');
  });

  it('refuses to patch a file that does not exist', async () => {
    const outcome = await registry.execute(
      'patch_file',
      { path: 'missing.ts', edits: [{ oldText: 'a', newText: 'b' }] },
      makeContext(),
    );
    expect(outcome.result.ok).toBe(false);
    expect(outcome.result.error?.code).toBe('ENOENT');
    expect(outcome.result.error?.hint).toMatch(/write_file/);
  });

  it('rejects a request that supplies both edits and a diff', async () => {
    await write('a.ts', 'one\n');
    const outcome = await registry.execute(
      'patch_file',
      { path: 'a.ts', edits: [{ oldText: 'one', newText: 'two' }], unifiedDiff: '@@ -1 +1 @@\n-one\n+two\n' },
      makeContext(),
    );
    expect(outcome.result.ok).toBe(false);
    expect(outcome.result.error?.code).toBe('invalid_input');
  });
});

describe('write_file', () => {
  it('creates a new file', async () => {
    const outcome = await registry.execute('write_file', { path: 'new.ts', content: 'export const x = 1;\n' }, makeContext());
    expect(outcome.result.ok).toBe(true);
    expect(await read('new.ts')).toBe('export const x = 1;\n');
    expect(outcome.result.data).toMatchObject({ created: true });
  });

  it('backs up and reports a diff when overwriting', async () => {
    await write('a.ts', 'old\n');
    const outcome = await registry.execute('write_file', { path: 'a.ts', content: 'new\n' }, makeContext());
    expect(outcome.result.ok).toBe(true);
    expect(await read('a.ts')).toBe('new\n');

    const data = outcome.result.data as { backupPath?: string; diff?: string };
    expect(data.backupPath).toBeTruthy();
    expect(data.diff).toContain('-old');
    expect(data.diff).toContain('+new');
  });

  it('honours createOnly', async () => {
    await write('a.ts', 'old\n');
    const outcome = await registry.execute(
      'write_file',
      { path: 'a.ts', content: 'new\n', createOnly: true },
      makeContext(),
    );
    expect(outcome.result.ok).toBe(false);
    expect(outcome.result.error?.code).toBe('already_exists');
    expect(await read('a.ts')).toBe('old\n');
  });

  it('records reason, lineCount, and sizeBytes when creating a file with write_file', async () => {
    const outcome = await registry.execute(
      'write_file',
      { path: 'header.tsx', content: 'export const Header = () => <div>Header</div>;\n', reason: 'needed for the new page layout' },
      makeContext(),
    );
    expect(outcome.result.ok).toBe(true);
    expect(outcome.result.output).toContain('Why: needed for the new page layout');
    expect(outcome.result.data).toMatchObject({
      created: true,
      reason: 'needed for the new page layout',
      lineCount: 2,
    });
  });

  it('records reason when patching a file with patch_file', async () => {
    await write('widget.tsx', 'const a = 1;\n');
    const outcome = await registry.execute(
      'patch_file',
      {
        path: 'widget.tsx',
        edits: [{ oldText: 'const a = 1;\n', newText: 'const a = 2;\n' }],
        reason: 'updating constant value',
      },
      makeContext(),
    );
    expect(outcome.result.ok).toBe(true);
    expect(outcome.result.output).toContain('Why: updating constant value');
    expect(outcome.result.data).toMatchObject({
      changed: true,
      reason: 'updating constant value',
    });
  });

  it('records reason when reading a file with read_file', async () => {
    await write('config.json', '{\n  "version": "1.0"\n}\n');
    const outcome = await registry.execute(
      'read_file',
      { path: 'config.json', reason: 'inspecting version property' },
      makeContext(),
    );
    expect(outcome.result.ok).toBe(true);
    expect(outcome.result.output).toContain('Why: inspecting version property');
    expect(outcome.result.data).toMatchObject({
      reason: 'inspecting version property',
      totalLines: 3,
    });
  });
});

describe('registry path safety', () => {
  it('refuses paths that escape the project root', async () => {
    const outcome = await registry.execute('read_file', { path: '../../etc/passwd' }, makeContext());
    expect(outcome.result.ok).toBe(false);
    expect(outcome.result.error?.code).toBe('path_escape');
  });

  it('returns a failed result for an unknown tool rather than throwing', async () => {
    const outcome = await registry.execute('does_not_exist', {}, makeContext());
    expect(outcome.result.ok).toBe(false);
    expect(outcome.result.error?.code).toBe('unknown_tool');
  });

  it('validates input and reports the offending field', async () => {
    const outcome = await registry.execute('read_file', { path: 42 }, makeContext());
    expect(outcome.result.ok).toBe(false);
    expect(outcome.result.error?.code).toBe('invalid_input');
  });
});
