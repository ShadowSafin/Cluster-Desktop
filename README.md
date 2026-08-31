# Cluster CLI

> A terminal-first AI coding assistant. Phase 1 — a reliable, single-agent MVP foundation.

Cluster CLI lives in your terminal, speaks to any OpenAI-compatible chat API, and edits code the same way you would: read, plan, patch, run, verify. The goal of this phase is not flashy features, but a foundation you can build on — modular packages, a clean agent loop, patch-based edits, live command streaming, and persistent sessions.

```
┌─ Cluster CLI ──────────────────────────────────────────────── · · ─┐
│  ● Cluster CLI · node/npm · main (dirty) · 2/40                  │
├───────────────────────────────────────────────────────────┤
│  you   add a `warmup` command to the cli that prints the  │
│        node version                                       │
│  Cluster CLI  ▸ I'll inspect the cli first, then add a warmup    │
│        command.                                           │
│        → read_file apps/tui/src/cli.ts                    │
│        ✓ read_file in 12ms                               │
│        → patch_file apps/tui/src/cli.ts                  │
│          + new "warmup" subcommand                        │
│          ✓ patch_file in 28ms                             │
│        → run_command node apps/tui/dist/cli.js warmup     │
│          $ cluster warmup                                   │
│          $ cluster 0.1.0                                    │
│          $ running on Node v22.22.2                       │
│          ✓ run_command in 410ms                           │
│  Cluster CLI  Added `cluster warmup` and verified it prints the    │
│        runtime version. 1 file changed.                   │
│                                                           │
├───────────────────────────────────────────────────────────┤
│  › add coverage with thresholds at 80% for lines          │
└───────────────────────────────────────────────────────────┘
```

## Quick start

```bash
# 1. Install (Node 20.10+).
npm install

# 2. Point Cluster CLI at any OpenAI-compatible endpoint.
cp .env.example .env
$EDITOR .env                   # set CLUSTER_API_KEY, CLUSTER_BASE_URL, CLUSTER_MODEL

# 3. Run a one-shot health check.
npm run build
node apps/tui/dist/cli.js doctor

# 4. Launch the TUI in this repo.
npm start                      # alias for: node apps/tui/dist/cli.js start
```

If you would rather pass values inline, the CLI accepts the same flags the config does:

```bash
node apps/tui/dist/cli.js start \
  --model gpt-4o-mini \
  --base-url https://api.openai.com/v1
```

You can also store values in `~/.cluster/config.json`:

```bash
node apps/tui/dist/cli.js config-set apiKey sk-...
node apps/tui/dist/cli.js config-set model gpt-4o-mini
```

## Commands

| Command                                  | What it does                                                            |
| ---------------------------------------- | ----------------------------------------------------------------------- |
| `cluster` / `cluster start`                    | Launch the interactive TUI in the current project.                      |
| `cluster resume [id]`                       | Resume a saved session (interactive picker if `id` is omitted).          |
| `cluster sessions`                          | List saved sessions for the current project (or `--all` for everything).|
| `cluster config`                            | Print the resolved configuration after merging all layers.              |
| `cluster config-get <key>` / `config-set`   | Read or write a single key in `~/.cluster/config.json`.                    |
| `cluster doctor [--ping]`                   | Check the runtime, project, config, storage and tool registry. Add `--ping` to also hit the model endpoint. |

Run any of them with `--help` for the full flag list.

## Configuration

Cluster CLI has exactly four layers of configuration, applied in order of increasing priority:

1. Built-in defaults (`gpt-4o-mini`, 120s command timeout, 40 iterations, …).
2. Environment variables — `CLUSTER_API_KEY`, `CLUSTER_BASE_URL`, `CLUSTER_MODEL`, `CLUSTER_TOOL_MODE`, `CLUSTER_MAX_ITERATIONS`, `CLUSTER_COMMAND_TIMEOUT_MS`, `CLUSTER_CONFIRM_DESTRUCTIVE`, `CLUSTER_CONFIRM_COMMANDS`, `CLUSTER_LOG_LEVEL`. `OPENAI_API_KEY` is also recognised as a fallback for the API key.
3. `~/.cluster/config.json` — small, non-secret preferences you want everywhere.
4. `cluster.config.json` in the project root — model defaults, command overrides, custom ignores, extra prompt instructions. Useful for teams that want a shared baseline.

```jsonc
// cluster.config.json
{
  "model": "gpt-4o",
  "temperature": 0.1,
  "commands": {
    "build": "npm run build",
    "test":  "npm test --silent",
    "lint":  "npm run lint"
  },
  "ignore": ["dist/**", "node_modules/**", "coverage/**"],
  "extraInstructions": "Always run typecheck after edits."
}
```

See [`.env.example`](./.env.example) for the full set of environment knobs.

## How a request flows

```
┌───────────────────────────────────────────────────────────────────┐
│ TUI  ── user prompt ──▶ agent-core ── tool calls ──▶ tool-runtime│
│  ▲                          │                    │                 │
│  │                          │                    ▼                 │
│  └────────── events ◀── Emitter ◀────────── workspace/storage     │
└───────────────────────────────────────────────────────────────────┘
```

