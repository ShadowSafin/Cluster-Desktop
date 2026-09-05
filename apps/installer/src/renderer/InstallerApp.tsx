import React, { useState, useEffect } from 'react';
import {
  Folder,
  FolderOpen,
  Check,
  ChevronRight,
  ChevronLeft,
  Rocket,
  Minus,
  X,
  ExternalLink,
  ShieldCheck,
  Cpu,
  Sparkles,
  HardDrive,
  CheckCircle2,
  Loader2,
} from 'lucide-react';
import { ClusterLogo } from './components/ClusterLogo';

export type Screen = 'welcome' | 'options' | 'installing' | 'complete';

interface ProgressInfo {
  percent: number;
  status: string;
  step: string;
}

declare global {
  interface Window {
    installer?: {
      getInfo: () => Promise<{
        defaultInstallDir: string;
        isExistingInstall: boolean;
        requiredSpaceMb: number;
        availableSpaceGb: number;
      }>;
      browse: (
        currentPath: string
      ) => Promise<{ path: string; availableSpaceGb: number } | null>;
      startInstall: (options: {
        installDir: string;
        createDesktopShortcut: boolean;
        createStartMenuShortcut: boolean;
        autoLaunch: boolean;
      }) => Promise<{ ok: boolean; installDir?: string; installedExe?: string; error?: string }>;
      launch: (exePath: string) => Promise<void>;
      minimize: () => Promise<void>;
      close: () => Promise<void>;
      onProgress: (callback: (data: ProgressInfo) => void) => () => void;
    };
  }
}

