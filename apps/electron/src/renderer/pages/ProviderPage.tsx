import React, { useState, useEffect } from 'react';

interface ProviderPageProps {
  projectRoot: string;
  onConfigUpdated?: (cfg: any) => void;
}

interface DiscoveredModel {
  id: string;
  name: string;
  provider?: string;
  description?: string;
}

export const ProviderPage: React.FC<ProviderPageProps> = ({ projectRoot, onConfigUpdated }) => {
  const [model, setModel] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [hasApiKey, setHasApiKey] = useState(false);
  const [showKeyInput, setShowKeyInput] = useState(false);

  const [modelList, setModelList] = useState<DiscoveredModel[]>([]);
  const [discovering, setDiscovering] = useState(false);
  const [discoveryStatus, setDiscoveryStatus] = useState<{
    ok: boolean;
    message: string;
  } | null>(null);

  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    ok: boolean;
    latencyMs?: number;
    reply?: string;
    error?: string;
  } | null>(null);

  const [saveStatus, setSaveStatus] = useState<{
    ok: boolean;
    message: string;
  } | null>(null);

  const loadCurrentConfig = async () => {
    if (typeof window.cluster !== 'undefined' && window.cluster.config) {
      try {
        const cfg = await window.cluster.config.get(projectRoot);
        if (cfg) {
          if (cfg.model) setModel(cfg.model);
          if (cfg.baseUrl) setBaseUrl(cfg.baseUrl);
          setHasApiKey(Boolean(cfg._hasKey));
        }
      } catch (err) {
        console.error('Failed to load config', err);
      }
    }
  };

  useEffect(() => {
    loadCurrentConfig();
  }, [projectRoot]);

  const handleDiscoverModels = async () => {
    const trimmedUrl = baseUrl.trim();
    if (!trimmedUrl) {
      setDiscoveryStatus({
        ok: false,
        message: 'Please enter an API Base URL before discovering models.',
      });
      return;
    }

    setDiscovering(true);
    setDiscoveryStatus(null);
    setTestResult(null);

    try {
      if (typeof window.cluster !== 'undefined' && window.cluster.models?.list) {
        const res = await window.cluster.models.list({
          baseUrl: trimmedUrl,
          apiKey: apiKey.trim() || undefined,
          projectRoot,
        });

        if (res && res.ok && Array.isArray(res.models) && res.models.length > 0) {
          setModelList(res.models);
          setDiscoveryStatus({
            ok: true,
            message: `Discovered ${res.models.length} model${
              res.models.length === 1 ? '' : 's'
            } from ${res.sourceUrl || trimmedUrl}`,
          });
          // Auto-select first model if none currently selected
          if (!model && res.models[0]?.id) {
            setModel(res.models[0].id);
          }
        } else {
          setModelList([]);
          setDiscoveryStatus({
            ok: false,
            message:
              res?.error ||
              `No models found at ${trimmedUrl}. Verify the URL and API key.`,
          });
        }
      } else {
        setDiscoveryStatus({
          ok: false,
          message: 'Cluster IPC models service is not available.',
        });
      }
    } catch (err: any) {
      setModelList([]);
      setDiscoveryStatus({
        ok: false,
        message: `Discovery error: ${err.message || String(err)}`,
      });
    } finally {
      setDiscovering(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveStatus(null);

    if (!baseUrl.trim()) {
      setSaveStatus({
        ok: false,
        message: 'API Base URL is required.',
      });
      return;
    }

    if (!model.trim()) {
      setSaveStatus({
        ok: false,
        message: 'Model name is required. Enter a model or discover models from your provider.',
      });
      return;
    }

    try {
      if (typeof window.cluster !== 'undefined' && window.cluster.config) {
        await window.cluster.config.set('model', model.trim(), projectRoot);
        await window.cluster.config.set('baseUrl', baseUrl.trim(), projectRoot);
        if (apiKey.trim()) {
          await window.cluster.config.set('apiKey', apiKey.trim(), projectRoot);
          setHasApiKey(true);
          setApiKey('');
          setShowKeyInput(false);
        }
        setSaveStatus({
          ok: true,
          message: 'Provider and model settings saved successfully.',
        });
        const updated = await window.cluster.config.get(projectRoot);
        if (onConfigUpdated) onConfigUpdated(updated);
      }
    } catch (err: any) {
      setSaveStatus({
        ok: false,
        message: `Save error: ${err.message}`,
      });
    }
  };

  const handleTestConnection = async () => {
    const trimmedUrl = baseUrl.trim();
    if (!trimmedUrl) {
      setTestResult({
        ok: false,
        error: 'Please enter an API Base URL before testing connection.',
      });
      return;
    }

    if (!model.trim()) {
      setTestResult({
        ok: false,
        error: 'Please enter or select a Model before testing connection.',
      });
      return;
    }

    setTesting(true);
    setTestResult(null);
    try {
      if (typeof window.cluster !== 'undefined' && window.cluster.models?.test) {
        const res = await window.cluster.models.test({
          baseUrl: trimmedUrl,
          apiKey: apiKey.trim() || undefined,
          model: model.trim(),
        });
        setTestResult(res);
      }
    } catch (err: any) {
      setTestResult({ ok: false, error: err.message });
    } finally {
      setTesting(false);
    }
  };

  const setPreset = (url: string, defaultModelName?: string) => {
    setBaseUrl(url);
    if (defaultModelName) setModel(defaultModelName);
    setDiscoveryStatus(null);
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#0a0a0d] overflow-y-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-[#232326]">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold tracking-tight text-white">Provider & Model Setup</h1>
            <span
              className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                hasApiKey
                  ? 'bg-emerald-950/30 text-emerald-400 border border-emerald-900/30'
                  : 'bg-neutral-800 text-[#a1a1aa] border border-neutral-700'
              }`}
            >
              {hasApiKey ? 'Key Configured' : 'No Key Saved'}
            </span>
          </div>
          <p className="text-xs text-[#71717a] mt-1">
            Configure your LLM inference provider (OpenAI, OpenRouter, Ollama, LM Studio, or any OpenAI-compatible API).
          </p>
        </div>

        <button
          onClick={handleTestConnection}
          disabled={testing}
          className="px-4 py-2 rounded-xl text-xs font-semibold bg-white text-black hover:bg-neutral-200 disabled:opacity-50 transition-all shadow-sm shrink-0"
        >
          {testing ? 'Pinging Provider...' : 'Test Connection / Ping'}
        </button>
      </div>

      {/* Save Notification */}
      {saveStatus && (
        <div
          className={`p-3.5 rounded-xl text-xs font-mono border flex items-center justify-between ${
            saveStatus.ok
              ? 'bg-emerald-950/20 text-emerald-300 border-emerald-900/30'
              : 'bg-red-950/20 text-red-300 border-red-900/30'
          }`}
        >
          <span>{saveStatus.message}</span>
          <button onClick={() => setSaveStatus(null)} className="text-[#71717a] hover:text-white">
            ✕
          </button>
        </div>
      )}

      {/* Test Ping Result Notification */}
      {testResult && (
        <div
          className={`p-4 rounded-xl text-xs font-mono border ${
            testResult.ok
              ? 'bg-emerald-950/20 text-emerald-300 border-emerald-900/30'
              : 'bg-red-950/20 text-red-300 border-red-900/30'
          }`}
        >
          <div className="font-semibold mb-1 flex items-center gap-2">
            <span>{testResult.ok ? '✓ Provider Connection Successful' : '✕ Connection Test Failed'}</span>
            {testResult.latencyMs !== undefined && <span>({testResult.latencyMs}ms)</span>}
          </div>
          {testResult.reply && <div>Reply from model: "{testResult.reply}"</div>}
          {testResult.error && <div>Error: {testResult.error}</div>}
        </div>
      )}

      {/* Discovery Status Notification */}
      {discoveryStatus && (
        <div
          className={`p-3.5 rounded-xl text-xs font-mono border flex items-center justify-between ${
            discoveryStatus.ok
              ? 'bg-emerald-950/20 text-emerald-300 border-emerald-900/30'
              : 'bg-red-950/20 text-red-300 border-red-900/30'
          }`}
        >
          <span>{discoveryStatus.message}</span>
          <button onClick={() => setDiscoveryStatus(null)} className="text-[#71717a] hover:text-white">
            ✕
          </button>
        </div>
      )}

      {/* Quick Endpoint Presets */}
      <div className="rounded-2xl border border-[#232326] bg-[#0f0f12] p-4">
        <div className="text-[11px] font-semibold text-[#71717a] uppercase tracking-wider mb-2">
          Endpoint Quick Presets
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setPreset('https://api.openai.com/v1', 'gpt-4o-mini')}
            className="px-3 py-1.5 rounded-lg text-xs bg-[#18181b] border border-[#27272a] text-[#a1a1aa] hover:text-white hover:border-[#3f3f46] transition-colors"
          >
            OpenAI (api.openai.com/v1)
          </button>
          <button
            type="button"
            onClick={() => setPreset('https://openrouter.ai/api/v1')}
            className="px-3 py-1.5 rounded-lg text-xs bg-[#18181b] border border-[#27272a] text-[#a1a1aa] hover:text-white hover:border-[#3f3f46] transition-colors"
          >
            OpenRouter (openrouter.ai/api/v1)
          </button>
          <button
            type="button"
            onClick={() => setPreset('http://localhost:11434/v1')}
            className="px-3 py-1.5 rounded-lg text-xs bg-[#18181b] border border-[#27272a] text-[#a1a1aa] hover:text-white hover:border-[#3f3f46] transition-colors"
          >
            Ollama Local (localhost:11434/v1)
          </button>
          <button
            type="button"
            onClick={() => setPreset('http://localhost:1234/v1')}
            className="px-3 py-1.5 rounded-lg text-xs bg-[#18181b] border border-[#27272a] text-[#a1a1aa] hover:text-white hover:border-[#3f3f46] transition-colors"
          >
            LM Studio (localhost:1234/v1)
          </button>
        </div>
      </div>

      {/* Main Configuration Form */}
      <form onSubmit={handleSave} className="rounded-2xl border border-[#232326] bg-[#0f0f12] p-6 space-y-4">
        <h3 className="text-xs font-semibold text-[#71717a] tracking-wider uppercase mb-1">
          Active Provider Settings
        </h3>

        <div className="space-y-4">
          {/* Base URL */}
          <div>
            <label className="text-xs font-medium text-[#a1a1aa] block mb-1.5">
              API Base URL
            </label>
            <input
              type="text"
              value={baseUrl}
              onChange={e => {
                setBaseUrl(e.target.value);
                setDiscoveryStatus(null);
              }}
              className="w-full font-mono text-xs bg-[#141418] border border-[#232326] rounded-xl px-3.5 py-2.5 text-white outline-none focus:border-[#3f3f46]"
            />
            <span className="text-[11px] text-[#71717a] mt-1 block">
              The root URL of your inference provider (e.g. <code className="text-[#a1a1aa]">https://api.openai.com/v1</code>, <code className="text-[#a1a1aa]">https://openrouter.ai/api/v1</code>, or local <code className="text-[#a1a1aa]">http://localhost:11434/v1</code>).
            </span>
          </div>

          {/* Model Selection & Discover Button */}
          <div>
            <label className="text-xs font-medium text-[#a1a1aa] block mb-1.5">
              Model Identifier
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={model}
                onChange={e => setModel(e.target.value)}
                className="flex-1 font-mono text-xs bg-[#141418] border border-[#232326] rounded-xl px-3.5 py-2.5 text-white outline-none focus:border-[#3f3f46]"
              />
              <button
                type="button"
                onClick={handleDiscoverModels}
                disabled={discovering}
                className="px-4 py-2.5 rounded-xl text-xs font-semibold bg-[#222228] border border-[#33333a] hover:bg-[#2c2c34] text-white disabled:opacity-50 transition-all shrink-0 flex items-center gap-2 shadow-sm"
              >
                {discovering && <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />}
                {discovering ? 'Discovering Models...' : 'Discover Models'}
              </button>
            </div>
            <span className="text-[11px] text-[#71717a] mt-1 block">
              Type the exact model ID or click <strong className="text-white">Discover Models</strong> to fetch available models from the endpoint.
            </span>
          </div>

          {/* API Key */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-medium text-[#a1a1aa]">
                API Key
              </label>
              <button
                type="button"
                onClick={() => setShowKeyInput(v => !v)}
                className="text-[11px] text-cyan-400 hover:text-cyan-300 font-medium"
              >
                {showKeyInput ? 'Close Key Input' : hasApiKey ? 'Update API Key' : 'Enter API Key'}
              </button>
            </div>

            {showKeyInput ? (
              <input
                type="password"
                value={apiKey}
                onChange={e => setApiKey(e.target.value)}
                className="w-full font-mono text-xs bg-[#141418] border border-[#232326] rounded-xl px-3.5 py-2.5 text-white outline-none focus:border-[#3f3f46]"
              />
            ) : (
              <div className="text-xs font-mono bg-[#141418] border border-[#232326] rounded-xl px-3.5 py-2.5 text-[#71717a]">
                {hasApiKey ? '•••••••••••••••••••••••••••••••• (Configured)' : 'No API key set (Leave empty if using a local provider without auth)'}
              </div>
            )}
            <span className="text-[11px] text-[#71717a] mt-1 block">
              Can also be provided via <code className="text-[#a1a1aa]">CLUSTER_API_KEY</code> or <code className="text-[#a1a1aa]">OPENAI_API_KEY</code> in environment.
            </span>
          </div>

          <div className="pt-2 flex justify-end">
            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl text-xs font-semibold bg-white text-black hover:bg-neutral-200 transition-all shadow-sm"
            >
              Save Configuration
            </button>
          </div>
        </div>
      </form>

      {/* Discovered Models List */}
      <div className="rounded-2xl border border-[#232326] bg-[#0f0f12] p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-semibold text-[#71717a] tracking-wider uppercase">
            Discovered Models {modelList.length > 0 ? `(${modelList.length})` : ''}
          </h3>
          {modelList.length > 0 && (
            <button
              type="button"
              onClick={() => setModelList([])}
              className="text-[11px] text-[#71717a] hover:text-white"
            >
              Clear List
            </button>
          )}
        </div>

        {modelList.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[#232326] bg-[#0a0a0d] p-8 text-center">
            <div className="text-xs font-medium text-[#a1a1aa]">No models discovered yet</div>
            <p className="text-[11px] text-[#71717a] mt-1 max-w-sm mx-auto">
              Fill in your API Base URL and API Key above, then tap <strong className="text-[#a1a1aa]">Discover Models</strong> to query the endpoint.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[400px] overflow-y-auto pr-1">
            {modelList.map(m => {
              const isSelected = model === m.id;
              return (
                <div
                  key={m.id}
                  onClick={async () => {
                    setModel(m.id);
                    if (typeof window.cluster !== 'undefined' && window.cluster.config) {
                      await window.cluster.config.set('model', m.id, projectRoot);
                      const updated = await window.cluster.config.get(projectRoot);
                      if (onConfigUpdated) onConfigUpdated(updated);
                    }
                  }}
                  className={`p-3 rounded-xl border cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-[#18181b] border-white text-white shadow-md ring-1 ring-white/20'
                      : 'bg-[#121215] border-[#232326] text-[#a1a1aa] hover:border-[#3f3f46] hover:text-white'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="font-mono text-xs font-semibold truncate text-white" title={m.id}>
                      {m.name || m.id}
                    </span>
                    {isSelected ? (
                      <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-emerald-500 text-black font-semibold shrink-0">
                        Selected
                      </span>
                    ) : (
                      <span className="text-[10px] font-mono text-[#71717a] shrink-0">
                        Select →
                      </span>
                    )}
                  </div>
                  {m.provider && (
                    <div className="text-[10px] font-mono text-[#71717a] truncate">{m.provider}</div>
                  )}
                  {m.description && (
                    <p className="text-[11px] text-[#71717a] line-clamp-2 mt-1">{m.description}</p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
