import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
import { execFileSync, spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow: BrowserWindow | null = null;

function getAvailableSpaceGb(dirPath: string): number {
  try {
    const root = path.parse(path.resolve(dirPath)).root || 'C:\\';
    if (fs.statfsSync) {
      const stats = fs.statfsSync(root);
      return Number(((stats.bavail * stats.bsize) / (1024 * 1024 * 1024)).toFixed(1));
    }
  } catch {}
  return 20.0;
}

function createShortcut(
  targetLnk: string,
  targetExe: string,
  workDir: string,
  iconPath: string,
  description: string
): void {
  const psScript = `
$ws = New-Object -ComObject WScript.Shell
$s = $ws.CreateShortcut('${targetLnk.replace(/'/g, "''")}')
$s.TargetPath = '${targetExe.replace(/'/g, "''")}'
$s.WorkingDirectory = '${workDir.replace(/'/g, "''")}'
$s.IconLocation = '${iconPath.replace(/'/g, "''")},0'
$s.Description = '${description.replace(/'/g, "''")}'
$s.Save()
`;
  execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', psScript], {
    windowsHide: true,
  });
}

function createMainWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 700,
    height: 530,
    resizable: false,
    maximizable: false,
    fullscreenable: false,
    frame: false,
    center: true,
    show: false,
    backgroundColor: '#09090b',
    icon: path.join(__dirname, '../../resources/icon.png'),
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  win.once('ready-to-show', () => {
    win.show();
  });

  const devUrl = process.env.VITE_DEV_SERVER_URL;
  if (devUrl) {
    win.loadURL(devUrl);
  } else {
    win.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  // Prevent navigation
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  return win;
}

app.whenReady().then(() => {
  mainWindow = createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createMainWindow();
    }
  });
});

app.on('window-all-closed', () => {
  app.quit();
});

// Window controls
ipcMain.handle('installer:window:minimize', () => {
  mainWindow?.minimize();
});

ipcMain.handle('installer:window:close', () => {
  app.quit();
});

// App info & detection
ipcMain.handle('installer:getInfo', () => {
  const localAppData = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
  const defaultInstallDir = path.join(localAppData, 'Programs', 'Cluster');
  const existingExe = path.join(defaultInstallDir, 'Cluster.exe');
  const isExistingInstall = fs.existsSync(existingExe);
  const availableSpaceGb = getAvailableSpaceGb(defaultInstallDir);

  return {
    defaultInstallDir,
    isExistingInstall,
    requiredSpaceMb: 350,
    availableSpaceGb,
  };
});

// Browse folder dialog
ipcMain.handle('installer:browse', async (_e, currentPath: string) => {
  if (!mainWindow) return null;
  const res = await dialog.showOpenDialog(mainWindow, {
    title: 'Select Cluster Installation Directory',
    defaultPath: currentPath || process.env.LOCALAPPDATA || 'C:\\',
    properties: ['openDirectory', 'createDirectory'],
  });

  if (res.canceled || res.filePaths.length === 0) {
    return null;
  }

  const selectedPath = res.filePaths[0];
  const availableSpaceGb = getAvailableSpaceGb(selectedPath);

  return {
    path: selectedPath,
    availableSpaceGb,
  };
});

