# TUI Feature Audit — Source of Truth for Electron Parity

> Every line here must exist in Electron unless explicitly deprecated.

## CLI Entrypoints (apps/tui/src/cli.ts)
- `cluster` / `cluster start` → TUI (TTY check, `--cwd`, `--model`, `--base-url`, `--session <id>`, `--continue`, `--title`, `--no-watch`)
- `cluster resume [id]` → picker via Ink SelectList if id omitted, lists sessions for project root
- `cluster sessions [--cwd] [--all] [--limit 20]` → tabular list (title, root, counts, model, updated)
- `cluster config [--cwd]` → effective config merge display
- `cluster config-get <key>` / `config-set <key> <value>` → `~/.cluster/config.json` read/write with primitive coercion
- `cluster doctor [--ping] [--cwd]` → runtime (node>=20), platform, project root+marker, project type, git branch/dirty, languages, apiKey, endpoint, model, diagnoseConfig hints, storage home+counts, tools list, optional live ping via ModelProvider.complete

## Bootstrap (bootstrap.ts)
- loadEnvFiles([cwd, detectedRoot]), detectProjectRoot, loadConfig (4 layers), SessionStore.open, mkdir backupsDir, loadWorkspaceInfo, create or resume session, setWorkspace, updateState(model), flush, createDefaultRegistry+phase2Registry, ModelProvider, ContextEngine, MemoryStore init, Emitter<AgentEvents>, Coordinator, watchWorkspace (unless --no-watch), close() flushes all

## App Shell (App.tsx)
- State: value/cursor, history array+index, focus (composer|chat|tasks|diff|verify|agents), rightTab (tasks|diff|verify|agents|logs|checkpoints|memory), showWorkspace (columns>=90 default), scrollOffset, expandedTools Set, showActivity, showHelp, showPalette, quickActions, notice, clearIndex, searchHistory
- Computed: modalOpen, composerFocused, visibleEntries (slice clearIndex), inputLines→composerRows, chromeRows→chatRows, busy, headerPhase, paletteItems, searchableHistory
- Slash commands (runSlashCommand): /help, /exit/quit, /clear (hides entries but keeps persistence), /plan (show plan or taskGraph), /edits, /tasks, /diff, /verify, /agents, /memory, /checkpoint, /multi <req>, /checkpoint-create [msg], /rollback <id>, /status (project/model/session/messages/tools/phase/tasks/agents/multi), unknown → notice
- handleSubmit: trim, slash vs normal, push history, reset value/cursor/scroll/notice, heuristic auto multi-agent if length>100 or contains " and " & "also", else single-agent
- handleHistory: Up/Down navigates stored prompts
- Global useInput hotkeys: Ctrl+C cancel→quit, Ctrl+K palette toggle, Ctrl+W workspace toggle, Tab cycle focus, 1-7 tab switch when not composerFocused, Ctrl+A toggle activity, Ctrl+R reload session, Ctrl+T toggle tool expansion, Ctrl+P pause running task, Ctrl+Y resume paused task, Ctrl+G create checkpoint, PageUp/Ctrl+B +5 scroll, PageDown/Ctrl+F -5 scroll, Ctrl+H cancel running task, Ctrl+L focus composer, chat/tasks/diff focus: ? help, / quickActions, k palette
- Layout: header (Cluster CLI version · workspace · phase · multi · agents · focus), split pane (left conversation+plan+activity+liveOutput, right tabs), notice box, StatusBar, conditional overlays (ConfirmDialog > HelpOverlay > CommandPalette > SelectList > Composer), bottom hint line

