# Developer Guide

## Adding a New Page

1. Create the page component in `apps/electron/src/renderer/pages/YourPage.tsx`:

```typescript
import React, { useEffect, useState } from 'react';

export const YourPage: React.FC<{ sessionId?: string; projectRoot?: string }> = ({ sessionId, projectRoot }) => {
  const [data, setData] = useState<any[]>([]);

  useEffect(() => {
    if (typeof window.cluster === 'undefined') return;
    window.cluster.yourApi.list({ projectRoot }).then(setData).catch(console.error);
  }, [projectRoot]);

  return (
    <div className="p-6 overflow-auto h-full">
      <h1 className="text-lg font-semibold text-white mb-4">Your Page</h1>
      {/* Your content */}
    </div>
  );
};
```

2. Add to `PageId` type in `Sidebar.tsx`:

```typescript
export type PageId =
  | 'sessions' | 'workspace' | 'tasks' | 'diff' | 'logs'
  | 'background' | 'checkpoints' | 'memory' | 'provider' | 'settings'
  | 'yourPage';  // Add here
```

3. Add nav item to the `navItems` array in `Sidebar.tsx`:

```typescript
{ id: 'yourPage', label: 'Your Page', shortcut: '9' /* next number */ }
```

4. Import and conditionally render in `App.tsx`:

```typescript
import { YourPage } from './pages/YourPage';

// In the main content area:
{currentPage === 'yourPage' && (
  <YourPage sessionId={activeSessionId} projectRoot={projectRoot} />
)}
```

5. If the page needs new IPC handlers, register them in `main/index.ts` and expose them in `preload/index.ts`.

---

## Adding a New Agent

Agents are defined in `packages/shared/src/agents.ts` and implemented as classes.

### Step 1: Define the Agent Role

Add to `AGENT_DEFINITIONS` in `shared/src/agents.ts`:

```typescript
export const AGENT_DEFINITIONS: Record<AgentRole, AgentDefinition> = {
  // ... existing agents ...
  myAgent: {
    role: 'myAgent',
    name: 'My Agent',
    description: 'Does something special',
    allowedTools: ['read_file', 'write_file', 'search_text'],
    deniedTools: ['run_command'],
    parallelizable: true,
    maxConcurrency: 2,
    systemPrompt: 'You are the My Agent. Your job is to...',
  },
};
```

Update the `AgentRole` type in `shared/src/tasks.ts`:

```typescript
export type AgentRole =
  | 'planner' | 'coder' | 'reviewer' | 'tester' | 'context' | 'coordinator'
  | 'myAgent';  // Add here
```

### Step 2: Implement the Agent Class

Create `packages/agent-core/src/agents/myAgent.ts`:

```typescript
import type { BaseAgent, AgentContext, AgentRunOutput } from './types.js';
import { createId, AGENT_DEFINITIONS, type Task, type ToolCall } from '@cluster/shared';
import { ModelProvider } from '../provider.js';
import type { AgentConfig } from '../config.js';

export class MyAgent implements BaseAgent {
  role = 'myAgent' as const;
  name = AGENT_DEFINITIONS.myAgent.name;

  constructor(
    private readonly config: AgentConfig,
    private readonly provider: ModelProvider,
  ) {}

  systemPrompt(): string {
    return AGENT_DEFINITIONS.myAgent.systemPrompt;
  }

  async run(task: Task, ctx: AgentContext): Promise<AgentRunOutput> {
    // Implement agent logic
    // Use ctx.registry.execute() for tool calls
    // Use ctx.emitActivity() for progress updates
    // Respect ctx.signal for cancellation
  }
}
```

### Step 3: Register in Coordinator

In `packages/agent-core/src/coordinator.ts`, add to the constructor:

```typescript
import { MyAgent } from './agents/myAgent.js';

private myAgent: MyAgent;

constructor(opts: CoordinatorOptions) {
  // ... existing agents ...
  this.myAgent = new MyAgent(opts.config, opts.provider);
  this.agents.set('myAgent', this.myAgent);
}
```

---

## Adding a New Tool

### Step 1: Define the Tool Schema

Create `packages/tool-runtime/src/tools/myTool.ts`:

