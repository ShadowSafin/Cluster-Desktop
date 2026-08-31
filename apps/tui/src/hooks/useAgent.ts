import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  createId,
  Emitter,
  getLogger,
  type AgentState,
  type CommandRun,
  type Edit,
  type Message,
  type Plan,
  type Session,
  type ToolCall,
  type TaskGraph,
  type AgentRole,
  type Checkpoint,
  type MemoryEntry,
  type VerificationResult,
} from '@cluster/shared';
import type { AgentEvents } from '@cluster/agent-core';
import { AgentLoop, toProviderMessages } from '@cluster/agent-core';
import type { ConfirmationRequest } from '@cluster/tool-runtime';
import type { Bootstrap } from '../bootstrap.js';
import { listCheckpoints } from '@cluster/storage';

export type TimelineEntry =
  | { kind: 'message'; id: string; at: string; message: Message }
  | { kind: 'tool'; id: string; at: string; call: ToolCall };

export interface ActivityLine {
  id: string;
  text: string;
  level: 'info' | 'warn' | 'error';
  at: string;
}

export interface AgentActivityItem {
  agentRole: AgentRole;
  phase: string;
  message: string;
  timestamp: string;
}

export interface AgentController {
  session: Session;
  entries: TimelineEntry[];
  agentState: AgentState;
  plan: Plan | null;
  liveOutput: Record<string, string>;
  activity: ActivityLine[];
  pendingConfirm: ConfirmationRequest | null;
  running: boolean;
  streamingText: string;
  edits: Edit[];
  // Phase 2
  taskGraph: TaskGraph | null;
  agentActivities: AgentActivityItem[];
  verificationResults: VerificationResult[];
  checkpoints: Checkpoint[];
  memoryProject: MemoryEntry[];
  memorySession: MemoryEntry[];
  multiAgentActive: boolean;
  submit(text: string): void;
  submitMulti(text: string): void;
  cancel(): void;
  cancelTask(taskId: string): void;
  pauseTask(taskId: string): void;
  resumeTask(taskId: string): void;
  retryTask(taskId: string): void;
  retry(): void;
  reload(): void;
  resolveConfirm(approved: boolean): void;
  createCheckpoint(message?: string): Promise<void>;
  rollbackCheckpoint(checkpointId: string): Promise<void>;
}

const MAX_ACTIVITY_LINES = 200;
const MAX_LIVE_OUTPUT_CHARS = 32_000;

/** Rebuild the render timeline from a persisted session. */
function timelineFromSession(session: Session): TimelineEntry[] {
  const entries: TimelineEntry[] = [
    ...session.messages.map(
      (message): TimelineEntry => ({ kind: 'message', id: message.id, at: message.createdAt, message }),
    ),
    ...session.toolCalls.map(
      (call): TimelineEntry => ({ kind: 'tool', id: call.id, at: call.createdAt, call }),
    ),
  ];
  entries.sort((a, b) => a.at.localeCompare(b.at));
  return entries;
}

