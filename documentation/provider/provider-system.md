# Provider / Model System

## Overview

The provider system handles all interaction with Large Language Model APIs. Cluster uses an **OpenAI-compatible protocol** — any provider that implements the `/chat/completions` endpoint with SSE streaming works out of the box.

## ModelProvider Class

**Location:** `packages/agent-core/src/provider.ts`

```typescript
class ModelProvider {
  constructor(config: AgentConfig)

  // Primary interface
  async chat(request: ChatRequest): Promise<ChatResponse>       // Streaming
  async complete(request: ChatRequest): Promise<ChatResponse>   // Non-streaming (fallback)

  // Tool support detection
  shouldSendTools(forceOff?: boolean): boolean
  markToolsUnsupported(): void
}
```

### Configuration

```typescript
interface AgentConfig {
  apiKey: string;
  baseUrl: string;              // e.g., "https://api.openai.com/v1"
  model: string;                // e.g., "gpt-4o-mini", "claude-3-5-sonnet"
  temperature: number;          // Default: 0.2
  toolMode: 'auto' | 'native' | 'text';
  maxIterations: number;        // Default: 40
  commandTimeoutMs: number;     // Default: 120000
  confirmDestructive: boolean;
  confirmAllCommands: boolean;
  maxToolOutputChars: number;   // Default: 24000
}
```

### Endpoint Construction

```typescript
get endpoint(): string {
  return `${this.config.baseUrl.replace(/\/+$/, '')}/chat/completions`;
}
```

---

## Configuration Resolution (4 Layers)

Config is resolved with increasing priority:

```
┌─────────────────────────────────────────────────────────────────┐
│                    CONFIG RESOLUTION ORDER                       │
│                                                                 │
│  1. Built-in defaults (lowest priority)                         │
│     └─ DEFAULT_CONFIG in config.ts                              │
│        model: "gpt-4o-mini"                                     │
│        baseUrl: "https://api.openai.com/v1"                     │
│        temperature: 0.2                                         │
│        maxIterations: 40                                        │
│                                                                 │
│  2. Environment variables                                       │
│     └─ CLUSTER_API_KEY, OPENAI_API_KEY                          │
│        CLUSTER_BASE_URL, OPENAI_BASE_URL                        │
│        CLUSTER_MODEL                                            │
│        CLUSTER_TOOL_MODE                                        │
│        CLUSTER_MAX_ITERATIONS                                   │
│        CLUSTER_COMMAND_TIMEOUT_MS                               │
│        CLUSTER_TEMPERATURE                                      │
│        CLUSTER_CONFIRM_DESTRUCTIVE                              │
│        CLUSTER_CONFIRM_COMMANDS                                 │
│                                                                 │
│  3. Global config file                                          │
│     └─ ~/.cluster/config.json                                   │
│                                                                 │
│  4. Project config file (highest priority)                      │
│     └─ <project-root>/cluster.config.json                       │
│                                                                 │
│  5. Explicit overrides (from IPC calls)                         │
│     └─ Passed directly to loadConfig({ overrides })             │
└─────────────────────────────────────────────────────────────────┘
```

### Example `cluster.config.json`

```json
{
  "model": "gpt-4o",
  "baseUrl": "https://api.openai.com/v1",
  "temperature": 0.1,
  "maxIterations": 30,
  "confirmDestructive": true,
  "commands": {
    "build": "npm run build",
    "test": "npm test --silent",
    "lint": "npm run lint",
    "format": "npm run format"
  },
  "ignore": ["dist/**", "node_modules/**", ".next/**"]
}
```

---

## Tool Modes

| Mode | Behavior | Use Case |
|------|----------|----------|
| `auto` (default) | Tries native function calling first; falls back to text protocol on rejection | Production use |
| `native` | Always sends tool schemas as JSON; fails if provider doesn't support it | OpenAI-compatible providers known to support tools |
| `text` | Never sends tools; expects model to output fenced code blocks | Legacy providers, local models without tool support |

Auto-detection works by checking for HTTP 400/422/404 responses containing "tool" or "function" in the error body (`ProviderError.isToolUnsupported`). On first failure, the provider marks itself as tool-unsupported and rebuilds the system prompt with text-format tool descriptions.

