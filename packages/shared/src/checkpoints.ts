/**
 * Checkpoint and diff workflow types.
 */

export interface PatchHunk {
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  header: string;
  lines: Array<{ type: 'context' | 'add' | 'remove'; text: string }>;
  summary: string;
}

export interface FilePatch {
  path: string;
  oldContent?: string;
  newContent: string;
  diff: string;
  hunks: PatchHunk[];
  additions: number;
  deletions: number;
  risk: 'safe' | 'caution' | 'destructive';
  riskReason?: string;
}

export interface Checkpoint {
  id: string;
  sessionId: string;
  projectRoot: string;
  message: string;
  createdAt: string;
  /** Git HEAD at checkpoint time, if available. */
  gitHead?: string | null;
  /** Snapshot of file contents at checkpoint. */
  files: Array<{ path: string; content: string; hash: string }>;
  /** Task graph snapshot at checkpoint. */
  taskGraphId?: string | null;
}

export interface PatchHistoryEntry {
  id: string;
  sessionId: string;
  toolCallId?: string;
  taskId?: string;
  patches: FilePatch[];
  appliedAt: string;
  checkpointId?: string;
  revertedAt?: string | null;
}

export interface DiffReviewState {
  patches: FilePatch[];
  selectedHunks: Set<string>; // "path:hunkIndex"
  mode: 'unified' | 'side-by-side';
  history: PatchHistoryEntry[];
  currentCheckpoint?: Checkpoint | null;
}