export function useAgent(bootstrap: Bootstrap): AgentController {
  const { session, store, registry, provider, config, projectRoot, workspace, backupsDir } = bootstrap;
  // Phase2 optional deps - may be undefined in older bootstrap but we now provide
  const coordinator = (bootstrap as any).coordinator as import('@cluster/agent-core').Coordinator | undefined;
  const memory = (bootstrap as any).memory as import('@cluster/memory').MemoryStore | undefined;
  const phase2Events = (bootstrap as any).events as Emitter<AgentEvents> | undefined;

  const [entries, setEntries] = useState<TimelineEntry[]>(() => timelineFromSession(session));
  const [agentState, setAgentState] = useState<AgentState>(session.state);
  const [plan, setPlan] = useState<Plan | null>(session.plan);
  const [liveOutput, setLiveOutput] = useState<Record<string, string>>({});
  const [activity, setActivity] = useState<ActivityLine[]>([]);
  const [pendingConfirm, setPendingConfirm] = useState<ConfirmationRequest | null>(null);
  const [running, setRunning] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const [edits, setEdits] = useState<Edit[]>(session.edits);
  // Phase2 state
  const [taskGraph, setTaskGraph] = useState<TaskGraph | null>(null);
  const [agentActivities, setAgentActivities] = useState<AgentActivityItem[]>([]);
  const [verificationResults, setVerificationResults] = useState<VerificationResult[]>([]);
  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([]);
  const [memoryProject, setMemoryProject] = useState<MemoryEntry[]>([]);
  const [memorySession, setMemorySession] = useState<MemoryEntry[]>([]);
  const [multiAgentActive, setMultiAgentActive] = useState(false);

  const entriesRef = useRef(entries);
  entriesRef.current = entries;

  const confirmRef = useRef<((approved: boolean) => void) | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const lastPromptRef = useRef<string | null>(null);
  const eventsRef = useRef<Emitter<AgentEvents> | null>(null);
  const engineRef = useRef<import('@cluster/task-engine').TaskEngine | null>(null);

  const pushActivity = useCallback((text: string, level: ActivityLine['level'] = 'info') => {
    setActivity((previous) => {
      const next = [...previous, { id: createId('act'), text, level, at: new Date().toISOString() }];
      return next.length > MAX_ACTIVITY_LINES ? next.slice(next.length - MAX_ACTIVITY_LINES) : next;
    });
  }, []);

  const pushAgentActivity = useCallback((role: AgentRole, phase: string, message: string) => {
    setAgentActivities((prev) => {
      const next = [...prev, { agentRole: role, phase, message, timestamp: new Date().toISOString() }];
      return next.length > 200 ? next.slice(next.length - 200) : next;
    });
    pushActivity(`[${role}] ${message}`, phase === 'error' ? 'error' : 'info');
  }, [pushActivity]);

  // Wire agent events to React state and to the session store. This runs once
  // per bootstrap; the agent loop is constructed per turn.
  useEffect(() => {
    if (!eventsRef.current) {
      // Prefer coordinator's events if available (shared emitter), otherwise create own
      eventsRef.current = phase2Events ?? new Emitter<AgentEvents>((error) => {
        getLogger('tui').error({ error }, 'agent event handler failed');
      });
    }
    const events = eventsRef.current;

    const unsubscribers = [
      events.on('message', (message) => {
        setEntries((previous) => [
          ...previous,
          { kind: 'message', id: message.id, at: message.createdAt, message },
        ]);
        store.appendMessage(session.id, message);
        if (message.kind === 'error') pushActivity(message.content, 'error');
        if (message.kind === 'warning') pushActivity(message.content, 'warn');
      }),

      events.on('delta', ({ text }) => {
        setStreamingText((previous) => previous + text);
      }),

      events.on('tool:start', (call) => {
        setEntries((previous) => [...previous, { kind: 'tool', id: call.id, at: call.createdAt, call }]);
        store.appendToolCall(session.id, call);
        pushActivity(`${call.name} started`);
        // Derive agent activity from tool name
        const role = inferRoleFromTool(call.name);
        pushAgentActivity(role, 'acting', `tool ${call.name}`);
      }),

      events.on('tool:end', (call) => {
        setEntries((previous) =>
          previous.map((entry) => (entry.kind === 'tool' && entry.id === call.id ? { ...entry, call } : entry)),
        );
        store.updateToolCall(session.id, call);
        pushActivity(
          `${call.name} ${call.status}${call.durationMs ? ` in ${call.durationMs}ms` : ''}`,
          call.status === 'error' ? 'error' : 'info',
        );
        const role = inferRoleFromTool(call.name);
        pushAgentActivity(role, call.status === 'error' ? 'error' : 'done', `${call.name} ${call.status}`);

        recordEdit(call);
        recordCommandRun(call);

        // If verification tool, collect
        if (call.name === 'verify' && call.result?.data) {
          const data = call.result.data as { verification?: VerificationResult };
          if (data.verification) {
            setVerificationResults((prev) => [...prev, data.verification!].slice(-10));
          }
        }
      }),

      events.on('tool:output', ({ callId, chunk }) => {
        setLiveOutput((previous) => {
          const current = previous[callId] ?? '';
          const next = current + chunk;
          return { ...previous, [callId]: next.slice(-MAX_LIVE_OUTPUT_CHARS) };
        });
      }),

      events.on('state', (state) => {
        setAgentState((previous) => ({
          ...previous,
          phase: state.phase,
          label: state.label,
          iteration: state.iteration,
          maxIterations: state.maxIterations,
        }));
      }),

      events.on('plan', (nextPlan) => {
        setPlan(nextPlan);
        store.setPlan(session.id, nextPlan);
        // Also create taskGraph from plan steps for board
        const graph: TaskGraph = {
          id: createId('graph'),
          goal: nextPlan.goal,
          createdAt: nextPlan.createdAt,
          updatedAt: new Date().toISOString(),
          status: 'running',
          rootIds: nextPlan.steps.map((s) => s.id),
          tasks: Object.fromEntries(nextPlan.steps.map((s) => [s.id, {
            id: s.id,
            title: s.text,
            status: s.status === 'pending' ? 'pending' as const : s.status === 'done' ? 'done' as const : 'pending' as const,
            priority: 'normal' as const,
            agentRole: inferRoleFromTask(s.text),
            dependsOn: [],
            retry: { maxAttempts: 2, attempts: 0, backoffMs: 1000 },
            createdAt: nextPlan.createdAt,
            updatedAt: new Date().toISOString(),
            subtasks: [],
            toolCallIds: [],
          }])) as Record<string, any>,
        };
        setTaskGraph(graph);
      }),

      events.on('progress', ({ message }) => {
        pushActivity(message);
        // Heuristic: messages containing [role] are agent activities
        const m = /^\[(\w+)\]\s*(.*)/.exec(message);
        if (m) {
          const role = m[1] as AgentRole;
          if (['planner','coder','reviewer','tester','context','coordinator'].includes(role)) {
            pushAgentActivity(role, 'thinking', m[2] ?? message);
          }
        }
      }),

      events.on('error', (error) => {
        pushActivity(error.message, error.recoverable ? 'warn' : 'error');
        store.appendError(session.id, {
          id: createId('err'),
          sessionId: session.id,
          source: error.source === 'workspace' ? 'workspace' : error.source,
          message: error.message,
          ...(error.code ? { code: error.code } : {}),
          recoverable: error.recoverable,
          createdAt: new Date().toISOString(),
        });
      }),

      events.on('done', ({ usage, cancelled, iterations }) => {
        setRunning(false);
        setStreamingText('');
        setMultiAgentActive(false);
        setAgentState((previous) => ({
          ...previous,
          usage,
          finishedAt: new Date().toISOString(),
          iteration: iterations,
        }));
        store.updateState(session.id, {
          usage,
          finishedAt: new Date().toISOString(),
          iteration: iterations,
          phase: cancelled ? 'cancelled' : 'done',
        });
        void store.flush();
        // Refresh checkpoints & memory after run
        void refreshCheckpoints();
        void refreshMemory();
        // Mark tasks done in graph
        setTaskGraph((prev) => prev ? {
          ...prev,
          status: cancelled ? 'cancelled' as const : 'done' as const,
          tasks: Object.fromEntries(Object.entries(prev.tasks).map(([k,v]) => [k, { ...v, status: v.status === 'running' ? 'done' as const : v.status }])),
          updatedAt: new Date().toISOString(),
        } : prev);
      }),
    ];

    return () => {
      for (const unsubscribe of unsubscribers) unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.id, store]);

  const refreshCheckpoints = useCallback(async () => {
    try {
      const list = await listCheckpoints(session.id);
      setCheckpoints(list);
    } catch {
      // ignore
    }
  }, [session.id]);

  const refreshMemory = useCallback(async () => {
    if (!memory) return;
    try {
      const proj = await memory.recall({ scope: 'project', limit: 10 });
      const sess = await memory.recall({ scope: 'session', limit: 10 });
      setMemoryProject(proj);
      setMemorySession(sess);
    } catch {
      // ignore
    }
  }, [memory]);

  useEffect(() => {
    void refreshCheckpoints();
    void refreshMemory();
  }, [refreshCheckpoints, refreshMemory]);

  /** Persist file changes so a session can be replayed after restart. */
  const recordEdit = useCallback(
    (call: ToolCall) => {
      if (call.name !== 'write_file' && call.name !== 'patch_file') return;
      const data = call.result?.data as
        | { path?: string; diff?: string; additions?: number; deletions?: number; backupPath?: string; created?: boolean }
        | undefined;
      if (!call.result?.ok || !data?.path || !data.diff) return;

      const edit: Edit = {
        id: createId('edit'),
        sessionId: session.id,
        toolCallId: call.id,
        path: data.path,
        kind: data.created ? 'create' : 'update',
        diff: data.diff,
        ...(data.backupPath ? { backupPath: data.backupPath } : {}),
        additions: data.additions ?? 0,
        deletions: data.deletions ?? 0,
        createdAt: new Date().toISOString(),
      };
      setEdits((previous) => [...previous, edit]);
      store.appendEdit(session.id, edit);
      // also auto-record patch history? tool already does
      void refreshCheckpoints();
    },
    [session.id, store, refreshCheckpoints],
  );

  const recordCommandRun = useCallback(
    (call: ToolCall) => {
      if (call.name !== 'run_command') return;
      const data = call.result?.data as
        | { command?: string; cwd?: string; exitCode?: number | null; durationMs?: number; timedOut?: boolean; cancelled?: boolean; output?: string }
        | undefined;
      if (!data?.command) return;

      const now = new Date().toISOString();
      const run: CommandRun = {
        id: createId('cmd'),
        sessionId: session.id,
        toolCallId: call.id,
        command: data.command,
        cwd: data.cwd ?? projectRoot,
        exitCode: data.exitCode ?? null,
        stdout: data.output ?? '',
        stderr: '',
        durationMs: data.durationMs ?? 0,
        timedOut: data.timedOut ?? false,
        cancelled: data.cancelled ?? false,
        startedAt: call.startedAt ?? now,
        finishedAt: call.finishedAt ?? now,
      };
      store.appendCommandRun(session.id, run);
    },
    [projectRoot, session.id, store],
  );

  const requestConfirm = useCallback((request: ConfirmationRequest) => {
    return new Promise<boolean>((resolve) => {
      confirmRef.current = resolve;
      setPendingConfirm(request);
    });
  }, []);

  const resolveConfirm = useCallback((approved: boolean) => {
    const resolve = confirmRef.current;
    confirmRef.current = null;
    setPendingConfirm(null);
    resolve?.(approved);
  }, []);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    engineRef.current?.cancel();
    setMultiAgentActive(false);
  }, []);

  const cancelTask = useCallback((taskId: string) => {
    engineRef.current?.cancel(taskId);
    setTaskGraph((prev) => prev ? {
      ...prev,
      tasks: { ...prev.tasks, [taskId]: { ...prev.tasks[taskId]!, status: 'cancelled' as const, updatedAt: new Date().toISOString() } },
      updatedAt: new Date().toISOString(),
    } : prev);
    pushActivity(`Cancelled task ${taskId.slice(0, 8)}`);
  }, [pushActivity]);

  const pauseTask = useCallback((taskId: string) => {
    engineRef.current?.pause(taskId);
    pushActivity(`Paused task ${taskId.slice(0, 8)}`);
  }, [pushActivity]);

  const resumeTask = useCallback((taskId: string) => {
    engineRef.current?.resume(taskId);
    pushActivity(`Resumed task ${taskId.slice(0, 8)}`);
  }, [pushActivity]);

  const retryTask = useCallback((taskId: string) => {
    engineRef.current?.retry(taskId);
    setTaskGraph((prev) => prev ? {
      ...prev,
      tasks: { ...prev.tasks, [taskId]: { ...prev.tasks[taskId]!, status: 'pending' as const, error: null, updatedAt: new Date().toISOString() } },
    } : prev);
    pushActivity(`Retrying task ${taskId.slice(0, 8)}`);
  }, [pushActivity]);

  const submit = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (trimmed === '' || running) return;

      // Heuristic: long/complex prompts go multi-agent
      const complex = trimmed.length > 80 || /and also|multiple|several|feature|complex|implement|refactor/i.test(trimmed);
      if (complex && coordinator) {
        void submitMulti(trimmed);
        return;
      }

      lastPromptRef.current = trimmed;
      setRunning(true);
      setStreamingText('');
      setLiveOutput({});

      const controller = new AbortController();
      abortRef.current = controller;

      const messages = entriesRef.current
        .filter((entry): entry is Extract<TimelineEntry, { kind: 'message' }> => entry.kind === 'message')
        .map((entry) => entry.message);
      const toolCalls = entriesRef.current
        .filter((entry): entry is Extract<TimelineEntry, { kind: 'tool' }> => entry.kind === 'tool')
        .map((entry) => entry.call);

      store.updateState(session.id, {
        phase: 'planning',
        label: 'Planning',
        startedAt: new Date().toISOString(),
        finishedAt: null,
      });

      if (messages.length === 0) {
        const title = trimmed.length > 60 ? `${trimmed.slice(0, 57)}…` : trimmed;
        store.renameSession(session.id, title);
      }

      const loop = new AgentLoop({
        config,
        provider,
        registry,
        projectRoot,
        workspace,
        backupsDir,
        sessionId: session.id,
        history: toProviderMessages(messages, toolCalls),
        events: eventsRef.current ?? new Emitter<AgentEvents>(),
        requestConfirm,
      });

      void loop
        .run(trimmed, controller.signal)
        .catch((error) => {
          getLogger('tui').error({ error }, 'agent loop crashed');
          pushActivity(`Agent loop failed: ${(error as Error).message}`, 'error');
        })
        .finally(() => {
          setRunning(false);
          abortRef.current = null;
          void store.flush();
        });
    },
    [backupsDir, config, projectRoot, provider, pushActivity, registry, requestConfirm, running, session.id, store, workspace, coordinator],
  );

  const submitMulti = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (trimmed === '' || running) return;
    if (!coordinator) {
      // fallback to single
      return submit(trimmed);
    }
    lastPromptRef.current = trimmed;
    setRunning(true);
    setMultiAgentActive(true);
    setStreamingText('');
    setLiveOutput({});
    pushAgentActivity('coordinator', 'thinking', `Multi-agent request: ${trimmed.slice(0, 60)}`);

    const controller = new AbortController();
    abortRef.current = controller;

    const messages = entriesRef.current.filter((e): e is Extract<TimelineEntry, { kind: 'message' }> => e.kind === 'message').map((e) => e.message);
    if (messages.length === 0) {
      const title = trimmed.length > 60 ? `${trimmed.slice(0, 57)}…` : trimmed;
      store.renameSession(session.id, title);
    }
    store.updateState(session.id, { phase: 'planning', label: 'Multi-agent planning', startedAt: new Date().toISOString(), finishedAt: null });

    // Use coordinator to create plan + graph
    try {
      const graph = await coordinator.createPlan(trimmed);
      setTaskGraph(graph);
      // Now run graph (parallel)
      // Create a TaskEngine from graph for control
      const { TaskEngine } = await import('@cluster/task-engine');
      const engine = new TaskEngine(graph, { maxConcurrency: 4 });
      engineRef.current = engine;

      // Wire engine events to UI already via coordinator events

      await coordinator.runGraph(graph, controller.signal);
      setTaskGraph({ ...engine.graph });
    } catch (error) {
      pushActivity(`Multi-agent failed: ${(error as Error).message}`, 'error');
      setRunning(false);
      setMultiAgentActive(false);
      return;
    } finally {
      setRunning(false);
      setMultiAgentActive(false);
      abortRef.current = null;
      void store.flush();
    }
  }, [coordinator, pushAgentActivity, pushActivity, running, session.id, store, submit]);

  const retry = useCallback(() => {
    if (!lastPromptRef.current) return;
    const prompt = lastPromptRef.current;
    if (multiAgentActive) submitMulti(prompt);
    else submit(prompt);
  }, [submit, submitMulti, multiAgentActive]);

  /** Re-read the session from disk and rebuild the view (Ctrl+R). */
  const reload = useCallback(() => {
    const fresh = store.getSession(session.id);
    if (!fresh) return;
    setEntries(timelineFromSession(fresh));
    setPlan(fresh.plan);
    setEdits(fresh.edits);
    setAgentState(fresh.state);
    setLiveOutput({});
    void refreshCheckpoints();
    void refreshMemory();
  }, [session.id, store, refreshCheckpoints, refreshMemory]);

  const createCheckpoint = useCallback(async (message?: string) => {
    try {
      const { createCheckpoint } = await import('@cluster/storage');
      const chk = await createCheckpoint({ sessionId: session.id, projectRoot, message: message ?? `Manual checkpoint` });
      pushActivity(`Checkpoint ${chk.id.slice(0, 8)} created`);
      void refreshCheckpoints();
    } catch (error) {
      pushActivity(`Checkpoint failed: ${(error as Error).message}`, 'error');
    }
  }, [session.id, projectRoot, pushActivity, refreshCheckpoints]);

  const rollbackCheckpoint = useCallback(async (checkpointId: string) => {
    try {
      const { rollbackToCheckpoint } = await import('@cluster/storage');
      const result = await rollbackToCheckpoint({ sessionId: session.id, checkpointId, projectRoot });
      pushActivity(`Rollback to ${checkpointId.slice(0, 8)}: ${result.restored.length} files restored`);
      void refreshCheckpoints();
    } catch (error) {
      pushActivity(`Rollback failed: ${(error as Error).message}`, 'error');
    }
  }, [session.id, projectRoot, pushActivity, refreshCheckpoints]);

  // Surface external file changes in the activity feed.
  useEffect(() => {
    const watcher = bootstrap.watcher;
    if (!watcher) return;
    return watcher.events.on('change', (change) => {
      pushActivity(`${change.type === 'unlink' ? 'deleted' : 'changed'} ${change.relative}`);
    });
  }, [bootstrap.watcher, pushActivity]);

  return useMemo(
    () => ({
      session,
      entries,
      agentState,
      plan,
      liveOutput,
      activity,
      pendingConfirm,
      running,
      streamingText,
      edits,
      taskGraph,
      agentActivities,
      verificationResults,
      checkpoints,
      memoryProject,
      memorySession,
      multiAgentActive,
      submit,
      submitMulti,
      cancel,
      cancelTask,
      pauseTask,
      resumeTask,
      retryTask,
      retry,
      reload,
      resolveConfirm,
      createCheckpoint,
      rollbackCheckpoint,
    }),
    [
      session,
      entries,
      agentState,
      plan,
      liveOutput,
      activity,
      pendingConfirm,
      running,
      streamingText,
      edits,
      taskGraph,
      agentActivities,
      verificationResults,
      checkpoints,
      memoryProject,
      memorySession,
      multiAgentActive,
      submit,
      submitMulti,
      cancel,
      cancelTask,
      pauseTask,
      resumeTask,
      retryTask,
      retry,
      reload,
      resolveConfirm,
      createCheckpoint,
      rollbackCheckpoint,
    ],
  );
}

function inferRoleFromTool(toolName: string): AgentRole {
  switch (toolName) {
    case 'write_file':
    case 'patch_file':
      return 'coder';
    case 'run_command':
    case 'verify':
      return 'tester';
    case 'read_file':
    case 'search_text':
    case 'list_files':
      return 'context';
    case 'git_diff':
    case 'git_status':
      return 'reviewer';
    default:
      return 'coder';
  }
}

function inferRoleFromTask(text: string): AgentRole {
  const lower = text.toLowerCase();
  if (/plan/.test(lower)) return 'planner';
  if (/test|verify|lint|build/.test(lower)) return 'tester';
  if (/review/.test(lower)) return 'reviewer';
  if (/context|gather|search/.test(lower)) return 'context';
  return 'coder';
}
