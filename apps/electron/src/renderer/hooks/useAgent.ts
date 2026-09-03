import { useEffect, useState, useCallback, useRef } from 'react';

export type AgentPhase = 'idle'|'planning'|'thinking'|'reading'|'editing'|'running'|'verifying'|'summarizing'|'waiting'|'done'|'error'|'cancelled';
export interface AgentState {
  phase: AgentPhase;
  label: string;
  iteration: number;
  maxIterations: number;
}
export interface TimelineEntry {
  kind: 'message' | 'tool';
  id: string;
  at: string;
  message?: any;
  call?: any;
}
export interface TaskItem {
  id: string;
  title: string;
  status: 'pending'|'ready'|'running'|'done'|'failed'|'blocked'|'cancelled'|'paused';
  agentRole?: string;
}
export interface TaskGraph {
  id: string;
  goal: string;
  status: string;
  tasks: Record<string, TaskItem>;
}

export interface FileProgressState {
  active: boolean;
  action?: 'reading' | 'writing' | 'patching' | 'read' | 'written' | 'patched';
  status?: 'running' | 'done' | 'failed';
  file?: string;
  fileIndex?: number;
  totalFiles?: number;
  lines?: number;
  sizeBytes?: number;
  reason?: string;
  queuedFiles?: string[];
  completedFiles?: string[];
}

