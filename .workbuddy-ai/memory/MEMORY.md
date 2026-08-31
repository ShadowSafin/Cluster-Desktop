# Cluster CLI — project memory

## Identity

- **Package name**: `cluster-cli` (root) — the CLI name users actually type (`cluster`).
- **Internal namespace**: `@cluster/*` (shared, agent-core, tool-runtime, workspace, storage, tui).
- **Engine**: Node ≥ 20.10, ESM-only, TypeScript ≥ 5.7 with project references.
- **Default model**: `gpt-4o-mini`. Provider is OpenAI-compatible; any base URL works.
- **Storage root**: `~/.cluster` (override with `CLUSTER_HOME`). Sessions live at `~/.cluster/sessions.json`; backups at `~/.cluster/backups/`.

## Architectural conventions

- TUI does **not** contain business logic. UI calls `bootstrap` → which wires `agent-core` + `tool-runtime` + `workspace` + `storage`, then renders the event stream.
- Tools always return `ToolResult` (typed `{ ok, output, data?, error? }`) — they never throw to the user. Errors carry `code`/`hint`.
- Risk classification lives only in `packages/tool-runtime/src/safety.ts`; both command and path classifiers are exportable from there.
- File edits always go through `tool-runtime/util.backupFile` so bad patches can be rolled back.
- Sessions use **lowdb JSON** (`sessions.json`) — chosen to keep the dep tree small and avoid native binding rebuilds on Windows.
- `agent-core` decides the tool protocol (`auto`/`native`/`text`) and silently downgrades when an endpoint rejects function calling.

## Conventions I should follow next session

- Tests are colocated as `*.test.ts` next to the module. They are **real** tests — no shallow mocks of the system under test.
- TypeScript build is project-references-based (`tsc -b`); `npm run rebuild` does `--force`.
- Run order for verification: `npm run typecheck` → `npm test` → `node apps/tui/dist/cli.js doctor`.
- The CLI exits with `process.exitCode = 1`, never `process.exit`, so Ink can still flush.

## Known gotchas

- `safety.classifyPath` previously missed hyphenated lockfiles (`package-lock.json`); fixed 2026-08-31.
- `util.readTextFile` previously masked `EISDIR` errors; fixed 2026-08-31 — directory reads now throw a real EISDIR.
- `.tmp-probe/` exists in the workspace; was used during early bootstrap to probe process.cwd behaviour. Safe to delete but harmless.
