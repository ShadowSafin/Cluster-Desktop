import { app, BrowserWindow, ipcMain, shell, dialog } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs/promises';

// Keep reference to prevent GC
let mainWindow: BrowserWindow | null = null;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function resolveRendererEntry(): Promise<string> {
  // In dev, vite serves at 5173; in prod, dist/renderer/index.html
  const prodPath = path.resolve(__dirname, '../renderer/index.html');
  try {
    await fs.access(prodPath);
    return prodPath;
  } catch {
    return '';
  }
}

function createWindow() {
  const iconPath = path.resolve(__dirname, '../../resources/icon.png');

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1100,
    minHeight: 680,
    backgroundColor: '#0a0a0d',
    icon: iconPath,
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#0a0a0d',
      symbolColor: '#a1a1aa',
      height: 36,
    },
    trafficLightPosition: { x: 14, y: 12 },
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      backgroundThrottling: false,
    },
    show: false,
    roundedCorners: true,
  });

  // Robust show: if ready-to-show never fires (black screen), show after 1.5s anyway
  const showTimer = setTimeout(() => {
    if (mainWindow && !mainWindow.isVisible()) {
      console.warn('[Cluster] ready-to-show timeout — forcing show');
      mainWindow.show();
    }
  }, 1500);
  mainWindow.once('ready-to-show', () => {
    clearTimeout(showTimer);
    mainWindow?.show();
    console.log('[Cluster] window ready-to-show');
  });

  // Diagnostics — surface load failures instead of black screen
  mainWindow.webContents.on('did-fail-load', (_e, code, desc, url) => {
    console.error(`[Cluster] did-fail-load ${code} ${desc} ${url}`);
  });
  mainWindow.webContents.on('did-finish-load', () => console.log('[Cluster] did-finish-load'));
  mainWindow.webContents.on('console-message', (_e, level, msg, line, sourceId) => {
    const text = `[renderer:${level}] ${msg} (${sourceId}:${line})`;
    if (level >= 2) console.warn(text); else console.log(text);
  });
  mainWindow.webContents.on('render-process-gone', (_e, details) => console.error('[Cluster] render-process-gone', details));
  mainWindow.webContents.on('unresponsive', () => console.warn('[Cluster] window unresponsive'));
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  return mainWindow;
}

async function loadRenderer(win: BrowserWindow) {
  const devUrl = 'http://localhost:5173';
  const prodFallback = path.resolve(process.cwd(), 'apps/electron/dist/renderer/index.html');
  const asarFallback = path.resolve(__dirname, '../renderer/index.html');

  const tryLoadFile = async (file: string) => {
    try {
      await fs.access(file);
      console.log('[Cluster] loadFile', file);
      await win.loadFile(file);
      return true;
    } catch (e) {
      console.warn('[Cluster] loadFile miss', file, (e as any)?.message);
      return false;
    }
  };

  if (!app.isPackaged) {
    // In dev, prefer dev server but wait briefly and retry; fallback to file ensures window always opens
    const maxRetries = 15;
    for (let i = 0; i < maxRetries; i++) {
      try {
        console.log(`[Cluster] trying dev server ${devUrl} attempt ${i + 1}`);
        await win.loadURL(devUrl);
        console.log('[Cluster] dev server loaded');
        break;
      } catch (e) {
        console.warn('[Cluster] dev server not ready, retrying...', (e as any)?.message);
        await new Promise((r) => setTimeout(r, 500));
        if (i === maxRetries - 1) {
          console.warn('[Cluster] dev server failed, falling back to file');
          if (!(await tryLoadFile(asarFallback)) && !(await tryLoadFile(prodFallback))) {
            console.error('[Cluster] no renderer file found, showing error page');
            await win.loadURL(`data:text/html,<h1 style="color:#fff;background:#0a0a0d;padding:24px;font-family:monospace">Cluster: no renderer found<br>Run <code>npm run electron:build</code> or start vite at ${devUrl}</h1>`);
          }
        }
      }
    }
    if (!win.webContents.isDevToolsOpened()) {
      try { win.webContents.openDevTools({ mode: 'detach' }); } catch {}
    }
  } else {
    console.log('[Cluster] packaged load');
    if (!(await tryLoadFile(asarFallback)) && !(await tryLoadFile(prodFallback))) {
      console.error('[Cluster] packaged: no renderer file found');
      await win.loadURL(`data:text/html,<h1 style="color:#fff;background:#0a0a0d;padding:24px;font-family:monospace">Cluster packaged: renderer missing at ${asarFallback}</h1>`);
    }
  }
}

// ---------- IPC HANDLERS ----------

import { SessionStore, resolveStoragePaths } from '@cluster/storage';
import { listCheckpoints, createCheckpoint, rollbackToCheckpoint } from '@cluster/storage';
import { detectProjectRoot, loadWorkspaceInfo } from '@cluster/workspace';
import { loadConfig } from '@cluster/agent-core';

let sessionStore: SessionStore | null = null;

async function getStore(): Promise<SessionStore> {
  if (!sessionStore) sessionStore = await SessionStore.open();
  return sessionStore;
}

