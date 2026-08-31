import path from 'node:path';
import { clusterHome } from '@cluster/shared';

export interface StoragePaths {
  home: string;
  /** JSON database containing every session. */
  databaseFile: string;
  /** Where file backups taken before edits are stored. */
  backupsDir: string;
  checkpointsDir: string;
  patchHistoryDir: string;
  memoryDir: string;
}

export function resolveStoragePaths(home: string = clusterHome()): StoragePaths {
  return {
    home,
    databaseFile: path.join(home, 'sessions.json'),
    backupsDir: path.join(home, 'backups'),
    checkpointsDir: path.join(home, 'checkpoints'),
    patchHistoryDir: path.join(home, 'patch-history'),
    memoryDir: path.join(home, 'memory'),
  };
}