## useAgent (hooks/useAgent.ts)
- Types: TimelineEntry (message|tool), ActivityLine (id,text,level,at), AgentActivityItem (role,phase,message,timestamp), AgentController interface
- State: entries, agentState, plan, liveOutput (Record<callId,string> capped 32k), activity (200 max), pendingConfirm, running, streamingText, edits, taskGraph, agentActivities, verificationResults, checkpoints, memoryProject/Session, multiAgentActive
- Refs: entriesRef, confirmRef (promise resolver), abortRef, lastPromptRef, eventsRef (shared coordinator events or new), engineRef
- Effects: wire AgentEvents → setState+store (message, delta(streamingText), tool:start(end) + pushAgentActivity via inferRoleFromTool, tool:output live scroll, state, plan→TaskGraph derivation via inferRoleFromTask, progress→pushActivity+[role] parse, error→store.appendError, done→updateState+flush+refreshCheckpoints/memory+mark tasks done), watcher events → activity
- Helpers: pushActivity, pushAgentActivity (200 cap), refreshCheckpoints (listCheckpoints), refreshMemory (memory.recall project+session limit 10), recordEdit (write/patch → Edit + store.appendEdit), recordCommandRun (run_command → CommandRun + store.appendCommandRun), requestConfirm (promise+modal), resolveConfirm, cancel(cancel engine+abort), cancelTask/pauseTask/resumeTask/retryTask (engine.* + optimistic graph patch), submit(text) → heuristic complex→submitMulti else single AgentLoop with AbortController, history messages/toolCalls, updateState planning, rename session if first message, new AgentLoop({config,provider,registry,projectRoot,workspace,backupsDir,sessionId,history,events,requestConfirm}), loop.run(trimmed, signal).catch→activity, retry(), reload() fresh session→timeline/plan/edits/state, createCheckpoint/rollbackCheckpoint (storage/checkpoints.ts)
- Inference: inferRoleFromTool (write/patch→coder, run_command/verify→tester, read/search/list→context, git→reviewer), inferRoleFromTask (plan→planner, test/verify→tester, review→reviewer, context/gather→context else coder)

## Components
- **ChatView**: scrollable bottom-anchored estimated-height renderer, streaming cursor ▌, MessageItem vs ToolCallCard per entry
- **MessageItem**: role color, truncated lines, meta
- **ToolCallCard**: name, status icon, duration, risk color, collapsed vs expanded (diff+json, always expanded on error), liveOutput inline when running
- **Composer**: textarea-like Ink Input, value/cursor, focused/disabled/width, placeholder dynamic busy hints, onChange, onSubmit (Enter), onHistory (Up/Down passed), onCancel (Esc), onQuickAction(?/)
- **ActivityFeed**: scrolling lines, level colors, max rows
- **PlanView**: goal + steps with status icons
- **TaskBoard**: stats done/running/failed/blocked, timeline batches (computeBatches via topological levels), tasks list (12 max + more), byAgent grouping, iconForStatus
- **DiffPanel/DiffView**: edits array → unified diff with diffAdd/diffRemove colors, hunk headers, +/− counts, apply/rollback actions
- **AgentPanel**: activities timeline (role:phase message @ timestamp)
- **VerificationPanel**: results[] {kind,command,passed,durationMs,summary,failures} + autoFixAttempts
- **CheckpointPanel**: checkpoints list (id, message, createdAt, gitHead, files hash)
- **MemoryPanel**: projectEntries+sessionEntries (scope/category/key/value/source/tags), importantFiles[]
- **CollapsibleLogs/LiveOutputPanel**: title lines maxHeight collapsed toggle, live command stdout
- **CommandPalette**: filterable list (fuzzy), title, items {id,label,detail,hotkey}, onSelect/onCancel, Ctrl+K trigger
- **SelectList**: title items {id,label,detail}, onSelect/onCancel (used resume picker, quick actions)
- **ConfirmDialog**: ConfirmationRequest {toolName, risk, reason, input}, approve/reject buttons
- **HelpOverlay**: keyboard shortcuts table + slash commands help
- **StatusBar**: state phase/label, iteration, usage, workspace git branch/dirty, width/busy indicator
- **Splash**: empty state with workspace.name/config.model/projectRoot/resumed flag, quick starters
- **Theme**: primary white, secondary gray, dim gray, user cyan, assistant white, tool magenta, success green, warning yellow, error red, accent cyanBright, border gray, diff colors, phaseColors mapping