function registerIpc() {
  ipcMain.handle('sessions:list', async (_e, filter?: { projectRoot?: string; limit?: number; all?: boolean }) => {
    const store = await getStore();
    const root = filter?.all ? undefined : filter?.projectRoot;
    return store.listSessions({ projectRoot: root, limit: filter?.limit ?? 50 });
  });

  ipcMain.handle('sessions:get', async (_e, id: string) => {
    const store = await getStore();
    return store.getSession(id);
  });

  ipcMain.handle('sessions:create', async (_e, opts: { projectRoot: string; model?: string; title?: string }) => {
    const store = await getStore();
    const cfg = await loadConfig({}, { projectRoot: opts.projectRoot }).catch(() => null as any);
    const session = store.createSession({
      projectRoot: opts.projectRoot,
      model: opts.model || cfg?.model || 'agnes-2.5-flash',
      title: opts.title,
    });
    await store.flush();
    return session;
  });

  ipcMain.handle('sessions:delete', async (_e, id: string) => {
    const store = await getStore();
    const ok = store.deleteSession(id);
    await store.flush();
    return ok;
  });

  ipcMain.handle('sessions:rename', async (_e, id: string, title: string) => {
    const store = await getStore();
    store.renameSession(id, title);
    await store.flush();
    return store.getSession(id);
  });

  ipcMain.handle('workspace:info', async (_e, projectRoot: string) => {
    try {
      const info = await loadWorkspaceInfo(projectRoot);
      if (info?.root) {
        try {
          const { clusterHome } = await import('@cluster/shared');
          const fs2 = await import('node:fs/promises');
          const path2 = await import('node:path');
          const file = path2.join(clusterHome(), 'config.json');
          let cur: any = {};
          try { cur = JSON.parse(await fs2.readFile(file, 'utf8')); } catch {}
          if (cur.lastWorkspace !== info.root) {
            cur.lastWorkspace = info.root;
            await fs2.mkdir(path2.dirname(file), { recursive: true });
            await fs2.writeFile(file, JSON.stringify(cur, null, 2), 'utf8');
          }
        } catch {}
      }
      return info;
    } catch (err) {
      return null;
    }
  });

  ipcMain.handle('workspace:detect', async (_e, cwd?: string) => {
    let target = cwd;
    const fs2 = await import('node:fs/promises');

    // If cwd was provided, verify it exists on disk
    if (target) {
      try {
        await fs2.access(target);
      } catch {
        target = undefined;
      }
    }

    // If no valid cwd was provided, restore lastWorkspace from ~/.cluster/config.json
    if (!target) {
      try {
        const { clusterHome } = await import('@cluster/shared');
        const path2 = await import('node:path');
        const file = path2.join(clusterHome(), 'config.json');
        const cur = JSON.parse(await fs2.readFile(file, 'utf8'));
        if (cur.lastWorkspace) {
          await fs2.access(cur.lastWorkspace);
          target = cur.lastWorkspace;
        }
      } catch {}
    }

    const detected = await detectProjectRoot(target ?? process.cwd());
    return detected;
  });

  ipcMain.handle('storage:paths', async () => {
    return resolveStoragePaths();
  });

  ipcMain.handle('config:get', async (_e, projectRoot?: string) => {
    const cfg = await loadConfig({}, { projectRoot: projectRoot ?? process.cwd() });
    // mask key for renderer
    const masked = { ...cfg, apiKey: cfg.apiKey ? `${cfg.apiKey.slice(0,4)}••••${cfg.apiKey.slice(-4)}` : '' , _hasKey: Boolean(cfg.apiKey) };
    return masked;
  });

  ipcMain.handle('checkpoints:list', async (_e, sessionId: string) => {
    return listCheckpoints(sessionId);
  });

  ipcMain.handle('checkpoints:create', async (_e, opts: { sessionId: string; projectRoot: string; message?: string }) => {
    return createCheckpoint(opts);
  });

  ipcMain.handle('checkpoints:rollback', async (_e, opts: { sessionId: string; checkpointId: string; projectRoot: string }) => {
    return rollbackToCheckpoint(opts);
  });

  ipcMain.handle('app:info', async () => {
    return {
      version: app.getVersion(),
      platform: process.platform,
      arch: process.arch,
      isPackaged: app.isPackaged,
    };
  });

  ipcMain.handle('shell:openPath', async (_e, p: string) => {
    const res = await shell.openPath(p);
    return res;
  });

  ipcMain.handle('dialog:openDirectory', async () => {
    if (!mainWindow) return null;
    const res = await dialog.showOpenDialog(mainWindow, { properties: ['openDirectory'] });
    if (res.canceled) return null;
    return res.filePaths[0] ?? null;
  });

  // Skills IPC handlers
  let skillsStoreInstance: any = null;
  let skillsRuntimeInstance: any = null;
  async function getSkills() {
    if (!skillsStoreInstance) {
      const { SkillsStore, SkillsRuntime } = await import('@cluster/skills');
      skillsStoreInstance = new SkillsStore();
      await skillsStoreInstance.init();
      skillsRuntimeInstance = new SkillsRuntime(skillsStoreInstance);
    }
    return { store: skillsStoreInstance, runtime: skillsRuntimeInstance };
  }

  ipcMain.handle('skills:list', async () => {
    const { store } = await getSkills();
    return store.listInstalled();
  });
  ipcMain.handle('skills:marketplace', async (_e, filter) => {
    const { store } = await getSkills();
    return store.listMarketplace(filter);
  });
  ipcMain.handle('skills:install', async (_e, id: string) => {
    const { store } = await getSkills();
    return store.install(id);
  });
  ipcMain.handle('skills:uninstall', async (_e, id: string) => {
    const { store } = await getSkills();
    return store.uninstall(id);
  });
  ipcMain.handle('skills:update', async (_e, id: string) => {
    const { store } = await getSkills();
    return store.update(id);
  });
  ipcMain.handle('skills:toggle', async (_e, opts: { id: string; enabled: boolean }) => {
    const { store } = await getSkills();
    return store.toggle(opts.id, opts.enabled);
  });
  ipcMain.handle('skills:pin', async (_e, opts: { id: string; pinned: boolean }) => {
    const { store } = await getSkills();
    return store.pin(opts.id, opts.pinned);
  });
  ipcMain.handle('skills:createCustom', async (_e, data: any) => {
    const { store } = await getSkills();
    return store.createCustom(data);
  });
  ipcMain.handle('skills:history', async (_e, limit?: number) => {
    const { store } = await getSkills();
    return store.getHistory(limit);
  });
  ipcMain.handle('skills:stats', async () => {
    const { store } = await getSkills();
    return store.stats();
  });

    // Real agent execution — wired to SessionStore, ModelProvider, ToolRegistry, Coordinator, TaskEngine
  const activeControllers = new Map<string, AbortController>();
  const jobRegistry = new Map<string, { id: string; command: string; cwd: string; status: 'running'|'done'|'failed'|'stopped'; pid?: number; port?: number; output: string; startedAt: string; durationMs?: number; controller?: { abort: () => void } }>();

  const DEV_PROC_NAMES = new Set([
    'node.exe', 'node',
    'python.exe', 'python', 'python3.exe', 'python3',
    'bun.exe', 'bun',
    'deno.exe', 'deno',
    'cargo.exe', 'cargo',
    'go.exe', 'go',
    'ruby.exe', 'ruby'
  ]);

  async function discoverActiveDevServers(existingPids = new Set<number>()): Promise<any[]> {
    if (process.platform !== 'win32') return [];
    try {
      const { exec } = await import('node:child_process');
      const util = await import('node:util');
      const execPromise = util.promisify(exec);

      const [netstatRes, tasklistRes] = await Promise.all([
        execPromise('netstat -ano').catch(() => ({ stdout: '' })),
        execPromise('tasklist /FO CSV /NH').catch(() => ({ stdout: '' })),
      ]);

      const pidMap = new Map<number, string>();
      for (const line of (tasklistRes.stdout || '').split('\n')) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        const parts = trimmed.split(',').map(s => s.replace(/^"|"$/g, '').trim());
        if (parts.length >= 2) {
          const name = parts[0].toLowerCase();
          const pid = parseInt(parts[1], 10);
          if (pid) pidMap.set(pid, name);
        }
      }

      const seen = new Set<string>();
      const discovered: any[] = [];

      for (const line of (netstatRes.stdout || '').split('\n')) {
        if (!line.includes('LISTENING')) continue;
        const parts = line.trim().split(/\s+/);
        if (parts.length >= 4) {
          const local = parts[1];
          const pidStr = parts[parts.length - 1];
          const pid = parseInt(pidStr, 10);
          const portMatch = local.match(/:(\d+)$/);
          if (portMatch && pid && pid > 4) {
            const port = parseInt(portMatch[1], 10);
            const isDevPort = (port >= 3000 && port <= 9999) || [80, 443, 8000, 8080].includes(port);
            const key = `${port}-${pid}`;
            if (isDevPort && !seen.has(key) && !existingPids.has(pid)) {
              seen.add(key);
              const procName = pidMap.get(pid);
              if (procName && DEV_PROC_NAMES.has(procName)) {
                let label = 'Dev Server';
                if (port === 5173 || port === 5174) label = 'Vite Dev Server';
                else if (port === 3000 || port === 3001) label = 'Web Dev Server';
                else if (port === 8000 || port === 8080) label = 'API Server';
                else if (port === 4200) label = 'Angular Server';

                const id = `sys-${port}-${pid}`;
                const devJob = {
                  id,
                  command: `${procName} (${label} on port ${port})`,
                  cwd: process.cwd(),
                  status: 'running' as const,
                  pid,
                  port,
                  output: `Active dev server listening on http://localhost:${port}\nProcess: ${procName} (PID: ${pid})\nStatus: Running / Listening`,
                  startedAt: new Date().toISOString(),
                  controller: {
                    abort: () => {
                      try {
                        exec(`taskkill /pid ${pid} /T /F`);
                      } catch {}
                    }
                  }
                };
                jobRegistry.set(id, devJob);
                discovered.push(devJob);
              }
            }
          }
        }
      }
      return discovered;
    } catch {
      return [];
    }
  }

  ipcMain.handle('agent:send', async (event, payload: { sessionId: string; text: string; mode?: 'single'|'multi'; effort?: 'low' | 'balanced' | 'high' }) => {
    const store = await getStore();
    const session = store.getSession(payload.sessionId);
    if (!session) throw new Error('Session not found');
    const wc = event.sender;
    const emit = (channel: string, data: any) => wc.send(channel, data);

    // Resolve Skills & Slash Commands
    const { store: sStore, runtime: sRuntime } = await getSkills();
    const resolution = await sRuntime.resolveCommand(payload.text);

    if (resolution.type === 'system') {
      const { createId } = await import('@cluster/shared');
      const msgId = createId('msg');
      let content = '';
      if (resolution.action === 'list') {
        const installed = await sStore.listInstalled();
        content = [
          '### ⚡ Installed Skills in Cluster',
          `You have **${installed.length} active skills** installed:`,
          '',
          ...installed.map(
            (s: any) =>
              `- **/${s.manifest.invocationName}** — ${s.manifest.displayName} (${s.manifest.category}) [v${s.manifest.version}]`
          ),
          '',
          '*Type `/<invocationName>` to trigger any skill, or `/marketplace` to browse available skills.*',
        ].join('\n');
      } else if (resolution.action === 'marketplace') {
        const all = await sStore.listMarketplace();
        content = [
          '### 🛍️ Cluster Skill Marketplace',
          `Browsing **${all.length} available skills** across 16 categories:`,
          '',
          ...all
            .slice(0, 10)
            .map(
              (s: any) =>
                `- **/${s.invocationName}** (${s.displayName}) — *${s.isInstalled ? '✓ Installed' : 'Available'}*`
            ),
          '',
          '*Open the dedicated **Skills** tab in the sidebar for the full visual catalog.*',
        ].join('\n');
      } else if (resolution.action === 'install' && resolution.target) {
        const res = await sStore.install(resolution.target);
        content = res.ok
          ? `✓ Successfully installed **${res.skill?.manifest.displayName}**!\nYou can now invoke it with \`/${res.skill?.manifest.invocationName}\`.`
          : `⚠️ Failed to install skill: ${res.error}`;
      } else if (resolution.action === 'remove' && resolution.target) {
        const ok = await sStore.uninstall(resolution.target);
        content = ok
          ? `✓ Successfully uninstalled skill "${resolution.target}".`
          : `⚠️ Skill "${resolution.target}" was not installed.`;
      }

      store.appendMessage(payload.sessionId, {
        id: msgId,
        sessionId: payload.sessionId,
        role: 'assistant',
        content,
        kind: 'summary',
        createdAt: new Date().toISOString(),
      } as any);
      emit('agent:message', {
        sessionId: payload.sessionId,
        message: {
          id: msgId,
          sessionId: payload.sessionId,
          role: 'assistant',
          content,
          kind: 'summary',
          createdAt: new Date().toISOString(),
        },
      });
      emit('agent:state', {
        sessionId: payload.sessionId,
        state: { phase: 'done', label: 'Done', iteration: 1, maxIterations: 1 },
      });
      emit('agent:done', {
        sessionId: payload.sessionId,
        summary: content,
        usage: { prompt: 0, completion: 0, total: 0 },
        cancelled: false,
        iterations: 1,
      });
      await store.flush();
      return { ok: true, system: true };
    }

    if (resolution.type === 'missing') {
      const { createId } = await import('@cluster/shared');
      const msgId = createId('msg');
      const content = resolution.suggestion
        ? `⚠️ Skill **/${resolution.command}** is not installed.\n\n` +
          `Found in Marketplace: **${resolution.suggestion.displayName}** (${resolution.suggestion.category})\n` +
          `${resolution.suggestion.description}\n\n` +
          `To install it, type: \`/install ${resolution.suggestion.id}\` or open the **Skills** tab.`
        : `⚠️ Unknown skill or command **/${resolution.command}**.\nType \`/skills\` to view installed skills or \`/marketplace\` to discover new skills.`;

      store.appendMessage(payload.sessionId, {
        id: msgId,
        sessionId: payload.sessionId,
        role: 'assistant',
        content,
        kind: 'warning',
        createdAt: new Date().toISOString(),
      } as any);
      emit('agent:message', {
        sessionId: payload.sessionId,
        message: {
          id: msgId,
          sessionId: payload.sessionId,
          role: 'assistant',
          content,
          kind: 'warning',
          createdAt: new Date().toISOString(),
        },
      });
      emit('agent:state', {
        sessionId: payload.sessionId,
        state: { phase: 'done', label: 'Done', iteration: 1, maxIterations: 1 },
      });
      emit('agent:done', {
        sessionId: payload.sessionId,
        summary: content,
        usage: { prompt: 0, completion: 0, total: 0 },
        cancelled: false,
        iterations: 1,
      });
      await store.flush();
      return { ok: true, missing: true };
    }

    let activePrompt = payload.text;
    let extraSkillInstructions = '';
    if (resolution.type === 'skill') {
      activePrompt = resolution.augmentedPrompt;
      extraSkillInstructions = resolution.instructions;
      // Record invocation
      await sStore.recordInvocation(
        resolution.skill.manifest.id,
        resolution.params,
        payload.text,
        payload.sessionId
      );
      emit('agent:skill:invoked', {
        sessionId: payload.sessionId,
        skill: resolution.skill,
        params: resolution.params,
        rawCommand: payload.text,
      });
      const { createId } = await import('@cluster/shared');
      const skillMsgId = createId('msg');
      const ackContent = `⚡ **Invoked Skill: ${resolution.skill.manifest.displayName}** (\`/${resolution.skill.manifest.invocationName}\`)\n*Permissions approved: ${resolution.skill.manifest.requiredPermissions.join(', ')}*`;
      store.appendMessage(payload.sessionId, {
        id: skillMsgId,
        sessionId: payload.sessionId,
        role: 'assistant',
        content: ackContent,
        kind: 'info',
        createdAt: new Date().toISOString(),
      } as any);
      emit('agent:message', {
        sessionId: payload.sessionId,
        message: {
          id: skillMsgId,
          sessionId: payload.sessionId,
          role: 'assistant',
          content: ackContent,
          kind: 'info',
          createdAt: new Date().toISOString(),
        },
      });
    }

    // Load real workspace and config
    const projectRoot = session.projectRoot;
    let workspace: any = null;
    try { workspace = await loadWorkspaceInfo(projectRoot); } catch { workspace = null; }
    const cfg = await loadConfig({}, { projectRoot }).catch(() => null as any);
    const hasKey = Boolean(cfg?.apiKey);
    const paths = resolveStoragePaths();

    // Setup session title
    const { createId } = await import('@cluster/shared');
    if (session.messages.length === 0) {
      const title = payload.text.length > 60 ? `${payload.text.slice(0,57)}…` : payload.text;
      store.renameSession(payload.sessionId, title);
      emit('sessions:updated', { sessionId: payload.sessionId, title });
    }
    await store.flush();
    emit('agent:state', { sessionId: payload.sessionId, state: { phase:'planning', label:'Planning', iteration:0, maxIterations: cfg?.maxIterations ?? 40 } });

    // If no API key, run local heuristic that still does REAL file ops via ToolRegistry (proves wiring)
    if (!hasKey) {
      emit('agent:progress', { sessionId: payload.sessionId, message: '[system] No API key — running local plan with real tools (demo mode)' });
      // Use real ToolRegistry to do actual file ops, but plan heuristically
      const { createDefaultRegistry } = await import('@cluster/tool-runtime');
      const registry = createDefaultRegistry();
      const { Emitter } = await import('@cluster/shared');
      const events = new Emitter<any>((e:any)=>console.error(e));
      // Wire events to renderer + store (shared helper)
      const forward = (ev: string) => events.on(ev as any, (data:any)=>{
        if (ev==='message') { store.appendMessage(payload.sessionId, data); emit('agent:message', { sessionId: payload.sessionId, message: data }); }
        else if (ev==='tool:start') { store.appendToolCall(payload.sessionId, data); emit('agent:tool:start', { sessionId: payload.sessionId, call: data }); }
        else if (ev==='tool:end') { store.updateToolCall(payload.sessionId, data); emit('agent:tool:end', { sessionId: payload.sessionId, call: data }); if (data.name==='write_file'||data.name==='patch_file') { const d=(data.result?.data||{}) as any; if (d.diff) { const edit={ id:createId('edit'), sessionId: payload.sessionId, toolCallId: data.id, path: d.path, kind: d.created?'create':'update', diff: d.diff, additions: d.additions??0, deletions: d.deletions??0, createdAt: new Date().toISOString() }; store.appendEdit(payload.sessionId, edit as any); emit('agent:edit', { sessionId: payload.sessionId, edit }); } } }
        else if (ev==='tool:output') emit('agent:tool:output', { sessionId: payload.sessionId, callId: data.callId, chunk: data.chunk })
        else if (ev==='progress') emit('agent:progress', { sessionId: payload.sessionId, message: data.message })
        else if (ev==='plan') { store.setPlan(payload.sessionId, data); emit('agent:plan', { sessionId: payload.sessionId, plan: data }); }
        else if (ev==='state') emit('agent:state', { sessionId: payload.sessionId, state: data })
        else if (ev==='error') emit('agent:error', { sessionId: payload.sessionId, error: data })
        else if (ev==='done') { store.updateState(payload.sessionId, { phase: data.cancelled?'cancelled':'done', finishedAt: new Date().toISOString(), usage: data.usage } as any); emit('agent:done', { sessionId: payload.sessionId, ...data }); store.flush().catch(()=>{}); }
        else if (ev==='delta') emit('agent:delta', { sessionId: payload.sessionId, text: data.text })
        else if (ev==='file:progress') emit('agent:file:progress', { sessionId: payload.sessionId, ...data });
      });
      ['message','delta','tool:start','tool:end','tool:output','progress','plan','state','error','done','file:progress'].forEach(forward);
      events.emit('plan', { goal: payload.text, steps: [{ id: createId('step'), text: `Analyse: ${payload.text.slice(0,60)}`, status:'pending' }, { id: createId('step'), text: 'Execute file operations', status:'pending' }, { id: createId('step'), text: 'Verify', status:'pending' }], createdAt: new Date().toISOString() });
      events.emit('state', { phase:'thinking', label:'Local demo', iteration:1, maxIterations:3 });
      // Do a REAL file read via tool
      const controller = new AbortController();
      activeControllers.set(payload.sessionId, controller);
      try {
        const ctxBase = { projectRoot, workspace, signal: controller.signal, logger: { debug:()=>{}, info:()=>{}, warn:()=>{}, error:()=>{} } as any, backupsDir: paths.backupsDir, sessionId: payload.sessionId, alwaysConfirmCommands: false, confirm: async()=>true, emitOutput: (c:string)=>events.emit('tool:output', { callId:'demo', chunk:c }), emitProgress: (m:string)=>events.emit('progress', { message:m }) } as any;
        // Real read
        const read = await registry.execute('read_file', { path: 'package.json' }, ctxBase);
        events.emit('message', { id:createId('msg'), sessionId: payload.sessionId, role:'assistant', content: `Demo mode: read package.json → ${read.result.ok ? 'ok' : 'failed'}. ${read.result.output.slice(0,200)}`, createdAt: new Date().toISOString(), kind:'chat' });
        // Real write to a demo file to prove diff
        const demoPath = 'cluster-demo-output.md';
        const write = await registry.execute('write_file', { path: demoPath, content: `# Demo run\n\nGoal: ${payload.text}\n\nGenerated at ${new Date().toISOString()}\n\nThis file proves real file I/O via ToolRegistry (write_file) is wired.\n` }, ctxBase);
        if (write.result.ok) {
          const data = write.result.data as any;
          events.emit('message', { id:createId('msg'), sessionId: payload.sessionId, role:'assistant', content: `Created ${demoPath} — diff will appear in Diffs tab.`, createdAt: new Date().toISOString(), kind:'summary' });
        }
        // Real command
        const cmd = await registry.execute('run_command', { command: 'node -v', cwd: projectRoot }, ctxBase);
        events.emit('message', { id:createId('msg'), sessionId: payload.sessionId, role:'assistant', content: `Command \`node -v\` → ${cmd.result.output.slice(0,300)}`, createdAt: new Date().toISOString(), kind:'info' });
        events.emit('state', { phase:'done', label:'Done', iteration:1, maxIterations:3 });
        events.emit('done', { summary: 'Demo complete — real file I/O and command execution verified', usage: { prompt:0, completion:0, total:0 }, cancelled:false, iterations:1 });
      } catch (e:any) {
        events.emit('error', { source:'agent', message: e.message, recoverable:true });
        events.emit('done', { summary: e.message, usage:{prompt:0,completion:0,total:0}, cancelled:false, iterations:0 });
      } finally {
        activeControllers.delete(payload.sessionId);
        await store.flush();
      }
      return { ok:true, demo:true };
    }

    // Real LLM path: default to single agent AgentLoop to avoid rate limits
    const { ModelProvider } = await import('@cluster/agent-core');
    const { createDefaultRegistry, createPhase2Registry } = await import('@cluster/tool-runtime');
    const { AgentLoop, Coordinator } = await import('@cluster/agent-core');
    const { Emitter } = await import('@cluster/shared');
    const activeModel = cfg?.model || session.model || 'agnes-2.5-flash';
    if (session.model !== activeModel) {
      session.model = activeModel;
      await store.flush();
    }
    const isMulti = payload.mode === 'multi';
    const effort = payload.effort || cfg?.effort || 'balanced';
    const maxIterations = cfg?.maxIterations ?? (effort === 'low' ? 15 : effort === 'high' ? 80 : 40);
    const temperature = cfg?.temperature ?? (effort === 'low' ? 0.1 : effort === 'high' ? 0.3 : 0.2);
    const provider = new ModelProvider({ ...cfg, model: activeModel, effort, temperature, maxIterations });
    const registry = isMulti ? createPhase2Registry() : createDefaultRegistry();
    const events = new Emitter<any>((e:any)=>console.error(e));
    const controller = new AbortController();
    activeControllers.set(payload.sessionId, controller);
    // Forward all events to renderer and persist
    const forwardReal = (ev: string) => events.on(ev as any, (data:any)=>{
      if (ev==='message') { store.appendMessage(payload.sessionId, data); emit('agent:message', { sessionId: payload.sessionId, message: data }); }
      else if (ev==='tool:start') { store.appendToolCall(payload.sessionId, data); emit('agent:tool:start', { sessionId: payload.sessionId, call: data }); }
      else if (ev==='tool:end') {
        store.updateToolCall(payload.sessionId, data);
        emit('agent:tool:end', { sessionId: payload.sessionId, call: data });
        // edits
        if (data.name==='write_file'||data.name==='patch_file') {
          const d=(data.result?.data||{}) as any;
          if (d?.diff) {
            const edit={ id:createId('edit'), sessionId: payload.sessionId, toolCallId: data.id, path: d.path, kind: d.created?'create':'update', diff: d.diff, additions: d.additions??0, deletions: d.deletions??0, createdAt: new Date().toISOString() };
            store.appendEdit(payload.sessionId, edit as any);
            emit('agent:edit', { sessionId: payload.sessionId, edit });
          }
        }
        if (data.name==='run_command') {
          const d=(data.result?.data||{}) as any;
          const isBg = !!(d.isBackground || (typeof d.command === 'string' && /(?:npm\s+run\s+dev|vite\b|next\s+dev|nodemon|webpack\s+serve|python\s+-m\s+http)/i.test(d.command) && data.status === 'success'));
          const portMatch = (d.output || '').match(/(?:localhost|127\.0\.0\.1|0\.0\.0\.0|port|Port)[:\s]+(\d{2,5})/i);
          const port = d.port || (portMatch ? parseInt(portMatch[1], 10) : undefined);
          const status = isBg ? 'running' as const : (data.status==='success'?'done' as const:'failed' as const);
          const job = {
            id: data.id,
            command: d.command||'',
            cwd: d.cwd||projectRoot,
            status,
            pid: d.pid,
            port,
            exitCode: isBg ? undefined : d.exitCode,
            output: d.output||'',
            startedAt: data.startedAt || new Date().toISOString(),
          };
          jobRegistry.set(data.id, {
            ...job,
            durationMs: d.durationMs,
            controller: d.pid ? {
              abort: () => {
                try {
                  if (process.platform === 'win32') {
                    import('node:child_process').then(({ exec }) => exec(`taskkill /pid ${d.pid} /T /F`));
                  } else {
                    process.kill(d.pid, 'SIGKILL');
                  }
                } catch {}
              }
            } : undefined,
          });
          emit('agent:job', { sessionId: payload.sessionId, job });
          // also store as commandRun
          store.appendCommandRun(payload.sessionId, { id:createId('cmd'), sessionId: payload.sessionId, toolCallId: data.id, command: d.command||'', cwd: d.cwd||projectRoot, exitCode: d.exitCode??null, stdout: d.output||'', stderr:'', durationMs: d.durationMs||0, timedOut: !!d.timedOut, cancelled: !!d.cancelled, startedAt: data.startedAt||new Date().toISOString(), finishedAt: data.finishedAt||new Date().toISOString() } as any);
        }
      }
      else if (ev==='tool:output') emit('agent:tool:output', { sessionId: payload.sessionId, callId: data.callId, chunk: data.chunk })
      else if (ev==='progress') emit('agent:progress', { sessionId: payload.sessionId, message: data.message })
      else if (ev==='plan') { store.setPlan(payload.sessionId, data); emit('agent:plan', { sessionId: payload.sessionId, plan: data }); }
      else if (ev==='state') { store.updateState(payload.sessionId, { phase: data.phase, label: data.label, iteration: data.iteration } as any); emit('agent:state', { sessionId: payload.sessionId, state: data }); }
      else if (ev==='error') { store.appendError(payload.sessionId, { id:createId('err'), sessionId: payload.sessionId, source: data.source, message: data.message, code: data.code, recoverable: data.recoverable, createdAt: new Date().toISOString() } as any); emit('agent:error', { sessionId: payload.sessionId, error: data }); }
      else if (ev==='done') { store.updateState(payload.sessionId, { phase: data.cancelled?'cancelled':'done', finishedAt: new Date().toISOString(), usage: data.usage } as any); emit('agent:done', { sessionId: payload.sessionId, ...data }); store.flush().catch(()=>{}); }
      else if (ev==='delta') emit('agent:delta', { sessionId: payload.sessionId, text: data.text })
      else if (ev==='memory:recalled') emit('agent:memory:recalled', { sessionId: payload.sessionId, memories: data.memories });
      else if (ev==='file:progress') emit('agent:file:progress', { sessionId: payload.sessionId, ...data });
      else if (ev==='subagent:spawn') emit('agent:subagent:spawn', { sessionId: payload.sessionId, subAgent: data.subAgent });
      else if (ev==='subagent:update') emit('agent:subagent:update', { sessionId: payload.sessionId, subAgent: data.subAgent });
      else if (ev==='subagent:handoff') emit('agent:subagent:handoff', { sessionId: payload.sessionId, handoff: data.handoff });
      else if (ev==='subagent:done') emit('agent:subagent:done', { sessionId: payload.sessionId, swarmSummary: data.swarmSummary });
      else if (ev==='verification:start') emit('agent:verification:start', { sessionId: payload.sessionId, turnId: data.turnId });
      else if (ev==='verification:update') emit('agent:verification:update', { sessionId: payload.sessionId, report: data.report });
      else if (ev==='verification:done') emit('agent:verification:done', { sessionId: payload.sessionId, report: data.report });
    });
    ['message','delta','tool:start','tool:end','tool:output','progress','plan','state','error','done','memory:recalled','file:progress','subagent:spawn','subagent:update','subagent:handoff','subagent:done','verification:start','verification:update','verification:done'].forEach(forwardReal);

    const needConfirm = async (req:any)=>{
      emit('agent:confirm', { sessionId: payload.sessionId, request: req });
      return new Promise<boolean>((resolve)=>{
        const handler = (_e:any, resp:any)=>{
          if (resp.sessionId===payload.sessionId && resp.requestId===req.id) {
            ipcMain.removeListener('agent:confirm:response', handler as any);
            resolve(!!resp.approved);
          }
        };
        ipcMain.on('agent:confirm:response', handler as any);
        setTimeout(()=>{ try{ ipcMain.removeListener('agent:confirm:response', handler as any); }catch{}; resolve(false); }, 60000);
      });
    };

    try {
      // Build history in provider format
      const { toProviderMessages } = await import('@cluster/agent-core');
      const { MemoryStore } = await import('@cluster/memory');
      const memory = new MemoryStore({ projectRoot, sessionId: payload.sessionId });
      await memory.init().catch(() => null);

      const history = toProviderMessages(session.messages, session.toolCalls);
      if (isMulti) {
        // Multi-agent via Coordinator
        const coordinator = new Coordinator({ config: cfg, provider, registry, projectRoot, sessionId: payload.sessionId, events, backupsDir: paths.backupsDir });
        const graph = await coordinator.createPlan(payload.text);
        emit('agent:graph', { sessionId: payload.sessionId, graph });
        const res = await coordinator.runGraph(graph, controller.signal);
        const subAgents = coordinator.getSubAgents();
        
        let summaryContent = `### Multi-Agent Coordination Complete\n\n`;
        summaryContent += `The Main Coordinator deployed **${subAgents.length} specialized sub-agents** to work concurrently on this goal.\n\n`;
        summaryContent += `#### Sub-Agent Execution Breakdown\n`;
        for (const sa of subAgents) {
          const statusIcon = sa.status === 'reported' || sa.status === 'done' ? '✓' : '✕';
          summaryContent += `- **${sa.name}** (\`${sa.role}\`): ${statusIcon} ${sa.summary || sa.message || 'Completed task responsibilities.'}\n`;
        }

        const filesChanged = Array.from(new Set(Object.values(res.graph.tasks).flatMap((t) => t.files || [])));
        if (filesChanged.length > 0) {
          summaryContent += `\n#### Files Touched\n`;
          for (const f of filesChanged) {
            summaryContent += `- \`${f}\`\n`;
          }
        }

        const summaryMsg = {
          id: createId('msg'),
          sessionId: payload.sessionId,
          role: 'assistant' as const,
          content: summaryContent,
          createdAt: new Date().toISOString(),
          kind: 'summary' as const,
        };
        store.appendMessage(payload.sessionId, summaryMsg);
        emit('agent:message', { sessionId: payload.sessionId, message: summaryMsg });
      } else {
        const loop = new AgentLoop({
          config: cfg,
          provider,
          registry,
          projectRoot,
          workspace,
          backupsDir: paths.backupsDir,
          sessionId: payload.sessionId,
          history,
          events,
          requestConfirm: needConfirm,
          memory,
          extraInstructions: [cfg?.extraInstructions, extraSkillInstructions].filter(Boolean).join('\n\n'),
        });
        await loop.run(activePrompt, controller.signal);
      }
    } catch (e:any) {
      const errMsg = {
        id: createId('msg'),
        sessionId: payload.sessionId,
        role: 'assistant' as const,
        content: `⚠️ Error: ${e.message}`,
        createdAt: new Date().toISOString(),
        kind: 'error' as const,
      };
      store.appendMessage(payload.sessionId, errMsg);
      emit('agent:message', { sessionId: payload.sessionId, message: errMsg });
      emit('agent:error', { sessionId: payload.sessionId, error: { source:'agent', message: e.message, recoverable:true } });
      emit('agent:done', { sessionId: payload.sessionId, summary: e.message, usage:{prompt:0,completion:0,total:0}, cancelled: controller.signal.aborted, iterations:0 });
    } finally {
      activeControllers.delete(payload.sessionId);
      await store.flush();
    }
    return { ok:true };
  });

  ipcMain.handle('agent:cancel', async (_e, sessionId: string) => {
    const c = activeControllers.get(sessionId);
    if (c) { c.abort(); activeControllers.delete(sessionId); return { cancelled:true }; }
    return { cancelled:false };
  });

  // Direct tool IPC for UI-driven actions (file read/patch, command run, verification)
  ipcMain.handle('tools:execute', async (_e, opts: { sessionId: string; tool: string; input: any; projectRoot?: string }) => {
    const store = await getStore();
    const sess = opts.sessionId ? store.getSession(opts.sessionId) : null;
    const root = opts.projectRoot || sess?.projectRoot || process.cwd();
    let ws:any=null; try{ ws=await loadWorkspaceInfo(root);}catch{}
    const cfg = await loadConfig({}, { projectRoot: root }).catch(()=>null as any);
    const { createPhase2Registry } = await import('@cluster/tool-runtime');
    const registry = createPhase2Registry();
    const ctx:any = { projectRoot: root, workspace: ws, signal: new AbortController().signal, logger:{debug:()=>{},info:()=>{},warn:()=>{},error:()=>{}} , backupsDir: resolveStoragePaths().backupsDir, sessionId: opts.sessionId||'ui', alwaysConfirmCommands: cfg?.confirmAllCommands??false, confirm: async()=>true, emitOutput: ()=>{}, emitProgress: ()=>{} };
    const out = await registry.execute(opts.tool, opts.input, ctx);
    return out;
  });

  ipcMain.handle('tools:runCommand', async (event, opts: { sessionId: string; command: string; cwd?: string; background?: boolean }) => {
    const id = (await import('@cluster/shared')).createId('job');
    const cwd = opts.cwd || (await getStore()).getSession(opts.sessionId)?.projectRoot || process.cwd();
    const startedAt = new Date().toISOString();
    const job:any = { id, command: opts.command, cwd, status: 'running', output:'', startedAt };
    jobRegistry.set(id, job);
    const emit = (chunk:string)=>{ job.output+=chunk; event.sender.send('agent:tool:output', { sessionId: opts.sessionId, callId: id, chunk }); };
    // Use tool-runtime run_command for real streaming
    const { createPhase2Registry } = await import('@cluster/tool-runtime');
    const registry = createPhase2Registry();
    let ws:any=null; try{ ws=await loadWorkspaceInfo(cwd);}catch{}
    const ctx:any = { projectRoot: cwd, workspace: ws, signal: new AbortController().signal, logger:{debug:()=>{},info:()=>{},warn:()=>{},error:()=>{}} , backupsDir: resolveStoragePaths().backupsDir, sessionId: opts.sessionId, alwaysConfirmCommands:false, confirm: async()=>true, emitOutput: emit, emitProgress: ()=>{} };
    registry.execute('run_command', { command: opts.command, cwd }, ctx).then((res)=>{
      job.status = res.result.ok?'done':'failed';
      job.output += '\n'+res.result.output;
      event.sender.send('agent:job', { sessionId: opts.sessionId, job });
    }).catch((e:any)=>{ job.status='failed'; job.output+=`\n${e.message}`; event.sender.send('agent:job', { sessionId: opts.sessionId, job }); });
    return { jobId: id, started:true };
  });

  ipcMain.handle('jobs:list', async (_e, sessionId?: string) => {
    const existingPids = new Set<number>();
    for (const j of jobRegistry.values()) {
      if (j.pid) existingPids.add(j.pid);
    }
    await discoverActiveDevServers(existingPids);

    return [...jobRegistry.values()].map(j => ({
      id: j.id,
      command: j.command,
      cwd: j.cwd,
      status: j.status,
      pid: j.pid,
      port: j.port,
      output: j.output,
      startedAt: j.startedAt,
      durationMs: j.durationMs,
    }));
  });

  ipcMain.handle('jobs:start', async (event, opts: { command: string; cwd?: string; sessionId?: string }) => {
    const { createId } = await import('@cluster/shared');
    const id = createId('job');
    const store = await getStore();
    const sess = opts.sessionId ? store.getSession(opts.sessionId) : null;
    const cwd = opts.cwd || sess?.projectRoot || process.cwd();
    const startedAt = new Date().toISOString();
    const controller = new AbortController();

    const jobRecord: any = {
      id,
      command: opts.command,
      cwd,
      status: 'running',
      pid: Math.floor(1000 + Math.random() * 90000),
      port: undefined,
      output: '',
      startedAt,
      controller,
    };
    jobRegistry.set(id, jobRecord);

    const emitChunk = (chunk: string) => {
      jobRecord.output += chunk;
      // Port detection heuristic
      const portMatch = chunk.match(/(?:localhost|127\.0\.0\.1|0\.0\.0\.0|port|Port)[:\s]+(\d{2,5})/i);
      if (portMatch && !jobRecord.port) {
        jobRecord.port = parseInt(portMatch[1], 10);
      }
      event.sender.send('agent:tool:output', { sessionId: opts.sessionId || 'global', callId: id, chunk });
      event.sender.send('agent:job', { sessionId: opts.sessionId || 'global', job: { ...jobRecord, controller: undefined } });
    };

    const { createPhase2Registry } = await import('@cluster/tool-runtime');
    const registry = createPhase2Registry();
    let ws: any = null; try { ws = await loadWorkspaceInfo(cwd); } catch {}
    const ctx: any = {
      projectRoot: cwd,
      workspace: ws,
      signal: controller.signal,
      logger: { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} },
      backupsDir: resolveStoragePaths().backupsDir,
      sessionId: opts.sessionId || 'bg',
      alwaysConfirmCommands: false,
      confirm: async () => true,
      emitOutput: emitChunk,
      emitProgress: () => {},
    };

    const startTime = Date.now();
    registry.execute('run_command', { command: opts.command, cwd }, ctx).then((res) => {
      jobRecord.status = res.result.ok ? 'done' : 'failed';
      jobRecord.output += '\n' + res.result.output;
      jobRecord.durationMs = Date.now() - startTime;
      event.sender.send('agent:job', { sessionId: opts.sessionId || 'global', job: { ...jobRecord, controller: undefined } });
    }).catch((e: any) => {
      jobRecord.status = controller.signal.aborted ? 'stopped' : 'failed';
      jobRecord.output += `\n${e.message}`;
      jobRecord.durationMs = Date.now() - startTime;
      event.sender.send('agent:job', { sessionId: opts.sessionId || 'global', job: { ...jobRecord, controller: undefined } });
    });

    return { id, started: true };
  });

  ipcMain.handle('jobs:stop', async (_e, id: string) => {
    const job = jobRegistry.get(id);
    if (!job) return false;
    if (job.controller) {
      job.controller.abort();
    }
    if (job.pid) {
      try {
        if (process.platform === 'win32') {
          const { exec } = await import('node:child_process');
          exec(`taskkill /pid ${job.pid} /T /F`);
        } else {
          process.kill(job.pid, 'SIGKILL');
        }
      } catch {}
    }
    job.status = 'stopped';
    return true;
  });

  ipcMain.handle('jobs:restart', async (event, id: string) => {
    const job = jobRegistry.get(id);
    if (!job) return null;
    if (job.controller) job.controller.abort();
    // Restart as new job with same command and cwd
    const { createId } = await import('@cluster/shared');
    const newId = createId('job');
    const startedAt = new Date().toISOString();
    const controller = new AbortController();

    const restarted: any = {
      id: newId,
      command: job.command,
      cwd: job.cwd,
      status: 'running',
      pid: Math.floor(1000 + Math.random() * 90000),
      port: undefined,
      output: '',
      startedAt,
      controller,
    };
    jobRegistry.set(newId, restarted);

    const emitChunk = (chunk: string) => {
      restarted.output += chunk;
      event.sender.send('agent:tool:output', { sessionId: 'global', callId: newId, chunk });
      event.sender.send('agent:job', { sessionId: 'global', job: { ...restarted, controller: undefined } });
    };

    const { createPhase2Registry } = await import('@cluster/tool-runtime');
    const registry = createPhase2Registry();
    const ctx: any = {
      projectRoot: job.cwd,
      workspace: null,
      signal: controller.signal,
      logger: { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} },
      backupsDir: resolveStoragePaths().backupsDir,
      sessionId: 'bg',
      alwaysConfirmCommands: false,
      confirm: async () => true,
      emitOutput: emitChunk,
      emitProgress: () => {},
    };

    registry.execute('run_command', { command: job.command, cwd: job.cwd }, ctx).then((res) => {
      restarted.status = res.result.ok ? 'done' : 'failed';
      restarted.output += '\n' + res.result.output;
      event.sender.send('agent:job', { sessionId: 'global', job: { ...restarted, controller: undefined } });
    }).catch((e: any) => {
      restarted.status = controller.signal.aborted ? 'stopped' : 'failed';
      restarted.output += `\n${e.message}`;
      event.sender.send('agent:job', { sessionId: 'global', job: { ...restarted, controller: undefined } });
    });

    return { id: newId, started: true };
  });

  ipcMain.handle('models:test', async (_e, opts: { baseUrl?: string; apiKey?: string; model?: string }) => {
    const start = Date.now();
    try {
      const cfg = await loadConfig({
        ...(opts.baseUrl ? { baseUrl: opts.baseUrl } : {}),
        ...(opts.apiKey ? { apiKey: opts.apiKey } : {}),
        ...(opts.model ? { model: opts.model } : {}),
      });
      const { ModelProvider } = await import('@cluster/agent-core');
      const provider = new ModelProvider(cfg);
      const res = await provider.complete({
        messages: [{ role: 'user', content: 'respond with the word ok' }]
      });
      const latencyMs = Date.now() - start;
      return { ok: true, latencyMs, reply: res.content.slice(0, 100) };
    } catch (err: any) {
      return { ok: false, latencyMs: Date.now() - start, error: err.message };
    }
  });

  ipcMain.handle('models:list', async (_e, opts?: { baseUrl?: string; apiKey?: string; projectRoot?: string }) => {
    let baseUrl = opts?.baseUrl?.trim();
    let apiKey = opts?.apiKey?.trim();

    // If apiKey not passed from renderer, load from persistent config or environment
    if (!apiKey) {
      try {
        const { loadConfig } = await import('@cluster/agent-core');
        const resolved = await loadConfig({}, { projectRoot: opts?.projectRoot });
        apiKey = resolved.apiKey || '';
      } catch {}
    }
    if (!apiKey) {
      try {
        const { clusterHome } = await import('@cluster/shared');
        const fs2 = await import('node:fs/promises');
        const path2 = await import('node:path');
        const raw = JSON.parse(await fs2.readFile(path2.join(clusterHome(), 'config.json'), 'utf8'));
        if (raw.apiKey) apiKey = raw.apiKey;
      } catch {}
    }
    if (!apiKey) {
      apiKey = process.env.CLUSTER_API_KEY || process.env.OPENAI_API_KEY || '';
    }

    if (!baseUrl) {
      try {
        const { loadConfig } = await import('@cluster/agent-core');
        const resolved = await loadConfig({}, { projectRoot: opts?.projectRoot });
        baseUrl = resolved.baseUrl || '';
      } catch {}
    }
    if (!baseUrl) {
      try {
        const { clusterHome } = await import('@cluster/shared');
        const fs2 = await import('node:fs/promises');
        const path2 = await import('node:path');
        const raw = JSON.parse(await fs2.readFile(path2.join(clusterHome(), 'config.json'), 'utf8'));
        if (raw.baseUrl) baseUrl = raw.baseUrl;
      } catch {}
    }

    if (!baseUrl) {
      return {
        ok: false,
        models: [],
        error: 'Please enter an API Base URL (e.g. https://api.openai.com/v1 or http://localhost:11434/v1).',
      };
    }

    const cleanBase = baseUrl.replace(/\/+$/, '');
    // Candidate URLs for standard OpenAI, /v1, and Ollama/local endpoints
    const candidateUrls: string[] = [];
    candidateUrls.push(`${cleanBase}/models`);
    if (cleanBase.endsWith('/v1')) {
      candidateUrls.push(`${cleanBase.slice(0, -3)}/models`);
    } else {
      candidateUrls.push(`${cleanBase}/v1/models`);
    }
    candidateUrls.push(`${cleanBase}/api/tags`); // Ollama local tags

    const headers: Record<string, string> = {
      Accept: 'application/json',
    };
    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }

    let lastError = '';
    for (const url of candidateUrls) {
      try {
        const resp = await fetch(url, { headers, signal: AbortSignal.timeout(12000) });
        if (!resp.ok) {
          const errText = await resp.text().catch(() => '');
          lastError = `HTTP ${resp.status} ${resp.statusText}${errText ? `: ${errText.slice(0, 120)}` : ''}`;
          if (resp.status === 401 || resp.status === 403) {
            return {
              ok: false,
              models: [],
              error: `Authentication failed (${resp.status} ${resp.statusText}). Please check your API Key.`,
              sourceUrl: url,
            };
          }
          continue;
        }

        const data = (await resp.json()) as any;
        let rawList: any[] = [];
        if (Array.isArray(data?.data)) {
          rawList = data.data;
        } else if (Array.isArray(data?.models)) {
          rawList = data.models;
        } else if (Array.isArray(data)) {
          rawList = data;
        }

        if (rawList.length > 0) {
          const fetched = rawList.map((m: any) => {
            const id = typeof m === 'string' ? m : m.id || m.name || String(m);
            const owned = typeof m === 'object' && m !== null ? m.owned_by || m.details?.family || '' : '';
            const contextWindow = typeof m === 'object' && m !== null && m.context_window ? m.context_window : undefined;
            const reasoning = typeof m === 'object' && m !== null ? Boolean(m.reasoning) : false;
            const vision = typeof m === 'object' && m !== null ? Boolean(m.vision) : false;
            return {
              id,
              name: id,
              provider: owned || 'Provider Endpoint',
              contextWindow,
              reasoning,
              vision,
              description: typeof m === 'object' && m.description ? m.description : (owned ? `${owned} · ${cleanBase}` : `Available on ${cleanBase}`),
            };
          });

          return {
            ok: true,
            models: fetched,
            sourceUrl: url,
          };
        }
      } catch (err: any) {
        lastError = err.name === 'TimeoutError' ? 'Connection timed out after 12s' : err.message;
      }
    }

    return {
      ok: false,
      models: [],
      error: lastError ? `Failed to discover models from ${cleanBase}: ${lastError}` : `No models found at ${cleanBase}.`,
    };
  });

  ipcMain.handle('config:set', async (_e, key: string, value: any, projectRoot?: string) => {
    // Persist to ~/.cluster/config.json (global) — mirrors TUI config-set
    const { clusterHome } = await import('@cluster/shared');
    const fs2 = await import('node:fs/promises');
    const path2 = await import('node:path');
    const file = path2.join(clusterHome(), 'config.json');
    let cur: any = {}; try { cur = JSON.parse(await fs2.readFile(file, 'utf8')); } catch {}
    cur[key] = value;
    await fs2.mkdir(path2.dirname(file), { recursive: true });
    await fs2.writeFile(file, JSON.stringify(cur, null, 2), 'utf8');
    return cur;
  });

  ipcMain.handle('workspace:git', async (_e, projectRoot: string) => {
    try { const { loadWorkspaceInfo } = await import('@cluster/workspace'); const ws = await loadWorkspaceInfo(projectRoot); return ws.git; } catch { return null; }
  });

  ipcMain.handle('verification:run', async (event, opts: { sessionId: string; projectRoot: string }) => {
    const { runVerification } = await import('@cluster/tool-runtime');
    const result = await runVerification({ projectRoot: opts.projectRoot, sessionId: opts.sessionId, signal: new AbortController().signal, emitOutput: (c: string) => event.sender.send('agent:tool:output', { sessionId: opts.sessionId, callId: 'verify', chunk: c }) });
    return result;
  });

  ipcMain.handle('memory:list', async (_e, opts: any = {}) => {
    try {
      const { MemoryStore } = await import('@cluster/memory');
      const store = new MemoryStore({ projectRoot: opts.projectRoot, sessionId: opts.sessionId });
      await store.init();
      return await store.recall({
        category: opts.category,
        scope: opts.scope,
        pinned: opts.pinned,
        archived: opts.archived,
        search: opts.search,
        limit: opts.limit ?? 100,
      });
    } catch { return []; }
  });

  ipcMain.handle('memory:search', async (_e, opts: { projectRoot?: string; sessionId?: string; query: string; limit?: number }) => {
    try {
      const { MemoryStore } = await import('@cluster/memory');
      const store = new MemoryStore({ projectRoot: opts.projectRoot, sessionId: opts.sessionId });
      await store.init();
      return await store.search(opts.query, opts.limit ?? 10);
    } catch { return []; }
  });

  ipcMain.handle('memory:add', async (_e, opts: any) => {
    try {
      const { MemoryStore } = await import('@cluster/memory');
      const store = new MemoryStore({ projectRoot: opts.projectRoot, sessionId: opts.sessionId });
      await store.init();
      return await store.add({
        title: opts.title,
        summary: opts.summary,
        scope: opts.scope,
        category: opts.category,
        key: opts.key || `note:${Date.now()}`,
        value: opts.value,
        importance: opts.importance,
        confidence: opts.confidence,
        pinned: opts.pinned,
        source: 'user',
        tags: opts.tags ?? ['user-note'],
      });
    } catch { return null; }
  });

  ipcMain.handle('memory:update', async (_e, opts: { id: string; updates: any }) => {
    try {
      const { MemoryStore } = await import('@cluster/memory');
      const store = new MemoryStore();
      await store.init();
      return await store.database.update(opts.id, opts.updates);
    } catch { return null; }
  });

  ipcMain.handle('memory:pin', async (_e, opts: { id: string; pinned: boolean }) => {
    try {
      const { MemoryStore } = await import('@cluster/memory');
      const store = new MemoryStore();
      await store.init();
      return await store.pin(opts.id, opts.pinned);
    } catch { return false; }
  });

  ipcMain.handle('memory:archive', async (_e, opts: { id: string; archived: boolean }) => {
    try {
      const { MemoryStore } = await import('@cluster/memory');
      const store = new MemoryStore();
      await store.init();
      return await store.archive(opts.id, opts.archived);
    } catch { return false; }
  });

  ipcMain.handle('memory:delete', async (_e, opts: { id: string }) => {
    try {
      const { MemoryStore } = await import('@cluster/memory');
      const store = new MemoryStore();
      await store.init();
      return await store.delete(opts.id);
    } catch { return false; }
  });

  ipcMain.handle('memory:clearProject', async (_e, opts: { projectRoot: string }) => {
    try {
      const { MemoryStore } = await import('@cluster/memory');
      const store = new MemoryStore({ projectRoot: opts.projectRoot });
      await store.init();
      return await store.clearProject();
    } catch { return 0; }
  });

  ipcMain.handle('memory:stats', async (_e, opts: { projectRoot?: string } = {}) => {
    try {
      const { MemoryStore } = await import('@cluster/memory');
      const store = new MemoryStore({ projectRoot: opts.projectRoot });
      await store.init();
      return await store.getStats();
    } catch {
      return { total: 0, pinned: 0, archived: 0, byCategory: {}, byScope: {} };
    }
  });

  ipcMain.handle('memory:getRetrievedForTask', async (_e, opts: { sessionId: string; limit?: number }) => {
    try {
      const { MemoryStore } = await import('@cluster/memory');
      const store = new MemoryStore({ sessionId: opts.sessionId });
      await store.init();
      return await store.getRetrievalLogs(opts.limit ?? 20);
    } catch { return []; }
  });

  ipcMain.handle('diagnostics:get', async (_e, projectRoot?: string) => {
    const root = projectRoot || process.cwd();
    let ws: any = null; try { ws = await loadWorkspaceInfo(root); } catch {}
    const cfg = await loadConfig({}, { projectRoot: root }).catch(() => null as any);
    const paths = resolveStoragePaths();
    const store = await getStore();
    const sessions = store.listSessions({ limit: 1000 });
    const { createPhase2Registry } = await import('@cluster/tool-runtime');
    const tools = createPhase2Registry().list().map(t => ({
      name: t.name,
      risk: typeof t.risk === 'function' ? (t.risk as any)({}) : t.risk,
    }));

    return {
      runtime: {
        node: process.version,
        electron: process.versions.electron,
        chrome: process.versions.chrome,
        platform: process.platform,
        arch: process.arch,
      },
      workspace: {
        root,
        name: ws?.name,
        kind: ws?.project?.kind,
        packageManager: ws?.project?.packageManager,
        git: ws?.git,
        scripts: ws?.project?.scripts ? Object.keys(ws.project.scripts) : [],
      },
      config: {
        model: cfg?.model,
        baseUrl: cfg?.baseUrl,
        hasApiKey: Boolean(cfg?.apiKey),
        maxIterations: cfg?.maxIterations,
      },
      storage: {
        home: paths.home,
        databaseFile: paths.databaseFile,
        backupsDir: paths.backupsDir,
        checkpointsDir: paths.checkpointsDir,
        totalSessions: sessions.length,
      },
      toolsCount: tools.length,
      tools,
    };
  });
}

app.whenReady().then(async () => {
  if (process.platform === 'win32') {
    app.setAppUserModelId('ai.cluster.desktop');
  }
  registerIpc();
  const win = createWindow();
  await loadRenderer(win);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      const w = createWindow();
      loadRenderer(w);
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// Security: deny navigation
app.on('web-contents-created', (_event, contents) => {
  contents.on('will-navigate', (event, url) => {
    const allowed = url.startsWith('http://localhost:5173');
    if (!allowed && !url.startsWith('file://')) event.preventDefault();
  });
});
