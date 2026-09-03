import React, { useState, useEffect, useMemo, useRef } from 'react';
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
} from 'lucide-react';

export interface ModelOption {
  id: string;
  name: string;
  provider: 'Anthropic' | 'OpenAI' | 'Google' | 'DeepSeek' | 'Local / Open Source' | 'Custom';
  description: string;
  badge?: string;
  isPopular?: boolean;
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

export function getModelDisplayName(modelId?: string): string {
  if (!modelId) return 'Claude 3.5 Sonnet';
  const found = PRESET_MODELS.find(
    (m) => m.id.toLowerCase() === modelId.toLowerCase() || m.name.toLowerCase() === modelId.toLowerCase()
  );
  if (found) return found.name;
  // Format slug if unknown
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
  onOpenProviderSettings?: () => void;
}

export const ModelSelectorModal: React.FC<ModelSelectorModalProps> = ({
  open,
  onClose,
  currentModel,
  onSelectModel,
  onOpenProviderSettings,
}) => {
  const [search, setSearch] = useState('');
  const [selectedProvider, setSelectedProvider] = useState<string>('All');
  const [customModelInput, setCustomModelInput] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setSearch('');
      setSelectedProvider('All');
      setCustomModelInput('');
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

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

  const providers = ['All', 'Anthropic', 'OpenAI', 'Google', 'DeepSeek', 'Local / Open Source'];

  const filteredModels = useMemo(() => {
    const query = search.trim().toLowerCase();
    return PRESET_MODELS.filter((m) => {
      const matchesProvider = selectedProvider === 'All' || m.provider === selectedProvider;
      if (!matchesProvider) return false;
      if (!query) return true;
      return (
        m.name.toLowerCase().includes(query) ||
        m.id.toLowerCase().includes(query) ||
        m.provider.toLowerCase().includes(query) ||
        m.description.toLowerCase().includes(query)
      );
    });
  }, [search, selectedProvider]);

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
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in select-none"
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
              <h2 className="text-sm font-semibold text-white tracking-wide">Select Model</h2>
              <p className="text-[11px] text-zinc-400 mt-0.5">
                Switch LLM model for this workspace and active session
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg hover:bg-[#18181e] text-zinc-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Search input */}
        <div className="p-3 border-b border-[#1f1f24] bg-[#0e0e11]">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              ref={inputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search models (e.g. Claude 3.7, GPT-4o, o3-mini, DeepSeek)..."
              className="w-full pl-9 pr-3 py-2 rounded-xl bg-[#141418] border border-[#202026] text-xs text-white placeholder:text-zinc-500 outline-none focus:border-[#32323e] transition-colors"
            />
          </div>

          {/* Provider Filter Tabs */}
          <div className="flex items-center gap-1.5 mt-2.5 overflow-x-auto pb-0.5">
            {providers.map((p) => (
              <button
                key={p}
                onClick={() => setSelectedProvider(p)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all whitespace-nowrap cursor-pointer ${
                  selectedProvider === p
                    ? 'bg-[#1f1f26] text-white border border-[#2c2c36] shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-[#15151a]'
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        {/* Model List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-1.5 min-h-0">
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
                    ? 'bg-[#18181f] border-[#383846] text-white shadow-md'
                    : 'bg-[#121215] border-[#1d1d22] text-zinc-300 hover:border-[#2b2b34] hover:bg-[#16161b]'
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-xs text-white">{m.name}</span>
                    <span className="font-mono text-[10px] text-zinc-400 bg-[#17171d] px-1.5 py-0.2 rounded border border-[#22222a]">
                      {m.id}
                    </span>
                    {m.badge && (
                      <span className="text-[9px] font-semibold px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
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

          {filteredModels.length === 0 && (
            <div className="py-8 text-center space-y-3">
              <p className="text-zinc-400 text-xs">
                No preset model matches "<span className="text-white">{search}</span>"
              </p>
              <form onSubmit={handleCustomSubmit} className="max-w-md mx-auto flex items-center gap-2">
                <input
                  type="text"
                  value={customModelInput || search}
                  onChange={(e) => setCustomModelInput(e.target.value)}
                  placeholder="Enter custom model identifier..."
                  className="flex-1 px-3 py-1.5 rounded-xl bg-[#141418] border border-[#22222a] text-xs text-white outline-none focus:border-[#33333e]"
                />
                <button
                  type="submit"
                  className="px-3 py-1.5 rounded-xl bg-white text-black font-semibold text-xs hover:bg-zinc-200 transition-colors cursor-pointer shrink-0"
                >
                  Use Custom
                </button>
              </form>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-[#1f1f24] bg-[#09090b] flex items-center justify-between text-[11px] text-zinc-400 shrink-0">
          <div className="flex items-center gap-2">
            <span>Active:</span>
            <span className="font-mono text-zinc-200 font-medium">{getModelDisplayName(currentModel)}</span>
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
