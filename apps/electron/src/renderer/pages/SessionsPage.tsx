import React, { useState, useMemo } from 'react';
import type { SessionSummary } from '../hooks/useSessions';

interface SessionsPageProps {
  sessions: SessionSummary[];
  activeSessionId: string | null;
  onSelectSession: (id: string) => void;
  onNewSession: () => void;
  onDeleteSession: (id: string) => void;
  onRenameSession: (id: string, newTitle: string) => void;
  projectRoot: string;
}

export const SessionsPage: React.FC<SessionsPageProps> = ({
  sessions,
  activeSessionId,
  onSelectSession,
  onNewSession,
  onDeleteSession,
  onRenameSession,
  projectRoot,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'running' | 'done' | 'idle'>('all');
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameText, setRenameText] = useState('');

  const stats = useMemo(() => {
    const total = sessions.length;
    const running = sessions.filter(s => s.phase === 'running' || s.phase === 'thinking' || s.phase === 'planning').length;
    const totalMessages = sessions.reduce((acc, s) => acc + (s.messageCount || 0), 0);
    const totalEdits = sessions.reduce((acc, s) => acc + (s.editCount || 0), 0);
    return { total, running, totalMessages, totalEdits };
  }, [sessions]);

  const filteredSessions = useMemo(() => {
    return sessions.filter(s => {
      const matchesSearch = s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (s.model && s.model.toLowerCase().includes(searchQuery.toLowerCase()));

      if (!matchesSearch) return false;
      if (statusFilter === 'all') return true;
      if (statusFilter === 'running') return s.phase === 'running' || s.phase === 'thinking' || s.phase === 'planning';
      if (statusFilter === 'done') return s.phase === 'done';
      if (statusFilter === 'idle') return !s.phase || s.phase === 'idle';
      return true;
    });
  }, [sessions, searchQuery, statusFilter]);

  const startRename = (s: SessionSummary, e: React.MouseEvent) => {
    e.stopPropagation();
    setRenamingId(s.id);
    setRenameText(s.title);
  };

  const submitRename = (id: string) => {
    if (renameText.trim()) {
      onRenameSession(id, renameText.trim());
    }
    setRenamingId(null);
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#0a0a0d] overflow-y-auto p-6 space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-[#232326]">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold tracking-tight text-white">Sessions</h1>
            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-[#1a1a1e] border border-[#27272a] text-[#a1a1aa]">
              {sessions.length} total
            </span>
          </div>
          <p className="text-xs text-[#71717a] mt-1 font-mono truncate max-w-xl">
            Project: {projectRoot || 'Default workspace'}
          </p>
        </div>

        <button
          onClick={onNewSession}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-white text-black hover:bg-neutral-200 transition-all shadow-sm"
        >
          <span className="text-sm font-bold leading-none">+</span> New Session
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-xl border border-[#232326] bg-[#0f0f12] p-3.5">
          <div className="text-[11px] font-semibold text-[#71717a] uppercase tracking-wider">Total Sessions</div>
          <div className="text-2xl font-bold text-white mt-1 font-mono">{stats.total}</div>
        </div>
        <div className="rounded-xl border border-[#232326] bg-[#0f0f12] p-3.5">
          <div className="text-[11px] font-semibold text-[#71717a] uppercase tracking-wider">Active / Running</div>
          <div className="text-2xl font-bold text-amber-400 mt-1 font-mono">{stats.running}</div>
        </div>
        <div className="rounded-xl border border-[#232326] bg-[#0f0f12] p-3.5">
          <div className="text-[11px] font-semibold text-[#71717a] uppercase tracking-wider">Messages Recorded</div>
          <div className="text-2xl font-bold text-cyan-400 mt-1 font-mono">{stats.totalMessages}</div>
        </div>
        <div className="rounded-xl border border-[#232326] bg-[#0f0f12] p-3.5">
          <div className="text-[11px] font-semibold text-[#71717a] uppercase tracking-wider">Code Edits Applied</div>
          <div className="text-2xl font-bold text-emerald-400 mt-1 font-mono">{stats.totalEdits}</div>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="relative flex-1">
          <input
            type="text"
            placeholder="Search sessions by title, ID or model..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full bg-[#121215] border border-[#232326] rounded-xl px-3.5 py-2 text-xs text-white placeholder-[#52525b] outline-none focus:border-[#3f3f46] transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-2.5 text-xs text-[#71717a] hover:text-white"
            >
              ✕
            </button>
          )}
        </div>

        <div className="flex items-center gap-1 bg-[#121215] border border-[#232326] p-1 rounded-xl">
          {(['all', 'running', 'done', 'idle'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setStatusFilter(tab)}
              className={`px-3 py-1 rounded-lg text-xs font-medium capitalize transition-colors ${
                statusFilter === tab
                  ? 'bg-[#27272a] text-white shadow-sm'
                  : 'text-[#71717a] hover:text-white'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Sessions Grid */}
      {filteredSessions.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#232326] bg-[#0f0f12]/50 p-12 text-center">
          <div className="w-10 h-10 rounded-full bg-[#18181b] border border-[#27272a] flex items-center justify-center mx-auto mb-3 text-sm text-[#71717a]">
            ∅
          </div>
          <div className="text-sm font-semibold text-[#a1a1aa]">No sessions found</div>
          <p className="text-xs text-[#52525b] mt-1 max-w-sm mx-auto">
            {searchQuery
              ? 'No sessions matched your search filters.'
              : 'Create a new session to start working on your codebase.'}
          </p>
          <button
            onClick={onNewSession}
            className="mt-4 px-4 py-2 rounded-xl text-xs font-semibold bg-[#27272a] hover:bg-[#3f3f46] text-white transition-colors"
          >
            Create New Session
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredSessions.map(session => {
            const isSelected = session.id === activeSessionId;
            const isRunning = session.phase === 'running' || session.phase === 'thinking' || session.phase === 'planning';
            const isDone = session.phase === 'done';

            return (
              <div
                key={session.id}
                onClick={() => onSelectSession(session.id)}
                className={`group relative rounded-xl border p-4 cursor-pointer transition-all ${
                  isSelected
                    ? 'bg-[#141418] border-white shadow-lg'
                    : 'bg-[#0f0f12] border-[#232326] hover:border-[#3f3f46] hover:bg-[#121215]'
                }`}
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className={`w-2 h-2 rounded-full shrink-0 ${
                        isRunning
                          ? 'bg-amber-400 animate-pulse'
                          : isDone
                          ? 'bg-emerald-400'
                          : 'bg-[#52525b]'
                      }`}
                    />
                    {renamingId === session.id ? (
                      <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                        <input
                          type="text"
                          value={renameText}
                          onChange={e => setRenameText(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') submitRename(session.id);
                            if (e.key === 'Escape') setRenamingId(null);
                          }}
                          autoFocus
                          className="text-sm font-semibold bg-[#1c1c20] border border-cyan-500 rounded px-1.5 py-0.5 text-white outline-none"
                        />
                        <button
                          onClick={() => submitRename(session.id)}
                          className="text-xs bg-cyan-600 text-white px-2 py-0.5 rounded"
                        >
                          ✓
                        </button>
                      </div>
                    ) : (
                      <h3
                        className="text-sm font-semibold text-white truncate group-hover:text-cyan-300 transition-colors"
                        title={session.title}
                      >
                        {session.title || 'Untitled Session'}
                      </h3>
                    )}
                  </div>

                  <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 shrink-0">
                    <button
                      onClick={e => startRename(session, e)}
                      title="Rename session"
                      className="text-[11px] text-[#71717a] hover:text-white p-1 rounded hover:bg-[#232326]"
                    >
                      ✎
                    </button>
                    <button
                      onClick={e => {
                        e.stopPropagation();
                        onDeleteSession(session.id);
                      }}
                      title="Delete session"
                      className="text-[11px] text-[#71717a] hover:text-red-400 p-1 rounded hover:bg-[#232326]"
                    >
                      ✕
                    </button>
                  </div>
                </div>

                <div className="text-[11px] font-mono text-[#71717a] truncate mb-3">
                  ID: {session.id.slice(0, 16)}...
                </div>

                <div className="grid grid-cols-3 gap-2 py-2 border-t border-b border-[#1c1c20] text-center my-2">
                  <div>
                    <div className="text-xs font-bold text-white font-mono">{session.messageCount || 0}</div>
                    <div className="text-[10px] text-[#71717a]">messages</div>
                  </div>
                  <div>
                    <div className="text-xs font-bold text-white font-mono">{session.toolCallCount || 0}</div>
                    <div className="text-[10px] text-[#71717a]">tools</div>
                  </div>
                  <div>
                    <div className="text-xs font-bold text-emerald-400 font-mono">+{session.editCount || 0}</div>
                    <div className="text-[10px] text-[#71717a]">edits</div>
                  </div>
                </div>

                <div className="flex items-center justify-between text-[11px] text-[#71717a] mt-2">
                  <span className="font-mono bg-[#18181b] px-2 py-0.5 rounded border border-[#232326]">
                    {session.model || 'default'}
                  </span>
                  <span>
                    {session.updatedAt ? new Date(session.updatedAt).toLocaleDateString() : 'recently'}
                  </span>
                </div>

                {isSelected && (
                  <div className="absolute top-2 right-2 flex items-center gap-1">
                    <span className="text-[10px] font-bold tracking-widest text-black bg-white px-1.5 py-0.5 rounded uppercase">
                      Current
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
