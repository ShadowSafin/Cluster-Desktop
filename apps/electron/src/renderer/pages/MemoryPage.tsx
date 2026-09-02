import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Brain,
  Search,
  Plus,
  Pin,
  Archive,
  Layers,
  Bug,
  Terminal,
  FileCode,
  Sliders,
  CheckCircle2,
  Trash2,
  Sparkles,
  RefreshCw,
  X,
  ExternalLink,
  Copy,
  Check,
  Palette,
  GitBranch,
  Star,
  Activity,
} from 'lucide-react';
import { MemoryCard, type MemoryEntryUI } from '../components/MemoryCard';

interface MemoryPageProps {
  sessionId: string | null;
  projectRoot: string;
}

type ViewTab = 'recent' | 'pinned' | 'project' | 'retrieved' | 'search';

export const MemoryPage: React.FC<MemoryPageProps> = ({ sessionId, projectRoot }) => {
  const [activeTab, setActiveTab] = useState<ViewTab>('recent');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [entries, setEntries] = useState<MemoryEntryUI[]>([]);
  const [retrievedLogs, setRetrievedLogs] = useState<any[]>([]);
  const [stats, setStats] = useState<any>({ total: 0, pinned: 0, archived: 0, byCategory: {}, byScope: {} });
  const [loading, setLoading] = useState(false);
  const [inspectingEntry, setInspectingEntry] = useState<MemoryEntryUI | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [copiedId, setCopiedId] = useState(false);

  // Form state for adding memory
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [newCategory, setNewCategory] = useState('architecture');
  const [newScope, setNewScope] = useState<'project' | 'session' | 'global'>('project');
  const [newImportance, setNewImportance] = useState(0.7);
  const [newPinned, setNewPinned] = useState(false);

  const loadData = useCallback(async () => {
    if (typeof window.cluster === 'undefined' || !window.cluster.memory) return;
    setLoading(true);
    try {
      // 1. Load stats
      const statsRes = await window.cluster.memory.stats({ projectRoot });
      setStats(statsRes);

      // 2. Load memories according to active tab or search
      if (activeTab === 'search' && searchQuery.trim()) {
        const searchRes = await window.cluster.memory.search({
          projectRoot,
          sessionId: sessionId || undefined,
          query: searchQuery.trim(),
          limit: 30,
        });
        setEntries(searchRes || []);
      } else if (activeTab === 'retrieved' && sessionId) {
        const logs = await window.cluster.memory.getRetrievedForTask({ sessionId, limit: 30 });
        setRetrievedLogs(logs || []);
        // Fetch the corresponding memories for the log IDs
        const all = await window.cluster.memory.list({ projectRoot, limit: 100 });
        const map = new Map(all.map((m: any) => [m.id, m]));
        const recalledEntries = logs
          .map((l: any) => {
            const found = map.get(l.memoryId);
            return found ? { ...found, similarity: l.similarityScore } : null;
          })
          .filter(Boolean);
        setEntries(recalledEntries);
      } else {
        const listRes = await window.cluster.memory.list({
          projectRoot,
          pinned: activeTab === 'pinned' ? true : undefined,
          scope: activeTab === 'project' ? 'project' : undefined,
          search: searchQuery.trim() || undefined,
          limit: 100,
        });
        setEntries(listRes || []);
      }
    } catch (err) {
      console.error('Failed to load memory data:', err);
    } finally {
      setLoading(false);
    }
  }, [projectRoot, sessionId, activeTab, searchQuery]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Handle live search with debounce
  useEffect(() => {
    if (!searchQuery.trim() && activeTab === 'search') return;
    const timer = setTimeout(() => {
      loadData();
    }, 250);
    return () => clearTimeout(timer);
  }, [searchQuery, loadData, activeTab]);

  const handlePin = async (id: string, pinned: boolean) => {
    await window.cluster.memory.pin({ id, pinned });
    await loadData();
    if (inspectingEntry?.id === id) {
      setInspectingEntry((prev) => (prev ? { ...prev, pinned } : null));
    }
  };

  const handleArchive = async (id: string, archived: boolean) => {
    await window.cluster.memory.archive({ id, archived });
    await loadData();
    if (inspectingEntry?.id === id) {
      setInspectingEntry((prev) => (prev ? { ...prev, archived } : null));
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to permanently delete this memory?')) return;
    await window.cluster.memory.delete({ id });
    if (inspectingEntry?.id === id) setInspectingEntry(null);
    await loadData();
  };

  const handleClearProject = async () => {
    if (!projectRoot) return;
    if (!confirm(`Are you sure you want to clear all memories for workspace ${projectRoot}? Pinned global preferences will be retained.`)) {
      return;
    }
    await window.cluster.memory.clearProject({ projectRoot });
    await loadData();
  };

  const handleCreateMemory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newContent.trim()) return;

    await window.cluster.memory.add({
      projectRoot,
      sessionId: sessionId || undefined,
      title: newTitle.trim(),
      summary: newContent.slice(0, 140),
      value: newContent.trim(),
      category: newCategory,
      scope: newScope,
      importance: newImportance,
      pinned: newPinned,
      tags: [newCategory, 'manual'],
    });

    setNewTitle('');
    setNewContent('');
    setIsAddModalOpen(false);
    await loadData();
  };

  const filteredEntries = useMemo(() => {
    if (selectedCategory === 'all') return entries;
    return entries.filter((e) => e.category === selectedCategory);
  }, [entries, selectedCategory]);

  const categories = [
    { id: 'all', label: 'All Types', icon: <Brain className="w-3.5 h-3.5" /> },
    { id: 'architecture', label: 'Architecture', icon: <Layers className="w-3.5 h-3.5" /> },
    { id: 'bug', label: 'Bug Fixes', icon: <Bug className="w-3.5 h-3.5" /> },
    { id: 'user_preference', label: 'Preferences', icon: <Sliders className="w-3.5 h-3.5" /> },
    { id: 'ui_style', label: 'UI / Style', icon: <Palette className="w-3.5 h-3.5" /> },
    { id: 'workflow', label: 'Workflow', icon: <GitBranch className="w-3.5 h-3.5" /> },
    { id: 'command', label: 'Commands', icon: <Terminal className="w-3.5 h-3.5" /> },
    { id: 'file', label: 'Key Files', icon: <FileCode className="w-3.5 h-3.5" /> },
    { id: 'task', label: 'Tasks', icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
  ];

  return (
    <div className="flex-1 flex flex-col h-full bg-[#0a0a0d] overflow-hidden">
      {/* Scrollable Container */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6 max-w-7xl mx-auto w-full">
        {/* Top Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-[#1e1e24]">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/30 text-indigo-400">
                <Brain className="w-5 h-5" />
              </div>
              <h1 className="text-xl font-bold tracking-tight text-white">
                Cluster Memory & Knowledge
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                SQLite + sqlite-vec Active
              </span>
            </div>
            <p className="text-xs text-neutral-400">
              Persistent, semantic knowledge across sessions. Recalls architectural patterns, bug fixes, and user preferences automatically.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-white text-black hover:bg-neutral-200 transition-all shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Memory
            </button>
            <button
              onClick={loadData}
              title="Refresh memories"
              className="p-2 rounded-xl text-neutral-400 hover:text-white bg-[#141418] border border-[#23232a] hover:border-[#33333d] transition-all"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3.5 rounded-xl bg-[#121216] border border-[#1e1e24] space-y-1">
            <span className="text-[11px] font-medium text-neutral-400">Total Memories</span>
            <div className="text-xl font-bold text-white">{stats.total ?? 0}</div>
          </div>
          <div className="p-3.5 rounded-xl bg-[#121216] border border-[#1e1e24] space-y-1">
            <span className="text-[11px] font-medium text-amber-400 flex items-center gap-1">
              <Pin className="w-3 h-3 fill-amber-400" /> Pinned Rules
            </span>
            <div className="text-xl font-bold text-amber-400">{stats.pinned ?? 0}</div>
          </div>
          <div className="p-3.5 rounded-xl bg-[#121216] border border-[#1e1e24] space-y-1">
            <span className="text-[11px] font-medium text-sky-400 flex items-center gap-1">
              <Layers className="w-3 h-3" /> Architecture & Bugs
            </span>
            <div className="text-xl font-bold text-sky-400">
              {(stats.byCategory?.architecture || 0) + (stats.byCategory?.bug || 0)}
            </div>
          </div>
          <div className="p-3.5 rounded-xl bg-[#121216] border border-[#1e1e24] space-y-1">
            <span className="text-[11px] font-medium text-emerald-400 flex items-center gap-1">
              <Activity className="w-3 h-3" /> Scope
            </span>
            <div className="text-xs font-mono text-neutral-300 pt-1">
              {stats.byScope?.project || 0} proj · {stats.byScope?.session || 0} sess
            </div>
          </div>
        </div>

        {/* Controls: Search & Tabs */}
        <div className="space-y-3">
          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
            <input
              type="text"
              placeholder={
                activeTab === 'search'
                  ? 'Type a query for semantic vector search (e.g. "how did we fix modal animations")...'
                  : 'Filter memories by keyword, path, or title...'
              }
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#121216] border border-[#22222a] text-xs text-white placeholder-neutral-400 focus:outline-none focus:border-indigo-500/50 transition-all shadow-inner"
            />
          </div>

          {/* View Tabs */}
          <div className="flex items-center justify-between gap-4 border-b border-[#1e1e24] pb-2 overflow-x-auto">
            <div className="flex items-center gap-1">
              {[
                { id: 'recent', label: 'Recent Memories', icon: <Brain className="w-3.5 h-3.5" /> },
                { id: 'pinned', label: 'Pinned & Rules', icon: <Pin className="w-3.5 h-3.5" /> },
                { id: 'project', label: 'Project Knowledge', icon: <Layers className="w-3.5 h-3.5" /> },
                {
                  id: 'retrieved',
                  label: 'Retrieved for Task',
                  icon: <Sparkles className="w-3.5 h-3.5" />,
                  badge: retrievedLogs.length > 0 ? String(retrievedLogs.length) : undefined,
                },
                { id: 'search', label: 'Semantic Vector Search', icon: <Search className="w-3.5 h-3.5" /> },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as ViewTab)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    activeTab === tab.id
                      ? 'bg-neutral-800 text-white shadow-sm'
                      : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900/50'
                  }`}
                >
                  {tab.icon}
                  <span>{tab.label}</span>
                  {tab.badge && (
                    <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                      {tab.badge}
                    </span>
                  )}
                </button>
              ))}
            </div>

            <button
              onClick={handleClearProject}
              className="text-[11px] text-neutral-400 hover:text-rose-400 transition-colors whitespace-nowrap"
            >
              Clear Workspace Memories
            </button>
          </div>

          {/* Category Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto py-1">
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                  selectedCategory === cat.id
                    ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/40'
                    : 'bg-[#121216] text-neutral-400 border border-[#202028] hover:text-neutral-300'
                }`}
              >
                {cat.icon}
                <span>{cat.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Memory Grid */}
        {filteredEntries.length === 0 ? (
          <div className="py-16 text-center space-y-3 rounded-2xl bg-[#121216]/40 border border-[#1e1e24] border-dashed">
            <div className="mx-auto w-10 h-10 rounded-xl bg-neutral-900 flex items-center justify-center text-neutral-400">
              <Brain className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-neutral-200">No memories found</h3>
              <p className="text-xs text-neutral-400 max-w-sm mx-auto">
                {searchQuery
                  ? 'No memory entries matched your query. Try searching with different terms.'
                  : 'Memories will be automatically captured when the agent runs tasks, or you can add one manually.'}
              </p>
            </div>
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-neutral-800 text-white hover:bg-neutral-700 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" /> Add First Memory
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredEntries.map((entry) => (
              <MemoryCard
                key={entry.id}
                entry={entry}
                onPin={handlePin}
                onArchive={handleArchive}
                onDelete={handleDelete}
                onInspect={(e) => setInspectingEntry(e)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Add Memory Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg rounded-2xl bg-[#121216] border border-[#23232c] shadow-2xl overflow-hidden space-y-4 p-6">
            <div className="flex items-center justify-between pb-3 border-b border-[#23232c]">
              <div className="flex items-center gap-2">
                <Brain className="w-4 h-4 text-indigo-400" />
                <h2 className="text-sm font-bold text-white">Add Persistent Memory</h2>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="p-1 rounded-lg text-neutral-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateMemory} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="text-neutral-400 font-medium">Memory Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Framer Motion Animation Standard"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-[#1a1a20] border border-[#2a2a34] text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-neutral-400 font-medium">Category</label>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-[#1a1a20] border border-[#2a2a34] text-white focus:outline-none focus:border-indigo-500"
                  >
                    <option value="architecture">Architecture Decision</option>
                    <option value="bug">Bug Fix / Troubleshooting</option>
                    <option value="user_preference">User Directive / Preference</option>
                    <option value="ui_style">UI / Style Guideline</option>
                    <option value="workflow">Workflow Rule</option>
                    <option value="command">Working Command</option>
                    <option value="file">Key File / Reference</option>
                    <option value="convention">Coding Convention</option>
                    <option value="note">General Note</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-neutral-400 font-medium">Scope</label>
                  <select
                    value={newScope}
                    onChange={(e) => setNewScope(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-xl bg-[#1a1a20] border border-[#2a2a34] text-white focus:outline-none focus:border-indigo-500"
                  >
                    <option value="project">Project (Workspace Only)</option>
                    <option value="session">Session (This Conversation)</option>
                    <option value="global">Global (All Projects)</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-neutral-400 font-medium">Memory Content / Rules</label>
                <textarea
                  required
                  rows={4}
                  placeholder="Explain the pattern, bug resolution, or user directive that the agent must remember..."
                  value={newContent}
                  onChange={(e) => setNewContent(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-[#1a1a20] border border-[#2a2a34] text-white font-mono text-xs focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex items-center justify-between pt-2">
                <label className="flex items-center gap-2 text-neutral-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newPinned}
                    onChange={(e) => setNewPinned(e.target.checked)}
                    className="rounded border-[#2a2a34] text-indigo-500 focus:ring-0"
                  />
                  <span>Pin to top & prioritize for agent prompt</span>
                </label>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsAddModalOpen(false)}
                    className="px-3 py-1.5 rounded-xl text-neutral-400 hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 rounded-xl font-semibold bg-indigo-600 text-white hover:bg-indigo-500 transition-colors shadow-sm"
                  >
                    Save Memory
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Inspect Memory Details Drawer / Modal */}
      {inspectingEntry && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-2xl rounded-2xl bg-[#121216] border border-[#23232c] shadow-2xl overflow-hidden space-y-4 p-6">
            <div className="flex items-start justify-between pb-3 border-b border-[#23232c]">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                    {inspectingEntry.category}
                  </span>
                  <span className="px-2 py-0.5 rounded text-[10px] bg-[#1a1a20] text-neutral-400 border border-[#2a2a34]">
                    {inspectingEntry.scope}
                  </span>
                  {inspectingEntry.pinned && (
                    <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                      ★ Pinned
                    </span>
                  )}
                </div>
                <h2 className="text-base font-bold text-white">{inspectingEntry.title}</h2>
              </div>
              <button
                onClick={() => setInspectingEntry(null)}
                className="p-1 rounded-lg text-neutral-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Memory Value */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-neutral-400">
                <span>Durable Knowledge Value</span>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(inspectingEntry.value);
                    setCopiedId(true);
                    setTimeout(() => setCopiedId(false), 2000);
                  }}
                  className="flex items-center gap-1 hover:text-white transition-colors"
                >
                  {copiedId ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedId ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
              <div className="p-3.5 rounded-xl bg-[#0d0d10] border border-[#202028] text-xs text-neutral-200 font-mono whitespace-pre-wrap leading-relaxed max-h-60 overflow-y-auto">
                {inspectingEntry.value}
              </div>
            </div>

            {/* Metadata Badges */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 text-xs">
              <div className="p-2.5 rounded-lg bg-[#18181e] border border-[#252530]">
                <div className="text-[10px] text-neutral-400">Importance</div>
                <div className="font-semibold text-amber-400">
                  ★ {(inspectingEntry.importance * 10).toFixed(1)} / 10
                </div>
              </div>
              <div className="p-2.5 rounded-lg bg-[#18181e] border border-[#252530]">
                <div className="text-[10px] text-neutral-400">Confidence</div>
                <div className="font-semibold text-emerald-400">
                  {Math.round(inspectingEntry.confidence * 100)}%
                </div>
              </div>
              <div className="p-2.5 rounded-lg bg-[#18181e] border border-[#252530]">
                <div className="text-[10px] text-neutral-400">Recalled Times</div>
                <div className="font-semibold text-sky-400">{inspectingEntry.hits} hits</div>
              </div>
              <div className="p-2.5 rounded-lg bg-[#18181e] border border-[#252530]">
                <div className="text-[10px] text-neutral-400">Vector Embeddings</div>
                <div className="font-semibold text-purple-400">128-d sqlite-vec</div>
              </div>
            </div>

            {/* Tags */}
            {inspectingEntry.tags && inspectingEntry.tags.length > 0 && (
              <div className="flex items-center gap-1.5 flex-wrap pt-1">
                <span className="text-[11px] text-neutral-400">Tags:</span>
                {inspectingEntry.tags.map((t) => (
                  <span
                    key={t}
                    className="px-2 py-0.5 rounded text-[10px] bg-neutral-800 text-neutral-300 border border-neutral-700"
                  >
                    #{t}
                  </span>
                ))}
              </div>
            )}

            {/* Action Bar */}
            <div className="flex items-center justify-between pt-4 border-t border-[#23232c]">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handlePin(inspectingEntry.id, !inspectingEntry.pinned)}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-[#18181e] text-neutral-200 border border-[#282834] hover:border-amber-500/50 transition-colors flex items-center gap-1.5"
                >
                  <Pin className="w-3.5 h-3.5" />
                  {inspectingEntry.pinned ? 'Unpin' : 'Pin to Top'}
                </button>
                <button
                  onClick={() => handleArchive(inspectingEntry.id, !inspectingEntry.archived)}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-[#18181e] text-neutral-200 border border-[#282834] hover:bg-neutral-800 transition-colors flex items-center gap-1.5"
                >
                  <Archive className="w-3.5 h-3.5" />
                  {inspectingEntry.archived ? 'Restore' : 'Archive'}
                </button>
              </div>

              <button
                onClick={() => handleDelete(inspectingEntry.id)}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/30 hover:bg-rose-500/20 transition-colors flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
