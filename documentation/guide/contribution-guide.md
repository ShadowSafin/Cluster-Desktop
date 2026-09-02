# Contribution Guide

## Repository Conventions

### Branch Strategy

- `main` — Stable, documented release branch
- `feature/<name>` — Feature development
- `fix/<name>` — Bug fixes
- No force-push on shared branches

### Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <description>

feat(agent): add multi-agent coordinator support
fix(storage): debounce write timer not clearing on flush
docs(memory): add extraction pipeline documentation
chore(build): update electron-builder to 24.13
```

**Types:** `feat`, `fix`, `docs`, `chore`, `refactor`, `test`, `perf`

### Pull Requests

- Describe what changed and why
- Link related issues
- Include screenshots for UI changes
- Run `npm run typecheck` and `npm test` before submitting
- Keep PRs focused — one logical change per PR

---

## Folder Structure Deep Dive

```
cluster-cli/
│
├── apps/
│   ├── electron/                    Electron desktop app
│   │   ├── src/
│   │   │   ├── main/
│   │   │   │   └── index.ts         Entry point; window lifecycle; all IPC handlers
│   │   │   ├── preload/
│   │   │   │   └── index.ts         contextBridge API definition
│   │   │   └── renderer/
│   │   │       ├── App.tsx          Top-level layout component
│   │   │       ├── main.tsx         React entry point
│   │   │       ├── components/      Shared UI components
│   │   │       ├── hooks/           React hooks (useAgent, useSessions)
│   │   │       ├── pages/           10 page components
│   │   │       ├── store/           Local type definitions (mirrors shared types)
│   │   │       └── styles/          Global CSS
│   │   ├── package.json             Dependencies + electron-builder config
│   │   ├── vite.config.ts           Vite build configuration
│   │   ├── tailwind.config.js       Tailwind CSS configuration
│   │   └── tsconfig.main.json       TypeScript config for main process
│   └── tui/                         Terminal UI (reference implementation)
│
├── packages/
│   ├── shared/                      Cross-cutting types and utilities
│   │   └── src/
│   │       ├── types.ts             Core domain types
│   │       ├── tasks.ts             Task graph types
│   │       ├── agents.ts            Agent definitions
│   │       ├── events.ts            Emitter class + event types
│   │       ├── memory.ts            Memory types
│   │       ├── paths.ts             Path utilities
│   │       └── index.ts             Barrel exports
│   │
│   ├── agent-core/                  LLM interaction & orchestration
│   │   └── src/
│   │       ├── agent.ts             AgentLoop (single-agent)
│   │       ├── coordinator.ts       Coordinator (multi-agent)
│   │       ├── provider.ts          ModelProvider (LLM client)
│   │       ├── config.ts            Config resolution
│   │       ├── prompts.ts           Prompt templates
│   │       ├── history.ts           History trimming
│   │       └── agents/              Individual agent implementations
│   │
│   ├── tool-runtime/                Tool registry & execution
│   │   └── src/
│   │       ├── registry.ts          ToolRegistry class
│   │       ├── types.ts             Tool types
│   │       ├── safety.ts            Risk classification
│   │       ├── permissions.ts       Execution policies
│   │       ├── verification.ts      Test/lint verification
│   │       └── tools/               Individual tool implementations
│   │
│   ├── storage/                     Persistence layer
│   │   └── src/
│   │       ├── store.ts             SessionStore (lowdb wrapper)
│   │       ├── schema.ts            Database schema
│   │       ├── paths.ts             Storage path resolution
│   │       ├── checkpoints.ts       Checkpoint management
│   │       ├── backups.ts           File backup utilities
│   │       └── patchHistory.ts      Patch operation tracking
│   │
│   ├── workspace/                   Project awareness
│   │   └── src/
│   │       ├── detect.ts            Project root detection
│   │       ├── manifest.ts          Manifest parsing
│   │       ├── git.ts               Git integration
│   │       ├── files.ts             File utilities
│   │       ├── commands.ts          Command discovery
│   │       └── watch.ts             File watching
│   │
│   ├── task-engine/                 DAG-based scheduling
│   │   └── src/
│   │       ├── engine.ts            TaskEngine executor
│   │       ├── graph.ts             TaskGraphStore (DAG storage)
│   │       └── planner.ts           TaskPlanner (graph creation)
│   │
│   ├── context-engine/              Context selection
│   │   └── src/
│   │       ├── engine.ts            ContextEngine orchestrator
│   │       ├── ranking.ts           File relevance scoring
│   │       ├── chunking.ts          Large file chunking
│   │       ├── symbols.ts           Symbol extraction
│   │       └── repoIntelligence.ts  Repo metadata gathering
│   │
│   ├── memory/                      Persistent memory
│   │   └── src/
│   │       ├── store.ts             MemoryStore (public API)
│   │       ├── database.ts          MemoryDatabase (SQLite/JSON)
│   │       ├── extraction.ts        MemoryExtractor (pattern-based)
│   │       ├── retrieval.ts         MemoryRetriever (hybrid scoring)
│   │       └── vector.ts            Embedding generation & similarity
│   │
│   └── ui-kit/                      Reusable React components
│       └── src/
│           ├── DiffView.tsx
│           ├── Collapsible.tsx
│           ├── SplitPane.tsx
│           └── TaskItem.tsx
│
├── docs/                            Legacy docs (keep for reference)
├── scripts/                         Utility scripts
├── package.json                     Root workspace config
├── tsconfig.json                    Root TypeScript config
├── vitest.config.ts                 Vitest test configuration
└── .env.example                     Environment variable template
```

---

## Naming Conventions

| Element | Convention | Example |
|---------|------------|---------|
| Package names | `@cluster/<name>` | `@cluster/agent-core` |
| TypeScript files | `camelCase.ts` | `agent.ts`, `memoryStore.ts` |
| React components | `PascalCase.tsx` | `SessionsPage.tsx`, `DiffViewer.tsx` |
| IPC channels | `namespace:action` | `agent:send`, `sessions:list` |
| Event names | `namespace:event` | `tool:start`, `memory:recalled` |
| ID prefixes | `<type>_<nanoid>` | `sess_abc`, `msg_xyz`, `call_123` |
| Interface names | `PascalCase` | `AgentConfig`, `ToolContext` |
| Type aliases | `PascalCase` | `MessageKind`, `TaskStatus` |
| Constants | `UPPER_SNAKE_CASE` | `MAX_ITERATIONS`, `REPETITION_LIMIT` |
| Private fields | `camelCase` with underscore prefix | `_internalState` |

---

## Testing Expectations

Tests live alongside source files as `*.test.ts` and run via Vitest.

```bash
npm test          # Run all tests
npm run test:watch # Watch mode
```

### Test Conventions

- **Name tests descriptively:** `describe('AgentLoop', () => { it('should trim history when over budget', ...)`
- **Test real behavior, not mocks:** Prefer integration tests that exercise actual code paths
- **Keep tests fast:** Unit tests should complete in milliseconds
- **One assertion per concept:** Group related assertions in the same `it()` block

### Adding Tests

Create a `.test.ts` file next to the module you're testing:

```typescript
import { describe, it, expect } from 'vitest';
import { AgentLoop } from './agent.js';

describe('AgentLoop', () => {
  it('should handle empty tool calls gracefully', async () => {
    // Test implementation
  });
});
```

---

## Code Style

### TypeScript

- Use strict mode (enabled in `tsconfig.base.json`)
- Prefer explicit types for function parameters and return values
- Use `unknown` instead of `any` when the type is truly unknown
- Use Zod for runtime validation of external input
- No `@ts-ignore` — fix the underlying type issue instead

### React

- Functional components only (no class components)
- Hooks for all state management
- Keep components under 300 lines; extract sub-components if larger
- Use `React.FC` only when you need `children` typing; otherwise plain function signature
- Memoize expensive computations with `useMemo` and `useCallback`

### General

- No console.error in production code (use the logger)
- No hardcoded paths — use `path.join()` and `clusterHome()`
- No direct `fs` access in the renderer (go through IPC)
- Graceful degradation: failures should never crash the app
- Always handle `AbortSignal` for cancellable operations

---

## Changing Core Systems Safely

### Modifying the Agent Loop

1. Understand the event flow: `run()` → `callModel()` → `runToolCalls()` → finalization
2. Never throw from event emitters — wrap in try/catch
3. Always emit `done` or `error` before returning, even on cancellation
4. Update `HISTORY_BUDGET_CHARS` only if you've measured the impact on context overflow

### Modifying Tools

1. Always validate input with Zod — the registry does this automatically
2. Always return `{ ok: boolean, output: string }` — never throw
3. Use `capMiddle()` for long outputs to prevent context overflow
4. Add backups before any write operation
5. Classify risk accurately — wrong risk levels undermine the safety system

### Modifying Storage

1. Always call `markDirty()` on mutations — writes are debounced
2. Always `await flush()` at the end of agent turns
3. Handle corrupt database gracefully (quarantine + empty DB)
4. Never assume the database file exists — create directories with `recursive: true`

### Modifying IPC

1. Update both `main/index.ts` (handler) and `preload/index.ts` (bridge + types)
2. Add to the `IpcApi` type for TypeScript safety
3. Consider backward compatibility — don't remove IPC channels without a migration path
4. Document new channels in the hooks documentation

---

## Review Checklist

Before marking a PR ready:

- [ ] `npm run typecheck` passes with no errors
- [ ] `npm test` passes all tests
- [ ] New code has tests (if applicable)
- [ ] No `console.log` in production code paths
- [ ] No hardcoded paths or magic strings
- [ ] Error handling covers all async boundaries
- [ ] AbortSignal propagated to all cancellable operations
- [ ] Documentation updated (README, relevant doc files)
- [ ] Changes described in commit message following Conventional Commits
