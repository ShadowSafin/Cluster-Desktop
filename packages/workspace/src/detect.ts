import path from 'node:path';
import fs from 'node:fs/promises';
import { toPosix } from '@cluster/shared';

/**
 * Project root detection.
 *
 * Walks up from `startDir` looking for the first directory that contains a
 * recognised project marker. Falls back to `startDir` so the tools always have
 * a well-defined root to reason about.
 */

const ROOT_MARKERS = [
  '.git',
  'package.json',
  'pyproject.toml',
  'go.mod',
  'Cargo.toml',
  'setup.py',
  'pom.xml',
  'build.gradle',
  'cluster.config.json',
];

async function exists(target: string): Promise<boolean> {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

export interface DetectResult {
  root: string;
  /** Marker that caused this directory to be chosen, if any. */
  marker: string | null;
  /** True when we fell back to `startDir` because nothing was found. */
  fallback: boolean;
}

export async function detectProjectRoot(startDir: string = process.cwd()): Promise<DetectResult> {
  let current = path.resolve(startDir);
  const { root: fsRoot } = path.parse(current);

  for (let depth = 0; depth < 64; depth += 1) {
    for (const marker of ROOT_MARKERS) {
      if (await exists(path.join(current, marker))) {
        return { root: current, marker, fallback: false };
      }
    }
    const parent = path.dirname(current);
    if (parent === current || current === fsRoot) break;
    current = parent;
  }

  return { root: path.resolve(startDir), marker: null, fallback: true };
}

/** Manifest files present directly at the project root. */
export async function findManifests(root: string): Promise<string[]> {
  const candidates = [
    'package.json',
    'pnpm-workspace.yaml',
    'tsconfig.json',
    'pyproject.toml',
    'setup.py',
    'requirements.txt',
    'go.mod',
    'Cargo.toml',
    'Makefile',
    'pom.xml',
    'build.gradle',
    'build.gradle.kts',
    'deno.json',
    'bun.lockb',
  ];

  const found: string[] = [];
  for (const candidate of candidates) {
    if (await exists(path.join(root, candidate))) found.push(candidate);
  }
  return found;
}

const LANGUAGE_BY_EXTENSION: Record<string, string> = {
  '.ts': 'TypeScript',
  '.tsx': 'TypeScript',
  '.mts': 'TypeScript',
  '.cts': 'TypeScript',
  '.js': 'JavaScript',
  '.jsx': 'JavaScript',
  '.mjs': 'JavaScript',
  '.cjs': 'JavaScript',
  '.py': 'Python',
  '.go': 'Go',
  '.rs': 'Rust',
  '.java': 'Java',
  '.kt': 'Kotlin',
  '.rb': 'Ruby',
  '.php': 'PHP',
  '.cs': 'C#',
  '.c': 'C',
  '.h': 'C',
  '.cpp': 'C++',
  '.hpp': 'C++',
  '.swift': 'Swift',
  '.sh': 'Shell',
  '.json': 'JSON',
  '.yaml': 'YAML',
  '.yml': 'YAML',
  '.toml': 'TOML',
  '.md': 'Markdown',
  '.css': 'CSS',
  '.scss': 'SCSS',
  '.html': 'HTML',
  '.sql': 'SQL',
};

export function languageForPath(filePath: string): string | null {
  return LANGUAGE_BY_EXTENSION[path.extname(filePath).toLowerCase()] ?? null;
}

export function languageForExtensionCount(counts: Map<string, number>): string[] {
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([language]) => language)
    .filter((language): language is string => Boolean(language));
}

export { toPosix };
