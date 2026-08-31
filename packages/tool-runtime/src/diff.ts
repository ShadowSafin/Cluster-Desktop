/**
 * Stronger diff workflow: side-by-side, inline hunk summaries,
 * change grouping by file, risk assessment.
 */

import { diffLines, formatUnifiedDiff, parseUnifiedDiff, type DiffResult } from '@cluster/shared';
import { classifyPath } from './safety.js';

export interface HunkSummary {
  index: number;
  header: string;
  additions: number;
  deletions: number;
  files: string;
  preview: string;
}

export interface FileDiffSummary {
  path: string;
  additions: number;
  deletions: number;
  hunks: HunkSummary[];
  risk: 'safe' | 'caution' | 'destructive';
  riskReason?: string;
  diff: string;
}

export function summarizeDiff(path: string, oldText: string, newText: string): FileDiffSummary {
  const result = diffLines(oldText, newText);
  const diff = formatUnifiedDiff(path, oldText, newText);
  const hunks: HunkSummary[] = result.hunks.map((hunk, idx) => {
    const adds = hunk.lines.filter((l) => l.type === 'add').length;
    const dels = hunk.lines.filter((l) => l.type === 'remove').length;
    const preview = hunk.lines
      .filter((l) => l.type !== 'context')
      .slice(0, 3)
      .map((l) => `${l.type === 'add' ? '+' : '-'}${l.text.slice(0, 60)}`)
      .join(' | ');
    return {
      index: idx,
      header: `@@ -${hunk.oldStart},${hunk.oldLines} +${hunk.newStart},${hunk.newLines} @@`,
      additions: adds,
      deletions: dels,
      files: path,
      preview: preview.slice(0, 120),
    };
  });

  const { risk, reason } = assessRisk(path, diff, result);
  return {
    path,
    additions: result.additions,
    deletions: result.deletions,
    hunks,
    risk,
    riskReason: reason,
    diff,
  };
}

function assessRisk(path: string, diff: string, result: DiffResult): { risk: FileDiffSummary['risk']; reason?: string } {
  const pathRisk = classifyPath(path);
  if (pathRisk.risk === 'destructive') return { risk: 'destructive', reason: pathRisk.reason };
  if (result.additions + result.deletions > 400) return { risk: 'caution', reason: 'Large change (>400 lines)' };
  if (diff.includes('DROP') || diff.includes('TRUNCATE') || /rm\s+-rf/.test(diff)) return { risk: 'destructive', reason: 'Destructive operation in diff' };
  if (pathRisk.risk === 'caution') return { risk: 'caution', reason: pathRisk.reason };
  if (path.toLowerCase().includes('migration') || path.toLowerCase().includes('schema')) return { risk: 'caution', reason: 'Schema/migration file' };
  return { risk: 'safe' };
}

export interface SideBySideLine {
  leftNo: number | null;
  rightNo: number | null;
  left: string;
  right: string;
  type: 'context' | 'add' | 'remove' | 'empty';
}

export function toSideBySide(oldText: string, newText: string): SideBySideLine[] {
  const { hunks } = diffLines(oldText, newText);
  const rows: SideBySideLine[] = [];
  for (const hunk of hunks) {
    for (const line of hunk.lines) {
      if (line.type === 'context') {
        rows.push({ leftNo: line.oldLineNo, rightNo: line.newLineNo, left: line.text, right: line.text, type: 'context' });
      } else if (line.type === 'remove') {
        rows.push({ leftNo: line.oldLineNo, rightNo: null, left: line.text, right: '', type: 'remove' });
      } else {
        rows.push({ leftNo: null, rightNo: line.newLineNo, left: '', right: line.text, type: 'add' });
      }
    }
  }
  return rows;
}

export function groupByFile(summaries: FileDiffSummary[]): Map<string, FileDiffSummary> {
  const map = new Map<string, FileDiffSummary>();
  for (const s of summaries) map.set(s.path, s);
  return map;
}

export function formatHunkSummary(hunk: HunkSummary): string {
  return `Hunk ${hunk.index + 1}: ${hunk.header} (+${hunk.additions} -${hunk.deletions}) — ${hunk.preview}`;
}

export function isLargeDiff(diff: string, threshold = 500): boolean {
  return diff.split('\n').length > threshold;
}

export function truncateDiff(diff: string, maxLines = 200): { text: string; truncated: boolean } {
  const lines = diff.split('\n');
  if (lines.length <= maxLines) return { text: diff, truncated: false };
  const head = Math.floor(maxLines * 0.6);
  const tail = maxLines - head - 1;
  const truncated = `… ${lines.length - maxLines} lines omitted …`;
  return { text: [...lines.slice(0, head), truncated, ...lines.slice(lines.length - tail)].join('\n'), truncated: true };
}
