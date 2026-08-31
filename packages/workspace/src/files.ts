import path from 'node:path';
import fs from 'node:fs/promises';
import fg from 'fast-glob';
import { resolveWithin, toPosix } from '@cluster/shared';

/**
 * File discovery.
 *
 * Everything here is scoped to the project root and filtered by a default
 * ignore set merged with the repository's own `.gitignore`, so listing a large
 * monorepo stays fast and useful.
 */

export const DEFAULT_IGNORE: string[] = [
  '**/node_modules/**',
  '**/.git/**',
  '**/dist/**',
  '**/build/**',
  '**/out/**',
  '**/coverage/**',
  '**/.next/**',
  '**/.nuxt/**',
  '**/.turbo/**',
  '**/.svelte-kit/**',
  '**/target/**',
  '**/.venv/**',
  '**/venv/**',
  '**/__pycache__/**',
  '**/.pytest_cache/**',
  '**/.mypy_cache/**',
  '**/.cluster/**',
  '**/*.min.js',
  '**/*.map',
  '**/package-lock.json',
  '**/pnpm-lock.yaml',
  '**/yarn.lock',
  '**/bun.lockb',
  '**/*.png',
  '**/*.jpg',
  '**/*.jpeg',
  '**/*.gif',
  '**/*.ico',
  '**/*.svg',
  '**/*.woff',
  '**/*.woff2',
  '**/*.ttf',
  '**/*.mp4',
  '**/*.mp3',
  '**/*.zip',
  '**/*.gz',
  '**/*.pdf',
];

/** Translate .gitignore entries into fast-glob patterns. */
export function gitignoreToGlobPatterns(gitignore: string): string[] {
  const out: string[] = [];
  for (const rawLine of gitignore.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line === '' || line.startsWith('#') || line.startsWith('!')) continue;
    const normalized = line.replace(/^\//, '').replace(/\/$/, '');
    if (normalized === '') continue;
    out.push(`**/${normalized}`);
    out.push(`**/${normalized}/**`);
  }
  return out;
}

export async function loadIgnorePatterns(root: string): Promise<string[]> {
  const patterns = [...DEFAULT_IGNORE];
  try {
    const gitignore = await fs.readFile(path.join(root, '.gitignore'), 'utf8');
    patterns.push(...gitignoreToGlobPatterns(gitignore));
  } catch {
    // No .gitignore is not an error.
  }
  return patterns;
}

export interface ListFilesOptions {
  /** fast-glob pattern, defaults to every tracked-looking file. */
  pattern?: string;
  maxFiles?: number;
  ignore?: string[];
}

export interface ListFilesResult {
  files: string[];
  truncated: boolean;
  total: number;
}

export async function listFiles(root: string, options: ListFilesOptions = {}): Promise<ListFilesResult> {
  const maxFiles = options.maxFiles ?? 500;
  const ignore = options.ignore ?? (await loadIgnorePatterns(root));

  const entries = await fg(options.pattern ?? '**/*', {
    cwd: root,
    dot: false,
    onlyFiles: true,
    unique: true,
    followSymbolicLinks: false,
    suppressErrors: true,
    ignore,
  });

  entries.sort((a, b) => a.localeCompare(b));
  return { files: entries.map(toPosix), truncated: entries.length > maxFiles, total: entries.length };
}

export interface DirectoryEntry {
  name: string;
  relativePath: string;
  type: 'file' | 'directory' | 'symlink' | 'other';
  size: number | null;
}

export interface ListDirectoryResult {
  entries: DirectoryEntry[];
}

export async function listDirectory(
  root: string,
  relativePath = '.',
  options: { maxEntries?: number } = {},
): Promise<ListDirectoryResult> {
  const maxEntries = options.maxEntries ?? 200;
  const absolute = resolveWithin(root, relativePath);

  const dirents = await fs.readdir(absolute, { withFileTypes: true });
  const entries: DirectoryEntry[] = [];

  for (const dirent of dirents) {
    const relative = toPosix(path.relative(root, path.join(absolute, dirent.name)));
    let type: DirectoryEntry['type'] = 'other';
    if (dirent.isDirectory()) type = 'directory';
    else if (dirent.isFile()) type = 'file';
    else if (dirent.isSymbolicLink()) type = 'symlink';

    let size: number | null = null;
    if (type === 'file') {
      try {
        size = (await fs.stat(path.join(absolute, dirent.name))).size;
      } catch {
        size = null;
      }
    }
    entries.push({ name: dirent.name, relativePath: relative, type, size });
  }

  entries.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  return { entries: entries.slice(0, maxEntries) };
}
