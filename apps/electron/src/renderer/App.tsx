import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { Sidebar, type PageId } from './components/Sidebar';
import { TopBar } from './components/TopBar';
import { CommandPalette } from './components/CommandPalette';
import { WorkspaceSwitcherModal, type RecentWorkspace } from './components/WorkspaceSwitcherModal';
import { useSessions } from './hooks/useSessions';
import { useAgent } from './hooks/useAgent';

// Import all 10 dedicated pages
import { SessionsPage } from './pages/SessionsPage';
import { WorkspacePage } from './pages/WorkspacePage';
import { TasksPage } from './pages/TasksPage';
import { DiffPage } from './pages/DiffPage';
import { LogsPage } from './pages/LogsPage';
import { BackgroundPage } from './pages/BackgroundPage';
import { CheckpointsPage } from './pages/CheckpointsPage';
import { MemoryPage } from './pages/MemoryPage';
import { SkillsPage } from './pages/SkillsPage';
import { ProviderPage } from './pages/ProviderPage';
import { SettingsPage } from './pages/SettingsPage';

export default function App() {
  const [currentPage, setCurrentPage] = useState<PageId>('workspace');
  const [projectRoot, setProjectRoot] = useState<string>('');
  const [workspaceInfo, setWorkspaceInfo] = useState<any>(null);
  const [config, setConfig] = useState<any>(null);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [showPalette, setShowPalette] = useState(false);
  const [showWorkspaceSwitcher, setShowWorkspaceSwitcher] = useState(false);
  const [recentWorkspaces, setRecentWorkspaces] = useState<RecentWorkspace[]>([]);
  const [checkpoints, setCheckpoints] = useState<any[]>([]);

  const isElectron = typeof (window as any).cluster !== 'undefined';
  const { sessions, refresh, create: createSession, remove: deleteSession } = useSessions(
    isElectron ? projectRoot || undefined : undefined
  );
  const agent = useAgent(isElectron ? activeSessionId : null);

  // Bootstrap workspace and config
  useEffect(() => {
    if (!isElectron) {
      console.warn('[Cluster] Not in Electron environment (preload missing)');
      setProjectRoot('C:/Coding Agent');
      setWorkspaceInfo({ name: 'cluster', git: null });
      setConfig({ model: '', baseUrl: '', _hasKey: false });
      return;
    }

    let isMounted = true;
    (async () => {
      try {
        const detected = await window.cluster.workspace.detect();
        const root = detected?.root || (typeof process !== 'undefined' ? (process as any).cwd?.() : '') || 'C:/Coding Agent';
        if (!isMounted) return;

        setProjectRoot(root);
        const ws = await window.cluster.workspace.info(root);
        if (!isMounted) return;
        setWorkspaceInfo(ws);
        addRecentWorkspace(root, ws?.name);

        const cfg = await window.cluster.config.get(root);
        if (!isMounted) return;
        setConfig(cfg);
      } catch (e) {
        console.error('[Cluster] Bootstrap error:', e);
      }
      if (isMounted) {
        refresh();
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [isElectron]);

  // Load recent workspaces from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('cluster:recent_workspaces');
      if (saved) {
        setRecentWorkspaces(JSON.parse(saved));
      }
    } catch {}
  }, []);

  const addRecentWorkspace = useCallback((folderPath: string, name?: string) => {
    const cleanPath = folderPath.replace(/\\/g, '/');
    const folderName = name || cleanPath.split('/').filter(Boolean).pop() || cleanPath;
    setRecentWorkspaces(prev => {
      const filtered = prev.filter(w => w.path.toLowerCase() !== cleanPath.toLowerCase());
      const updated = [{ path: cleanPath, name: folderName, lastOpenedAt: new Date().toISOString() }, ...filtered].slice(0, 15);
      try { localStorage.setItem('cluster:recent_workspaces', JSON.stringify(updated)); } catch {}
      return updated;
    });
  }, []);

  const removeRecentWorkspace = useCallback((folderPath: string) => {
    setRecentWorkspaces(prev => {
      const updated = prev.filter(w => w.path.toLowerCase() !== folderPath.toLowerCase());
      try { localStorage.setItem('cluster:recent_workspaces', JSON.stringify(updated)); } catch {}
      return updated;
    });
  }, []);

  const handleSwitchWorkspace = useCallback(async (newPath: string) => {
    if (!newPath) return;
    try {
      let effectiveRoot = newPath.replace(/\\/g, '/');
      if (window.cluster?.workspace?.detect) {
        const detected = await window.cluster.workspace.detect(newPath);
        if (detected?.root) effectiveRoot = detected.root.replace(/\\/g, '/');
      }
      setProjectRoot(effectiveRoot);
      setActiveSessionId(null);
      const ws = await window.cluster.workspace.info(effectiveRoot);
      setWorkspaceInfo(ws);
      addRecentWorkspace(effectiveRoot, ws?.name);
      const cfg = await window.cluster.config.get(effectiveRoot);
      setConfig(cfg);
    } catch (err) {
      console.error('Failed to switch workspace:', err);
    }
  }, [addRecentWorkspace]);

  const handleOpenFolderDialog = useCallback(async () => {
    if (typeof window.cluster !== 'undefined' && window.cluster.dialog?.openDirectory) {
      try {
        const selected = await window.cluster.dialog.openDirectory();
        if (selected) {
          await handleSwitchWorkspace(selected);
        }
      } catch (err) {
        console.error('Open directory failed:', err);
      }
    }
  }, [handleSwitchWorkspace]);

  // Auto-select first session if none selected
  useEffect(() => {
    if (sessions.length > 0 && !activeSessionId) {
      setActiveSessionId(sessions[0].id);
    }
  }, [sessions, activeSessionId]);

  // Refresh checkpoints when active session changes
  useEffect(() => {
    if (activeSessionId && isElectron && window.cluster.checkpoints) {
      window.cluster.checkpoints.list(activeSessionId).then(setCheckpoints).catch(() => {});
    }
  }, [activeSessionId, isElectron]);

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isInputFocused =
        document.activeElement?.tagName === 'INPUT' ||
        document.activeElement?.tagName === 'TEXTAREA' ||
        (document.activeElement as HTMLElement)?.isContentEditable;

      // Ctrl/Cmd + K: Command Palette
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setShowPalette(v => !v);
        return;
      }

      // Ctrl/Cmd + O: Open Workspace Folder
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'o') {
        e.preventDefault();
        handleOpenFolderDialog();
        return;
      }

      // Ctrl/Cmd + G: Manual Snapshot Checkpoint
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'g') {
        e.preventDefault();
        handleNewCheckpoint();
        return;
      }

      // Ctrl + C: Stop Running Agent
      if (e.ctrlKey && e.key.toLowerCase() === 'c' && agent.running) {
        e.preventDefault();
        agent.cancel();
        return;
      }

      // Escape: Close modals
      if (e.key === 'Escape') {
        if (showWorkspaceSwitcher) {
          setShowWorkspaceSwitcher(false);
          return;
        }
        if (showPalette) {
          setShowPalette(false);
          return;
        }
        if (agent.pendingConfirm) {
          agent.confirm(false);
          return;
        }
      }

      // Number keys 1-0 for direct page switching when not typing in inputs
      if (!isInputFocused && !showPalette) {
        const pages: PageId[] = [
          'sessions',   // 1
          'workspace',  // 2
          'tasks',      // 3
          'diff',       // 4
          'logs',       // 5
          'background', // 6
          'checkpoints',// 7
          'memory',     // 8
          'provider',   // 9
          'settings',   // 0
        ];
        const num = parseInt(e.key, 10);
        if (!isNaN(num)) {
          const targetIndex = num === 0 ? 9 : num - 1;
          if (pages[targetIndex]) {
            e.preventDefault();
            setCurrentPage(pages[targetIndex]);
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showPalette, agent, activeSessionId, projectRoot]);

  // Session operations
  const handleSelectSession = (id: string) => {
    setActiveSessionId(id);
  };

  const handleNewSession = async () => {
    if (!projectRoot) return;
    const newSession = await createSession('New Session');
    if (newSession) {
      setActiveSessionId(newSession.id);
      setCurrentPage('workspace');
    }
  };

  const handleDeleteSession = async (id: string) => {
    await deleteSession(id);
    if (activeSessionId === id) {
      const remaining = sessions.filter(s => s.id !== id);
      setActiveSessionId(remaining[0]?.id || null);
    }
  };

  const handleRenameSession = async (id: string, newTitle: string) => {
    if (isElectron && window.cluster.sessions?.rename) {
      await window.cluster.sessions.rename(id, newTitle);
      await refresh();
    }
  };

  const handleNewCheckpoint = async () => {
    if (!activeSessionId || !projectRoot) return;
    try {
      await window.cluster.checkpoints.create({
        sessionId: activeSessionId,
        projectRoot,
        message: `Snapshot @ ${new Date().toLocaleTimeString()}`,
      });
      const list = await window.cluster.checkpoints.list(activeSessionId);
      setCheckpoints(list);
    } catch (e) {
      console.error('Checkpoint creation failed', e);
    }
  };

  const handleRollback = async (checkpointId: string) => {
    if (!activeSessionId || !projectRoot) return;
    try {
      await window.cluster.checkpoints.rollback({
        sessionId: activeSessionId,
        checkpointId,
        projectRoot,
      });
      await refresh();
    } catch (e) {
      console.error('Rollback error', e);
    }
  };

  // Slash commands execution in workspace
  const handleSlashCommand = (cmd: string): boolean => {
    if (!cmd.startsWith('/')) return false;
    const [action, ...restArgs] = cmd.split(/\s+/);
    const rest = restArgs.join(' ');

    switch (action) {
      case '/help':
        setShowPalette(true);
        return true;
      case '/sessions':
        setCurrentPage('sessions');
        return true;
      case '/workspace':
        setCurrentPage('workspace');
        return true;
      case '/tasks':
      case '/plan':
        setCurrentPage('tasks');
        return true;
      case '/diff':
      case '/diffs':
        setCurrentPage('diff');
        return true;
      case '/logs':
        setCurrentPage('logs');
        return true;
      case '/background':
      case '/jobs':
        setCurrentPage('background');
        return true;
      case '/checkpoint':
      case '/checkpoints':
        setCurrentPage('checkpoints');
        return true;
      case '/memory':
        setCurrentPage('memory');
        return true;
      case '/skills':
      case '/marketplace':
        setCurrentPage('skills');
        return true;
      case '/provider':
      case '/model':
        setCurrentPage('provider');
        return true;
      case '/settings':
        setCurrentPage('settings');
        return true;
      case '/clear':
        agent.clear();
        return true;
      case '/multi':
        if (rest) {
          agent.submit(rest);
        }
        return true;
      default:
        return false;
    }
  };

  const onWorkspaceSubmit = (text: string) => {
    if (handleSlashCommand(text)) return;
    agent.submit(text);
  };

  const activeSession = sessions.find(s => s.id === activeSessionId);

  // Command Palette Items
  const paletteItems = useMemo(() => {
    const pageItems = [
      { id: 'nav:sessions', label: 'Go to Sessions', detail: 'View and manage all chat sessions · 1', hotkey: '1' },
      { id: 'nav:workspace', label: 'Go to Workspace', detail: 'Main conversation & coding assistant · 2', hotkey: '2' },
      { id: 'nav:tasks', label: 'Go to Tasks & Plan', detail: 'Step-by-step task DAG & multi-agent execution · 3', hotkey: '3' },
      { id: 'nav:diff', label: 'Go to Diffs & Review', detail: 'Inspect code edits & line counts · 4', hotkey: '4' },
      { id: 'nav:logs', label: 'Go to Logs', detail: 'Streaming stdout & event log · 5', hotkey: '5' },
      { id: 'nav:background', label: 'Go to Background Jobs', detail: 'Inspect processes & servers · 6', hotkey: '6' },
      { id: 'nav:checkpoints', label: 'Go to Checkpoints', detail: 'Restore snapshots & rollbacks · 7', hotkey: '7' },
      { id: 'nav:memory', label: 'Go to Memory', detail: 'Project & session knowledge · 8', hotkey: '8' },
      { id: 'nav:skills', label: 'Go to Skills & Marketplace', detail: 'Discover, install, and manage skills · S', hotkey: 'S' },
      { id: 'nav:provider', label: 'Go to Provider & Model', detail: 'Configure LLM inference & API key · 9', hotkey: '9' },
      { id: 'nav:settings', label: 'Go to Settings', detail: 'Workspace directory & environment · 0', hotkey: '0' },
    ];

    const actionItems = [
      { id: 'action:open-folder', label: 'Open Workspace Folder...', detail: 'Browse directory with native picker · Ctrl+O', hotkey: 'Ctrl+O' },
      { id: 'action:switch-workspace', label: 'Switch Workspace...', detail: 'Browse recent workspaces or enter path' },
      { id: 'action:new-session', label: 'Create New Session', detail: 'Start fresh session' },
      { id: 'action:checkpoint', label: 'Take Snapshot Checkpoint', detail: 'Capture files now · Ctrl+G', hotkey: 'Ctrl+G' },
      { id: 'action:clear-chat', label: 'Clear Chat View', detail: 'Hide current visible messages' },
    ];

    const workspaceItems = recentWorkspaces.slice(0, 5).map(w => ({
      id: `workspace:${w.path}`,
      label: `Switch Workspace: ${w.name}`,
      detail: w.path,
    }));

    const sessionItems = sessions.slice(0, 6).map(s => ({
      id: `session:${s.id}`,
      label: `Switch to Session: ${s.title.slice(0, 32)}`,
      detail: `${s.messageCount || 0} msgs · ${s.model || 'model'}`,
    }));

    return [...pageItems, ...actionItems, ...workspaceItems, ...sessionItems];
  }, [sessions, recentWorkspaces]);

  const handlePaletteSelect = (id: string) => {
    setShowPalette(false);
    if (id.startsWith('nav:')) {
      const page = id.slice(4) as PageId;
      setCurrentPage(page);
    } else if (id.startsWith('session:')) {
      const sid = id.slice(8);
      handleSelectSession(sid);
      setCurrentPage('workspace');
    } else if (id === 'action:open-folder') {
      handleOpenFolderDialog();
    } else if (id === 'action:switch-workspace') {
      setShowWorkspaceSwitcher(true);
    } else if (id.startsWith('workspace:')) {
      const p = id.slice(10);
      handleSwitchWorkspace(p);
    } else if (id === 'action:new-session') {
      handleNewSession();
    } else if (id === 'action:checkpoint') {
      handleNewCheckpoint();
      setCurrentPage('checkpoints');
    } else if (id === 'action:clear-chat') {
      agent.clear();
    }
  };

  const handleConfigUpdated = (newCfg: any) => {
    setConfig(newCfg);
    refresh();
  };

  return (
    <div className="h-screen w-screen flex flex-col bg-[#07070a] text-[#f4f4f5] overflow-hidden select-none font-sans">
      {/* Top Application Bar */}
      <TopBar
        currentPage={currentPage}
        projectRoot={projectRoot}
        workspaceName={workspaceInfo?.name || 'cluster'}
        model={config?.model || activeSession?.model}
        sessionTitle={activeSession?.title}
        running={agent.running}
        onCommandPalette={() => setShowPalette(true)}
        onNewCheckpoint={handleNewCheckpoint}
        onNewSession={handleNewSession}
        onOpenWorkspaceSwitcher={() => setShowWorkspaceSwitcher(true)}
        onOpenFolderDialog={handleOpenFolderDialog}
      />

      {/* Main Split Layout: Sidebar + Active Page */}
      <div className="flex flex-1 overflow-hidden min-h-0">
        <Sidebar
          currentPage={currentPage}
          onNavigate={setCurrentPage}
          sessions={sessions}
          activeSessionId={activeSessionId}
          onSelectSession={handleSelectSession}
          onNewSession={handleNewSession}
          workspaceName={workspaceInfo?.name || 'cluster'}
          taskGraph={agent.taskGraph}
          running={agent.running}
          diffCount={agent.edits.length}
          jobCount={agent.jobs.length}
          model={config?.model || activeSession?.model}
          onOpenWorkspaceSwitcher={() => setShowWorkspaceSwitcher(true)}
        />

        {/* Dynamic Page Rendering */}
        <main className="flex-1 flex flex-col min-w-0 bg-[#0a0a0d] overflow-hidden">
          {currentPage === 'sessions' && (
            <SessionsPage
              sessions={sessions}
              activeSessionId={activeSessionId}
              onSelectSession={id => {
                handleSelectSession(id);
                setCurrentPage('workspace');
              }}
              onNewSession={handleNewSession}
              onDeleteSession={handleDeleteSession}
              onRenameSession={handleRenameSession}
              projectRoot={projectRoot}
            />
          )}

          {currentPage === 'workspace' && (
            <WorkspacePage
              sessionTitle={activeSession?.title || 'Workspace'}
              entries={agent.entries}
              agentState={agent.agentState}
              running={agent.running}
              streamingText={agent.streamingText}
              liveOutput={agent.liveOutput}
              activity={agent.activity}
              pendingConfirm={agent.pendingConfirm}
              taskGraph={agent.taskGraph}
              plan={agent.plan}
              onSubmit={onWorkspaceSubmit}
              onCancel={agent.cancel}
              onConfirm={agent.confirm}
              onOpenTasks={() => setCurrentPage('tasks')}
              onOpenDiffs={() => setCurrentPage('diff')}
              recalledMemories={agent.recalledMemories}
              fileProgress={agent.fileProgress}
              activeSkill={agent.activeSkill}
            />
          )}

          {currentPage === 'tasks' && (
            <TasksPage
              taskGraph={agent.taskGraph}
              plan={agent.plan}
              liveOutput={agent.liveOutput}
            />
          )}

          {currentPage === 'diff' && (
            <DiffPage
              edits={agent.edits}
              onRollback={handleRollback}
              checkpoints={checkpoints}
            />
          )}

          {currentPage === 'logs' && (
            <LogsPage
              activity={agent.activity}
              liveOutput={agent.liveOutput}
              jobs={agent.jobs}
            />
          )}

          {currentPage === 'background' && (
            <BackgroundPage
              jobs={agent.jobs}
            />
          )}

          {currentPage === 'checkpoints' && (
            <CheckpointsPage
              sessionId={activeSessionId}
              projectRoot={projectRoot}
            />
          )}

          {currentPage === 'memory' && (
            <MemoryPage
              sessionId={activeSessionId}
              projectRoot={projectRoot}
            />
          )}

          {currentPage === 'skills' && (
            <SkillsPage
              onNavigateToWorkspace={(cmd) => {
                setCurrentPage('workspace');
                if (cmd) {
                  agent.submit(cmd);
                }
              }}
            />
          )}

          {currentPage === 'provider' && (
            <ProviderPage
              projectRoot={projectRoot}
              onConfigUpdated={handleConfigUpdated}
            />
          )}

          {currentPage === 'settings' && (
            <SettingsPage
              projectRoot={projectRoot}
              workspaceInfo={workspaceInfo}
              onProjectRootChange={handleSwitchWorkspace}
              recentWorkspaces={recentWorkspaces}
              onOpenWorkspaceSwitcher={() => setShowWorkspaceSwitcher(true)}
            />
          )}
        </main>
      </div>

      {/* Global Bottom Status Bar */}
      <footer className="h-6 flex items-center justify-between px-3 bg-[#08080a] border-t border-[#1f1f23] text-[11px] text-[#71717a] shrink-0 font-mono select-none">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5">
            {workspaceInfo?.git?.branch ? (
              <>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                <span className="text-white">{workspaceInfo.git.branch}</span>
              </>
            ) : (
              <span className="text-[#52525b]">no git</span>
            )}
          </span>
          <span>·</span>
          <span>{activeSession ? activeSession.title.slice(0, 24) : 'No Session'}</span>
          <span>·</span>
          <span className="text-cyan-400 font-mono">{config?.model || activeSession?.model || 'No model'}</span>
          {agent.taskGraph && (
            <>
              <span>·</span>
              <span className="text-emerald-400">
                {Object.values(agent.taskGraph.tasks || {}).filter((t: any) => t.status === 'done').length} done
              </span>
            </>
          )}
          {agent.running && (
            <span className="text-amber-400 animate-pulse">● {agent.agentState.phase}</span>
          )}
        </div>

        <div className="flex items-center gap-4">
          <span className="hidden sm:inline">UTF-8</span>
          <span className="hidden sm:inline">LF</span>
          <span>{agent.edits.length} edits</span>
          <span className="text-[#a1a1aa]">{agent.running ? 'running' : 'ready'}</span>
        </div>
      </footer>

      {/* Global Command Palette Modal */}
      <CommandPalette
        open={showPalette}
        onClose={() => setShowPalette(false)}
        onSelect={handlePaletteSelect}
        items={paletteItems}
      />

      {/* Quick Workspace Switcher Modal */}
      <WorkspaceSwitcherModal
        open={showWorkspaceSwitcher}
        onClose={() => setShowWorkspaceSwitcher(false)}
        currentRoot={projectRoot}
        onSelectWorkspace={handleSwitchWorkspace}
        onOpenFolderDialog={handleOpenFolderDialog}
        recentWorkspaces={recentWorkspaces}
        onRemoveRecent={removeRecentWorkspace}
      />
    </div>
  );
}
