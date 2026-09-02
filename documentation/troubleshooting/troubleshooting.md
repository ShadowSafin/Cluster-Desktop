# Troubleshooting

## Startup Issues

### Blank Window / Black Screen

**Symptoms:** Electron window opens but shows nothing, or shows an error HTML page.

**Causes and fixes:**

| Cause | Fix |
|-------|-----|
| Vite dev server not running | Start with `npm run electron:dev` (not just `electron dist/main/index.js`) |
| Port 5173 blocked | Kill the process on port 5173: `netstat -ano | findstr :5173` then `taskkill /PID <pid> /F` |
| Corrupt renderer build | Run `npm run build` to regenerate `dist/renderer/` |
| Missing preload script | Ensure `dist/preload/index.js` exists; run `npm run build` |
| ASAR packaging issue (production) | Re-run `npm run electron:package`; check that `dist/` is included in asar |

**Diagnostics:** Check the main process console (where Electron prints logs). Look for:
- `[Cluster] did-fail-load <code> <desc> <url>` — load failure
- `[Cluster] ready-to-show timeout — forcing show` — renderer took too long
- `[Cluster] render-process-gone` — renderer crashed

### "No renderer found" Error Page

The app shows an HTML error page saying "no renderer found". This means:
1. Dev server at `localhost:5173` is unreachable after 15 retries
2. AND `dist/renderer/index.html` doesn't exist

**Fix:**
```bash
# Build the renderer first
npm run electron:build
# Then start
npm run start
```

---

## Build Issues

### TypeScript Errors Across Packages

```
error TS6059: file '.../packages/agent-core/src/agent.ts' is not under 'rootDir'
```

**Fix:**
```bash
npm run clean   # Remove all dist folders
npm run build   # Full rebuild
```

### Preload Module Type Error

```
Error [ERR_REQUIRE_ESM]: require() of ES Module
```

**Fix:** The preload script needs a `package.json` with `"type": "commonjs"`. This is added automatically by the `build:preload:fix` script in the build pipeline. If missing:
```bash
node -e "require('fs').writeFileSync('apps/electron/dist/preload/package.json', JSON.stringify({type:'commonjs'}))"
```

### electron-builder Fails on Non-Windows

```
electron-builder --win --x64
Error: This packager method can only be used on Windows
```

**Fix:** Packaging for Windows requires running on a Windows machine. Use GitHub Actions CI or WSL2 for cross-platform builds.

---

## Provider / Model Issues

### "No API key configured" Error

**Symptoms:** Agent returns early with demo mode even when you have a key set.

**Check:**
1. Is the key in the right layer? (env > global config > project config)
2. Is the key being masked correctly? Check Settings → Diagnostics → `hasApiKey: true`
3. Is there a typo in the env var name? (`CLUSTER_API_KEY` not `CLUSTER apiKey`)

```bash
# Quick test from shell
echo $CLUSTER_API_KEY
# or on Windows PowerShell
$env:CLUSTER_API_KEY
```

### "Endpoint does not support function calling"

**Symptoms:** Agent falls back to text protocol. Responses are slower but still functional.

This is **expected behavior** for providers that don't support OpenAI-style function calling (e.g., some Ollama models, older local models). The agent auto-detects and switches.

**To force native mode:** Set `CLUSTER_TOOL_MODE=native` — but this will fail if the provider truly doesn't support it.

**To force text mode:** Set `CLUSTER_TOOL_MODE=text` — slower but universally compatible.

### Model Discovery Returns No Models

**Symptoms:** Provider page shows "No models found" after clicking Discover.

**Causes:**
1. Wrong base URL format — must include `/v1` for OpenAI-compatible endpoints
2. Authentication failure — check that the API key is correct
3. Endpoint doesn't expose a `/models` route — some providers (Ollama) use `/api/tags`

**Debug:** The handler tries these URLs in order:
```
{baseUrl}/models
{baseUrl}/v1/models
{baseUrl}/api/tags   (Ollama)
```

Check which one your provider uses and adjust the base URL accordingly.

### Auth Error (401/403)

**Symptoms:** Provider page shows "Authentication failed (401 Unauthorized)"

**Fix:**
1. Verify API key is valid and not expired
2. Check if the provider requires a different key format (e.g., some use `x-api-key` header instead of `Authorization: Bearer`)
3. For Azure OpenAI, the baseUrl must include the deployment path: `https://{resource}.openai.azure.com/openai/deployments/{deploy-name}/chat/completions`

