import path from 'node:path';
import fs from 'node:fs/promises';
import { createId, nowIso, type PatchHistoryEntry, type FilePatch, diffLines } from '@cluster/shared';
import { clusterHome } from '@cluster/shared';

/**
 * Patch history and diff review flows.
 *
 * - Every write produces a clear diff representation
 * - Change grouping by file
 * - Patch history, accept/reject hunks
 * - Diff stays readable even for large changes via chunking + summaries
 */

function historyRoot(home = clusterHome()): string {
  return path.join(home, 'patch-history');
}

function historyFile(sessionId: string, home = clusterHome()): string {
  return path.join(historyRoot(home), `${sessionId}.json`);
}

async function readHistory(sessionId: string, home = clusterHome()): Promise<PatchHistoryEntry[]> {
  try {
    const raw = await fs.readFile(historyFile(sessionId, home), 'utf8');
    return JSON.parse(raw) as PatchHistoryEntry[];
  } catch {
    return [];
  }
}

async function writeHistory(sessionId: string, entries: PatchHistoryEntry[], home = clusterHome()): Promise<void> {
  await fs.mkdir(historyRoot(home), { recursive: true });
  await fs.writeFile(historyFile(sessionId, home), JSON.stringify(entries, null, 2), 'utf8');
}

export async function recordPatch(options: {
  sessionId: string;
  toolCallId?: string;
  taskId?: string;
  patches: FilePatch[];
  checkpointId?: string;
  home?: string;
}): Promise<PatchHistoryEntry> {
  const entry: PatchHistoryEntry = {
    id: createId('patch'),
    sessionId: options.sessionId,
    toolCallId: options.toolCallId,
    taskId: options.taskId,
    patches: options.patches,
    appliedAt: nowIso(),
    checkpointId: options.checkpointId,
    revertedAt: null,
  };
  const history = await readHistory(options.sessionId, options.home);
  history.unshift(entry);
  // Bound history
  if (history.length > 100) history.splice(100);
  await writeHistory(options.sessionId, history, options.home);
  return entry;
}

export async function listPatchHistory(sessionId: string, home = clusterHome()): Promise<PatchHistoryEntry[]> {
  return readHistory(sessionId, home);
}

export async function markReverted(sessionId: string, patchId: string, home = clusterHome()): Promise<void> {
  const history = await readHistory(sessionId, home);
  const entry = history.find((e) => e.id === patchId);
  if (entry) {
    entry.revertedAt = nowIso();
    await writeHistory(sessionId, history, home);
  }
}

/** Create FilePatch from diff text */
export function createFilePatch(filePath: string, oldContent: string, newContent: string, diff: string): FilePatch {
  const { additions, deletions } = diffLines(oldContent, newContent);
  // Parse hunks summaries
  const lines = diff.split('\n');
  const hunkHeaders = lines.filter((l) => l.startsWith('@@'));
  const hunks = hunkHeaders.map((header) => {
    const match = /^@@\s+-(\d+),?(\d*)\s+\+(\d+),?(\d*)\s+@@(.*)/.exec(header);
    return {
      oldStart: match ? Number(match[1]) : 0,
      oldLines: match && match[2] ? Number(match[2]) : 0,
      newStart: match ? Number(match[3]) : 0,
      newLines: match && match[4] ? Number(match[4]) : 0,
      header,
      lines: [] as Array<{ type: 'context' | 'add' | 'remove'; text: string }>,
      summary: header.trim(),
    };
  });

  // Simple risk heuristic
  let risk: FilePatch['risk'] = 'safe';
  let riskReason: string | undefined;
  if (filePath.endsWith('.env') || filePath.includes('secret')) {
    risk = 'destructive';
    riskReason = 'Sensitive file';
  } else if (additions + deletions > 300) {
    risk = 'caution';
    riskReason = 'Large change';
  } else if (oldContent === '' && newContent !== '') {
    risk = 'caution';
    riskReason = 'New file creation';
  }

  return {
    path: filePath,
    oldContent,
    newContent,
    diff,
    hunks,
    additions,
    deletions,
    risk,
    riskReason,
  };
}

/** Group patches by file for UI */
export function groupPatchesByFile(patches: FilePatch[]): Map<string, FilePatch[]> {
  const map = new Map<string, FilePatch[]>();
  for (const p of patches) {
    const arr = map.get(p.path) ?? [];
    arr.push(p);
    map.set(p.path, arr);
  }
  return map;
}

/** Accept/reject hunks: filter diff to only selected hunks */
export function filterHunks(patch: FilePatch, selectedHunkIndexes: Set<number>): FilePatch {
  if (selectedHunkIndexes.size === 0) return { ...patch, diff: '', hunks: [], additions: 0, deletions: 0 };
  const selected = patch.hunks.filter((_, idx) => selectedHunkIndexes.has(idx));
  const diff = [`--- a/${patch.path}`, `+++ b/${patch.path}`, ...selected.map((h) => h.header)].join('\n');
  return { ...patch, hunks: selected, diff };
}

export function summarizePatches(patches: FilePatch[]): string {
  const totalAdd = patches.reduce((sum, p) => sum + p.additions, 0);
  const totalDel = patches.reduce((sum, p) => sum + p.deletions, 0);
  const files = patches.map((p) => `${p.path} +${p.additions} -${p.deletions}${p.risk !== 'safe' ? ` (${p.risk}: ${p.riskReason})` : ''}`).join('\n');
  return `${patches.length} files changed (+${totalAdd} -${totalDel}):\n${files}`;
}
