# Configuration Reference

## 4-Layer Config Resolution

Cluster resolves configuration from 4 layers, with higher layers overriding lower ones:

```
Priority (lowest → highest):
┌─────────────────────────────────────────────────────────────────┐
│ Layer 1: Built-in Defaults                                      │
│   model: "gpt-4o-mini"                                          │
│   baseUrl: "https://api.openai.com/v1"                          │
│   temperature: 0.2                                              │
│   maxIterations: 40                                             │
│   confirmDestructive: true                                      │
│   confirmAllCommands: false                                     │
│   maxToolOutputChars: 24000                                     │
├─────────────────────────────────────────────────────────────────┤
│ Layer 2: Environment Variables                                  │
│   CLUSTER_API_KEY / OPENAI_API_KEY                              │
│   CLUSTER_BASE_URL / OPENAI_BASE_URL                            │
│   CLUSTER_MODEL                                                 │
│   CLUSTER_TOOL_MODE (auto/native/text)                          │
│   CLUSTER_MAX_ITERATIONS                                        │
│   CLUSTER_COMMAND_TIMEOUT_MS                                    │
│   CLUSTER_TEMPERATURE                                           │
│   CLUSTER_CONFIRM_DESTRUCTIVE (1/true/yes/on)                   │
│   CLUSTER_CONFIRM_COMMANDS (1/true/yes/on)                      │
│   CLUSTER_HOME                                                  │
├─────────────────────────────────────────────────────────────────┤
│ Layer 3: Global Config File                                     │
│   ~/.cluster/config.json                                        │
│   Schema: ProjectConfig (see below)                             │
├─────────────────────────────────────────────────────────────────┤
│ Layer 4: Project Config File                                    │
│   <project-root>/cluster.config.json                            │
│   Schema: ProjectConfig (same as global, takes priority)        │
└─────────────────────────────────────────────────────────────────┘
```

## Config Schema

Both config files use the same schema (`projectConfigSchema` in `agent-core/src/config.ts`):

```typescript
interface ProjectConfig {
  model?: string;                    // LLM model name
  baseUrl?: string;                  // API base URL
  apiKey?: string;                   // API key (stored in plaintext — caution!)
  maxIterations?: number;            // Max agent loop iterations
  temperature?: number;              // LLM temperature (0-2)
  commands?: {
    build?: string;                  // Build command
    test?: string;                   // Test command
    lint?: string;                   // Lint command
    format?: string;                 // Format command
  };
  ignore?: string[];                 // File patterns to ignore
  confirmDestructive?: boolean;      // Require confirmation for destructive tools
}
```

## Example Config Files

### `~/.cluster/config.json` (Global)

```json
{
  "model": "gpt-4o",
  "baseUrl": "https://api.openai.com/v1",
  "apiKey": "sk-your-global-key-here",
  "temperature": 0.1,
  "maxIterations": 30,
  "confirmDestructive": true,
  "commands": {
    "build": "npm run build",
    "test": "npm test",
    "lint": "npm run lint"
  }
}
```

### `<project>/cluster.config.json` (Project-specific)

```json
{
  "model": "claude-3-5-sonnet-20241022",
  "baseUrl": "https://api.anthropic.com/v1",
  "temperature": 0,
  "maxIterations": 50,
  "commands": {
    "build": "pnpm build",
    "test": "pnpm test --coverage",
    "lint": "pnpm lint:fix"
  },
  "ignore": ["node_modules/**", ".next/**", "dist/**"],
  "confirmDestructive": false
}
```

## Runtime Config Access

Config is loaded lazily in the main process:

```typescript
import { loadConfig } from '@cluster/agent-core';

const cfg = await loadConfig({}, { projectRoot: '/path/to/project' });
// cfg is the fully resolved AgentConfig with all 4 layers merged
```

The `config:get` IPC handler returns a masked version for the renderer:
```typescript
{
  ...cfg,
  apiKey: cfg.apiKey ? `${cfg.apiKey.slice(0,4)}••••${cfg.apiKey.slice(-4)}` : '',
  _hasKey: Boolean(cfg.apiKey)
}
```

## Settings Page Fields ↔ Config Keys

| Settings UI Field | Config Key | Env Override |
|-------------------|------------|--------------|
| Base URL | `baseUrl` | `CLUSTER_BASE_URL`, `OPENAI_BASE_URL` |
| API Key | `apiKey` | `CLUSTER_API_KEY`, `OPENAI_API_KEY` |
| Model | `model` | `CLUSTER_MODEL` |
| Temperature | `temperature` | `CLUSTER_TEMPERATURE` |
| Max Iterations | `maxIterations` | `CLUSTER_MAX_ITERATIONS` |
| Confirm Destructive | `confirmDestructive` | `CLUSTER_CONFIRM_DESTRUCTIVE` |
| Confirm All Commands | `confirmAllCommands` | `CLUSTER_CONFIRM_COMMANDS` |
| Tool Mode | `toolMode` | `CLUSTER_TOOL_MODE` |

## Storage Paths

Resolved by `resolveStoragePaths()` in `@cluster/storage`:

```typescript
{
  home: process.env.CLUSTER_HOME || ~/.cluster,
  databaseFile: ~/.cluster/sessions.json,
  backupsDir: ~/.cluster/backups,
  checkpointsDir: ~/.cluster/checkpoints,
  patchHistoryDir: ~/.cluster/patch-history,
  memoryDir: ~/.cluster/memory
}
```

## Diagnostic Config Check

The `doctor` command (in the TUI reference) and `diagnostics:get` IPC handler validate config:

```typescript
function diagnoseConfig(config: AgentConfig): ConfigProblem[] {
  const problems = []
  if (!config.apiKey) problems.push({ level: 'error', message: 'No API key configured.' })
  if (!/^https?:\/\//.test(config.baseUrl)) problems.push({ level: 'error', message: `Invalid baseUrl: ${config.baseUrl}` })
  if (config.maxIterations < 1) problems.push({ level: 'warn', message: 'maxIterations below 1' })
  return problems
}
```

Problems are displayed in the Provider page and Settings page diagnostic panel.
