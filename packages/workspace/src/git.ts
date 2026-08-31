import { execa } from 'execa';
import type { GitState } from '@cluster/shared';

/**
 * Git integration.
 *
 * Deliberately shelling out to `git` rather than depending on a git library:
 * the CLI is always available in a repository the user is working in, and this
 * keeps the install free of native modules.
 */

const TIMEOUT_MS = 8_000;

async function git(cwd: string, args: string[]): Promise<{ ok: boolean; stdout: string }> {
  try {
    const result = await execa('git', args, {
      cwd,
      timeout: TIMEOUT_MS,
      reject: false,
      all: false,
      windowsHide: true,
    });
    return { ok: result.exitCode === 0, stdout: result.stdout ?? '' };
  } catch {
    return { ok: false, stdout: '' };
  }
}

export async function isGitRepository(cwd: string): Promise<boolean> {
  const result = await git(cwd, ['rev-parse', '--is-inside-work-tree']);
  return result.ok && result.stdout.trim() === 'true';
}

function parsePorcelain(stdout: string): { staged: number; unstaged: number; untracked: number } {
  let staged = 0;
  let unstaged = 0;
  let untracked = 0;

  for (const line of stdout.split('\n')) {
    if (line.length < 2) continue;
    const indexStatus = line[0]!;
    const worktreeStatus = line[1]!;

    if (indexStatus === '?' && worktreeStatus === '?') {
      untracked += 1;
      continue;
    }
    if (indexStatus === '!') continue; // ignored
    if (indexStatus !== ' ') staged += 1;
    if (worktreeStatus !== ' ') unstaged += 1;
  }

  return { staged, unstaged, untracked };
}

export async function readGitState(cwd: string): Promise<GitState | null> {
  if (!(await isGitRepository(cwd))) return null;

  const [branchResult, headResult, statusResult, logResult] = await Promise.all([
    git(cwd, ['rev-parse', '--abbrev-ref', 'HEAD']),
    git(cwd, ['rev-parse', '--short', 'HEAD']),
    git(cwd, ['status', '--porcelain']),
    git(cwd, ['log', '-1', '--pretty=%s']),
  ]);

  const branch = branchResult.ok ? branchResult.stdout.trim() : 'unknown';
  const counts = parsePorcelain(statusResult.stdout);

  return {
    type: 'git',
    branch: branch === 'HEAD' ? `detached@${headResult.stdout.trim() || 'unknown'}` : branch,
    head: headResult.ok ? headResult.stdout.trim() || null : null,
    dirty: counts.staged + counts.unstaged + counts.untracked > 0,
    staged: counts.staged,
    unstaged: counts.unstaged,
    untracked: counts.untracked,
    lastCommit: logResult.ok ? logResult.stdout.trim() || null : null,
  };
}

/** Raw `git status --porcelain` output, for tools that need the file list. */
export async function readGitPorcelain(cwd: string): Promise<string | null> {
  if (!(await isGitRepository(cwd))) return null;
  const result = await git(cwd, ['status', '--porcelain']);
  return result.ok ? result.stdout.trimEnd() : null;
}

/**
 * Short, one-line description of the working tree, shown in the status bar.
 * e.g. `main* +3 ~2 ?1`
 */
export function formatGitState(git: GitState | null): string {
  if (!git) return 'no git';
  const parts: string[] = [git.dirty ? `${git.branch}*` : git.branch];
  if (git.staged > 0) parts.push(`+${git.staged}`);
  if (git.unstaged > 0) parts.push(`~${git.unstaged}`);
  if (git.untracked > 0) parts.push(`?${git.untracked}`);
  return parts.join(' ');
}