```typescript
import { z } from 'zod';
import { okResult, failResult, type AnyTool, type ToolContext } from '../types.js';
import { riskOf } from '../safety.js';

const schema = z.object({
  path: z.string().min(1),
  mode: z.enum(['read', 'write']).default('read'),
});

export const myTool: AnyTool = {
  name: 'my_tool',
  description: 'Performs a custom operation on a file.',
  schema,
  risk: ({ path }) => (path.includes('.env') ? 'destructive' : 'safe'),
  execute: async (input, ctx) => {
    const { path, mode } = input;
    try {
      // Implement tool logic using fs, child_process, etc.
      // Always use ctx.projectRoot for path resolution
      const result = await doSomething(path, mode, ctx);
      return okResult({ data: { success: true, result } });
    } catch (err) {
      return failResult(`my_tool failed: ${(err as Error).message}`);
    }
  },
};
```

### Step 2: Export from Tools Index

In `packages/tool-runtime/src/tools/index.ts`:

```typescript
import { myTool } from './myTool.js';

export { myTool };

export const defaultTools = [
  // ... existing tools ...
  myTool,  // Add here
];
```

### Step 3: Add to Agent Definitions (if needed)

If the tool should only be available to certain agents, add it to their `allowedTools` list in `shared/src/agents.ts`.

---

## Adding a New Provider

To support a new LLM provider, you typically only need to change the `baseUrl` and `model` in config — no code changes are needed since Cluster uses the OpenAI-compatible protocol.

However, if the provider requires special handling (custom headers, different streaming format, etc.):

### Step 1: Extend ModelProvider

In `packages/agent-core/src/provider.ts`, add provider-specific logic:

```typescript
// Example: Custom headers for a specific provider
private getHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    authorization: `Bearer ${this.config.apiKey}`,
  };
  if (this.config.baseUrl.includes('custom-provider')) {
    headers['x-custom-header'] = 'some-value';
  }
  return headers;
}
```

### Step 2: Test with models:test

Use the Provider page's "Test Connection" button to verify the new provider works end-to-end.

---

## Extending Memory

### Adding a New Memory Category

Update `MemoryCategory` in `packages/shared/src/memory.ts`:

```typescript
export type MemoryCategory =
  | 'project' | 'session' | 'user_preference' | 'task' | 'bug'
  | 'architecture' | 'file' | 'command' | 'provider_model'
  | 'checkpoint' | 'global' | 'fact' | 'convention' | 'pattern'
  | 'note' | 'important-file' | 'ui_style' | 'workflow'
  | 'myNewCategory';  // Add here
```

### Adding Extraction Logic

In `packages/memory/src/extraction.ts`, add a new regex pattern to `extractFromPrompt()`:

```typescript
// My new category detection
const myMatch = /(?:my specific pattern)\s+([^.,\n]{10,120})/i.exec(trimmed);
if (myMatch) {
  const entry = createMemoryEntry({
    id: createId('mem'),
    key: `mycat:${slugify(myMatch[1])}`,
    title: `My Category: ${myMatch[1].slice(0, 60)}`,
    summary: myMatch[1],
    value: `My category rule: ${myMatch[1]}`,
    category: 'myNewCategory',
    scope: 'project',
    importance: 0.7,
    confidence: 0.85,
    tags: ['my-category'],
  });
  const stored = await this.saveOrDeduplicate(entry);
  if (stored) saved.push(stored);
}
```

---

## Extending IPC

### Main Process Handler

In `apps/electron/src/main/index.ts`, inside `registerIpc()`:

```typescript
ipcMain.handle('my:newAction', async (_e, payload: MyPayload) => {
  const result = await doSomething(payload);
  return result;
});
```

### Preload Bridge

In `apps/electron/src/preload/index.ts`, add to the `IpcApi` type and `api` object:

```typescript
export type IpcApi = {
  // ... existing APIs ...
  my: {
    newAction: (payload: MyPayload) => Promise<MyResult>;
  };
};

const api: IpcApi = {
  // ... existing APIs ...
  my: {
    newAction: (payload) => ipcRenderer.invoke('my:newAction', payload),
  },
};
```

### Renderer Usage

```typescript
const result = await window.cluster.my.newAction({ foo: 'bar' });
```

---

## Debugging Tips

| Issue | Debug Method |
|-------|-------------|
| Renderer not loading | Check main process console for `did-fail-load` or `ready-to-show timeout` |
| IPC handler not firing | Add `console.log` at top of handler in `main/index.ts` |
| Tool returning empty output | Check `ctx.projectRoot` — tools resolve paths relative to this |
| Session not persisting | Verify `store.flush()` is called after mutations |
| Memory not recalling | Check `memory.init()` was called before first use |
| Type errors across packages | Run `npm run rebuild` to force full recompilation |
| Electron shows blank window | Check dev tools console for JavaScript errors in renderer |
