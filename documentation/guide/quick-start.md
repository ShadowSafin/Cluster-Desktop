# Quick Start — Running Cluster Locally

## Prerequisites

| Requirement | Minimum Version |
|-------------|----------------|
| Node.js | >= 20.10.0 |
| npm | bundled with Node |
| Git | Any (for workspace detection) |

## Installation

```bash
# Clone the repository
git clone <repo-url>
cd "C:\Coding Agent"

# Install all dependencies (workspaces auto-linked)
npm install

# Type-check the entire monorepo
npm run typecheck
```

## Configuration

### Option 1: Environment Variables (Recommended for Development)

```bash
# Copy the example env file
cp .env.example .env

# Edit .env and set your API key
# CLUSTER_API_KEY=sk-your-key-here
# CLUSTER_BASE_URL=https://api.openai.com/v1
# CLUSTER_MODEL=gpt-4o-mini
```

### Option 2: In-App Configuration

Open Cluster → press `9` to go to **Provider / Model** page → enter your Base URL and API Key → click **Test Connection**.

### Option 3: Config Files

Cluster reads config from 4 layers (lowest to highest priority):

| Layer | Location | Format |
|-------|----------|--------|
| 1. Built-in defaults | — | Hardcoded in `config.ts` |
| 2. Environment | `.env` or shell | `CLUSTER_API_KEY`, `CLUSTER_BASE_URL`, etc. |
| 3. Global | `~/.cluster/config.json` | JSON |
| 4. Project | `<project-root>/cluster.config.json` | JSON |

Example `cluster.config.json`:

```json
{
  "model": "gpt-4o",
  "baseUrl": "https://api.openai.com/v1",
  "temperature": 0.2,
  "maxIterations": 40,
  "confirmDestructive": true,
  "commands": {
    "build": "npm run build",
    "test": "npm test --silent"
  }
}
```

## Running in Development

```bash
# Full dev mode (Vite + tsc watch + Electron)
npm run dev

# or equivalently:
npm run electron:dev
```

This starts three processes simultaneously:
1. **Vite dev server** at `http://localhost:5173` (renderer)
2. **TypeScript watch** for main + preload processes
3. **Electron** loads the Vite server automatically

Dev tools open automatically in a detached pane.

## Running the TUI (Terminal UI)

```bash
# Start the reference terminal implementation
npm run dev
# or directly:
npx tsx apps/tui/src/cli.ts
```

## Building for Production

```bash
# Build all packages + renderer
npm run electron:build

# Creates: apps/electron/dist/
```

## Packaging a Windows Installer (.exe)

```bash
npm run electron:package
```

Output: `apps/electron/release/Cluster-Setup-0.1.0.exe`

Requirements for packaging:
- Must run on Windows (x64)
- Requires network access (electron-builder downloads NSIS)
- Sets `npmRebuild: false` — native modules are not rebuilt

## Verifying Your Install

```bash
# Run all tests
npm test

# Type-check everything
npm run typecheck
```

## Default Values

| Setting | Default | Environment Override |
|---------|---------|---------------------|
| Model | `gpt-4o-mini` | `CLUSTER_MODEL` |
| Base URL | `https://api.openai.com/v1` | `CLUSTER_BASE_URL` |
| Max Iterations | `40` | `CLUSTER_MAX_ITERATIONS` |
| Command Timeout | `120s` | `CLUSTER_COMMAND_TIMEOUT_MS` |
| Temperature | `0.2` | `CLUSTER_TEMPERATURE` |
| Confirm Destructive | `true` | `CLUSTER_CONFIRM_DESTRUCTIVE` |
| Confirm All Commands | `false` | `CLUSTER_CONFIRM_COMMANDS` |
| Tool Mode | `auto` | `CLUSTER_TOOL_MODE` (auto/native/text) |
| Storage Home | `~/.cluster/` | `CLUSTER_HOME` |

---

<div class="see-also">
<strong>Next:</strong> Read the <a href="./architecture/system.md">Architecture Overview</a> to understand the system internals, or jump to <a href="./workflow/execution-flow.md">Workflow & Execution Flow</a> to learn how a request is processed end-to-end.
</div>
