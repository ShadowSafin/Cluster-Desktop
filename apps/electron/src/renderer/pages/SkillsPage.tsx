import React, { useState, useEffect, useMemo } from 'react';
import {
  Sparkles,
  ShoppingBag,
  CheckCircle2,
  History,
  Plus,
  Search,
  SlidersHorizontal,
  X,
  Layers,
  ShieldCheck,
  Terminal,
  ExternalLink,
  RotateCw,
  Clock,
  Pin,
  FileCode,
  Tag,
  AlertTriangle,
} from 'lucide-react';
import type { SkillManifest, InstalledSkill, SkillCategory, SkillInvocationRecord } from '@cluster/shared';
import { SkillCard } from '../components/SkillCard';

const CATEGORIES: { id: SkillCategory | 'all'; label: string }[] = [
  { id: 'all', label: 'All Categories' },
  { id: 'coding', label: 'Coding' },
  { id: 'refactor', label: 'Refactor' },
  { id: 'testing', label: 'Testing' },
  { id: 'debugging', label: 'Debugging' },
  { id: 'ui', label: 'UI & Design' },
  { id: 'docs', label: 'Docs & API' },
  { id: 'review', label: 'Code Review & Security' },
  { id: 'electron', label: 'Electron Desktop' },
  { id: 'memory', label: 'Memory' },
  { id: 'workflow', label: 'Workflow' },
  { id: 'automation', label: 'Automation' },
  { id: 'planning', label: 'Planning & Specs' },
  { id: 'deployment', label: 'Deployment' },
  { id: 'project_setup', label: 'Project Setup' },
  { id: 'migration', label: 'Migration' },
  { id: 'provider', label: 'Provider & Routing' },
];

interface Props {
  onNavigateToWorkspace?: (initialCommand?: string) => void;
}

