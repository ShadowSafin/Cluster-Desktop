import React, { useCallback, useMemo, useState } from 'react';
import { Box, Text, useApp, useInput } from 'ink';
import { pluralize, type AgentPhase } from '@cluster/shared';
import { theme } from './theme.js';
import type { Bootstrap } from './bootstrap.js';
import { useAgent } from './hooks/useAgent.js';
import { useTerminalSize } from './hooks/useTerminalSize.js';
import { ActivityFeed } from './components/ActivityFeed.js';
import { ChatView } from './components/ChatView.js';
import { Composer } from './components/Composer.js';
import { ConfirmDialog } from './components/ConfirmDialog.js';
import { HelpOverlay } from './components/HelpOverlay.js';
import { PlanView } from './components/PlanView.js';
import { SelectList } from './components/SelectList.js';
import { Splash } from './components/Splash.js';
import { StatusBar } from './components/StatusBar.js';
import { TaskBoard } from './components/TaskBoard.js';
import { DiffPanel } from './components/DiffPanel.js';
import { AgentPanel } from './components/AgentPanel.js';
import { VerificationPanel } from './components/VerificationPanel.js';
import { CheckpointPanel } from './components/CheckpointPanel.js';
import { MemoryPanel } from './components/MemoryPanel.js';
import { CommandPalette } from './components/CommandPalette.js';
import { CollapsibleLogs, LiveOutputPanel } from './components/CollapsibleLogs.js';

export interface AppProps {
  bootstrap: Bootstrap;
  onExit(): void;
}

const VERSION = '0.1.0';

const QUICK_ACTIONS = [
  { id: '/help', label: '/help', detail: 'keyboard shortcuts' },
  { id: '/plan', label: '/plan', detail: 'show the current plan' },
  { id: '/status', label: '/status', detail: 'workspace and session info' },
  { id: '/edits', label: '/edits', detail: 'files changed this session' },
  { id: '/tasks', label: '/tasks', detail: 'task board & timeline' },
  { id: '/diff', label: '/diff', detail: 'review & rollback changes' },
  { id: '/verify', label: '/verify', detail: 'verification results' },
  { id: '/agents', label: '/agents', detail: 'agent activity' },
  { id: '/memory', label: '/memory', detail: 'project knowledge' },
  { id: '/checkpoint', label: '/checkpoint', detail: 'checkpoint & rollback' },
  { id: '/clear', label: '/clear', detail: 'clear the visible conversation' },
  { id: '/multi', label: '/multi', detail: 'run in multi-agent mode' },
  { id: '/exit', label: '/exit', detail: 'quit' },
];

type Focus = 'composer' | 'chat' | 'tasks' | 'diff' | 'verify' | 'agents';
type RightTab = 'tasks' | 'diff' | 'verify' | 'agents' | 'logs' | 'checkpoints' | 'memory';

