# Packaging & Build

## Build System Overview

Cluster uses a **TypeScript project references** setup with a monorepo npm workspace. All packages share a root `tsconfig.json` that references every package and the Electron app.

```
Root tsconfig.json
├── references:
│   ├── packages/shared
│   ├── packages/storage
│   ├── packages/workspace
│   ├── packages/tool-runtime
│   ├── packages/agent-core
│   ├── packages/task-engine
│   ├── packages/context-engine
│   ├── packages/memory
│   └── apps/electron
```

## Development Workflow

```bash
# Install all dependencies across workspaces
npm install

# Type-check everything (fast, no emit)
npm run typecheck

# Build all packages + electron app (full compile)
npm run build

# Run tests
npm test

# Watch mode for tests
npm run test:watch
```

### Electron Dev Mode

```bash
npm run electron:dev
# or: npm run dev
```

This runs three processes concurrently via `concurrently`:
1. **Vite dev server** — `vite --config vite.config.ts` serves the renderer at `http://localhost:5173`
2. **TypeScript watch** — `tsc -p tsconfig.main.json --watch & tsc -p tsconfig.preload.json --watch` compiles main + preload on change
3. **Electron** — Waits for Vite to be ready (`wait-on http://localhost:5173`), then launches `electron dist/main/index.js`

Dev tools open automatically in a detached pane.

### What Happens on Dev Launch

```
1. tsc --watch compiles:
   apps/electron/src/main/index.ts     → dist/main/index.js
   apps/electron/src/preload/index.ts  → dist/preload/index.js

2. Vite compiles:
   apps/electron/src/renderer/         → http://localhost:5173/

3. Electron loads http://localhost:5173/
   (with 15 retries × 500ms wait, fallback to file if dev server fails)

4. Preload script exposes window.cluster API
5. React app mounts
6. Bootstrap effect detects workspace, loads config, refreshes sessions
```

## Production Build

### Step 1: Build All Packages

```bash
npm run build
# Equivalent to: tsc -b
# Compiles all packages in dependency order (shared → storage → workspace → tool-runtime → agent-core → task-engine → context-engine → memory → electron)
```

### Step 2: Build Electron App

```bash
npm run electron:build
```

This runs:
```bash
tsc -p apps/electron/tsconfig.main.json      # Compiles main process
tsc -p apps/electron/tsconfig.preload.json   # Compiles preload script
node -e "require('fs').writeFileSync('dist/preload/package.json', JSON.stringify({type:'commonjs'}))"  # Fix CJS for preload
vite build --config apps/electron/vite.config.ts  # Builds renderer bundle
```

Output structure:
```
apps/electron/dist/
├── main/
│   └── index.js              # Main process entry
├── preload/
│   └── index.js              # Preload script
│   └── package.json          # { "type": "commonjs" } (added by fix step)
└── renderer/
    ├── index.html
    ├── assets/
    │   ├── index-[hash].js
    │   └── index-[hash].css
    └── ... (Vite-built static assets)
```

### Step 3: Package Installer (Windows)

```bash
npm run electron:package
```

Runs `electron-builder --win --x64` with the config from `apps/electron/package.json`:

```json
{
  "appId": "ai.cluster.desktop",
  "productName": "Cluster",
  "win": {
    "target": [{ "target": "nsis", "arch": ["x64"] }],
    "artifactName": "Cluster-Setup-${version}.${ext}"
  },
  "nsis": {
    "oneClick": false,
    "allowToChangeInstallationDirectory": true,
    "createDesktopShortcut": true,
    "createStartMenuShortcut": true
  }
}
```

Output: `apps/electron/release/Cluster-Setup-0.1.0.exe`

## Platform Targets

| Platform | Command | Output Format |
|----------|---------|---------------|
| Windows | `npm run electron:package` | NSIS installer (.exe) |
| macOS | `electron-builder --mac` | DMG |
| Linux | `electron-builder --linux` | AppImage |

## Environment Variables

| Variable | Purpose | Default |
|----------|---------|---------|
| `CLUSTER_HOME` | Override storage directory | `~/.cluster/` |
| `CLUSTER_API_KEY` | LLM API key | — |
| `CLUSTER_BASE_URL` | LLM base URL | `https://api.openai.com/v1` |
| `CLUSTER_MODEL` | Default model | `gpt-4o-mini` |
| `CLUSTER_TOOL_MODE` | Tool protocol mode | `auto` |
| `CLUSTER_MAX_ITERATIONS` | Max agent loop iterations | `40` |
| `CLUSTER_COMMAND_TIMEOUT_MS` | Command timeout | `120000` |
| `CLUSTER_CONFIRM_DESTRUCTIVE` | Require confirmation for destructive actions | `true` |
| `CLUSTER_CONFIRM_COMMANDS` | Paranoid mode: confirm all commands | `false` |

## VS Code Debugging

Add to `.vscode/launch.json`:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Electron Main",
      "type": "node",
      "request": "launch",
      "program": "${workspaceFolder}/apps/electron/dist/main/index.js",
      "preLaunchTask": "tsc: main",
      "outFiles": ["${workspaceFolder}/apps/electron/dist/**/*.js"]
    },
    {
      "name": "Electron Renderer",
      "type": "chrome",
      "request": "launch",
      "url": "http://localhost:5173",
      "webRoot": "${workspaceFolder}/apps/electron/src/renderer"
    }
  ]
}
```

## Common Build Issues

| Issue | Cause | Fix |
|-------|-------|-----|
| `Cannot find module '@cluster/shared'` | Packages not built before electron | Run `npm run build` first |
| Preload script fails with CJS error | Missing package.json type fix | Ensure `build:preload:fix` step runs |
| Vite dev server not found | Port 5173 occupied | Kill the occupying process or change port in vite.config.ts |
| Electron shows blank screen | Renderer failed to load | Check main process console for `did-fail-load` messages |
| `electron-builder` fails on non-Windows | NSIS target requires Windows | Use `--linux` or `--mac` flag, or run in WSL/CI |
| TypeScript errors after adding package | Missing project reference | Add to root tsconfig.json references |

## Source Maps

Source maps are enabled in both Vite and TypeScript configs for debugging. In production builds, they are included in the `dist/` folder but not packaged into the installer (filtered by electron-builder's default file list).
