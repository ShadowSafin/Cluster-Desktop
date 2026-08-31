import path from 'node:path';
import fs from 'node:fs/promises';
import type { PackageManager, ProjectKind } from '@cluster/shared';

export interface ManifestInfo {
  kind: ProjectKind;
  packageManager: PackageManager | null;
  name: string | null;
  scripts: Record<string, string>;
}

const EMPTY: ManifestInfo = { kind: 'unknown', packageManager: null, name: null, scripts: {} };

async function readJson(root: string, file: string): Promise<Record<string, unknown> | null> {
  try {
    const raw = await fs.readFile(path.join(root, file), 'utf8');
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

async function detectPackageManager(root: string): Promise<PackageManager | null> {
  const locks: Array<[string, PackageManager]> = [
    ['bun.lockb', 'bun'],
    ['bun.lock', 'bun'],
    ['pnpm-lock.yaml', 'pnpm'],
    ['yarn.lock', 'yarn'],
    ['package-lock.json', 'npm'],
  ];
  for (const [file, manager] of locks) {
    try {
      await fs.access(path.join(root, file));
      return manager;
    } catch {
      // continue
    }
  }
  return null;
}

function scriptsFrom(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object') return {};
  const out: Record<string, string> = {};
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    if (typeof entry === 'string') out[key] = entry;
  }
  return out;
}

/**
 * Read whichever manifest is present at the project root. Manifests are
 * advisory: a missing or malformed manifest must never break startup, so every
 * read is best-effort.
 */
export async function readManifest(root: string, manifests: string[]): Promise<ManifestInfo> {
  if (manifests.includes('package.json')) {
    const pkg = await readJson(root, 'package.json');
    if (pkg) {
      const name = typeof pkg['name'] === 'string' ? pkg['name'] : null;
      const declared = typeof pkg['packageManager'] === 'string' ? pkg['packageManager'] : null;
      const lockManager = await detectPackageManager(root);
      const manager = declared ? (declared.split('@')[0] as PackageManager) : lockManager;
      return { kind: 'node', packageManager: manager, name, scripts: scriptsFrom(pkg['scripts']) };
    }
  }

  if (manifests.includes('pyproject.toml')) {
    try {
      const raw = await fs.readFile(path.join(root, 'pyproject.toml'), 'utf8');
      const name = /^\s*name\s*=\s*["']([^"']+)["']/m.exec(raw)?.[1] ?? null;
      const poetry = /\[tool\.poetry\]/.test(raw);
      const manager: PackageManager = poetry ? 'poetry' : 'pip';
      return { kind: 'python', packageManager: manager, name, scripts: {} };
    } catch {
      return { ...EMPTY, kind: 'python', packageManager: 'pip' };
    }
  }

  if (manifests.includes('go.mod')) {
    try {
      const raw = await fs.readFile(path.join(root, 'go.mod'), 'utf8');
      const name = /^module\s+(\S+)/m.exec(raw)?.[1] ?? null;
      return { kind: 'go', packageManager: 'go', name, scripts: {} };
    } catch {
      return { ...EMPTY, kind: 'go', packageManager: 'go' };
    }
  }

  if (manifests.includes('Cargo.toml')) {
    try {
      const raw = await fs.readFile(path.join(root, 'Cargo.toml'), 'utf8');
      const name = /^\s*name\s*=\s*["']([^"']+)["']/m.exec(raw)?.[1] ?? null;
      return { kind: 'rust', packageManager: 'cargo', name, scripts: {} };
    } catch {
      return { ...EMPTY, kind: 'rust', packageManager: 'cargo' };
    }
  }

  return EMPTY;
}
