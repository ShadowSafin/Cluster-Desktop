# Agent Loop — Single-Agent Deep Dive

## Overview

`AgentLoop` (in `packages/agent-core/src/agent.ts`) is the core execution engine for single-agent tasks. It runs an iterative loop: plan → call model → execute tools → repeat until done or max iterations reached.

## Constructor & Initialization

```typescript
new AgentLoop({
  config,           // AgentConfig (apiKey, model, baseUrl, maxIterations, etc.)
  provider,         // ModelProvider instance
  registry,         // ToolRegistry with all available tools
  projectRoot,      // Absolute path to the active workspace
  workspace,        // WorkspaceInfo (project kind, languages, git state)
  backupsDir,       // ~/.cluster/backups/<sessionId>/
  sessionId,        // Current session ID
  history,          // ProviderMessage[] from existing session messages
  events,           // Emitter<AgentEvents> for UI streaming
  requestConfirm,   // Promise<(request) => boolean> for user confirmation
  memory,           // Optional MemoryStore for recall/extraction
})
```

## The Main `run()` Method

The `run(userInput, signal)` method orchestrates one complete turn:

### Step 1: Persist User Message
```typescript
events.emit('message', makeMessage('user', userInput, 'chat'))
messages.push({ role: 'user', content: userInput })
```

### Step 2: Memory Extraction (Pre-Task)
```typescript
memory.extractFromPrompt(userInput)  // Detects goals, preferences, architecture
```
This runs **before** any LLM call, so future sessions benefit from the user's stated intent.

### Step 3: Contextual Memory Recall
```typescript
const recalled = memory.retrieveContextual({ queryText: userInput, limit: 6 })
events.emit('memory:recalled', { memories: recalled })
// Inject into system prompt:
systemPrompt += formatForPrompt(recalled)
```
Retrieved memories are appended to the system prompt so the model respects them during planning and execution.

### Step 4: Planning
```typescript
emitState('planning', 'Planning', 0, maxIterations)
const plan = await createPlan(userInput, signal, recalledMemories)
emit('plan', plan)
```
Planning calls the LLM with `PLAN_SYSTEM_PROMPT` in JSON mode (`maxTokens: 800`). Response is validated against `planSchema` (Zod). If parsing fails, `null` is returned and execution continues without a plan.

The plan contains:
- `goal`: restated user goal
- `classification`: array of categories (e.g., `['frontend', 'bug_fix']`)
- `strategy`: high-level approach
- `steps`: up to 8 steps, each with optional role, toolTarget, verificationCmd
- `risks`, `constraints`, `acceptanceCriteria`

### Step 5: Execution Loop

```typescript
for (let iteration = 1; iteration <= maxIterations; iteration++) {
  emitState('thinking', 'Thinking', iteration, maxIterations)

  // Call model with full context
  const response = await provider.chat({
    messages: [{ role: 'system', content: systemPrompt }, ...trimmedHistory],
    tools: useTextProtocol ? undefined : registry.toFunctionSchemas(),
    signal,
    onDelta: (text) => emit('delta', { messageId, text }),  // Streaming
  })

  // Parse tool calls from response
  const toolCalls = response.toolCalls.length > 0
    ? response.toolCalls
    : toolCallsFromText(response.content)  // Fallback parser

  if (toolCalls.length === 0) {
    summary = response.content.trim()
    break  // No more tool calls = task complete
  }

  // Execute all tool calls
  const result = await runToolCalls(toolCalls, messageId, signal)
  if (result === 'cancelled') break
  if (result === 'stalled') {
    error = 'Repeated same tool call...'
    break
  }
}
```

### Step 6: Finalization

After the loop exits:

1. **Ensure final summary**: If no assistant message with text exists, force one more model call asking for a summary
2. **Warning if no verification**: If files were edited but no command was run, emit a warning message
3. **Update plan steps**: Mark remaining steps as `done`/`failed`/`skipped`
4. **Memory extraction (post-task)**:
   ```typescript
   memory.extractFromWorkflow({
     goal, summary, success, filesChanged, commandsRun,
     errorEncountered, plan, userCorrection
   })
   ```
5. **Flush storage**: `store.flush()` writes everything to disk
6. **Emit done event**:
   ```typescript
   emit('done', { summary, usage, cancelled, iterations })
   ```