## Task Engine / Multi-Agent
- Planner creates graph from goal+fileGroups, visas via TaskGraphStore
- Execution: batches by dependency level, maxConcurrency 4, file locks per task, retry maxAttempts 2 backoff 1s
- Controls: pause/resume per task or whole graph, cancel, retry, status: pending|ready|blocked|running|paused|done|failed|cancelled|skipped
- Visible: taskBoard timeline, by-agent grouping, stats, progress emissions per agent, AgentPanel activities, live output per tool

## Tool Execution
- file reading: read_file (auto binary, line ranges), list_files (glob), search_text (literal/regex), workspace_info (project type/pm/git/languages)
- file writing: write_file (create/overwrite), patch_file (find/replace preferred), diff preview/applyHunks/patchHistory, backups before write
- commands: run_command (live streaming via tool:output, duration, exitCode, timedOut, cancelled, cwd), safety classifyCommand, confirmation required for destructive (rm -rf, git push --force etc)
- git: git_status (branch/dirty/staged), git_diff (unified)
- verification: verify (auto discovery of build/test/lint), discoverTests, runVerification, auto-fix loop
- checkpoints: create/list/rollback/delete, assessPatchRisk (sensitive path detection)

## Workspace & Context
- detectProjectRoot (cwd → upward search for package.json, etc., marker, fallback)
- loadWorkspaceInfo (manifestFiles, languages, project kind/packageManager/scripts, commands build/test/lint/format, git state)
- ContextEngine: repoIntelligence (fileGroups, languages), chunking (file → chunks), ranking (relevance)
- watchWorkspace: fs watch → change events → activity feed

## Memory
- MemoryStore {projectRoot, sessionId}, init, add({scope:project|session, category:note|pattern, key, value, source, tags}), recall({scope,limit}), appendTaskHistory

## Logs & Background
- Logs panel: activity feed + liveOutput combined
- Background jobs: run_command streamed chunks, TaskEngine parallel tasks
- Activity capped 200, liveOutput capped 32k per call

## Provider/Model Selection
- config.model/baseUrl/apiKey mutable via CLI flags or config-set, effective config displayed in doctor/status, endpoint constructed as baseUrl/chat/completions, model shown in session title/state

## Checkpoints & Resume
- createCheckpoint (Ctrl+G or /checkpoint-create), listCheckpoints (Checkpoints tab), rollbackToCheckpoint ( /rollback <id> ), index.json listing, snapshot dir per session
- resume via CLI or Ctrl+R reload from disk, SessionStore.latestSession, listSessions picker

## Verification Flows
- verify tool → VerificationPanel, runVerification after coder edits in orchestrator, passed/failed badges, duration, failures list, attemptedFixes counter
- diff review: DiffPanel shows edits, rollback via checkpoint, applyHunks for selective apply

## Keyboard Shortcuts (full)
- Enter send, Shift+Enter newline, Esc cancel/back, Ctrl+C cancel→exit (two presses), Tab cycle focus, ↑/↓ scroll/history, Ctrl+R reload, / palette, Ctrl+K command palette, Ctrl+W workspace toggle, Ctrl+A activity toggle, Ctrl+T tool details toggle, Ctrl+P pause, Ctrl+Y resume, Ctrl+G checkpoint, Ctrl+H cancel task, Ctrl+L focus composer, Ctrl+B/F PageUp/Down scroll, 1-7 tab switch, ? help

## States
- idle, planning, thinking, reading, editing, running, verifying, summarizing, waiting, done, error, cancelled, blocked, paused, failed, skipped, ready, pending, blocked (task), running (task)

## Packaging (desired)
- Electron Windows .exe via electron-builder, launch without terminal, premium dark desktop look (sidebar, topbar, central workspace, diff/review, logs, composer)
