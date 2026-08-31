import fs from 'node:fs/promises';
import path from 'node:path';
import { toPosix } from '@cluster/shared';

/**
 * Pre-edit backups.
 *
 * Every write or patch takes a copy of the original bytes first. Backups are
 * content-addressed by path + timestamp so restoring is unambiguous even if a
 * file is edited several times in one session.
 */

export interface BackupRecord {
  /** Where the pre-change copy lives. */
  backupPath: string;
  /** Original path, relative to the project root when possible. */
  relativePath: string;
  createdAt: string;
}

function safeName(relativePath: string): string {
  return relativePath.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-80) || 'file';
}

export async function createBackup(
  root: string,
  backupsDir: string,
  absolutePath: string,
  content: string,
): Promise<BackupRecord> {
  const relativePath = toPosix(path.relative(root, absolutePath));
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = path.join(backupsDir, `${stamp}--${safeName(relativePath)}`);

  await fs.mkdir(backupsDir, { recursive: true });
  await fs.writeFile(backupPath, content, 'utf8');

  return { backupPath, relativePath, createdAt: new Date().toISOString() };
}

export async function listBackups(backupsDir: string): Promise<BackupRecord[]> {
  try {
    const entries = await fs.readdir(backupsDir, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isFile())
      .map((entry) => ({
        backupPath: path.join(backupsDir, entry.name),
        relativePath: entry.name,
        createdAt: new Date().toISOString(),
      }))
      .sort((a, b) => b.relativePath.localeCompare(a.relativePath));
  } catch {
    return [];
  }
}