export const App: React.FC<AppProps> = ({ bootstrap, onExit }) => {
  const app = useApp();
  const { rows, columns } = useTerminalSize();
  const agent = useAgent(bootstrap);

  const [value, setValue] = useState('');
  const [cursor, setCursor] = useState(0);
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number | null>(null);
  const [focus, setFocus] = useState<Focus>('composer');
  const [rightTab, setRightTab] = useState<RightTab>('tasks');
  const [showWorkspace, setShowWorkspace] = useState(columns >= 90);
  const [scrollOffset, setScrollOffset] = useState(0);
  const [expandedTools, setExpandedTools] = useState<Set<string>>(new Set());
  const [showActivity, setShowActivity] = useState(true);
  const [showHelp, setShowHelp] = useState(false);
  const [showPalette, setShowPalette] = useState(false);
  const [quickActions, setQuickActions] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [clearIndex, setClearIndex] = useState(0);
  const [searchHistory, setSearchHistory] = useState(false);

  const modalOpen = Boolean(agent.pendingConfirm) || showHelp || quickActions || showPalette || searchHistory;
  const composerFocused = focus === 'composer' && !modalOpen;

  const visibleEntries = useMemo(() => agent.entries.slice(clearIndex), [agent.entries, clearIndex]);

  const quit = useCallback(() => {
    void bootstrap.close().finally(() => {
      onExit();
      app.exit();
    });
  }, [app, bootstrap, onExit]);

  const runSlashCommand = useCallback(
    (command: string): void => {
      const [name] = command.split(/\s+/, 1);
      const arg = command.slice(name.length).trim();
      switch (name) {
        case '/help':
          setShowHelp(true);
          return;
        case '/exit':
        case '/quit':
          quit();
          return;
        case '/clear':
          setClearIndex(agent.entries.length);
          setNotice('Conversation cleared from view. The session is still saved.');
          return;
        case '/plan':
          setNotice(
            agent.plan
              ? [
                  `plan · ${agent.plan.goal}`,
                  ...agent.plan.steps.map((step, index) => `  ${index + 1}. ${step.text}`),
                ].join('\n')
              : agent.taskGraph
              ? `task graph · ${agent.taskGraph.goal}\n${Object.values(agent.taskGraph.tasks).map((t) => `  [${t.agentRole}] ${t.title} (${t.status})`).join('\n')}`
              : 'No plan yet. Send a task to create one.',
          );
          return;
        case '/edits':
          setNotice(
            agent.edits.length === 0
              ? 'No files have been changed in this session.'
              : [
                  `${pluralize(agent.edits.length, 'file')} changed:`,
                  ...agent.edits.map((edit) => `  ${edit.path}  +${edit.additions} -${edit.deletions}`),
                ].join('\n'),
          );
          return;
        case '/tasks':
          setShowWorkspace(true);
          setRightTab('tasks');
          setFocus('tasks');
          return;
        case '/diff':
          setShowWorkspace(true);
          setRightTab('diff');
          setFocus('diff');
          return;
        case '/verify':
          setShowWorkspace(true);
          setRightTab('verify');
          return;
        case '/agents':
          setShowWorkspace(true);
          setRightTab('agents');
          return;
        case '/memory':
          setShowWorkspace(true);
          setRightTab('memory');
          return;
        case '/checkpoint':
          setShowWorkspace(true);
          setRightTab('checkpoints');
          return;
        case '/multi':
          if (arg) agent.submitMulti(arg);
          else setNotice('Usage: /multi <request> — runs in multi-agent parallel mode');
          return;
        case '/checkpoint-create':
          void agent.createCheckpoint(arg || 'Manual checkpoint');
          setNotice('Checkpoint requested…');
          return;
        case '/rollback':
          if (arg) void agent.rollbackCheckpoint(arg);
          else setNotice('Usage: /rollback <checkpointId>');
          return;
        case '/status':
          setNotice(
            [
              `project:  ${bootstrap.workspace?.name ?? bootstrap.projectRoot}`,
              `root:     ${bootstrap.projectRoot}`,
              `model:    ${bootstrap.config.model}`,
              `endpoint: ${bootstrap.config.baseUrl}`,
              `session:  ${agent.session.id}`,
              `messages: ${agent.session.messages.length}`,
              `tools:    ${agent.session.toolCalls.length}`,
              `phase:    ${agent.agentState.phase}`,
              `tasks:    ${agent.taskGraph ? Object.keys(agent.taskGraph.tasks).length + ' tasks' : 'no graph'}`,
              `agents:   ${agent.agentActivities.length} events`,
              `multi:    ${agent.multiAgentActive ? 'active' : 'idle'}`,
            ].join('\n'),
          );
          return;
        default:
          setNotice(`Unknown command: ${name}. Try /help or Ctrl+K palette.`);
      }
    },
    [agent, bootstrap.config.baseUrl, bootstrap.config.model, bootstrap.projectRoot, bootstrap.workspace, quit],
  );

  const handleSubmit = useCallback(() => {
    const text = value.trim();
    if (text === '') return;
    if (text.startsWith('/')) {
      runSlashCommand(text);
      setValue('');
      setCursor(0);
      return;
    }
    setHistory((previous) => [...previous, text]);
    setHistoryIndex(null);
    setValue('');
    setCursor(0);
    setScrollOffset(0);
    setNotice(null);
    // Heuristic: longer prompts auto-use multi-agent
    if (text.length > 100 || text.includes(' and ') && text.includes('also')) {
      agent.submitMulti(text);
    } else {
      agent.submit(text);
    }
  }, [agent, runSlashCommand, value]);

  const handleHistory = useCallback(
    (direction: -1 | 1) => {
      if (history.length === 0) return;
      const next =
        historyIndex === null
          ? direction === -1
            ? history.length - 1
            : null
          : Math.min(history.length - 1, Math.max(0, historyIndex + direction));
      setHistoryIndex(next);
      const entry = next === null ? '' : history[next] ?? '';
      setValue(entry);
      setCursor(entry.length);
    },
    [history, historyIndex],
  );

  useInput(
    (input, key) => {
      if (key.ctrl && input === 'c') {
        if (agent.running) {
          agent.cancel();
          setNotice('Cancelling… press Ctrl+C again to quit.');
        } else {
          quit();
        }
        return;
      }
      if (key.ctrl && input === 'k') {
        setShowPalette((v) => !v);
        return;
      }
      if (key.ctrl && input === 'w') {
        setShowWorkspace((v) => !v);
        setNotice(showWorkspace ? 'Workspace hidden (Ctrl+W to show)' : 'Workspace visible');
        return;
      }
      if (key.tab) {
        if (showWorkspace) {
          const order: Focus[] = ['composer', 'chat', 'tasks', 'diff', 'agents'];
          const idx = order.indexOf(focus);
          const next = order[(idx + 1) % order.length] ?? 'composer';
          setFocus(next as Focus);
          if ((next as string) === 'tasks') setRightTab('tasks');
          if ((next as string) === 'diff') setRightTab('diff');
          if ((next as string) === 'agents') setRightTab('agents');
        } else {
          setFocus((current) => (current === 'composer' ? 'chat' : 'composer'));
        }
        return;
      }
      // Right pane tab switching 1-7
      if (input >= '1' && input <= '7' && !composerFocused) {
        const tabs: RightTab[] = ['tasks', 'diff', 'verify', 'agents', 'logs', 'checkpoints', 'memory'];
        const t = tabs[Number(input) - 1];
        if (t) {
          setShowWorkspace(true);
          setRightTab(t);
          setNotice(`Tab: ${t}`);
        }
        return;
      }
      if (key.ctrl && input === 'a') {
        setShowActivity((current) => !current);
        return;
      }
      if (key.ctrl && input === 'r') {
        agent.reload();
        setClearIndex(0);
        setNotice('Session reloaded from disk.');
        return;
      }
      if (key.ctrl && input === 't') {
        setExpandedTools((previous) =>
          previous.size > 0 ? new Set() : new Set(agent.entries.filter((e) => e.kind === 'tool').map((e) => e.id)),
        );
        return;
      }
      if (key.ctrl && input === 'p' && agent.taskGraph) {
        const running = Object.values(agent.taskGraph.tasks).find((t) => t.status === 'running');
        if (running) {
          agent.pauseTask(running.id);
          setNotice(`Paused task ${running.title.slice(0, 40)}`);
        }
        return;
      }
      if (key.ctrl && input === 'y' && agent.taskGraph) {
        const paused = Object.values(agent.taskGraph.tasks).find((t) => t.status === 'paused');
        if (paused) {
          agent.resumeTask(paused.id);
          setNotice(`Resumed task ${paused.title.slice(0, 40)}`);
        }
        return;
      }
      if (key.ctrl && input === 'g') {
        void agent.createCheckpoint(`Manual @ ${new Date().toLocaleTimeString()}`);
        setNotice('Checkpoint created');
        return;
      }
      if (key.pageUp || (key.ctrl && input === 'b')) {
        setScrollOffset((current) => current + 5);
        return;
      }
      if (key.pageDown || (key.ctrl && input === 'f')) {
        setScrollOffset((current) => Math.max(0, current - 5));
        return;
      }
      if (key.ctrl && input === 'h' && agent.taskGraph) {
        const running = Object.values(agent.taskGraph.tasks).find((t) => t.status === 'running');
        if (running) agent.cancelTask(running.id);
        return;
      }
      if (key.ctrl && input === 'l') {
        setFocus('composer');
        return;
      }
      if (focus === 'chat' || focus === 'tasks' || focus === 'diff') {
        if (input === '?') setShowHelp(true);
        if (input === '/') setQuickActions(true);
        if (input === 'k' && key.ctrl === false) setShowPalette(true);
      }
    },
    { isActive: !modalOpen },
  );

  const inputLines = value.split('\n').length;
  const composerRows = Math.min(inputLines, 6) + 2 + (inputLines > 1 ? 1 : 0);
  const noticeRows = notice ? notice.split('\n').length + 2 : 0;
  const planRows = agent.plan ? agent.plan.steps.length + 2 : 0;
  const workspaceRows = showWorkspace ? 16 : 0;

  const chromeRows =
    1 +
    1 +
    1 +
    composerRows +
    noticeRows +
    planRows +
    (showActivity ? 6 : 0) +
    workspaceRows;

  const chatRows = Math.max(6, rows - chromeRows);
  const busy = agent.running;
  const headerPhase: AgentPhase = agent.agentState.phase;

  // Command palette items
  const paletteItems = [
    { id: '/tasks', label: 'Show task board', detail: 'task timeline · Ctrl+W · 1', hotkey: '1' },
    { id: '/diff', label: 'Show diff panel', detail: 'side-by-side · 2', hotkey: '2' },
    { id: '/verify', label: 'Verification', detail: 'tests · 3', hotkey: '3' },
    { id: '/agents', label: 'Agent activity', detail: 'live indicators · 4', hotkey: '4' },
    { id: '/checkpoint', label: 'Checkpoints', detail: 'rollback · 6', hotkey: '6' },
    { id: '/memory', label: 'Memory', detail: 'project knowledge · 7', hotkey: '7' },
    { id: 'action:checkpoint', label: 'Create checkpoint', detail: 'Ctrl+G' },
    { id: 'action:toggle-workspace', label: showWorkspace ? 'Hide workspace' : 'Show workspace', detail: 'Ctrl+W' },
    { id: 'action:expand-tools', label: 'Toggle tool details', detail: 'Ctrl+T' },
    ...QUICK_ACTIONS.map((q) => ({ id: q.id, label: q.label, detail: q.detail })),
  ];

  const searchableHistory = history.map((h, i) => ({ id: `hist-${i}`, label: h.slice(0, 80), detail: `${i}` }));

  return (
    <Box flexDirection="column" width={columns} height={rows}>
      {/* Header with agent indicators — truncate on narrow terminals */}
      <Box justifyContent="space-between" paddingX={1} overflow="hidden">
        <Box overflow="hidden">
          <Text color={theme.accent} bold wrap="truncate">Cluster CLI v{VERSION}</Text>
          <Text color={theme.dim} wrap="truncate"> · {bootstrap.workspace?.name ?? bootstrap.projectRoot}</Text>
          {agent.running ? (
            <>
              <Text color={theme.dim}> · </Text>
              <Text color={theme.accent} wrap="truncate">{headerPhase}</Text>
              {agent.multiAgentActive ? <Text color={theme.warning}> · multi</Text> : null}
            </>
          ) : null}
        </Box>
        <Box overflow="hidden">
          {agent.agentActivities.length > 0 && columns >= 100 ? (
            <Text color={theme.dim} wrap="truncate">
              {agent.agentActivities.slice(-2).map((a) => `${a.agentRole}:${a.phase}`).join(' · ')}
            </Text>
          ) : null}
          <Text color={theme.dim} wrap="truncate"> {focus !== 'composer' ? `${focus}` : ''}</Text>
          <Text color={theme.dim}> {showWorkspace ? '⋗' : ''}</Text>
        </Box>
      </Box>

      {/* Split-pane main — stack vertically on narrow terminals */}
      <Box flexGrow={1} flexDirection={columns < 90 && showWorkspace ? "column" : "row"} overflow="hidden">
        {/* Left: conversation */}
        <Box flexDirection="column" width={showWorkspace ? (columns < 90 ? "100%" : "55%") : '100%'} flexGrow={1} overflow="hidden" borderStyle={showWorkspace ? 'single' : undefined} borderColor={theme.border} paddingX={showWorkspace ? 1 : 0}>
          {visibleEntries.length === 0 && !agent.streamingText ? (
            <Splash workspace={bootstrap.workspace} config={bootstrap.config} projectRoot={bootstrap.projectRoot} resumed={bootstrap.resumed} />
          ) : (
            <ChatView entries={visibleEntries} liveOutput={agent.liveOutput} streamingText={agent.streamingText} rows={chatRows} width={showWorkspace ? Math.floor(columns * 0.52) : columns} scrollOffset={scrollOffset} expandedTools={expandedTools} />
          )}
          {agent.plan ? <PlanView plan={agent.plan} /> : null}
          {showActivity ? <ActivityFeed lines={agent.activity} rows={6} width={showWorkspace ? Math.floor(columns * 0.52) : columns} /> : null}
          {/* Live output collapsible */}
          <LiveOutputPanel outputs={agent.liveOutput} />
          {Object.keys(agent.liveOutput).length > 0 ? <CollapsibleLogs title="command output" lines={Object.values(agent.liveOutput).join('\n').split('\n').slice(-20)} defaultCollapsed /> : null}
        </Box>

        {/* Right: workspace panes — full width when stacked vertically */}
        {showWorkspace ? (
          <Box flexDirection="column" width={columns < 90 ? "100%" : "45%"} overflow="hidden" paddingLeft={columns < 90 ? 0 : 1} paddingTop={columns < 90 ? 1 : 0}>
            {/* Tab bar — wraps on narrow terminals to avoid mid-word truncation */}
            <Box flexWrap="wrap" width="100%">
              {(['tasks', 'diff', 'verify', 'agents', 'logs', 'checkpoints', 'memory'] as RightTab[]).map((tab, idx) => (
                <Box key={tab} paddingX={1} borderStyle={rightTab === tab ? 'single' : undefined} borderColor={rightTab === tab ? theme.accent : theme.border} flexShrink={0}>
                  <Text color={rightTab === tab ? theme.accent : theme.dim} bold={rightTab === tab} wrap="truncate">
                    {columns < 70 ? `${idx + 1}` : `${idx + 1}:${tab}`}
                  </Text>
                </Box>
              ))}
            </Box>

            <Box flexDirection="column" flexGrow={1} overflow="hidden" marginTop={1}>
              {rightTab === 'tasks' ? <TaskBoard graph={agent.taskGraph} /> : null}
              {rightTab === 'diff' ? <DiffPanel edits={agent.edits} /> : null}
              {rightTab === 'verify' ? (
                <VerificationPanel
                  results={agent.verificationResults.map((v) => ({
                    kind: v.kind,
                    command: v.command,
                    passed: v.passed,
                    durationMs: v.durationMs,
                    summary: v.summary,
                    failures: v.failures,
                  }))}
                  autoFixAttempts={agent.verificationResults[0]?.attemptedFixes}
                />
              ) : null}
              {rightTab === 'agents' ? <AgentPanel activities={agent.agentActivities} /> : null}
              {rightTab === 'logs' ? (
                <Box flexDirection="column">
                  <CollapsibleLogs title="activity feed" lines={agent.activity.map((a) => `[${a.level}] ${a.text}`)} defaultCollapsed={false} maxHeight={20} />
                  <LiveOutputPanel outputs={agent.liveOutput} />
                </Box>
              ) : null}
              {rightTab === 'checkpoints' ? <CheckpointPanel checkpoints={agent.checkpoints} /> : null}
              {rightTab === 'memory' ? (
                <MemoryPanel projectEntries={agent.memoryProject} sessionEntries={agent.memorySession} importantFiles={[]} />
              ) : null}
            </Box>

            <Box marginTop={1} paddingX={1} borderStyle="single" borderColor={theme.border}>
              <Text color={theme.dim}>Tab 1-7 switch · Ctrl+W toggle · Ctrl+G checkpoint · Ctrl+P/Y pause/resume · ?:help </Text>
            </Box>
          </Box>
        ) : null}
      </Box>

      {notice ? (
        <Box borderStyle="single" borderColor={theme.border} paddingX={1} flexDirection="column">
          <Text color={theme.primary} wrap="wrap">{notice}</Text>
        </Box>
      ) : null}

      <StatusBar state={agent.agentState} workspace={bootstrap.workspace} width={columns} busy={busy} />

      {agent.pendingConfirm ? (
        <ConfirmDialog request={agent.pendingConfirm} onResolve={agent.resolveConfirm} />
      ) : showHelp ? (
        <HelpOverlay onClose={() => setShowHelp(false)} />
      ) : showPalette ? (
        <CommandPalette
          items={paletteItems}
          title="command palette · Ctrl+K"
          onSelect={(id) => {
            setShowPalette(false);
            if (id.startsWith('action:')) {
              if (id === 'action:checkpoint') void agent.createCheckpoint();
              if (id === 'action:toggle-workspace') setShowWorkspace((v) => !v);
              if (id === 'action:expand-tools') setExpandedTools((p) => p.size > 0 ? new Set() : new Set(agent.entries.filter((e) => e.kind === 'tool').map((e) => e.id)));
            } else {
              runSlashCommand(id);
            }
          }}
          onCancel={() => setShowPalette(false)}
        />
      ) : searchHistory ? (
        <CommandPalette
          items={searchableHistory}
          title="search history"
          onSelect={(id) => {
            const idx = Number(id.split('-')[1] ?? -1);
            if (idx >= 0 && history[idx]) {
              setValue(history[idx]!);
              setCursor(history[idx]!.length);
            }
            setSearchHistory(false);
          }}
          onCancel={() => setSearchHistory(false)}
        />
      ) : quickActions ? (
        <SelectList
          title="Quick actions"
          items={QUICK_ACTIONS}
          onSelect={(id) => {
            setQuickActions(false);
            if (id === '/exit') quit();
            else if (id === '/help') setShowHelp(true);
            else runSlashCommand(id);
          }}
          onCancel={() => setQuickActions(false)}
        />
      ) : (
        <Composer
          value={value}
          cursor={cursor}
          focused={composerFocused}
          disabled={busy}
          width={columns}
          placeholder={
            busy
              ? agent.multiAgentActive
                ? 'multi-agent working… (Ctrl+C stop · Ctrl+P pause)'
                : 'working… (Esc or Ctrl+C to stop)'
              : 'Describe a task… (? help, / actions, Ctrl+K palette, Ctrl+W workspace)'
          }
          onChange={(nextValue, nextCursor) => {
            setValue(nextValue);
            setCursor(nextCursor);
            if (notice) setNotice(null);
          }}
          onSubmit={handleSubmit}
          onHistory={handleHistory}
          onCancel={() => {
            if (agent.running) agent.cancel();
            else if (value === '') setFocus('chat');
            else {
              setValue('');
              setCursor(0);
            }
          }}
          onQuickAction={(key) => {
            if (key === '?') setShowHelp(true);
            else setQuickActions(true);
          }}
        />
      )}

      <Box paddingX={1}>
        <Text color={theme.dim} wrap="truncate">
          Enter send · Shift+Enter newline · Tab cycle focus · Ctrl+K palette · Ctrl+W workspace · Ctrl+C stop · 1-7 tabs · Ctrl+G checkpoint
        </Text>
      </Box>
    </Box>
  );
};