export const InstallerApp: React.FC = () => {
  const [screen, setScreen] = useState<Screen>('welcome');
  const [installDir, setInstallDir] = useState<string>('');
  const [isExistingInstall, setIsExistingInstall] = useState<boolean>(false);
  const [availableSpaceGb, setAvailableSpaceGb] = useState<number>(20.0);
  const [requiredSpaceMb] = useState<number>(350);

  // Options
  const [createDesktopShortcut, setCreateDesktopShortcut] = useState<boolean>(true);
  const [createStartMenuShortcut, setCreateStartMenuShortcut] = useState<boolean>(true);
  const [autoLaunch, setAutoLaunch] = useState<boolean>(true);

  // Progress state
  const [progress, setProgress] = useState<ProgressInfo>({
    percent: 0,
    status: 'Initializing setup...',
    step: 'prepare',
  });
  const [installedExePath, setInstalledExePath] = useState<string>('');
  const [installError, setInstallError] = useState<string | null>(null);

  // Initialize info on mount
  useEffect(() => {
    if (window.installer?.getInfo) {
      window.installer.getInfo().then((info) => {
        setInstallDir(info.defaultInstallDir);
        setIsExistingInstall(info.isExistingInstall);
        setAvailableSpaceGb(info.availableSpaceGb);
      });
    } else {
      // Fallback for dev mode
      setInstallDir('C:\\Users\\User\\AppData\\Local\\Programs\\Cluster');
      setAvailableSpaceGb(84.2);
    }
  }, []);

  // Listen to installation progress
  useEffect(() => {
    if (window.installer?.onProgress) {
      const unsub = window.installer.onProgress((data) => {
        setProgress(data);
      });
      return unsub;
    }
  }, []);

  const handleBrowse = async () => {
    if (window.installer?.browse) {
      const res = await window.installer.browse(installDir);
      if (res) {
        setInstallDir(res.path);
        setAvailableSpaceGb(res.availableSpaceGb);
      }
    }
  };

  const handleStartInstallation = async () => {
    setScreen('installing');
    setInstallError(null);
    setProgress({ percent: 5, status: 'Preparing installation...', step: 'prepare' });

    if (window.installer?.startInstall) {
      const res = await window.installer.startInstall({
        installDir,
        createDesktopShortcut,
        createStartMenuShortcut,
        autoLaunch,
      });

      if (res.ok) {
        setInstalledExePath(res.installedExe || `${installDir}\\Cluster.exe`);
        setTimeout(() => {
          setScreen('complete');
          if (autoLaunch && res.installedExe) {
            setTimeout(() => {
              window.installer?.launch(res.installedExe!);
            }, 1200);
          }
        }, 600);
      } else {
        setInstallError(res.error || 'Failed to complete installation.');
      }
    } else {
      // Mock progress simulation for dev mode
      let p = 5;
      const interval = setInterval(() => {
        p += 15;
        if (p >= 100) {
          clearInterval(interval);
          setProgress({ percent: 100, status: 'Installation finalized successfully!', step: 'done' });
          setTimeout(() => setScreen('complete'), 600);
        } else if (p > 70) {
          setProgress({ percent: p, status: 'Registering shortcuts & Windows integration...', step: 'registry' });
        } else if (p > 30) {
          setProgress({ percent: p, status: 'Extracting core application binaries & runtimes...', step: 'extract' });
        } else {
          setProgress({ percent: p, status: 'Preparing directory...', step: 'prepare' });
        }
      }, 400);
    }
  };

  const handleLaunchApp = () => {
    if (window.installer?.launch && installedExePath) {
      window.installer.launch(installedExePath);
    } else if (window.installer?.close) {
      window.installer.close();
    }
  };

  const handleMinimize = () => {
    window.installer?.minimize();
  };

  const handleClose = () => {
    window.installer?.close();
  };

  const stepsList = [
    { key: 'prepare', label: 'Preparing installation directory' },
    { key: 'extract', label: 'Extracting core application binaries & runtimes' },
    { key: 'shortcuts', label: 'Configuring Desktop & Start Menu shortcuts' },
    { key: 'registry', label: 'Registering with Windows Control Panel' },
    { key: 'done', label: 'Finalizing installation' },
  ];

  const getStepStatus = (stepKey: string) => {
    const keys = ['prepare', 'extract', 'shortcuts', 'registry', 'done'];
    const currentIdx = keys.indexOf(progress.step);
    const stepIdx = keys.indexOf(stepKey);

    if (progress.percent === 100 || currentIdx > stepIdx) return 'done';
    if (currentIdx === stepIdx) return 'active';
    return 'pending';
  };

  return (
    <div className="w-full h-screen bg-[#09090b] text-zinc-200 flex flex-col select-none overflow-hidden font-sans border border-[#202026] rounded-xl shadow-2xl">
      {/* Sleek Custom Titlebar */}
      <div
        className="h-10 px-4 bg-[#0d0d11] border-b border-[#1f1f26] flex items-center justify-between shrink-0"
        style={{ WebkitAppRegion: 'drag' } as any}
      >
        <div className="flex items-center gap-2.5">
          <ClusterLogo size={18} />
          <span className="text-xs font-semibold tracking-wide text-zinc-300">Cluster Setup</span>
          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-zinc-800/70 text-zinc-400 border border-zinc-700/50">
            v0.1.0
          </span>
        </div>

        {/* Window controls */}
        <div className="flex items-center gap-1" style={{ WebkitAppRegion: 'no-drag' } as any}>
          <button
            onClick={handleMinimize}
            className="w-7 h-7 rounded hover:bg-zinc-800 text-zinc-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
            title="Minimize"
          >
            <Minus className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleClose}
            className="w-7 h-7 rounded hover:bg-red-500/20 text-zinc-400 hover:text-red-400 flex items-center justify-center transition-colors cursor-pointer"
            title="Close"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-h-0 relative">
        {/* Subtle decorative background glow */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none -ml-20 -mb-20" />

        {/* 1. Welcome Screen */}
        {screen === 'welcome' && (
          <div className="flex-1 p-8 flex flex-col justify-between animate-in fade-in duration-300 relative z-10">
            <div className="flex items-start gap-6 pt-2">
              <div className="relative group shrink-0">
                <div className="absolute -inset-1 bg-gradient-to-tr from-emerald-500/30 to-teal-500/20 rounded-2xl blur-md opacity-75 group-hover:opacity-100 transition duration-500" />
                <div className="relative p-2 rounded-2xl bg-[#121215] border border-[#272733] flex items-center justify-center shadow-xl">
                  <ClusterLogo size={64} />
                </div>
              </div>

              <div className="space-y-1.5 flex-1">
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl font-bold tracking-tight text-white">Cluster Desktop</h1>
                  {isExistingInstall && (
                    <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                      Existing Install Detected
                    </span>
                  )}
                </div>
                <p className="text-xs text-zinc-400 leading-relaxed max-w-md">
                  Next-generation AI coding workspace with autonomous single-agent verification, critique, and self-repair.
                </p>
                <div className="flex items-center gap-2 pt-1 font-mono text-[11px] text-zinc-500">
                  <span>Windows x64</span>
                  <span>•</span>
                  <span>Standalone Native App</span>
                  <span>•</span>
                  <span>Developer Edition</span>
                </div>
              </div>
            </div>

            {/* Feature Highlights Grid */}
            <div className="grid grid-cols-3 gap-3 my-4">
              <div className="p-3 rounded-xl bg-[#121215] border border-[#1e1e24] space-y-1.5">
                <div className="w-6 h-6 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                  <Cpu className="w-3.5 h-3.5" />
                </div>
                <div className="text-xs font-semibold text-zinc-200">Senior Engineer Loop</div>
                <div className="text-[10px] text-zinc-400 leading-tight">
                  Autonomous planning, tool execution, and code synthesis.
                </div>
              </div>

              <div className="p-3 rounded-xl bg-[#121215] border border-[#1e1e24] space-y-1.5">
                <div className="w-6 h-6 rounded-lg bg-teal-500/10 text-teal-400 flex items-center justify-center">
                  <ShieldCheck className="w-3.5 h-3.5" />
                </div>
                <div className="text-xs font-semibold text-zinc-200">Self-Verification</div>
                <div className="text-[10px] text-zinc-400 leading-tight">
                  Automated checks, test runs, and regression repairs.
                </div>
              </div>

              <div className="p-3 rounded-xl bg-[#121215] border border-[#1e1e24] space-y-1.5">
                <div className="w-6 h-6 rounded-lg bg-cyan-500/10 text-cyan-400 flex items-center justify-center">
                  <Sparkles className="w-3.5 h-3.5" />
                </div>
                <div className="text-xs font-semibold text-zinc-200">Live Router & Models</div>
                <div className="text-[10px] text-zinc-400 leading-tight">
                  Connect byNara, OpenAI, Claude, or local Ollama endpoints.
                </div>
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="pt-4 border-t border-[#1f1f26] flex items-center justify-between">
              <div className="text-[11px] text-zinc-500">
                Release 0.1.0 · MIT License · Clean Uninstaller included
              </div>

              <button
                onClick={() => setScreen('options')}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-black font-semibold text-xs tracking-wide shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/30 transition-all flex items-center gap-2 cursor-pointer"
              >
                <span>Start Installation</span>
                <ChevronRight className="w-4 h-4 stroke-[2.5]" />
              </button>
            </div>
          </div>
        )}

        {/* 2. Options Screen */}
        {screen === 'options' && (
          <div className="flex-1 p-7 flex flex-col justify-between animate-in fade-in duration-300 relative z-10">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-white tracking-tight">Installation Preferences</h2>
                  <p className="text-xs text-zinc-400">Choose where and how Cluster Desktop is installed</p>
                </div>
                <div className="px-2.5 py-1 rounded-lg bg-[#141418] border border-[#22222a] text-[11px] font-mono text-zinc-400">
                  Step 2 of 4
                </div>
              </div>

              {/* Install Location Card */}
              <div className="p-3.5 rounded-xl bg-[#121215] border border-[#1e1e24] space-y-2.5">
                <div className="flex items-center justify-between text-xs font-medium text-zinc-300">
                  <div className="flex items-center gap-2">
                    <Folder className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Destination Folder</span>
                  </div>
                  <div className="flex items-center gap-3 text-[11px] font-mono text-zinc-400">
                    <span>Required: {requiredSpaceMb} MB</span>
                    <span>•</span>
                    <span className={availableSpaceGb < 1.0 ? 'text-red-400' : 'text-emerald-400'}>
                      {availableSpaceGb} GB Available
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <div className="flex-1 px-3 py-2 rounded-lg bg-[#18181f] border border-[#272732] text-xs font-mono text-zinc-200 truncate">
                    {installDir}
                  </div>
                  <button
                    onClick={handleBrowse}
                    className="px-3.5 py-2 rounded-lg bg-[#202028] hover:bg-[#282832] text-zinc-200 text-xs font-medium border border-[#30303c] transition-colors flex items-center gap-1.5 cursor-pointer shrink-0"
                  >
                    <FolderOpen className="w-3.5 h-3.5" />
                    <span>Browse...</span>
                  </button>
                </div>
              </div>

              {/* Shortcuts and Automation */}
              <div className="p-3.5 rounded-xl bg-[#121215] border border-[#1e1e24] space-y-2.5">
                <div className="text-xs font-medium text-zinc-300 flex items-center gap-2">
                  <HardDrive className="w-3.5 h-3.5 text-teal-400" />
                  <span>Integration & Shortcuts</span>
                </div>

                <div className="space-y-2">
                  <label className="flex items-center gap-3 p-2 rounded-lg hover:bg-[#17171d] cursor-pointer transition-colors">
                    <input
                      type="checkbox"
                      checked={createDesktopShortcut}
                      onChange={(e) => setCreateDesktopShortcut(e.target.checked)}
                      className="sr-only"
                    />
                    <div
                      className={`w-4 h-4 rounded flex items-center justify-center transition-all ${
                        createDesktopShortcut
                          ? 'bg-emerald-500 text-black border border-emerald-400'
                          : 'bg-[#18181f] border border-zinc-700'
                      }`}
                    >
                      {createDesktopShortcut && <Check className="w-3 h-3 stroke-[3]" />}
                    </div>
                    <div className="text-xs text-zinc-200">
                      Create Desktop shortcut
                      <span className="block text-[10px] text-zinc-400">Place an icon on your desktop for quick launch</span>
                    </div>
                  </label>

                  <label className="flex items-center gap-3 p-2 rounded-lg hover:bg-[#17171d] cursor-pointer transition-colors">
                    <input
                      type="checkbox"
                      checked={createStartMenuShortcut}
                      onChange={(e) => setCreateStartMenuShortcut(e.target.checked)}
                      className="sr-only"
                    />
                    <div
                      className={`w-4 h-4 rounded flex items-center justify-center transition-all ${
                        createStartMenuShortcut
                          ? 'bg-emerald-500 text-black border border-emerald-400'
                          : 'bg-[#18181f] border border-zinc-700'
                      }`}
                    >
                      {createStartMenuShortcut && <Check className="w-3 h-3 stroke-[3]" />}
                    </div>
                    <div className="text-xs text-zinc-200">
                      Create Start Menu shortcut
                      <span className="block text-[10px] text-zinc-400">Register Cluster in the Windows Start Menu & App List</span>
                    </div>
                  </label>

                  <label className="flex items-center gap-3 p-2 rounded-lg hover:bg-[#17171d] cursor-pointer transition-colors">
                    <input
                      type="checkbox"
                      checked={autoLaunch}
                      onChange={(e) => setAutoLaunch(e.target.checked)}
                      className="sr-only"
                    />
                    <div
                      className={`w-4 h-4 rounded flex items-center justify-center transition-all ${
                        autoLaunch
                          ? 'bg-emerald-500 text-black border border-emerald-400'
                          : 'bg-[#18181f] border border-zinc-700'
                      }`}
                    >
                      {autoLaunch && <Check className="w-3 h-3 stroke-[3]" />}
                    </div>
                    <div className="text-xs text-zinc-200">
                      Launch Cluster automatically when setup finishes
                      <span className="block text-[10px] text-zinc-400">Open the desktop workspace as soon as files are ready</span>
                    </div>
                  </label>
                </div>
              </div>
            </div>

            {/* Bottom Navigation */}
            <div className="pt-4 border-t border-[#1f1f26] flex items-center justify-between">
              <button
                onClick={() => setScreen('welcome')}
                className="px-4 py-2 rounded-xl bg-[#141418] hover:bg-[#1e1e24] text-zinc-400 hover:text-white text-xs font-medium border border-[#22222a] transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Back</span>
              </button>

              <button
                onClick={handleStartInstallation}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-black font-semibold text-xs tracking-wide shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/30 transition-all flex items-center gap-2 cursor-pointer"
              >
                <span>Install Now</span>
                <ChevronRight className="w-4 h-4 stroke-[2.5]" />
              </button>
            </div>
          </div>
        )}

        {/* 3. Installing Screen */}
        {screen === 'installing' && (
          <div className="flex-1 p-8 flex flex-col justify-between animate-in fade-in duration-300 relative z-10">
            <div className="space-y-6 pt-2">
              <div className="flex items-center gap-4">
                <div className="relative">
                  <div className="p-1.5 rounded-xl bg-[#121215] border border-[#252530] flex items-center justify-center">
                    <ClusterLogo size={44} />
                  </div>
                  <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 flex items-center justify-center shadow-md">
                    <Loader2 className="w-2.5 h-2.5 text-black animate-spin stroke-[3]" />
                  </div>
                </div>

                <div>
                  <h2 className="text-lg font-bold text-white tracking-tight">Installing Cluster Desktop</h2>
                  <p className="text-xs text-zinc-400 mt-0.5">{progress.status}</p>
                </div>
              </div>

              {/* Progress bar */}
              <div className="space-y-2 bg-[#121215] border border-[#1e1e24] p-4 rounded-xl">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-zinc-400">{progress.status}</span>
                  <span className="text-emerald-400 font-semibold">{progress.percent}%</span>
                </div>

                <div className="w-full h-2.5 rounded-full bg-[#181820] overflow-hidden p-0.5 border border-[#24242e]">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-400 transition-all duration-300 relative"
                    style={{ width: `${Math.max(5, progress.percent)}%` }}
                  >
                    <div className="absolute inset-0 bg-white/20 animate-pulse" />
                  </div>
                </div>
              </div>

              {/* Step checklist */}
              <div className="p-3.5 rounded-xl bg-[#121215] border border-[#1e1e24] space-y-2">
                <div className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-2">
                  Installation Steps
                </div>

                {stepsList.map((st) => {
                  const status = getStepStatus(st.key);
                  return (
                    <div key={st.key} className="flex items-center gap-2.5 text-xs py-1">
                      {status === 'done' ? (
                        <div className="w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center shrink-0">
                          <Check className="w-2.5 h-2.5 stroke-[3]" />
                        </div>
                      ) : status === 'active' ? (
                        <div className="w-4 h-4 rounded-full bg-teal-500/20 text-teal-300 border border-teal-500/40 flex items-center justify-center shrink-0">
                          <Loader2 className="w-2.5 h-2.5 animate-spin" />
                        </div>
                      ) : (
                        <div className="w-4 h-4 rounded-full bg-zinc-800 border border-zinc-700 shrink-0" />
                      )}

                      <span
                        className={
                          status === 'done'
                            ? 'text-zinc-300 font-medium'
                            : status === 'active'
                            ? 'text-white font-semibold'
                            : 'text-zinc-600'
                        }
                      >
                        {st.label}
                      </span>
                    </div>
                  );
                })}
              </div>

              {installError && (
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-300">
                  <span className="font-semibold">Error:</span> {installError}
                </div>
              )}
            </div>

            <div className="pt-4 border-t border-[#1f1f26] flex items-center justify-between text-[11px] text-zinc-500">
              <span>Writing files safely to disk · Please do not close this window</span>
              <span className="font-mono text-zinc-400">{progress.percent}% complete</span>
            </div>
          </div>
        )}

        {/* 4. Completion Screen */}
        {screen === 'complete' && (
          <div className="flex-1 p-8 flex flex-col justify-between animate-in zoom-in-95 duration-300 relative z-10">
            <div className="space-y-6 pt-2">
              <div className="flex items-start gap-5">
                <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-xl shadow-emerald-500/10 shrink-0">
                  <CheckCircle2 className="w-8 h-8" />
                </div>

                <div className="space-y-1">
                  <h2 className="text-xl font-bold text-white tracking-tight">Installation Complete!</h2>
                  <p className="text-xs text-zinc-400 leading-relaxed">
                    Cluster Desktop has been installed and configured successfully. You are now ready to run autonomous coding workflows.
                  </p>
                </div>
              </div>

              {/* Installation Summary Card */}
              <div className="p-4 rounded-xl bg-[#121215] border border-[#1e1e24] space-y-2 text-xs">
                <div className="flex items-center justify-between py-0.5 border-b border-[#1b1b22] pb-2">
                  <span className="text-zinc-400">Application</span>
                  <span className="font-semibold text-white">Cluster Desktop v0.1.0</span>
                </div>
                <div className="flex items-center justify-between py-0.5 border-b border-[#1b1b22] pb-2">
                  <span className="text-zinc-400">Install Path</span>
                  <span className="font-mono text-zinc-300 truncate max-w-[280px]" title={installDir}>
                    {installDir}
                  </span>
                </div>
                <div className="flex items-center justify-between py-0.5">
                  <span className="text-zinc-400">Shortcuts & Add/Remove</span>
                  <span className="text-emerald-400 font-medium">Registered in Windows</span>
                </div>
              </div>

              {/* Resource Links */}
              <div className="flex items-center gap-4 text-xs text-zinc-400 pt-1">
                <span className="text-zinc-500">Quick Links:</span>
                <a
                  href="https://github.com/ShadowSafin/Cluster-Desktop"
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-white transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <span>GitHub</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
                <a
                  href="https://github.com/ShadowSafin/Cluster-Desktop/releases"
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-white transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <span>Release Notes</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
                <a
                  href="https://github.com/ShadowSafin/Cluster-Desktop#readme"
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-white transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <span>Documentation</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="pt-4 border-t border-[#1f1f26] flex items-center justify-between">
              <button
                onClick={handleClose}
                className="px-4 py-2 rounded-xl bg-[#141418] hover:bg-[#1e1e24] text-zinc-400 hover:text-white text-xs font-medium border border-[#22222a] transition-colors cursor-pointer"
              >
                Close
              </button>

              <button
                onClick={handleLaunchApp}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-black font-semibold text-xs tracking-wide shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/35 transition-all flex items-center gap-2 cursor-pointer"
              >
                <Rocket className="w-4 h-4" />
                <span>Launch Cluster Desktop</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