1. The TUI hands the user prompt to **agent-core**, which assembles a system prompt from the workspace context.
2. **agent-core** calls the model via the **OpenAI-compatible provider** in `agent-core/src/provider.ts`. Responses may carry native tool calls; if the endpoint does not support them, Cluster CLI degrades to a fenced-JSON text protocol automatically.
3. Tool calls go through the **tool-runtime registry**. Each tool validates its input with `zod`, returns a typed `ToolResult`, and emits structured `tool:start` / `tool:end` events.
4. The TUI subscribes to the event stream to drive the chat view, tool cards, status bar and command output. Long-running output is streamed chunk-by-chunk via `tool:output`.
5. Every turn is written to the **storage** package, which round-trips through `lowdb` JSON. The `resume` command and `Ctrl+R` shortcut rehydrate that transcript so the next session continues where the last one left off.

## Layout

```
.
├── apps/
│   └── tui/                Ink-based terminal UI
│       ├── src/cli.ts          CLI entry point (commander)
│       ├── src/bootstrap.ts    Assembles config + stores + registry
│       ├── src/App.tsx         Top-level React/Ink component
│       └── src/components/     Composer, ChatView, DiffView, ...
├── packages/
│   ├── agent-core/         Orchestration: planning, agent loop, provider
│   ├── tool-runtime/       Tool registry + file/command/git tools
│   ├── workspace/          Project detection, git state, file watcher
│   ├── storage/            Session persistence (lowdb JSON)
│   └── shared/             Shared types, ids, logger, paths, diff
├── tsconfig.base.json
├── vitest.config.ts
├── vitest.setup.ts
├── .env.example
└── package.json
```

The TUI does not talk to tools or storage directly. The split keeps business logic out of components and means Phase 2 features (multi-agent, plugin marketplace, semantic search, …) can attach to the same package boundaries without restructuring the UI.

## Tools available to the agent

| Tool            | Purpose                                              | Risk       |
| --------------- | ---------------------------------------------------- | ---------- |
| `workspace_info` | Snapshot of project type, package manager, git branch | safe       |
| `list_files`     | Glob a directory                                     | safe       |
| `read_file`      | Read a text file (auto-detects binary + line ranges) | safe       |
| `search_text`    | Find literal or regex matches across the project      | safe       |
| `git_status`     | Working tree status and current branch                | safe       |
| `write_file`     | Create or fully overwrite a file                     | varies     |
| `patch_file`     | Targeted find/replace edit (preferred for code)      | varies     |
| `run_command`    | Run a shell command with live output streaming       | varies     |

Risk classification lives in `packages/tool-runtime/src/safety.ts`. Destructive actions — `rm -rf`, `git push --force`, edits to secrets, etc. — always require explicit user confirmation. The `--no-confirm-destructive` flag and `CLUSTER_CONFIRM_DESTRUCTIVE=false` are intentional escape hatches, not defaults.

Every file edit is backed up under `~/.cluster/backups/<session>/<call>/…` before it touches the filesystem, so a bad patch is recoverable.

## Keyboard shortcuts inside the TUI

| Key            | Action                                                 |
| -------------- | ------------------------------------------------------ |
| `Enter`        | Send the message                                      |
| `Shift+Enter`  | Insert a newline (multi-line input)                   |
| `Esc`          | Cancel the current run / back out of a dialog         |
| `Ctrl+C`       | First press: cancel work · second press: exit         |
| `Tab`          | Cycle focus between panes                              |
| `↑` / `↓`      | Scroll history or the focused pane                    |
| `Ctrl+R`       | Reload the most recent session                        |
| `/`            | Open the command palette                              |

## Development

```bash
npm run typecheck      # tsc -b
npm run build          # tsc -b (writes to apps/tui/dist, packages/*/dist)
npm run dev            # tsx apps/tui/src/cli.ts
npm test               # vitest run
npm run test:watch     # vitest
npm run clean          # tsc -b --clean
npm run rebuild        # tsc -b --force
```

Tests live next to the code as `*.test.ts`. They are intentionally small and exercise real behavior — not mocks of the system under test.

## What Phase 1 deliberately does not include

* Multi-agent orchestration (planned for Phase 2).
* Embeddings, semantic retrieval, or background indexing.
* Plugin marketplace, web access, browser automation.
* Remote sync or a background daemon.
* An interactive “plan approval” workflow beyond the destructive-action prompts.

These were all intentionally scoped out so Phase 1 could land a stable foundation that already feels like a developer tool on real codebases.

## Troubleshooting

* **`✖ api key (not set)`** — Set `CLUSTER_API_KEY` or `OPENAI_API_KEY`, or run `cluster config-set apiKey …`.
* **`This endpoint does not support function calling; switching to the text tool protocol`** — Cluster CLI detected the API rejected native tools. The session keeps running using the fenced-JSON protocol, which is slower but functionally complete.
* **`Refused to access "<path>": it resolves outside the project root`** — Paths are sandboxed to the detected project root for safety. Pass a path that is inside the repository.
* **Sessions missing after restart** — Override the data directory with `CLUSTER_HOME=/some/path cluster start`. Cluster CLI persists under `~/.cluster` by default.
* **Doctor reports the wrong project root** — `--cwd <dir>` overrides detection explicitly.

## License

MIT.
