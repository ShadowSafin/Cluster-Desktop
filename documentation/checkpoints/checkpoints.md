# Checkpoints & Rollback

## Overview

Checkpoints are file-level snapshots that let you restore a project to a previous state. They are stored under `~/.cluster/checkpoints/` and are tied to a specific session.

## Storage Layout

```
~/.cluster/checkpoints/
└── <sessionId>/
    ├── index.json              ← Listing of all checkpoints (metadata only)
    └── <checkpointId>/
        ├── meta.json           ← Full checkpoint metadata
        └── <relative-file-path>  ← Snapshotted file contents
            e.g., src/auth.ts
            e.g., package.json
```

## Creating a Checkpoint

```typescript
async function createCheckpoint(options: {
  sessionId: string;
  projectRoot: string;
  message?: string;       // e.g., "Before auth middleware implementation"
  files?: string[];       // Optional: specific files to snapshot
  home?: string;          // Override storage home
}): Promise<Checkpoint>
```

### Creation Process

1. Generate unique ID: `createId('chk')`
2. Create snapshot directory
3. Try to capture git HEAD: `git rev-parse --short HEAD`
4. Determine files to snapshot:
   - If `files` provided: snapshot only those files
   - Otherwise: `git ls-files` to get tracked files (max 200)
5. For each file:
   - Read content
   - Compute SHA-256 hash (first 12 chars)
   - Write snapshot to checkpoint directory (preserving relative path structure)
6. Write `meta.json`:
   ```json
   {
     "id": "chk_x1y2z3",
     "sessionId": "sess_abc",
     "projectRoot": "/path/to/project",
     "message": "Before auth middleware",
     "createdAt": "2026-09-03T00:00:00Z",
     "gitHead": "abc1234",
     "files": [
       { "path": "src/auth.ts", "content": "...", "hash": "a1b2c3d4e5f6" },
       { "path": "package.json", "content": "...", "hash": "f6e5d4c3b2a1" }
     ]
   }
   ```
7. Write `index.json` (listing all checkpoints for the session, without full file contents)

## Rolling Back

```typescript
async function rollbackToCheckpoint(options: {
  sessionId: string;
  checkpointId: string;
  projectRoot: string;
  home?: string;
}): Promise<{ restored: string[]; errors: Array<{ path: string; error: string }> }>
```

### Rollback Process

1. Read `meta.json` from checkpoint directory
2. For each file in the checkpoint:
   - Construct absolute path: `path.join(projectRoot, file.path)`
   - Create parent directories if needed
   - Overwrite with checkpoint content
3. Collect results:
   - `restored`: successfully restored file paths
   - `errors`: any failures with path and error message

### Important Notes

- Rollback **overwrites** current files — there is no "undo" within a rollback
- Untracked files not in the checkpoint are NOT affected
- If the checkpoint was taken from a git repo, you can also use `git checkout <gitHead>` as an alternative
- Checkpoint metadata stores the git HEAD at time of creation, enabling git-based rollback

---

## Checkpoint Assessment

### Risk Classification for Patches

```typescript
function assessPatchRisk(diff: string, filePath: string): { risk: string; reason?: string }
```

| Condition | Risk | Reason |
|-----------|------|--------|
| Path contains `.env`, `credentials`, `.pem`, `.key` | `destructive` | Sensitive file |
| Diff exceeds 500 lines | `caution` | Large change |
| Diff contains `DROP TABLE`, `DELETE FROM`, `rm -rf` | `destructive` | Destructive operation |
| Diff touches `package.json` or lock files | `caution` | Dependency manifest |
| None of the above | `safe` | — |

This is used by the UI to show risk indicators next to diff cards.

---

## Checkpoint Operations via IPC

| IPC Channel | Method | Description |
|-------------|--------|-------------|
| `checkpoints:list` | `invoke` | List all checkpoints for a session |
| `checkpoints:create` | `invoke` | Create a new checkpoint |
| `checkpoints:rollback` | `invoke` | Restore files from a checkpoint |

---

## Keyboard Shortcut

**Ctrl+G** creates an instant checkpoint with a timestamp message:
```
"Snapshot @ HH:MM:SS"
```

---

## Lifecycle: Checkpoint → Rollback → Recovery

```
User starts task
    │
    ▼
[Optional] Manual checkpoint (Ctrl+G)
    │
    ▼
Agent executes (reads, writes, patches)
    │
    ├─ Before each coder task: auto-checkpoint created (multi-agent mode)
    │
    ▼
User reviews diffs in Diffs page
    │
    ├─ [If unhappy] Open Checkpoints page → select checkpoint → Rollback
    │   └─ Files restored to checkpoint state
    │
    └─ [If happy] Continue with new task
        └─ New checkpoint may be created before next round of edits
```

---

## Current Limitations

| Limitation | Details |
|-----------|---------|
| Git-only tracked files | By default, only `git ls-files` results are snapshot. Untracked files are skipped unless explicitly listed |
| No partial rollback | You restore ALL files in the checkpoint, not selected ones |
| Content stored inline | File contents are stored in `meta.json` and snapshot files — large repos can create large checkpoints |
| No compression | Files are stored uncompressed |
| In-memory job registry | Background jobs are not checkpointed; they restart on app relaunch |