export const SkillsPage: React.FC<Props> = ({ onNavigateToWorkspace }) => {
  const [activeTab, setActiveTab] = useState<'installed' | 'marketplace' | 'custom' | 'history'>('installed');
  const [installed, setInstalled] = useState<InstalledSkill[]>([]);
  const [marketplace, setMarketplace] = useState<(SkillManifest & { isInstalled: boolean })[]>([]);
  const [history, setHistory] = useState<SkillInvocationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ installedCount: 0, marketplaceCount: 0, totalInvocations: 0, pinnedCount: 0 });

  // Filters
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<SkillCategory | 'all'>('all');
  const [sortBy, setSortBy] = useState<'popularity' | 'rating' | 'name' | 'recent'>('popularity');

  // Modals
  const [inspectSkill, setInspectSkill] = useState<{ manifest: SkillManifest; installed?: InstalledSkill } | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Custom skill form
  const [customName, setCustomName] = useState('');
  const [customCmd, setCustomCmd] = useState('');
  const [customCategory, setCustomCategory] = useState<SkillCategory>('coding');
  const [customDesc, setCustomDesc] = useState('');
  const [customInstructions, setCustomInstructions] = useState('');
  const [customCreating, setCustomCreating] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      const [inst, mkt, hist, st] = await Promise.all([
        window.cluster.skills.list(),
        window.cluster.skills.marketplace(),
        window.cluster.skills.history(100),
        window.cluster.skills.stats(),
      ]);
      setInstalled(inst);
      setMarketplace(mkt);
      setHistory(hist);
      setStats(st);
    } catch (e) {
      console.error('Failed to load skills:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleInstall = async (id: string) => {
    await window.cluster.skills.install(id);
    await loadData();
  };

  const handleUninstall = async (id: string) => {
    if (confirm(`Uninstall skill "${id}"?`)) {
      await window.cluster.skills.uninstall(id);
      await loadData();
      if (inspectSkill?.manifest.id === id) setInspectSkill(null);
    }
  };

  const handleToggle = async (id: string, enabled: boolean) => {
    await window.cluster.skills.toggle(id, enabled);
    await loadData();
  };

  const handlePin = async (id: string, pinned: boolean) => {
    await window.cluster.skills.pin(id, pinned);
    await loadData();
  };

  const handleCreateCustom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customName.trim() || !customCmd.trim() || !customInstructions.trim()) return;

    try {
      setCustomCreating(true);
      await window.cluster.skills.createCustom({
        displayName: customName.trim(),
        invocationName: customCmd.trim().replace(/^\//, ''),
        category: customCategory,
        description: customDesc.trim(),
        instructions: customInstructions.trim(),
      });
      setShowCreateModal(false);
      setCustomName('');
      setCustomCmd('');
      setCustomDesc('');
      setCustomInstructions('');
      await loadData();
      setActiveTab('installed');
    } finally {
      setCustomCreating(false);
    }
  };

  const handleRunSkill = (command: string) => {
    if (onNavigateToWorkspace) {
      onNavigateToWorkspace(command);
    }
  };

  // Filtered lists
  const filteredInstalled = useMemo(() => {
    let list = [...installed];
    if (selectedCategory !== 'all') {
      list = list.filter((s) => s.manifest.category === selectedCategory);
    }
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      list = list.filter(
        (s) =>
          s.manifest.displayName.toLowerCase().includes(q) ||
          s.manifest.description.toLowerCase().includes(q) ||
          s.manifest.invocationName.toLowerCase().includes(q) ||
          s.manifest.tags.some((t) => t.toLowerCase().includes(q)),
      );
    }
    return list;
  }, [installed, selectedCategory, search]);

  const filteredMarketplace = useMemo(() => {
    let list = [...marketplace];
    if (selectedCategory !== 'all') {
      list = list.filter((s) => s.category === selectedCategory);
    }
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      list = list.filter(
        (s) =>
          s.displayName.toLowerCase().includes(q) ||
          s.description.toLowerCase().includes(q) ||
          s.invocationName.toLowerCase().includes(q) ||
          s.author.toLowerCase().includes(q) ||
          s.tags.some((t) => t.toLowerCase().includes(q)),
      );
    }
    if (sortBy === 'rating') {
      list.sort((a, b) => b.stats.rating - a.stats.rating);
    } else if (sortBy === 'name') {
      list.sort((a, b) => a.displayName.localeCompare(b.displayName));
    } else if (sortBy === 'recent') {
      list.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    } else {
      list.sort((a, b) => b.stats.downloads - a.stats.downloads);
    }
    return list;
  }, [marketplace, selectedCategory, search, sortBy]);

  const customSkills = useMemo(() => {
    return installed.filter((s) => s.manifest.installSource === 'custom');
  }, [installed]);

  return (
    <div className="flex-1 flex flex-col h-full bg-[#0a0a0d] text-white overflow-hidden select-none">
      {/* Top Stats Banner */}
      <div className="p-6 border-b border-[#1f1f24] bg-[#0e0e12]">
        <div className="flex items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-600 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-cyan-500/20">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
                Skills & Marketplace
                <span className="text-xs font-mono font-normal text-cyan-400 bg-cyan-950/60 border border-cyan-500/30 px-2 py-0.5 rounded-full">
                  v1.0 Standard
                </span>
              </h1>
              <p className="text-xs text-zinc-400 mt-0.5">
                Extend Cluster with prompt engines, custom refactoring workflows, and slash-command tools
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={loadData}
              title="Refresh skills"
              className="p-2 rounded-lg bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 border border-zinc-700 transition-colors"
            >
              <RotateCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={() => setShowCreateModal(true)}
              className="text-xs bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-medium px-3.5 py-2 rounded-lg flex items-center gap-1.5 shadow-md shadow-cyan-500/20 transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Create Custom Skill</span>
            </button>
          </div>
        </div>

        {/* 4 Stats Chips */}
        <div className="grid grid-cols-4 gap-3">
          <div className="rounded-lg bg-[#141419] border border-[#23232a] p-3 flex items-center justify-between">
            <div>
              <div className="text-[11px] text-zinc-400 uppercase font-medium tracking-wider">Installed Skills</div>
              <div className="text-lg font-bold text-white mt-0.5">{stats.installedCount}</div>
            </div>
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
          </div>

          <div className="rounded-lg bg-[#141419] border border-[#23232a] p-3 flex items-center justify-between">
            <div>
              <div className="text-[11px] text-zinc-400 uppercase font-medium tracking-wider">Marketplace Catalog</div>
              <div className="text-lg font-bold text-white mt-0.5">{stats.marketplaceCount}</div>
            </div>
            <ShoppingBag className="w-5 h-5 text-cyan-400" />
          </div>

          <div className="rounded-lg bg-[#141419] border border-[#23232a] p-3 flex items-center justify-between">
            <div>
              <div className="text-[11px] text-zinc-400 uppercase font-medium tracking-wider">Total Invocations</div>
              <div className="text-lg font-bold text-white mt-0.5">{stats.totalInvocations}</div>
            </div>
            <Terminal className="w-5 h-5 text-purple-400" />
          </div>

          <div className="rounded-lg bg-[#141419] border border-[#23232a] p-3 flex items-center justify-between">
            <div>
              <div className="text-[11px] text-zinc-400 uppercase font-medium tracking-wider">Pinned Favorites</div>
              <div className="text-lg font-bold text-white mt-0.5">{stats.pinnedCount}</div>
            </div>
            <Pin className="w-5 h-5 text-amber-400" />
          </div>
        </div>
      </div>

      {/* Tabs & Controls */}
      <div className="px-6 pt-4 pb-2 border-b border-[#1f1f24] bg-[#0c0c10] flex flex-col gap-3">
        <div className="flex items-center justify-between gap-4">
          {/* Main 4 Tabs */}
          <div className="flex items-center gap-1 bg-[#141419] p-1 rounded-lg border border-[#23232a]">
            <button
              onClick={() => setActiveTab('installed')}
              className={`text-xs px-3 py-1.5 rounded-md font-medium flex items-center gap-1.5 transition-all ${
                activeTab === 'installed'
                  ? 'bg-zinc-800 text-white shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>Installed</span>
              <span className="text-[10px] bg-zinc-900 px-1.5 py-0.2 rounded-full text-zinc-400 font-mono">
                {installed.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('marketplace')}
              className={`text-xs px-3 py-1.5 rounded-md font-medium flex items-center gap-1.5 transition-all ${
                activeTab === 'marketplace'
                  ? 'bg-zinc-800 text-white shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <ShoppingBag className="w-3.5 h-3.5 text-cyan-400" />
              <span>Marketplace</span>
              <span className="text-[10px] bg-zinc-900 px-1.5 py-0.2 rounded-full text-zinc-400 font-mono">
                {marketplace.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('custom')}
              className={`text-xs px-3 py-1.5 rounded-md font-medium flex items-center gap-1.5 transition-all ${
                activeTab === 'custom'
                  ? 'bg-zinc-800 text-white shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <FileCode className="w-3.5 h-3.5 text-amber-400" />
              <span>Custom Skills</span>
              <span className="text-[10px] bg-zinc-900 px-1.5 py-0.2 rounded-full text-zinc-400 font-mono">
                {customSkills.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('history')}
              className={`text-xs px-3 py-1.5 rounded-md font-medium flex items-center gap-1.5 transition-all ${
                activeTab === 'history'
                  ? 'bg-zinc-800 text-white shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <History className="w-3.5 h-3.5 text-purple-400" />
              <span>Activity Log</span>
              <span className="text-[10px] bg-zinc-900 px-1.5 py-0.2 rounded-full text-zinc-400 font-mono">
                {history.length}
              </span>
            </button>
          </div>

          {/* Search & Sort */}
          {activeTab !== 'history' && (
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search skills, commands, tags…"
                  className="w-64 bg-[#141419] border border-[#27272e] rounded-lg pl-8 pr-7 py-1.5 text-xs text-white placeholder:text-zinc-500 outline-none focus:border-cyan-500 transition-colors"
                />
                {search && (
                  <button
                    onClick={() => setSearch('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {activeTab === 'marketplace' && (
                <div className="flex items-center gap-1 bg-[#141419] border border-[#27272e] rounded-lg px-2 py-1 text-xs">
                  <SlidersHorizontal className="w-3 h-3 text-zinc-500" />
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as any)}
                    className="bg-transparent text-zinc-300 text-xs outline-none cursor-pointer"
                  >
                    <option value="popularity">Most Popular</option>
                    <option value="rating">Highest Rated</option>
                    <option value="name">Name A-Z</option>
                    <option value="recent">Recently Updated</option>
                  </select>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Category Filter Chips */}
        {activeTab !== 'history' && (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1.5 text-xs no-scrollbar">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`shrink-0 px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
                  selectedCategory === cat.id
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                    : 'bg-zinc-900/60 text-zinc-400 hover:text-zinc-200 border border-zinc-800'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-6">
        {activeTab === 'installed' && (
          <div>
            {filteredInstalled.length === 0 ? (
              <div className="text-center py-16 text-zinc-500">
                <CheckCircle2 className="w-10 h-10 mx-auto mb-2 text-zinc-600" />
                <p className="text-sm font-medium text-zinc-400">No installed skills found matching your filters</p>
                <p className="text-xs text-zinc-500 mt-1">Browse the Marketplace tab to install new capabilities</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {filteredInstalled.map((item) => (
                  <SkillCard
                    key={item.manifest.id}
                    manifest={item.manifest}
                    installed={item}
                    onUninstall={handleUninstall}
                    onToggle={handleToggle}
                    onPin={handlePin}
                    onInspect={(m, inst) => setInspectSkill({ manifest: m, installed: inst })}
                    onInvokeDirect={handleRunSkill}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'marketplace' && (
          <div>
            {filteredMarketplace.length === 0 ? (
              <div className="text-center py-16 text-zinc-500">
                <ShoppingBag className="w-10 h-10 mx-auto mb-2 text-zinc-600" />
                <p className="text-sm font-medium text-zinc-400">No marketplace skills found</p>
                <p className="text-xs text-zinc-500 mt-1">Try refining your search terms or category filter</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {filteredMarketplace.map((manifest) => {
                  const inst = installed.find((s) => s.manifest.id === manifest.id);
                  return (
                    <SkillCard
                      key={manifest.id}
                      manifest={manifest}
                      installed={inst}
                      onInstall={handleInstall}
                      onUninstall={handleUninstall}
                      onToggle={handleToggle}
                      onPin={handlePin}
                      onInspect={(m, installedItem) => setInspectSkill({ manifest: m, installed: installedItem })}
                      onInvokeDirect={handleRunSkill}
                    />
                  );
                })}
              </div>
            )}
          </div>
        )}

        {activeTab === 'custom' && (
          <div>
            {customSkills.length === 0 ? (
              <div className="text-center py-16 text-zinc-500">
                <FileCode className="w-10 h-10 mx-auto mb-2 text-zinc-600" />
                <p className="text-sm font-medium text-zinc-400">No custom skills created yet</p>
                <p className="text-xs text-zinc-500 mt-1">
                  Click the "+ Create Custom Skill" button above to author your first custom prompt or workflow
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {customSkills.map((item) => (
                  <SkillCard
                    key={item.manifest.id}
                    manifest={item.manifest}
                    installed={item}
                    onUninstall={handleUninstall}
                    onToggle={handleToggle}
                    onPin={handlePin}
                    onInspect={(m, inst) => setInspectSkill({ manifest: m, installed: inst })}
                    onInvokeDirect={handleRunSkill}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'history' && (
          <div className="max-w-4xl mx-auto space-y-2">
            {history.length === 0 ? (
              <div className="text-center py-16 text-zinc-500">
                <History className="w-10 h-10 mx-auto mb-2 text-zinc-600" />
                <p className="text-sm font-medium text-zinc-400">No skill invocations recorded yet</p>
                <p className="text-xs text-zinc-500 mt-1">
                  Invoke a skill in the chat with {'/<invocationName>'} to see live execution audit trails
                </p>
              </div>
            ) : (
              history.map((item) => (
                <div
                  key={item.id}
                  className="rounded-xl border border-[#222227] bg-[#111115] p-3.5 flex items-center justify-between gap-3 hover:border-zinc-700 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-zinc-800 border border-zinc-700 flex items-center justify-center text-cyan-400 font-mono text-xs font-bold shrink-0">
                      /
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs text-cyan-300 font-semibold">{item.rawCommand}</span>
                        <span className="text-[11px] text-zinc-400">({item.skillName})</span>
                      </div>
                      <div className="text-[10px] text-zinc-500 flex items-center gap-2 mt-0.5 font-mono">
                        <span>{new Date(item.invokedAt).toLocaleString()}</span>
                        <span>·</span>
                        <span>session: {item.sessionId.slice(0, 8)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-[11px] px-2 py-0.5 rounded font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      {item.status}
                    </span>
                    <button
                      onClick={() => handleRunSkill(item.rawCommand)}
                      className="text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-200 px-2.5 py-1 rounded border border-zinc-700 transition-colors"
                    >
                      Re-run
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Detail Inspection Modal */}
      {inspectSkill && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#121217] border border-zinc-700 rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="p-5 border-b border-[#23232a] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-zinc-800 border border-zinc-700 flex items-center justify-center text-cyan-400 font-bold">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-white flex items-center gap-2">
                    {inspectSkill.manifest.displayName}
                    <span className="text-xs font-mono font-normal text-zinc-400 bg-zinc-800 px-2 py-0.5 rounded">
                      v{inspectSkill.manifest.version}
                    </span>
                  </h2>
                  <div className="text-xs text-zinc-400 mt-0.5">
                    by {inspectSkill.manifest.author} · Category: <span className="text-cyan-400">{inspectSkill.manifest.category}</span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => setInspectSkill(null)}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-4 flex-1 text-xs">
              <div>
                <h4 className="text-[11px] font-semibold uppercase text-zinc-400 tracking-wider mb-1">Description</h4>
                <p className="text-zinc-200 leading-relaxed bg-[#181820] p-3 rounded-xl border border-zinc-800">
                  {inspectSkill.manifest.description}
                </p>
              </div>

              <div>
                <h4 className="text-[11px] font-semibold uppercase text-zinc-400 tracking-wider mb-1">Invocation Command</h4>
                <div className="flex items-center gap-2 bg-[#181820] p-3 rounded-xl border border-zinc-800 font-mono text-cyan-300">
                  <span>/{inspectSkill.manifest.invocationName} [parameters]</span>
                </div>
              </div>

              {/* Workflow steps */}
              {inspectSkill.manifest.workflow && inspectSkill.manifest.workflow.length > 0 && (
                <div>
                  <h4 className="text-[11px] font-semibold uppercase text-zinc-400 tracking-wider mb-1.5">
                    Execution Workflow
                  </h4>
                  <div className="space-y-1.5">
                    {inspectSkill.manifest.workflow.map((st, idx) => (
                      <div
                        key={st.id}
                        className="flex items-start gap-2.5 p-2.5 rounded-lg bg-[#181820] border border-zinc-800/80"
                      >
                        <span className="w-5 h-5 rounded-full bg-cyan-500/20 text-cyan-300 text-[10px] flex items-center justify-center font-bold shrink-0">
                          {idx + 1}
                        </span>
                        <div>
                          <div className="font-semibold text-zinc-200">{st.title}</div>
                          <div className="text-zinc-400 mt-0.5">{st.action}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Prompt / Instructions Preview */}
              <div>
                <h4 className="text-[11px] font-semibold uppercase text-zinc-400 tracking-wider mb-1">
                  System Prompt Directive
                </h4>
                <pre className="p-3 rounded-xl bg-[#0e0e12] border border-zinc-800 text-zinc-300 font-mono text-[11px] whitespace-pre-wrap max-h-48 overflow-y-auto leading-relaxed">
                  {inspectSkill.manifest.instructions}
                </pre>
              </div>

              {/* Security & Permissions */}
              <div>
                <h4 className="text-[11px] font-semibold uppercase text-zinc-400 tracking-wider mb-1.5">
                  Declared Capabilities & Sandbox
                </h4>
                <div className="flex flex-wrap gap-2">
                  {inspectSkill.manifest.requiredPermissions.map((perm) => (
                    <span
                      key={perm}
                      className="px-2 py-1 rounded bg-zinc-800 border border-zinc-700 text-zinc-300 font-mono text-[11px]"
                    >
                      perm:{perm}
                    </span>
                  ))}
                  {inspectSkill.manifest.requiredTools.map((t) => (
                    <span
                      key={t}
                      className="px-2 py-1 rounded bg-zinc-800/60 border border-zinc-700/60 text-zinc-400 font-mono text-[11px]"
                    >
                      tool:{t}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-[#23232a] bg-[#0f0f13] flex items-center justify-between">
              <div className="text-[11px] text-zinc-400">
                Source: <span className="font-medium text-zinc-200 uppercase">{inspectSkill.manifest.installSource}</span>
              </div>
              <div className="flex items-center gap-2">
                {inspectSkill.installed ? (
                  <button
                    onClick={() => {
                      setInspectSkill(null);
                      handleRunSkill(`/${inspectSkill.manifest.invocationName}`);
                    }}
                    className="text-xs bg-cyan-600 hover:bg-cyan-500 text-white font-medium px-4 py-2 rounded-lg transition-colors shadow-sm"
                  >
                    Run in Workspace (/{inspectSkill.manifest.invocationName})
                  </button>
                ) : (
                  <button
                    onClick={() => handleInstall(inspectSkill.manifest.id)}
                    className="text-xs bg-cyan-600 hover:bg-cyan-500 text-white font-medium px-4 py-2 rounded-lg transition-colors shadow-sm"
                  >
                    Install Skill
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create Custom Skill Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleCreateCustom}
            className="bg-[#121217] border border-zinc-700 rounded-2xl w-full max-w-xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden"
          >
            <div className="p-5 border-b border-[#23232a] flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-cyan-600/20 border border-cyan-500/40 flex items-center justify-center text-cyan-300">
                  <Plus className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Create Custom Skill</h3>
                  <p className="text-[11px] text-zinc-400">Define a reusable prompt or workflow trigger</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto flex-1 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-zinc-300 mb-1">Display Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. My Fast Linter"
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                    className="w-full bg-[#181820] border border-zinc-700 rounded-lg px-3 py-2 text-xs text-white placeholder:text-zinc-500 outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-zinc-300 mb-1">
                    Slash Command Trigger *
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 font-mono">/</span>
                    <input
                      type="text"
                      required
                      placeholder="e.g. fast-lint"
                      value={customCmd}
                      onChange={(e) => setCustomCmd(e.target.value.toLowerCase().replace(/[^a-z0-9-_]/g, ''))}
                      className="w-full bg-[#181820] border border-zinc-700 rounded-lg pl-6 pr-3 py-2 text-xs text-cyan-300 font-mono placeholder:text-zinc-500 outline-none focus:border-cyan-500"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-zinc-300 mb-1">Category</label>
                <select
                  value={customCategory}
                  onChange={(e) => setCustomCategory(e.target.value as any)}
                  className="w-full bg-[#181820] border border-zinc-700 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-cyan-500"
                >
                  {CATEGORIES.filter((c) => c.id !== 'all').map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-zinc-300 mb-1">Description</label>
                <input
                  type="text"
                  placeholder="Short summary of what this skill does"
                  value={customDesc}
                  onChange={(e) => setCustomDesc(e.target.value)}
                  className="w-full bg-[#181820] border border-zinc-700 rounded-lg px-3 py-2 text-xs text-white placeholder:text-zinc-500 outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-zinc-300 mb-1">
                  Instructions / System Prompt *
                </label>
                <textarea
                  rows={6}
                  required
                  placeholder="Direct instructions given to the agent whenever /command is invoked..."
                  value={customInstructions}
                  onChange={(e) => setCustomInstructions(e.target.value)}
                  className="w-full bg-[#181820] border border-zinc-700 rounded-lg p-3 text-xs text-white placeholder:text-zinc-500 font-mono outline-none focus:border-cyan-500 resize-none"
                />
              </div>
            </div>

            <div className="p-4 border-t border-[#23232a] bg-[#0f0f13] flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="text-xs text-zinc-400 hover:text-white px-3 py-1.5 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={customCreating}
                className="text-xs bg-cyan-600 hover:bg-cyan-500 text-white font-medium px-4 py-2 rounded-lg transition-colors shadow-sm disabled:opacity-50"
              >
                {customCreating ? 'Creating…' : 'Save & Install Skill'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