---

## Streaming Protocol

### Native Function Calling (OpenAI Format)

```
POST {baseUrl}/chat/completions
Content-Type: application/json
Authorization: Bearer {apiKey}

{
  "model": "gpt-4o-mini",
  "messages": [...],
  "stream": true,
  "tools": [{ type: "function", function: { name, description, parameters } }],
  "tool_choice": "auto"
}
```

**Response (SSE):**
```
data: {"choices":[{"delta":{"content":"Here"}}]}
data: {"choices":[{"delta":{"content":" is"}}]}
data: {"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"name":"write_file"}}]}}]}
data: {"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"arguments":"{\"path\""}}]}}]}
data: {"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"arguments":"\":\\"src"}}]}}]}
...
data: {"usage":{"prompt_tokens":120,"completion_tokens":45,"total_tokens":165}}
data: [DONE]
```

The `readStream()` method merges incremental `tool_calls` by index, so partial arguments accumulate into complete JSON strings.

### Text Protocol (Fallback)

When function calling is unsupported, the model outputs tool calls as fenced blocks:

````
I'll write the file now.

```tool_write_file
{
  "path": "src/auth.ts",
  "content": "export..."
}
```
````

Parsed by `parseToolBlock()` in `prompts.ts`:
```typescript
function parseToolBlock(content: string): { tool: string; input: unknown } | null
```

---

## Error Handling

| Status | Error Property | Response |
|--------|---------------|----------|
| 401 / 403 | `ProviderError.isAuthError = true` | Shows "Authentication failed" message |
| 400 / 422 with "tool" | `ProviderError.isToolUnsupported = true` | Switches to text protocol |
| 400 / 422 / 404 (other) | Generic ProviderError | Shows HTTP status + message |
| Network failure | Generic Error | Shows connection failure |
| Empty response | Handled in agent loop | Falls back to single complete() call |

```typescript
class ProviderError extends Error {
  constructor(message: string, readonly status: number, readonly body: string)

  get isToolUnsupported(): boolean  // 400/422/404 + "tool"/"function" in body
  get isAuthError(): boolean        // 401/403
}
```

---

## Model Discovery

The `models:list` IPC handler attempts multiple endpoint patterns:

```
Candidates tried in order:
  1. {baseUrl}/models              (OpenAI standard)
  2. {baseUrl}/v1/models           (if baseUrl doesn't end in /v1)
  3. {baseUrl}/api/tags            (Ollama local)
```

Response formats handled:
- OpenAI: `{ data: [{ id, name, owned_by }] }`
- Generic: `{ models: [...] }` or plain array

On failure, shows the last error message. Timeout: 12 seconds per URL.

---

## Model Test

The `models:test` IPC handler performs a live ping:

```typescript
{
  messages: [{ role: 'user', content: 'respond with the word ok' }]
}
```

Returns: `{ ok: true, latencyMs: 234, reply: 'ok' }` or `{ ok: false, latencyMs: 0, error: '...' }`

---

## Supported Providers (Examples)

| Provider | Base URL | Notes |
|----------|----------|-------|
| OpenAI | `https://api.openai.com/v1` | Default |
| Azure OpenAI | `https://{resource}.openai.azure.com/openai/deployments/{deploy}` | Requires API key; may need path adjustment |
| Ollama (local) | `http://localhost:11434/v1` | Run `ollama serve` first |
| LiteLLM proxy | `http://localhost:4000` | Aggregates multiple providers |
| Anthropic (via proxy) | Any /v1-compatible endpoint | Needs tool schema adaptation |
| LocalAI | `http://localhost:8080/v1` | OpenAI-compatible local inference |

> **Note**: Cluster does not have native Anthropic or Google SDK support. Use a proxy (LiteLLM, OpenRouter, etc.) that exposes an OpenAI-compatible `/chat/completions` endpoint.

---

## Current Limitations

| Limitation | Details |
|-----------|---------|
| Single provider at a time | No multi-provider failover within a session |
| No token counting cache | Usage is counted per-request; no running total across turns |
| Text protocol is slower | Falls back to unstreamed text parsing instead of native tool calling |
| No provider-specific optimization | Tool schemas are always OpenAI-format; Anthropic-style schemas not generated |
