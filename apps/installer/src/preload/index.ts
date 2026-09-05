import { contextBridge, ipcRenderer } from 'electron';

export interface InstallOptions {
  installDir: string;
  createDesktopShortcut: boolean;
  createStartMenuShortcut: boolean;
  autoLaunch: boolean;
}

export interface ProgressData {
  percent: number;
  status: string;
  step: string;
}

export interface InstallerInfo {
  defaultInstallDir: string;
  isExistingInstall: boolean;
  requiredSpaceMb: number;
  availableSpaceGb: number;
}

const installerApi = {
  getInfo: (): Promise<InstallerInfo> => ipcRenderer.invoke('installer:getInfo'),
  browse: (currentPath: string): Promise<{ path: string; availableSpaceGb: number } | null> =>
    ipcRenderer.invoke('installer:browse', currentPath),
  startInstall: (
    options: InstallOptions
  ): Promise<{ ok: boolean; installDir?: string; installedExe?: string; error?: string }> =>
    ipcRenderer.invoke('installer:startInstall', options),
  launch: (exePath: string): Promise<void> => ipcRenderer.invoke('installer:launch', exePath),
  minimize: (): Promise<void> => ipcRenderer.invoke('installer:window:minimize'),
  close: (): Promise<void> => ipcRenderer.invoke('installer:window:close'),
  onProgress: (callback: (data: ProgressData) => void) => {
    const handler = (_event: any, data: ProgressData) => callback(data);
    ipcRenderer.on('installer:progress', handler);
    return () => {
      ipcRenderer.removeListener('installer:progress', handler);
    };
  },
};

contextBridge.exposeInMainWorld('installer', installerApi);

export type InstallerApi = typeof installerApi;
