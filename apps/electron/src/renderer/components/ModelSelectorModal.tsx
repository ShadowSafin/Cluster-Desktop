import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  Bot,
  Search,
  Check,
  Sparkles,
  ExternalLink,
  ChevronRight,
  Cpu,
  Layers,
  ArrowRight,
  X,
  RefreshCw,
  Server,
  AlertCircle,
  Zap,
} from 'lucide-react';

export interface ModelOption {
  id: string;
  name: string;
  provider: string;
  description: string;
  badge?: string;
  isPopular?: boolean;
  isProvider?: boolean;
  contextWindow?: number;
  reasoning?: boolean;
  vision?: boolean;
}

export const PRESET_MODELS: ModelOption[] = [
  // Anthropic
  {
    id: 'claude-3-7-sonnet-20250219',
    name: 'Claude 3.7 Sonnet',
    provider: 'Anthropic',
    description: 'Hybrid reasoning and frontier coding capability with adaptive thinking.',
    badge: 'Latest',
    isPopular: true,
  },
  {
    id: 'claude-3-5-sonnet-20241022',
    name: 'Claude 3.5 Sonnet',
    provider: 'Anthropic',
    description: 'Industry-leading code generation, architectural refactoring, and multi-file reasoning.',
    badge: 'Recommended',
    isPopular: true,
  },
  {
    id: 'claude-3-5-haiku-20241022',
    name: 'Claude 3.5 Haiku',
    provider: 'Anthropic',
    description: 'Ultra-fast, responsive coding model ideal for quick queries and edits.',
    badge: 'Fast',
  },

  // OpenAI
  {
    id: 'gpt-4o',
    name: 'GPT-4o',
    provider: 'OpenAI',
    description: 'Flagship multimodal high-intelligence model for general programming.',
    isPopular: true,
  },
  {
    id: 'gpt-4o-mini',
    name: 'GPT-4o mini',
    provider: 'OpenAI',
    description: 'Fast, cost-efficient model for everyday coding tasks.',
    badge: 'Lightweight',
  },
  {
    id: 'o3-mini',
    name: 'o3-mini',
    provider: 'OpenAI',
    description: 'High-speed reasoning model specialized in math, logic, and coding.',
    badge: 'Reasoning',
    isPopular: true,
  },
  {
    id: 'o1',
    name: 'o1',
    provider: 'OpenAI',
    description: 'Deep reasoning model that spends more time thinking before answering.',
    badge: 'Deep Reasoning',
  },

  // Google
  {
    id: 'gemini-2.0-flash',
    name: 'Gemini 2.0 Flash',
    provider: 'Google',
    description: 'Next-gen multimodal model with high speed and large 1M token context.',
    badge: '1M Context',
    isPopular: true,
  },
  {
    id: 'gemini-2.0-pro-exp-02-05',
    name: 'Gemini 2.0 Pro',
    provider: 'Google',
    description: 'Google’s frontier model for complex coding and math problems.',
    badge: 'Experimental',
  },

  // DeepSeek
  {
    id: 'deepseek-chat',
    name: 'DeepSeek V3',
    provider: 'DeepSeek',
    description: 'Strong general coding and architectural intelligence at lower latency.',
    isPopular: true,
  },
  {
    id: 'deepseek-reasoner',
    name: 'DeepSeek R1',
    provider: 'DeepSeek',
    description: 'Open-weights reasoning model with comprehensive chain-of-thought.',
    badge: 'Reasoning',
    isPopular: true,
  },

  // Local / Open Source
  {
    id: 'qwen2.5-coder:32b',
    name: 'Qwen 2.5 Coder 32B',
    provider: 'Local / Open Source',
    description: 'Top-tier open-source coding model running via Ollama or local endpoint.',
    badge: 'Local',
  },
  {
    id: 'llama3.3:70b',
    name: 'Llama 3.3 70B',
    provider: 'Local / Open Source',
    description: 'Meta’s open-weights 70B parameter model with general coding capabilities.',
    badge: 'Local',
  },
];

