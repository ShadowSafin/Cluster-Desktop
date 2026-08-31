import path from 'node:path';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import { createId, nowIso, type Checkpoint } from '@cluster/shared';
import { clusterHome } from '@cluster/shared';
import { execa } from 'execa';

/**
 * Checkpoint-based rollback.
 *
 * Every write should produce a clear diff representation,
 * and reverting to a previous state is possible without manual repair.
 * Checkpoints are stored under ~/.cluster/checkpoints/<session>/<checkpointId>
 * with file snapshots.
 */

function checkpointsRoot(home = clusterHome()): string {
  return path.join(home, 'checkpoints');
}

function checkpointDir(sessionId: string, checkpointId: string, home = clusterHome()): string {
  return path.join(checkpointsRoot(home), sessionId, checkpointId);
}

function hashContent(content: string): string {
  return crypto.createHash('sha256').update(content).digest('hex').slice(0, 12);
}

export async function createCheckpoint(options: {
  sessionId: string;
  projectRoot: string;
  message?: string;
  files?: string[]; // if not provided, snapshot tracked files via git or filesystem
  home?: string;
}): Promise<Checkpoint> {
  const id = createId('chk');
  const dir = checkpointDir(options.sessionId, id, options.home);
  await fs.mkdir(dir, { recursive: true });

  // Try to capture git HEAD
  let gitHead: string | null = null;
  try {
    const res = await execa('git', ['rev-parse', '--short', 'HEAD'], { cwd: options.projectRoot, reject: false, timeout: 3000 });
    if (res.exitCode === 0) gitHead = res.stdout.trim();
  } catch {
    // ignore
  }

  const files: Checkpoint['files'] = [];

  if (options.files && options.files.length > 0) {
    for (const file of options.files) {
      const abs = path.isAbsolute(file) ? file : path.join(options.projectRoot, file);
      try {
        const content = await fs.readFile(abs, 'utf8');
        const hash = hashContent(content);
        const rel = path.relative(options.projectRoot, abs);
        files.push({ path: rel, content, hash });
        // Also write snapshot to dir for recovery
        const snapshotPath = path.join(dir, rel);
        await fs.mkdir(path.dirname(snapshotPath), { recursive: true });
        await fs.writeFile(snapshotPath, content, 'utf8');
      } catch {
        // skip unreadable
      }
    }
  } else {
    // Snapshot all tracked files via git ls-files or via fast-glob limited
    try {
      const res = await execa('git', ['ls-files'], { cwd: options.projectRoot, reject: false, timeout: 4000 });
      const tracked = res.exitCode === 0 ? res.stdout.split('\n').filter(Boolean).slice(0, 200) : [];
      for (const rel of tracked) {
        const abs = path.join(options.projectRoot, rel);
        try {
          const content = await fs.readFile(abs, 'utf8');
          const hash = hashContent(content);
          files.push({ path: rel, content, hash });
          const snapshotPath = path.join(dir, rel);
          await fs.mkdir(path.dirname(snapshotPath), { recursive: true });
          await fs.writeFile(snapshotPath, content, 'utf8');
        } catch {
          // binary or unreadable skip
        }
      }
    } catch {
      // fallback: no files
    }
  }

  const checkpoint: Checkpoint = {
    id,
    sessionId: options.sessionId,
    projectRoot: options.projectRoot,
    message: options.message ?? `Checkpoint ${id.slice(0, 8)}`,
    createdAt: nowIso(),
    gitHead,
    files,
  };

  // Persist metadata
  await fs.writeFile(path.join(dir, 'meta.json'), JSON.stringify(checkpoint, null, 2), 'utf8');

  // Also write index for listing
  const indexPath = path.join(checkpointsRoot(options.home), options.sessionId, 'index.json');
  let index: Checkpoint[] = [];
  try {
    const raw = await fs.readFile(indexPath, 'utf8');
    index = JSON.parse(raw) as Checkpoint[];
  } catch {
    index = [];
  }
  index.unshift({ ...checkpoint, files: [] }); // index stores without full content to keep size low, but we keep hash
  // Keep full checkpoint files separately, but index references metadata
  // Actually store full for simplicity, but truncate files in index
  await fs.mkdir(path.dirname(indexPath), { recursive: true });
  await fs.writeFile(indexPath, JSON.stringify(index.map((c) => ({ ...c, files: c.files.slice(0, 0) })), null, 2), 'utf8');
  // Store full checkpoint separately via meta already

  return checkpoint;
}

export async function listCheckpoints(sessionId: string, home = clusterHome()): Promise<Checkpoint[]> {
  const dir = path.join(checkpointsRoot(home), sessionId);
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    const checks: Checkpoint[] = [];
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      try {
        const meta = await fs.readFile(path.join(dir, entry.name, 'meta.json'), 'utf8');
        checks.push(JSON.parse(meta) as Checkpoint);
      } catch {
        continue;
      }
    }
    return checks.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  } catch {
    return [];
  }
}

export async function getCheckpoint(sessionId: string, checkpointId: string, home = clusterHome()): Promise<Checkpoint | null> {
  try {
    const raw = await fs.readFile(path.join(checkpointDir(sessionId, checkpointId, home), 'meta.json'), 'utf8');
    return JSON.parse(raw) as Checkpoint;
  } catch {
    return null;
  }
}

/**
 * Rollback to checkpoint: restore file contents.
 * Returns list of restored files.
 */
export async function rollbackToCheckpoint(options: {
  sessionId: string;
  checkpointId: string;
  projectRoot: string;
  home?: string;
}): Promise<{ restored: string[]; errors: Array<{ path: string; error: string }> }> {
  const checkpoint = await getCheckpoint(options.sessionId, options.checkpointId, options.home);
  if (!checkpoint) throw new Error(`Checkpoint ${options.checkpointId} not found`);

  const restored: string[] = [];
  const errors: Array<{ path: string; error: string }> = [];

  for (const file of checkpoint.files) {
    const abs = path.join(options.projectRoot, file.path);
    try {
      await fs.mkdir(path.dirname(abs), { recursive: true });
      await fs.writeFile(abs, file.content, 'utf8');
      restored.push(file.path);
    } catch (error) {
      errors.push({ path: file.path, error: (error as Error).message });
    }
  }

  return { restored, errors };
}

/** Visual indication of risky edits: classify a patch's risk. */
export function assessPatchRisk(diff: string, filePath: string): { risk: Checkpoint['files'] extends Array<unknown> ? string : string; reason?: string } {
  const lower = filePath.toLowerCase();
  if (lower.includes('.env') || lower.includes('credentials') || lower.endsWith('.pem') || lower.endsWith('.key')) {
    return { risk: 'destructive', reason: 'Sensitive file' };
  }
  if (diff.split('\n').length > 500) {
    return { risk: 'caution', reason: 'Large change (>500 lines)' };
  }
  if (/DROP\s+TABLE|DELETE\s+FROM|rm\s+-rf/i.test(diff)) {
    return { risk: 'destructive', reason: 'Contains destructive operation' };
  }
  if (diff.includes('package.json') || diff.includes('lock')) {
    return { risk: 'caution', reason: 'Dependency manifest' };
  }
  return { risk: 'safe' };
}

export async function deleteCheckpoint(sessionId: string, checkpointId: string, home = clusterHome()): Promise<void> {
  const dir = checkpointDir(sessionId, checkpointId, home);
  await fs.rm(dir, { recursive: true, force: true });
}