// Installation process
ipcMain.handle(
  'installer:startInstall',
  async (
    event,
    options: {
      installDir: string;
      createDesktopShortcut: boolean;
      createStartMenuShortcut: boolean;
      autoLaunch: boolean;
    }
  ) => {
    const wc = event.sender;
    const emit = (percent: number, status: string, step: string) => {
      wc.send('installer:progress', { percent, status, step });
    };

    try {
      const { installDir, createDesktopShortcut, createStartMenuShortcut } = options;

      // 1. Preparing
      emit(5, 'Preparing installation directory...', 'prepare');
      try {
        execFileSync('taskkill.exe', ['/F', '/IM', 'Cluster.exe', '/T'], {
          stdio: 'ignore',
          windowsHide: true,
        });
      } catch {}

      fs.mkdirSync(installDir, { recursive: true });

      // 2. Locate payload archive
      emit(15, 'Locating application packages...', 'locate');
      const candidatePaths = [
        path.join(process.resourcesPath, 'resources', 'cluster-app.tar.gz'),
        path.join(process.resourcesPath, 'cluster-app.tar.gz'),
        path.join(path.dirname(process.execPath), 'resources', 'cluster-app.tar.gz'),
        path.join(path.dirname(process.execPath), 'resources', 'resources', 'cluster-app.tar.gz'),
        path.join(__dirname, '../../resources/cluster-app.tar.gz'),
        path.join(app.getAppPath(), 'resources', 'cluster-app.tar.gz'),
        path.join(app.getAppPath(), 'resources', 'resources', 'cluster-app.tar.gz'),
      ];

      let payloadPath = candidatePaths.find((p) => fs.existsSync(p));

      // Fallback in dev environment: copy directly from release/win-unpacked if tar.gz not present
      if (!payloadPath) {
        const unpackedDevDir = path.resolve(__dirname, '../../../electron/release/win-unpacked');
        if (fs.existsSync(unpackedDevDir)) {
          emit(30, 'Copying core application files...', 'extract');
          // Copy directory recursively
          fs.cpSync(unpackedDevDir, installDir, { recursive: true });
        } else {
          throw new Error('Application package payload (cluster-app.tar.gz) could not be located.');
        }
      } else {
        // Extracting archive using native Windows tar
        emit(25, 'Extracting core application binaries & runtimes...', 'extract');
        execFileSync('tar.exe', ['-xzf', payloadPath, '-C', installDir], {
          windowsHide: true,
        });
      }

      emit(70, 'Verifying extracted binaries...', 'verify');
      const installedExe = path.join(installDir, 'Cluster.exe');
      if (!fs.existsSync(installedExe)) {
        throw new Error('Verification failed: Cluster.exe not found in target folder.');
      }

      // 3. Shortcuts
      emit(80, 'Configuring Windows shortcuts...', 'shortcuts');
      const iconPath = installedExe;

      if (createDesktopShortcut) {
        const desktopLnk = path.join(os.homedir(), 'Desktop', 'Cluster.lnk');
        createShortcut(
          desktopLnk,
          installedExe,
          installDir,
          iconPath,
          'Cluster Desktop — Premium AI Coding Workspace'
        );
      }

      if (createStartMenuShortcut) {
        const startMenuDir = path.join(
          process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'),
          'Microsoft',
          'Windows',
          'Start Menu',
          'Programs',
          'Cluster'
        );
        fs.mkdirSync(startMenuDir, { recursive: true });
        const startMenuLnk = path.join(startMenuDir, 'Cluster.lnk');
        createShortcut(
          startMenuLnk,
          installedExe,
          installDir,
          iconPath,
          'Cluster Desktop — Premium AI Coding Workspace'
        );
      }

      // 4. Registry & Uninstaller
      emit(90, 'Registering application with Windows...', 'registry');

      // Create uninstaller script
      const uninstallerBatPath = path.join(installDir, 'Uninstall-Cluster.bat');
      const uninstallerContent = `@echo off
title Cluster Desktop Uninstaller
echo ===================================================
echo Uninstalling Cluster Desktop...
echo ===================================================
taskkill /F /IM Cluster.exe /T >nul 2>&1
del /F /Q "%USERPROFILE%\\Desktop\\Cluster.lnk" >nul 2>&1
rmdir /S /Q "%APPDATA%\\Microsoft\\Windows\\Start Menu\\Programs\\Cluster" >nul 2>&1
reg delete "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Cluster" /f >nul 2>&1
echo Removing application files...
start /b "" cmd /c "timeout /t 2 /nobreak >nul & rmdir /s /q \\"%~dp0\\""
echo Cluster Desktop has been uninstalled successfully.
`;
      fs.writeFileSync(uninstallerBatPath, uninstallerContent, 'utf8');

      // Register in Windows Add/Remove Programs
      const regKey = 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Cluster';
      const regCommands = [
        ['add', regKey, '/v', 'DisplayName', '/t', 'REG_SZ', '/d', 'Cluster Desktop', '/f'],
        ['add', regKey, '/v', 'DisplayVersion', '/t', 'REG_SZ', '/d', '0.1.0', '/f'],
        ['add', regKey, '/v', 'Publisher', '/t', 'REG_SZ', '/d', 'Abrar Safin', '/f'],
        ['add', regKey, '/v', 'InstallLocation', '/t', 'REG_SZ', '/d', installDir, '/f'],
        ['add', regKey, '/v', 'DisplayIcon', '/t', 'REG_SZ', '/d', `${installedExe},0`, '/f'],
        ['add', regKey, '/v', 'UninstallString', '/t', 'REG_SZ', '/d', `"${uninstallerBatPath}"`, '/f'],
        ['add', regKey, '/v', 'EstimatedSize', '/t', 'REG_DWORD', '/d', '358400', '/f'],
        ['add', regKey, '/v', 'NoModify', '/t', 'REG_DWORD', '/d', '1', '/f'],
        ['add', regKey, '/v', 'NoRepair', '/t', 'REG_DWORD', '/d', '1', '/f'],
      ];

      for (const cmd of regCommands) {
        try {
          execFileSync('reg.exe', cmd, { windowsHide: true, stdio: 'ignore' });
        } catch {}
      }

      emit(100, 'Installation finalized successfully!', 'done');
      return { ok: true, installDir, installedExe };
    } catch (err: any) {
      console.error('Installation error:', err);
      return { ok: false, error: err?.message || 'Unknown error occurred during installation.' };
    }
  }
);

// Launch installed app
ipcMain.handle('installer:launch', (_e, exePath: string) => {
  if (fs.existsSync(exePath)) {
    spawn(exePath, [], {
      detached: true,
      stdio: 'ignore',
    }).unref();
  }
  app.quit();
});