## Model Interaction (`callModel`)

```typescript
private async callModel(messageId, signal): Promise<{ response, error }>
```

**Error handling strategy:**

| Error Type | Handling |
|-----------|----------|
| `AbortError` / signal.aborted | Return `{ response: null, error: 'Cancelled' }` |
| `ProviderError.isToolUnsupported` (400/422/404 with "tool" in body) | Set `useTextProtocol = true`, rebuild prompt, retry recursively |
| `ProviderError.isAuthError` (401/403) | Emit error event, return error message |
| Other ProviderError | Emit error, return status-code message |
| Generic error | Wrap and return |

**History trimming:** `trimHistory(messages, 120_000)` keeps the rolling transcript within 120K characters, dropping oldest messages first. This prevents context overflow on long sessions.

## Tool Execution (`runToolCalls`)

For each tool call in the response:

```typescript
// 1. Record start
const record: ToolCall = { id, sessionId, name, input, status: 'running', risk, ... }
emit('tool:start', record)
advancePlanStep(toolName, 'in-progress')

// 2. Execute
const outcome = await registry.execute(name, input, toolContext)

// 3. Record completion
record.status = statusFromOutcome(outcome.result.ok, code, aborted)
record.result = outcome.result
emit('tool:end', record)
advancePlanStep(toolName, outcome.result.ok ? 'done' : 'failed')

// 4. Track side effects
if (name === 'write_file' || name === 'patch_file') {
  madeEdits = true
  changedFiles.add(input.path)
}
if (name === 'run_command') {
  ranCommand = true
  executedCommands.add(input.command)
}

// 5. Feed output back to model
const feedback = capMiddle(outcome.result.output, maxToolOutputChars).text
emit('message', makeMessage('tool', feedback, 'tool-result', [call.id]))
messages.push({ role: 'tool', content: feedback, tool_call_id: call.id })
```

### Stall Detection

```typescript
const signature = `${toolName}:${JSON.stringify(input)}`
this.toolSignatures.push(signature)
if (this.toolSignatures.length > REPETITION_LIMIT) this.toolSignatures.shift()
const stalled = toolSignatures.length === REPETITION_LIMIT &&
                toolSignatures.every(s => s === signature)
```

If the same `(tool, input)` pair repeats 3 times, the loop aborts with a "stalled" error. The model receives a corrective message telling it to try a different approach.

## Tool Context

Each tool execution receives a `ToolContext`:

```typescript
{
  projectRoot,          // Absolute workspace path
  workspace,            // WorkspaceInfo (project metadata)
  signal,               // AbortController.signal for cancellation
  logger,               // getLogger('agent') instance
  backupsDir,           // ~/.cluster/backups/<sessionId>/
  sessionId,            // Current session
  alwaysConfirmCommands,// config flag for paranoid mode
  confirm: async (req) => {
    // Calls requestConfirm (which shows UI modal) unless config says otherwise
    if (!config.confirmDestructive && req.risk !== 'destructive') return true
    return await requestConfirm(req)
  },
  emitOutput: (chunk) => emit('tool:output', { callId, chunk }),
  emitProgress: (msg) => emit('progress', { message: msg }),
}
```

## Plan Advancement

The agent tracks plan step progress:

```typescript
private advancePlanStep(toolName: string, status: 'in-progress' | 'done' | 'failed')
```

- When a tool starts: find the first `pending` step → set to `in-progress`
- When a tool succeeds/fails: find the `in-progress` step → set to `done`/`failed`
- Plan updates are emitted on every change so the UI stays in sync

## System Prompt Construction

```typescript
private buildPrompt(): string {
  return buildSystemPrompt({
    workspace,              // Project kind, languages, git branch
    projectRoot,            // Absolute path
    extraInstructions,      // From cluster.config.json
    textProtocol,           // Tool descriptions in text form (if using text protocol)
  })
}
```

The system prompt includes:
1. Core identity and capabilities
2. Workspace context (project type, language, git state)
3. Tool descriptions (either JSON schemas or text format)
4. Safety rules (confirm destructive actions, never escape project root)
5. Output format instructions
6. Any extra instructions from config

---

<div class="see-also">
<strong>Next:</strong> Read <a href="./multi-agent.md">Multi-Agent Orchestration</a> to understand how the Coordinator extends this flow across multiple specialized agents.
</div>