---

## Session / Storage Issues

### Sessions Not Persisting

**Symptoms:** After restarting the app, sessions are gone.

**Check:**
1. Is `~/.cluster/sessions.json` being written? Look for it in the file explorer.
2. Is the storage home overridden? Check `CLUSTER_HOME` env var.
3. Is the file corrupted? If so, the app quarantines it as `sessions.json.corrupt-<timestamp>`. Check that file for data loss.

**Recovery:** If you have a corrupt backup, manually copy it back:
```bash
cp ~/.cluster/sessions.json.corrupt-1234567890 ~/.cluster/sessions.json
```

### Session Resume Shows Empty Chat

**Symptoms:** Selecting an old session shows no messages.

**Cause:** Messages may have been truncated during storage due to the 64KB cap on `stdout`/`stderr`. Check the raw JSON:
```bash
cat ~/.cluster/sessions.json | python -m json.tool | grep -A5 '"id":"sess_abc"'
```

### Database Quarantine on Launch

**Symptoms:** App launches but no sessions appear; main console shows "Session database could not be parsed; quarantining it"

**Fix:**
1. The app already created a quarantine copy — check `~/.cluster/sessions.json.corrupt-<timestamp>`
2. Try to repair: the JSON structure might be valid but have unexpected fields. Open the file and check for syntax errors.
3. If unrecoverable, the app continues with an empty database (no data loss of other sessions if they're in separate files).

---

## Memory Issues

### Memories Not Being Recalled

**Symptoms:** New sessions don't show recalled memories even after previous tasks.

**Checks:**
1. Is memory initialization succeeding? Check main process console for "failed to init memory" warnings.
2. Are there memories in the database? Open `~/.cluster/cluster_memory.db.json` and check entries.
3. Is the `sessionId` being passed correctly? Memory retrieval is scoped to the current session unless `projectRoot` is also set.
4. Synthetic embeddings may not be discriminative enough for large memory corpora. Try pinning important memories to boost their score.

### Vector Search Returning Low-Score Results

**Symptoms:** Retrieved memories have similarity scores < 0.3 and are filtered out.

**Cause:** Current embeddings are hash-based (deterministic but not semantic). For better recall:
1. Pin high-importance memories (adds +0.15 to composite score)
2. Increase `importance` when adding memories manually
3. Use more specific search queries

---

## Background Job Issues

### Job Output Not Appearing

**Symptoms:** Started a command but the output panel stays empty.

**Checks:**
1. Did the command actually start? Check the job list for the job ID.
2. Is the command producing output? Some commands are silent until they error.
3. Check the main process console for tool execution errors.

### Job Stuck in "running" Forever

**Symptoms:** A job shows "running" but the command has clearly finished.

**Cause:** The `run_command` tool's stderr/stdout streams may not have closed if the child process is still alive. Or the AbortController wasn't properly wired.

**Fix:** Click "Stop" on the job, which sends the abort signal. If that doesn't work, restart the app.

---

## UI Rendering Issues

### Page Not Updating After Event

**Symptoms:** Agent completes a task but the UI doesn't reflect the new state.

**Common causes:**
1. **Missing IPC event listener:** Check that the preload bridge exposes the event and the hook subscribes to it.
2. **Session ID mismatch:** Events are scoped to `sessionId`. If the hook is subscribed to a different session, it won't receive events.
3. **React state batch issue:** Multiple state updates in one event handler may be batched. Use functional updates: `setEntries(prev => [...prev, newEntry])`.

### Checkpoints Page Shows Nothing

**Cause:** The page loads checkpoints only when a `sessionId` is available. Make sure a session is selected before navigating to Checkpoints.

---

## Quick Diagnostic Commands

```bash
# Check storage paths
node -e "const {resolveStoragePaths} = require('./packages/storage/dist/paths.js'); console.log(resolveStoragePaths())"

# Check if sessions exist
cat ~/.cluster/sessions.json | jq '.sessions | length'

# Check memory count
cat ~/.cluster/cluster_memory.db.json | jq '.entries | length'

# List checkpoints
ls ~/.cluster/checkpoints/

# Test API connectivity
curl -H "Authorization: Bearer $CLUSTER_API_KEY" -H "Content-Type: application/json" \
  -d '{"model":"gpt-4o-mini","messages":[{"role":"user","content":"hi"}],"max_tokens":5}' \
  https://api.openai.com/v1/chat/completions
```
