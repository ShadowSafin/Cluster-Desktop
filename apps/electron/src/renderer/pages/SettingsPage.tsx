import React, { useState, useEffect } from 'react';

interface SettingsPageProps {
  projectRoot: string;
  workspaceInfo: any;
  onProjectRootChange: (newRoot: string) => void;
  recentWorkspaces?: any[];
  onOpenWorkspaceSwitcher?: () => void;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({
  projectRoot,
  workspaceInfo,
  onProjectRootChange,
  recentWorkspaces = [],
  onOpenWorkspaceSwitcher,
}) => {
  const [diagnostics, setDiagnostics] = useState<any | null>(null);
  const [storagePaths, setStoragePaths] = useState<any | null>(null);
  const [confirmAll, setConfirmAll] = useState(false);
  const [saveNote, setSaveNote] = useState<string | null>(null);

  const loadDetails = async () => {
    if (typeof window.cluster !== 'undefined') {
      try {
        if (window.cluster.diagnostics?.get) {
          const diag = await window.cluster.diagnostics.get(projectRoot);
          setDiagnostics(diag);
        }
        if (window.cluster.storage?.paths) {
          const paths = await window.cluster.storage.paths();
          setStoragePaths(paths);
        }
      } catch (err) {
        console.error('Failed to load settings details', err);
      }
    }
  };

  useEffect(() => {
    loadDetails();
  }, [projectRoot]);

  const handlePickDirectory = async () => {
    if (typeof window.cluster !== 'undefined' && window.cluster.dialog?.openDirectory) {
      try {
        const selected = await window.cluster.dialog.openDirectory();
        if (selected) {
          onProjectRootChange(selected);
          setSaveNote(`Workspace switched to: ${selected}`);
        }
      } catch (err: any) {
        console.error('Directory open failed', err);
      }
    }
  };

  const handleOpenClusterHome = async () => {
    if (typeof window.cluster !== 'undefined' && window.cluster.shell?.openPath && storagePaths?.home) {
      await window.cluster.shell.openPath(storagePaths.home);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#0a0a0d] overflow-y-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-[#232326]">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold tracking-tight text-white">Settings & Workspace</h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#18181b] border border-[#27272a] text-[#a1a1aa]">
              Configuration
            </span>
          </div>
          <p className="text-xs text-[#71717a] mt-1">
            Environment setup, repository root detection, storage paths, and app preferences.
          </p>
        </div>

        <button
          onClick={handlePickDirectory}
          className="px-4 py-2 rounded-xl text-xs font-semibold bg-white text-black hover:bg-neutral-200 transition-all shadow-sm"
        >
          Change Workspace Folder
        </button>
      </div>

      {saveNote && (
        <div className="p-3.5 rounded-xl text-xs font-mono bg-[#141418] border border-[#27272a] text-cyan-300 flex items-center justify-between">
          <span>{saveNote}</span>
          <button onClick={() => setSaveNote(null)} className="text-[#71717a] hover:text-white">
            ✕
          </button>
        </div>
      )}

      {/* Detected Workspace Section */}
      <div className="rounded-2xl border border-[#232326] bg-[#0f0f12] p-6 space-y-4">
        <h3 className="text-xs font-semibold text-[#71717a] tracking-wider uppercase">
          Detected Project Workspace
        </h3>

        <div className="space-y-3">
          <div>
            <label className="text-xs text-[#a1a1aa] block mb-1">Project Root Directory</label>
            <div className="flex items-center gap-2">
              <div className="flex-1 font-mono text-xs bg-[#141418] border border-[#232326] rounded-xl px-3.5 py-2.5 text-white truncate">
                {projectRoot || 'Not detected'}
              </div>
              <button
                onClick={handlePickDirectory}
                className="px-3.5 py-2.5 rounded-xl text-xs bg-[#18181b] border border-[#27272a] text-[#a1a1aa] hover:text-white shrink-0"
              >
                Browse...
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
            <div className="p-3 rounded-xl bg-[#141418] border border-[#1c1c20]">
              <div className="text-[11px] text-[#71717a] uppercase font-semibold">Project Type</div>
              <div className="text-sm font-semibold text-white mt-1">
                {workspaceInfo?.project?.kind || 'Standard project'}
              </div>
              <div className="text-[11px] text-[#71717a] mt-0.5">
                {workspaceInfo?.project?.packageManager ? `via ${workspaceInfo.project.packageManager}` : ''}
              </div>
            </div>

            <div className="p-3 rounded-xl bg-[#141418] border border-[#1c1c20]">
              <div className="text-[11px] text-[#71717a] uppercase font-semibold">Git Branch & Status</div>
              <div className="text-sm font-semibold text-white mt-1 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                {workspaceInfo?.git?.branch || 'No branch'}
              </div>
              <div className="text-[11px] text-[#71717a] mt-0.5">
                {workspaceInfo?.git?.dirty ? 'Working tree dirty' : 'Clean tree'}
              </div>
            </div>

            <div className="p-3 rounded-xl bg-[#141418] border border-[#1c1c20]">
              <div className="text-[11px] text-[#71717a] uppercase font-semibold">Registered Tools</div>
              <div className="text-sm font-semibold text-cyan-400 font-mono mt-1">
                {diagnostics?.toolsCount || 15} tools active
              </div>
              <div className="text-[11px] text-[#71717a] mt-0.5">Zod validated</div>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Workspaces Card */}
      {recentWorkspaces.length > 0 && (
        <div className="rounded-2xl border border-[#232326] bg-[#0f0f12] p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold text-[#71717a] tracking-wider uppercase">
              Recent Workspaces ({recentWorkspaces.length})
            </h3>
            {onOpenWorkspaceSwitcher && (
              <button
                onClick={onOpenWorkspaceSwitcher}
                className="text-xs text-cyan-400 hover:text-cyan-300 font-medium"
              >
                Open Switcher (Ctrl+O) →
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {recentWorkspaces.map((w: any) => {
              const isCurrent = w.path.toLowerCase() === projectRoot.toLowerCase();
              return (
                <div
                  key={w.path}
                  onClick={() => onProjectRootChange(w.path)}
                  className={`p-3 rounded-xl border cursor-pointer transition-all flex items-center justify-between gap-3 ${
                    isCurrent
                      ? 'bg-[#141418] border-cyan-500/30 text-white'
                      : 'bg-[#101013] border-[#1f1f23] text-[#a1a1aa] hover:border-[#38383e] hover:bg-[#16161a] hover:text-white'
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs">📁</span>
                      <span className="font-semibold text-xs text-white truncate">{w.name}</span>
                      {isCurrent && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-400 font-semibold">
                          Active
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] font-mono text-[#71717a] truncate mt-1">{w.path}</div>
                  </div>
                  <span className="text-xs text-[#52525b] hover:text-white">→</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* App Preferences */}
      <div className="rounded-2xl border border-[#232326] bg-[#0f0f12] p-6 space-y-4">
        <h3 className="text-xs font-semibold text-[#71717a] tracking-wider uppercase">
          App Execution Preferences
        </h3>

        <div className="space-y-3">
          <label className="flex items-center justify-between p-3.5 rounded-xl bg-[#141418] border border-[#1c1c20] cursor-pointer">
            <div>
              <div className="text-xs font-semibold text-white">Require Confirmation for Destructive Commands</div>
              <div className="text-[11px] text-[#71717a] mt-0.5">
                Always prompt before running commands classified with caution or destructive risk (e.g. git reset, rm).
              </div>
            </div>
            <input
              type="checkbox"
              checked={confirmAll}
              onChange={e => setConfirmAll(e.target.checked)}
              className="w-4 h-4 rounded bg-[#232326] border-[#3f3f46] text-cyan-500 focus:ring-0"
            />
          </label>

          <div className="p-3.5 rounded-xl bg-[#141418] border border-[#1c1c20] flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold text-white">4-Layer Configuration Priority</div>
              <div className="text-[11px] text-[#71717a] mt-0.5">
                Defaults → Environment Variables → Global (~/.cluster/config.json) → Project (cluster.config.json)
              </div>
            </div>
            <span className="text-[11px] font-mono text-emerald-400 bg-emerald-950/30 px-2 py-0.5 rounded border border-emerald-800/30">
              Active
            </span>
          </div>
        </div>
      </div>

      {/* Storage & Environment Diagnostics */}
      <div className="rounded-2xl border border-[#232326] bg-[#0f0f12] p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold text-[#71717a] tracking-wider uppercase">
            Storage & System Diagnostics
          </h3>
          {storagePaths?.home && (
            <button
              onClick={handleOpenClusterHome}
              className="text-xs text-cyan-400 hover:text-cyan-300 underline font-mono"
            >
              Open ~/.cluster in File Explorer →
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-mono">
          <div className="p-3 rounded-xl bg-[#141418] border border-[#1c1c20]">
            <span className="text-[#71717a] block text-[11px]">Storage Home:</span>
            <span className="text-white truncate block mt-0.5">{storagePaths?.home || '~/.cluster'}</span>
          </div>
          <div className="p-3 rounded-xl bg-[#141418] border border-[#1c1c20]">
            <span className="text-[#71717a] block text-[11px]">Session Database:</span>
            <span className="text-white truncate block mt-0.5">{storagePaths?.databaseFile || 'sessions.json'}</span>
          </div>
          <div className="p-3 rounded-xl bg-[#141418] border border-[#1c1c20]">
            <span className="text-[#71717a] block text-[11px]">Backups Directory:</span>
            <span className="text-white truncate block mt-0.5">{storagePaths?.backupsDir || 'backups/'}</span>
          </div>
          <div className="p-3 rounded-xl bg-[#141418] border border-[#1c1c20]">
            <span className="text-[#71717a] block text-[11px]">Checkpoints Directory:</span>
            <span className="text-white truncate block mt-0.5">{storagePaths?.checkpointsDir || 'checkpoints/'}</span>
          </div>
        </div>

        {diagnostics?.runtime && (
          <div className="p-3 rounded-xl bg-[#141418] border border-[#1c1c20] text-xs font-mono flex flex-wrap gap-4 text-[#71717a]">
            <span>Node: <strong className="text-white">{diagnostics.runtime.node}</strong></span>
            <span>Electron: <strong className="text-white">{diagnostics.runtime.electron}</strong></span>
            <span>Platform: <strong className="text-white">{diagnostics.runtime.platform}</strong> ({diagnostics.runtime.arch})</span>
          </div>
        )}
      </div>
    </div>
  );
};