export function getModelDisplayName(modelId?: string, extraModels?: ModelOption[]): string {
  if (!modelId) return 'Claude 3.5 Sonnet';
  if (extraModels && extraModels.length > 0) {
    const foundExtra = extraModels.find(
      (m) => m.id.toLowerCase() === modelId.toLowerCase() || m.name.toLowerCase() === modelId.toLowerCase()
    );
    if (foundExtra) return foundExtra.name;
  }
  try {
    const cachedRaw = localStorage.getItem('cluster:cached_provider_models');
    if (cachedRaw) {
      const cached = JSON.parse(cachedRaw);
      const foundCached = cached.find(
        (m: any) => m.id.toLowerCase() === modelId.toLowerCase() || m.name?.toLowerCase() === modelId.toLowerCase()
      );
      if (foundCached) return foundCached.name;
    }
  } catch {}
  const found = PRESET_MODELS.find(
    (m) => m.id.toLowerCase() === modelId.toLowerCase() || m.name.toLowerCase() === modelId.toLowerCase()
  );
  if (found) return found.name;
  if (modelId.includes('/')) {
    const lastPart = modelId.split('/').pop() || modelId;
    return lastPart.replace(/[-_]/g, ' ');
  }
  return modelId;
}

interface ModelSelectorModalProps {
  open: boolean;
  onClose: () => void;
  currentModel: string;
  onSelectModel: (modelId: string) => void;
  projectRoot?: string;
  onOpenProviderSettings?: () => void;
}