export function useAgent(sessionId: string | null) {
  const isElectron = typeof (window as any).cluster !== 'undefined';
  const [entries, setEntries] = useState<TimelineEntry[]>([]);
  const [agentState, setAgentState] = useState<AgentState>({ phase:'idle', label:'Ready', iteration:0, maxIterations:40 });
  const [running, setRunning] = useState(false);
  const [plan, setPlan] = useState<any|null>(null);
  const [taskGraph, setTaskGraph] = useState<TaskGraph|null>(null);
  const [liveOutput, setLiveOutput] = useState<Record<string,string>>({});
  const [activity, setActivity] = useState<string[]>([]);
  const [edits, setEdits] = useState<any[]>([]);
  const [streamingText, setStreamingText] = useState('');
  const [jobs, setJobs] = useState<any[]>([]);
  const [pendingConfirm, setPendingConfirm] = useState<any|null>(null);
  const [recalledMemories, setRecalledMemories] = useState<any[]>([]);
  const [fileProgress, setFileProgress] = useState<FileProgressState | null>(null);
  const [activeSkill, setActiveSkill] = useState<{ skill: any; params: any; rawCommand: string } | null>(null);

  // Performance Optimization: Buffers and Throttle Handles
  const streamingBufferRef = useRef<string>('');
  const streamingRafRef = useRef<number | null>(null);

  const toolOutputBufferRef = useRef<Record<string, string>>({});
  const toolOutputTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const activityQueueRef = useRef<string[]>([]);
  const activityTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Throttled activity push to eliminate state thrashing
  const pushActivity = useCallback((msg: string) => {
    const formatted = `[${new Date().toLocaleTimeString()}] ${msg}`;
    activityQueueRef.current.push(formatted);
    if (!activityTimerRef.current) {
      activityTimerRef.current = setTimeout(() => {
        activityTimerRef.current = null;
        if (activityQueueRef.current.length > 0) {
          const queued = [...activityQueueRef.current];
          activityQueueRef.current = [];
          setActivity((prev) => [...prev.slice(-(250 - queued.length)), ...queued]);
        }
      }, 75);
    }
  }, []);

  // Flush streaming text to state on RAF boundaries (~25-30fps)
  const flushStreaming = useCallback((immediateText?: string) => {
    if (streamingRafRef.current !== null) {
      cancelAnimationFrame(streamingRafRef.current);
      streamingRafRef.current = null;
    }
    const val = immediateText !== undefined ? immediateText : streamingBufferRef.current;
    streamingBufferRef.current = val;
    setStreamingText(val);
  }, []);

  useEffect(() => {
    if (!sessionId) {
      setEntries([]); setPlan(null); setTaskGraph(null); setEdits([]); setActivity([]); setLiveOutput({}); setJobs([]); setStreamingText(''); setAgentState({ phase:'idle', label:'Ready', iteration:0, maxIterations:40 }); setRunning(false);
      streamingBufferRef.current = '';
      toolOutputBufferRef.current = {};
      activityQueueRef.current = [];
      return;
    }
    if (!isElectron) return;
    window.cluster.sessions.get(sessionId).then(sess => {
      if (!sess) return;
      const entriesFromSess: TimelineEntry[] = [
        ...(sess.messages||[]).map((m:any)=>({ kind:'message' as const, id:m.id, at:m.createdAt, message:m })),
        ...(sess.toolCalls||[]).map((c:any)=>({ kind:'tool' as const, id:c.id, at:c.createdAt, call:c })),
      ].sort((a,b)=>a.at.localeCompare(b.at));
      setEntries(entriesFromSess);
      setAgentState(sess.state ?? { phase:'idle', label:'Ready', iteration:0, maxIterations:40 });
      setPlan(sess.plan ?? null);
      setEdits(sess.edits ?? []);
      if (sess.commandRuns?.length) {
        setJobs(sess.commandRuns.map((r:any)=>({ id:r.id, command:r.command, cwd:r.cwd, status: r.exitCode===0?'done':'failed', output: r.stdout, startedAt: r.startedAt })));
      }
      setRunning(sess.state?.phase==='running' || sess.state?.phase==='thinking' || sess.state?.phase==='planning');
    }).catch((e)=>console.warn('[Cluster] sessions.get failed', e));
    window.cluster.jobs.list(sessionId).then(setJobs).catch((e)=>console.warn('[Cluster] jobs.list failed', e));
  }, [sessionId, isElectron]);

  useEffect(() => {
    if (!sessionId || !isElectron) return;
    const unsubs = [
      window.cluster.agent.onMessage(({ sessionId: sid, message }) => {
        if (sid !== sessionId) return;
        streamingBufferRef.current = '';
        flushStreaming('');
        // Skip assistant messages that have no text and no tools
        if (message.role === 'assistant' && !message.content?.trim() && (!message.toolCallIds || message.toolCallIds.length === 0)) {
          return;
        }
        setEntries(e => {
          // If this message already exists by id, skip
          if (e.some(x => x.kind === 'message' && x.id === message.id)) return e;
          // Match optimistic user message added by submit()
          if (message.role === 'user') {
            const optIdx = e.findIndex(x => x.kind === 'message' && x.message?.role === 'user' && x.message?.content === message.content && x.id.startsWith('msg-'));
            if (optIdx >= 0) {
              const copy = [...e];
              copy[optIdx] = { kind: 'message', id: message.id, at: message.createdAt, message };
              return copy;
            }
          }
          return [...e, { kind: 'message', id: message.id, at: message.createdAt, message }];
        });
        if (message.content?.trim()) {
          pushActivity(`${message.role}: ${message.content.slice(0, 140)}`);
        }
      }),
      window.cluster.agent.onDelta(({ sessionId: sid, text }) => {
        if (sid !== sessionId) return;
        streamingBufferRef.current += text;
        if (streamingRafRef.current === null) {
          streamingRafRef.current = requestAnimationFrame(() => {
            streamingRafRef.current = null;
            setStreamingText(streamingBufferRef.current);
          });
        }
      }),
      window.cluster.agent.onToolStart(({ sessionId: sid, call }) => {
        if (sid !== sessionId) return;
        streamingBufferRef.current = '';
        flushStreaming('');
        setEntries(e => [...e, { kind: 'tool', id: call.id, at: call.createdAt, call }]);
        pushActivity(`→ ${call.name} ${JSON.stringify(call.input).slice(0, 80)}`);
        setAgentState(s => ({ ...s, phase: 'running' }));
        setRunning(true);
        if (call.name) {
          setTaskGraph(g => g ? { ...g, tasks: Object.fromEntries(Object.entries(g.tasks).map(([k,v])=> [k, v.status==='pending'||v.status==='ready' ? {...v, status:'running'} : v ])) } : g);
        }
      }),
      window.cluster.agent.onToolEnd(({ sessionId: sid, call }) => {
        if (sid !== sessionId) return;
        setEntries(e => e.map(entry => entry.kind==='tool' && entry.id===call.id ? {...entry, call} : (entry.id===call.id ? {...entry, call} : entry)));
        setEntries(e => {
          const exists = e.some(en => en.id === call.id);
          if (!exists && call.id) return [...e, { kind: 'tool' as const, id: call.id, at: call.finishedAt || new Date().toISOString(), call }];
          return e;
        });
        if (call.result?.data?.diff) {
          setEdits(ed => {
            const exists = ed.some((x: any) => x.path === call.result.data.path && x.diff === call.result.data.diff);
            if (exists) return ed;
            return [...ed, { path: call.result.data.path, diff: call.result.data.diff, additions: call.result.data.additions ?? 0, deletions: call.result.data.deletions ?? 0, createdAt: call.finishedAt }];
          });
        }
        pushActivity(`✓ ${call.name} ${call.status} ${call.durationMs ? `(${call.durationMs}ms)` : ''}`);
        // Clear live output buffer for completed call
        delete toolOutputBufferRef.current[call.id];
        setLiveOutput({ ...toolOutputBufferRef.current });
      }),
      (window.cluster.agent as any).onToolOutput?.(({ sessionId: sid, callId, chunk }: any) => {
        if (sid !== sessionId) return;
        toolOutputBufferRef.current[callId] = (toolOutputBufferRef.current[callId] || '') + chunk;
        if (!toolOutputTimerRef.current) {
          toolOutputTimerRef.current = setTimeout(() => {
            toolOutputTimerRef.current = null;
            setLiveOutput({ ...toolOutputBufferRef.current });
          }, 75);
        }
      }),
      window.cluster.agent.onProgress(({ sessionId: sid, message }) => {
        if (sid!==sessionId) return;
        pushActivity(message);
        // parse agent activity for card updates
        const m = /^\[(\w+)\]\s*(.*)/.exec(message);
        if (m) {
          const role=m[1], msg=m[2];
          // could update agent cards here via activity
        }
      }),
      window.cluster.agent.onState(({ sessionId: sid, state }) => {
        if (sid!==sessionId) return;
        setAgentState(state);
        if (state.phase==='running' || state.phase==='thinking' || state.phase==='planning') setRunning(true);
      }),
      window.cluster.agent.onPlan(({ sessionId: sid, plan: p }) => {
        if (sid!==sessionId) return;
        setPlan(p);
        const graph: TaskGraph = {
          id: 'graph-'+Date.now(),
          goal: p.goal,
          status: 'running',
          tasks: Object.fromEntries(p.steps.map((s:any)=>[s.id, { id:s.id, title:s.text, status:'pending', agentRole: (s.text.match(/\[(\w+)\]/)?.[1] ?? 'coder') }])),
        };
        setTaskGraph(graph);
        pushActivity(`Plan: ${p.goal} — ${p.steps.length} steps`);
      }),
      (window.cluster.agent as any).onGraph?.(({ sessionId: sid, graph }:any)=>{
        if (sid!==sessionId) return;
        setTaskGraph(graph);
        pushActivity(`Graph: ${Object.keys(graph.tasks).length} tasks`);
      }),
      (window.cluster.agent as any).onEdit?.(({ sessionId: sid, edit }:any)=>{
        if (sid!==sessionId) return;
        setEdits(ed=> [...ed, edit]);
        pushActivity(`edit ${edit.path} +${edit.additions} -${edit.deletions}`);
      }),
      (window.cluster.agent as any).onJob?.(({ sessionId: sid, job }:any)=>{
        if (sid!==sessionId) return;
        setJobs(j=> {
          const idx=j.findIndex((x:any)=>x.id===job.id);
          if (idx>=0) { const n=[...j]; n[idx]=job; return n; }
          return [...j, job];
        });
      }),
      (window.cluster.agent as any).onError?.(({ sessionId: sid, error }:any)=>{
        if (sid!==sessionId) return;
        streamingBufferRef.current = '';
        flushStreaming('');
        pushActivity(`error [${error.source}]: ${error.message}`);
        setAgentState(s=>({...s, phase:'error' as any, label: 'Failed'}));
        setEntries(e => {
          const alreadyHas = e.some(item => item.kind === 'message' && item.message?.content?.includes(error.message));
          if (alreadyHas) return e;
          return [...e, {
            kind: 'message',
            id: 'err-' + Date.now(),
            at: new Date().toISOString(),
            message: {
              id: 'err-' + Date.now(),
              sessionId: sid,
              role: 'assistant',
              kind: 'error',
              content: `⚠️ ${error.message}`,
              createdAt: new Date().toISOString(),
            }
          }];
        });
      }),
      (window.cluster.agent as any).onConfirm?.(({ sessionId: sid, request }:any)=>{
        if (sid!==sessionId) return;
        setPendingConfirm(request);
        pushActivity(`confirm required: ${request.tool} — ${request.reason}`);
      }),
      (window.cluster.agent as any).onMemoryRecalled?.(({ sessionId: sid, memories }: any) => {
        if (sid !== sessionId) return;
        setRecalledMemories(memories);
        pushActivity(`Recalled ${memories.length} durable memories`);
      }),
      (window.cluster.skills as any)?.onInvoked?.(({ sessionId: sid, skill, params, rawCommand }: any) => {
        if (sid !== sessionId) return;
        setActiveSkill({ skill, params, rawCommand });
        pushActivity(`[skill] invoked /${skill.manifest.invocationName}`);
      }),
      (window.cluster.agent as any).onFileProgress?.(({ sessionId: sid, ...data }: any) => {
        if (sid !== sessionId) return;
        setFileProgress({
          active: data.status === 'running' || (data.queuedFiles && data.queuedFiles.length > 0),
          ...data,
        });
        pushActivity(`[file] ${data.action}: ${data.file} (${data.fileIndex}/${data.totalFiles})`);
      }),
      window.cluster.agent.onDone(({ sessionId: sid, summary, cancelled }) => {
        if (sid!==sessionId) return;
        setRunning(false);
        streamingBufferRef.current = '';
        flushStreaming('');
        setActiveSkill(null);
        setAgentState(s=>({...s, phase: cancelled ? 'cancelled' : 'done' as any }));
        pushActivity(cancelled ? 'cancelled' : `done: ${summary.slice(0,120)}`);
        setTaskGraph(g=> g ? {...g, status: cancelled?'cancelled':'done', tasks: Object.fromEntries(Object.entries(g.tasks).map(([k,v])=>[k, {...v, status: (v.status==='running'||v.status==='pending'||v.status==='ready') ? (cancelled?'cancelled':'done') as any : v.status }]))} : g);
        setTimeout(() => {
          setFileProgress((prev) => (prev ? { ...prev, active: false } : null));
        }, 3500);
      }),
    ].filter(Boolean) as (()=>void)[];
    return () => {
      if (streamingRafRef.current !== null) cancelAnimationFrame(streamingRafRef.current);
      if (toolOutputTimerRef.current !== null) clearTimeout(toolOutputTimerRef.current);
      if (activityTimerRef.current !== null) clearTimeout(activityTimerRef.current);
      unsubs.forEach(fn=>fn());
    };
  }, [sessionId, pushActivity, flushStreaming, isElectron]);

  const submit = useCallback(async (text: string) => {
    if (!sessionId || !text.trim()) return;
    if (!isElectron) { pushActivity('Cannot send: not in Electron (no preload)'); return; }
    const trimmed = text.trim();
    const userMsg = { id:`msg-${Date.now()}`, sessionId, role:'user', content: trimmed, createdAt: new Date().toISOString(), kind:'chat' };
    setEntries(e=>[...e, { kind:'message', id:userMsg.id, at:userMsg.createdAt, message:userMsg }]);
    setRunning(true);
    setAgentState({ phase:'planning', label:'Planning', iteration:0, maxIterations:40 });
    streamingBufferRef.current = '';
    flushStreaming('');
    setLiveOutput({});
    toolOutputBufferRef.current = {};
    setFileProgress(null);
    const isMulti = trimmed.startsWith('/multi ');
    const actualText = isMulti ? trimmed.replace(/^\/multi\s+/, '') : trimmed;
    try {
      await window.cluster.agent.send({ sessionId, text: actualText, mode: isMulti ? 'multi' : 'single' });
    } catch (e:any) {
      pushActivity(`send failed: ${e.message}`);
      setRunning(false);
    }
  }, [sessionId, pushActivity, flushStreaming, isElectron]);

  const cancel = useCallback(async () => {
    if (!sessionId) return;
    if (!isElectron) return;
    await window.cluster.agent.cancel(sessionId);
    setRunning(false);
    streamingBufferRef.current = '';
    flushStreaming('');
    setFileProgress(null);
    setActiveSkill(null);
    setAgentState(s=>({...s, phase:'cancelled'}));
    pushActivity('cancel requested');
  }, [sessionId, pushActivity, flushStreaming, isElectron]);

  const confirm = useCallback((approved:boolean)=>{
    if (!pendingConfirm || !sessionId) return;
    if (!isElectron) return;
    (window.cluster.agent as any).confirm(sessionId, pendingConfirm.id||pendingConfirm.tool, approved);
    setPendingConfirm(null);
    pushActivity(approved ? 'confirmed' : 'rejected');
  }, [pendingConfirm, sessionId, pushActivity, isElectron]);

  const clear = useCallback(()=>{
    setEntries([]);
    streamingBufferRef.current = '';
    flushStreaming('');
    setLiveOutput({});
    toolOutputBufferRef.current = {};
    setFileProgress(null);
    setActiveSkill(null);
  }, [flushStreaming]);

  return { entries, agentState, running, plan, taskGraph, liveOutput, activity, edits, jobs, streamingText, pendingConfirm, recalledMemories, fileProgress, activeSkill, submit, cancel, confirm, clear, setEntries, setTaskGraph };
}