export const ModelSelectorModal: React.FC<ModelSelectorModalProps> = ({
  open,
  onClose,
  currentModel,
  onSelectModel,
  projectRoot,
  onOpenProviderSettings,
}) => {
  const [search, setSearch] = useState('');
  const [selectedTab, setSelectedTab] = useState<string>('All');
  const [customModelInput, setCustomModelInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [providerSource, setProviderSource] = useState<string>('');
  const [providerModels, setProviderModels] = useState<ModelOption[]>(() => {
    try {
      const cached = localStorage.getItem('cluster:cached_provider_models');
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });

  const inputRef = useRef<HTMLInputElement>(null);

  const fetchProviderModels = useCallback(async () => {
    if (typeof window !== 'undefined' && window.cluster?.models?.list) {
      setLoading(true);
      setFetchError(null);
      try {
        const res = await window.cluster.models.list({ projectRoot });
        if (res && res.ok && Array.isArray(res.models) && res.models.length > 0) {
          const transformed: ModelOption[] = res.models.map((m: any) => {
            const badges: string[] = [];
            if (m.reasoning) badges.push('Reasoning');
            if (m.contextWindow) badges.push(`${Math.round(m.contextWindow / 1000)}k Context`);
            else if (m.vision) badges.push('Vision');

            return {
              id: m.id,
              name: m.name || m.id,
              provider: m.provider || 'Configured Provider',
              description: m.description || `Discovered from ${res.sourceUrl || 'provider endpoint'}`,
              badge: badges[0],
              isProvider: true,
              contextWindow: m.contextWindow,
              reasoning: m.reasoning,
              vision: m.vision,
            };
          });
          setProviderModels(transformed);
          setProviderSource(res.sourceUrl || 'Connected Provider');
          try {
            localStorage.setItem('cluster:cached_provider_models', JSON.stringify(transformed));
          } catch {}
          // Automatically focus on provider models tab if models found
          setSelectedTab('Provider Models');
        } else if (res && !res.ok && res.error) {
          setFetchError(res.error);
        }
      } catch (err: any) {
        setFetchError(err?.message || 'Failed to query provider models');
      } finally {
        setLoading(false);
      }
    }
  }, [projectRoot]);

  useEffect(() => {
    if (open) {
      setSearch('');
      setCustomModelInput('');
      fetchProviderModels();
      setTimeout(() => inputRef.current?.focus(), 60);
    }
  }, [open, fetchProviderModels]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!open) return;
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  // Combined models list: Provider models first, followed by unique preset models
  const allAvailableModels = useMemo(() => {
    const existingIds = new Set(providerModels.map((m) => m.id.toLowerCase()));
    const remainingPresets = PRESET_MODELS.filter((m) => !existingIds.has(m.id.toLowerCase()));
    return [...providerModels, ...remainingPresets];
  }, [providerModels]);

  const tabs = useMemo(() => {
    const list: string[] = [];
    if (providerModels.length > 0) {
      list.push('Provider Models');
    }
    list.push('All', 'Anthropic', 'OpenAI', 'Google', 'DeepSeek', 'Local / Open Source');
    return list;
  }, [providerModels.length]);

  const filteredModels = useMemo(() => {
    const query = search.trim().toLowerCase();
    let baseList = allAvailableModels;

    if (selectedTab === 'Provider Models') {
      baseList = providerModels;
    } else if (selectedTab !== 'All') {
      baseList = allAvailableModels.filter((m) => m.provider === selectedTab);
    }

    if (!query) return baseList;

    return baseList.filter((m) => {
      return (
        m.name.toLowerCase().includes(query) ||
        m.id.toLowerCase().includes(query) ||
        m.provider.toLowerCase().includes(query) ||
        m.description.toLowerCase().includes(query)
      );
    });
  }, [allAvailableModels, providerModels, selectedTab, search]);

  if (!open) return null;

  const handleSelect = (modelId: string) => {
    onSelectModel(modelId);
    onClose();
  };

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = (customModelInput || search).trim();
    if (trimmed) {
      handleSelect(trimmed);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-in fade-in select-none"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl rounded-2xl border border-[#23232a] bg-[#0c0c0e] shadow-2xl flex flex-col overflow-hidden text-xs max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b border-[#1f1f24] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#16161c] border border-[#24242d] text-zinc-200 flex items-center justify-center shrink-0">
              <Bot className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold text-white tracking-wide">Select Model</h2>
                {providerModels.length > 0 && (
                  <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    {providerModels.length} Discovered
                  </span>
                )}
              </div>
              <p className="text-[11px] text-zinc-400 mt-0.5">
                {providerSource ? `Connected to ${providerSource}` : 'Switch LLM model for this workspace'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={fetchProviderModels}
              disabled={loading}
              className="p-1.5 rounded-lg hover:bg-[#18181e] text-zinc-400 hover:text-white transition-colors cursor-pointer disabled:opacity-50"
              title="Refresh models from provider"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-emerald-400' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="w-7 h-7 rounded-lg hover:bg-[#18181e] text-zinc-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Search input & Provider Filter Tabs */}
        <div className="p-3 border-b border-[#1f1f24] bg-[#0e0e11] space-y-2.5">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              ref={inputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search provider models or presets (e.g. agnes-2.5-flash, Claude, GPT)..."
              className="w-full pl-9 pr-3 py-2 rounded-xl bg-[#141418] border border-[#202026] text-xs text-white placeholder:text-zinc-500 outline-none focus:border-[#32323e] transition-colors"
            />
          </div>

          {/* Provider Filter Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-none">
            {tabs.map((tab) => {
              const isSelected = selectedTab === tab;
              const isProviderTab = tab === 'Provider Models';

              return (
                <button
                  key={tab}
                  onClick={() => setSelectedTab(tab)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                    isSelected
                      ? isProviderTab
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                        : 'bg-[#1f1f26] text-white border border-[#2c2c36] shadow-sm'
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-[#15151a]'
                  }`}
                >
                  {isProviderTab && <Server className="w-3 h-3 text-emerald-400" />}
                  <span>{tab}</span>
                  {isProviderTab && (
                    <span className="text-[10px] font-mono px-1 py-0.2 rounded bg-emerald-500/20 text-emerald-300">
                      {providerModels.length}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Informational Alerts */}
        {fetchError && (
          <div className="px-4 py-2.5 bg-amber-950/20 border-b border-amber-900/30 flex items-center justify-between text-[11px] text-amber-300">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span>Could not query provider models: {fetchError}</span>
            </div>
            {onOpenProviderSettings && (
              <button
                onClick={() => {
                  onClose();
                  onOpenProviderSettings();
                }}
                className="underline hover:text-white shrink-0 ml-2"
              >
                Settings →
              </button>
            )}
          </div>
        )}

        {/* Model List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-1.5 min-h-0">
          {loading && providerModels.length === 0 && (
            <div className="py-8 text-center space-y-2">
              <RefreshCw className="w-5 h-5 text-emerald-400 animate-spin mx-auto" />
              <p className="text-zinc-400 text-xs">Querying connected provider endpoint for models...</p>
            </div>
          )}

          {filteredModels.map((m) => {
            const isSelected =
              currentModel.toLowerCase() === m.id.toLowerCase() ||
              currentModel.toLowerCase() === m.name.toLowerCase();

            return (
              <div
                key={m.id}
                onClick={() => handleSelect(m.id)}
                className={`p-2.5 rounded-xl border transition-all cursor-pointer flex items-start justify-between gap-3 ${
                  isSelected
                    ? 'bg-[#18181f] border-[#383846] text-white shadow-md ring-1 ring-emerald-500/30'
                    : 'bg-[#121215] border-[#1d1d22] text-zinc-300 hover:border-[#2b2b34] hover:bg-[#16161b]'
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-xs text-white">{m.name}</span>
                    <span className="font-mono text-[10px] text-zinc-400 bg-[#17171d] px-1.5 py-0.2 rounded border border-[#22222a]">
                      {m.id}
                    </span>
                    {m.isProvider && (
                      <span className="text-[9px] font-semibold px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        Provider
                      </span>
                    )}
                    {m.badge && (
                      <span className="text-[9px] font-semibold px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-300 border border-zinc-700">
                        {m.badge}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-zinc-400 mt-1 line-clamp-1">{m.description}</p>
                </div>

                <div className="shrink-0 pt-0.5 flex items-center gap-2">
                  {isSelected ? (
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                      <Check className="w-3 h-3 stroke-[3]" />
                      Active
                    </span>
                  ) : (
                    <span className="text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors">
                      Select
                    </span>
                  )}
                </div>
              </div>
            );
          })}

          {!loading && filteredModels.length === 0 && (
            <div className="py-8 text-center space-y-3">
              <p className="text-zinc-400 text-xs">
                No model matches "<span className="text-white">{search}</span>"
              </p>
              <form onSubmit={handleCustomSubmit} className="max-w-md mx-auto flex items-center gap-2">
                <input
                  type="text"
                  value={customModelInput || search}
                  onChange={(e) => setCustomModelInput(e.target.value)}
                  placeholder="Enter exact model ID (e.g. agnes-2.5-flash)..."
                  className="flex-1 px-3 py-1.5 rounded-xl bg-[#141418] border border-[#22222a] text-xs text-white outline-none focus:border-[#33333e]"
                />
                <button
                  type="submit"
                  className="px-3 py-1.5 rounded-xl bg-white text-black font-semibold text-xs hover:bg-zinc-200 transition-colors cursor-pointer shrink-0"
                >
                  Use Model
                </button>
              </form>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-[#1f1f24] bg-[#09090b] flex items-center justify-between text-[11px] text-zinc-400 shrink-0">
          <div className="flex items-center gap-2">
            <span>Active:</span>
            <span className="font-mono text-zinc-200 font-semibold">{getModelDisplayName(currentModel, providerModels)}</span>
          </div>

          {onOpenProviderSettings && (
            <button
              onClick={() => {
                onClose();
                onOpenProviderSettings();
              }}
              className="text-zinc-400 hover:text-white transition-colors flex items-center gap-1 cursor-pointer"
            >
              <span>Provider & API Key Setup</span>
              <ExternalLink className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
