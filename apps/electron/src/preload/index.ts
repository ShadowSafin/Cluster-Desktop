import { contextBridge, ipcRenderer } from 'electron';
console.log('[Cluster] preload: loading bridge');
// Ensure we are in correct context
if (typeof contextBridge === 'undefined') {
  console.error('[Cluster] preload: contextBridge missing');
}

export type IpcApi = {
  sessions: {
    list: (filter?: { projectRoot?: string; limit?: number; all?: boolean }) => Promise<any[]>;
    get: (id: string) => Promise<any>;
    create: (opts: { projectRoot: string; model?: string; title?: string }) => Promise<any>;
    delete: (id: string) => Promise<boolean>;
    rename: (id: string, title: string) => Promise<any>;
    onUpdated: (cb: (data:any)=>void)=>()=>void;
  };
  workspace: {
    info: (root: string) => Promise<any>;
    detect: (cwd?: string) => Promise<any>;
    git: (root: string)=>Promise<any>;
  };
  storage: { paths: () => Promise<any>; };
  config: {
    get: (projectRoot?: string) => Promise<any>;
    set: (key:string, value:any, projectRoot?:string)=>Promise<any>;
  };
  checkpoints: {
    list: (sessionId: string) => Promise<any[]>;
    create: (opts: { sessionId: string; projectRoot: string; message?: string }) => Promise<any>;
    rollback: (opts: { sessionId: string; checkpointId: string; projectRoot: string }) => Promise<any>;
  };
  app: { info: () => Promise<any>; };
  shell: { openPath: (p: string) => Promise<string>; };
  dialog: { openDirectory: () => Promise<string | null>; };
  tools: {
    execute: (opts:{ sessionId:string; tool:string; input:any; projectRoot?:string})=>Promise<any>;
    runCommand: (opts:{ sessionId:string; command:string; cwd?:string; background?:boolean})=>Promise<any>;
  };
  jobs: {
    list: (sessionId?: string) => Promise<any[]>;
    start: (opts: { command: string; cwd?: string; sessionId?: string }) => Promise<any>;
    stop: (id: string) => Promise<boolean>;
    restart: (id: string) => Promise<any>;
  };
  models: {
    list: (opts?: { baseUrl?: string; apiKey?: string; projectRoot?: string }) => Promise<{ ok: boolean; models: any[]; error?: string; sourceUrl?: string }>;
    test: (opts: { baseUrl?: string; apiKey?: string; model?: string }) => Promise<{ ok: boolean; latencyMs: number; reply?: string; error?: string }>;
  };
  verification: { run: (opts: { sessionId: string; projectRoot: string }) => Promise<any>; };
  memory: {
    list: (opts: { projectRoot?: string; sessionId?: string; category?: string; scope?: string; pinned?: boolean; archived?: boolean; search?: string; limit?: number }) => Promise<any[]>;
    search: (opts: { projectRoot?: string; sessionId?: string; query: string; limit?: number }) => Promise<any[]>;
    add: (opts: { projectRoot?: string; sessionId?: string; title?: string; summary?: string; scope?: string; category?: string; key?: string; value: string; importance?: number; pinned?: boolean; tags?: string[] }) => Promise<any>;
    update: (opts: { id: string; updates: any }) => Promise<any>;
    pin: (opts: { id: string; pinned: boolean }) => Promise<boolean>;
    archive: (opts: { id: string; archived: boolean }) => Promise<boolean>;
    delete: (opts: { id: string }) => Promise<boolean>;
    clearProject: (opts: { projectRoot: string }) => Promise<number>;
    stats: (opts: { projectRoot?: string }) => Promise<any>;
    getRetrievedForTask: (opts: { sessionId: string; limit?: number }) => Promise<any[]>;
  };
  diagnostics: {
    get: (projectRoot?: string) => Promise<any>;
  };
  agent: {
    send: (payload: { sessionId: string; text: string; mode?: 'single'|'multi' }) => Promise<any>;
    cancel: (sessionId: string) => Promise<any>;
    confirm: (sessionId:string, requestId:string, approved:boolean)=>void;
    onMemoryRecalled: (cb: (data: { sessionId: string; memories: any[] })=>void) => () => void;
    onMessage: (cb: (data: any) => void) => () => void;
    onDelta: (cb: (data: any) => void) => () => void;
    onToolStart: (cb: (data: any) => void) => () => void;
    onToolEnd: (cb: (data: any) => void) => () => void;
    onToolOutput: (cb:(data:any)=>void)=>()=>void;
    onProgress: (cb: (data: any) => void) => () => void;
    onState: (cb: (data: any) => void) => () => void;
    onPlan: (cb: (data: any) => void) => () => void;
    onGraph: (cb:(data:any)=>void)=>()=>void;
    onEdit: (cb:(data:any)=>void)=>()=>void;
    onJob: (cb:(data:any)=>void)=>()=>void;
    onError: (cb:(data:any)=>void)=>()=>void;
    onConfirm: (cb:(data:any)=>void)=>()=>void;
    onDone: (cb: (data: any) => void) => () => void;
  };
};

const api: IpcApi = {
  sessions: {
    list: (filter) => ipcRenderer.invoke('sessions:list', filter),
    get: (id) => ipcRenderer.invoke('sessions:get', id),
    create: (opts) => ipcRenderer.invoke('sessions:create', opts),
    delete: (id) => ipcRenderer.invoke('sessions:delete', id),
    rename: (id, title) => ipcRenderer.invoke('sessions:rename', id, title),
    onUpdated: (cb)=>{
      const h=(_e:any,d:any)=>cb(d);
      ipcRenderer.on('sessions:updated',h);
      return ()=>ipcRenderer.removeListener('sessions:updated',h);
    },
  },
  workspace: {
    info: (root) => ipcRenderer.invoke('workspace:info', root),
    detect: (cwd) => ipcRenderer.invoke('workspace:detect', cwd),
    git: (root)=> ipcRenderer.invoke('workspace:git', root),
  },
  storage: { paths: () => ipcRenderer.invoke('storage:paths'), },
  config: {
    get: (root) => ipcRenderer.invoke('config:get', root),
    set: (key, value, root)=> ipcRenderer.invoke('config:set', key, value, root),
  },
  checkpoints: {
    list: (sid) => ipcRenderer.invoke('checkpoints:list', sid),
    create: (opts) => ipcRenderer.invoke('checkpoints:create', opts),
    rollback: (opts) => ipcRenderer.invoke('checkpoints:rollback', opts),
  },
  app: { info: () => ipcRenderer.invoke('app:info'), },
  shell: { openPath: (p) => ipcRenderer.invoke('shell:openPath', p), },
  dialog: { openDirectory: () => ipcRenderer.invoke('dialog:openDirectory'), },
  tools: {
    execute: (opts)=> ipcRenderer.invoke('tools:execute', opts),
    runCommand: (opts)=> ipcRenderer.invoke('tools:runCommand', opts),
  },
  jobs: {
    list: (sid)=> ipcRenderer.invoke('jobs:list', sid),
    start: (opts) => ipcRenderer.invoke('jobs:start', opts),
    stop: (id) => ipcRenderer.invoke('jobs:stop', id),
    restart: (id) => ipcRenderer.invoke('jobs:restart', id),
  },
  models: {
    list: (opts) => ipcRenderer.invoke('models:list', opts),
    test: (opts) => ipcRenderer.invoke('models:test', opts),
  },
  verification: { run: (opts)=> ipcRenderer.invoke('verification:run', opts), },
  memory: {
    list: (opts)=> ipcRenderer.invoke('memory:list', opts),
    search: (opts) => ipcRenderer.invoke('memory:search', opts),
    add: (opts) => ipcRenderer.invoke('memory:add', opts),
    update: (opts) => ipcRenderer.invoke('memory:update', opts),
    pin: (opts) => ipcRenderer.invoke('memory:pin', opts),
    archive: (opts) => ipcRenderer.invoke('memory:archive', opts),
    delete: (opts) => ipcRenderer.invoke('memory:delete', opts),
    clearProject: (opts) => ipcRenderer.invoke('memory:clearProject', opts),
    stats: (opts) => ipcRenderer.invoke('memory:stats', opts),
    getRetrievedForTask: (opts) => ipcRenderer.invoke('memory:getRetrievedForTask', opts),
  },
  diagnostics: {
    get: (root) => ipcRenderer.invoke('diagnostics:get', root),
  },
  agent: {
    send: (payload) => ipcRenderer.invoke('agent:send', payload),
    cancel: (sid) => ipcRenderer.invoke('agent:cancel', sid),
    confirm: (sessionId, requestId, approved)=> ipcRenderer.send('agent:confirm:response', { sessionId, requestId, approved }),
    onMemoryRecalled: (cb) => { const h = (_e: any, d: any) => cb(d); ipcRenderer.on('agent:memory:recalled', h); return () => ipcRenderer.removeListener('agent:memory:recalled', h); },
    onMessage: (cb) => { const h = (_e: any, d: any) => cb(d); ipcRenderer.on('agent:message', h); return () => ipcRenderer.removeListener('agent:message', h); },
    onDelta: (cb) => { const h = (_e: any, d: any) => cb(d); ipcRenderer.on('agent:delta', h); return () => ipcRenderer.removeListener('agent:delta', h); },
    onToolStart: (cb) => { const h = (_e: any, d: any) => cb(d); ipcRenderer.on('agent:tool:start', h); return () => ipcRenderer.removeListener('agent:tool:start', h); },
    onToolEnd: (cb) => { const h = (_e: any, d: any) => cb(d); ipcRenderer.on('agent:tool:end', h); return () => ipcRenderer.removeListener('agent:tool:end', h); },
    onToolOutput: (cb)=>{ const h=(_e:any,d:any)=>cb(d); ipcRenderer.on('agent:tool:output',h); return ()=>ipcRenderer.removeListener('agent:tool:output',h); },
    onProgress: (cb) => { const h = (_e: any, d: any) => cb(d); ipcRenderer.on('agent:progress', h); return () => ipcRenderer.removeListener('agent:progress', h); },
    onState: (cb) => { const h = (_e: any, d: any) => cb(d); ipcRenderer.on('agent:state', h); return () => ipcRenderer.removeListener('agent:state', h); },
    onPlan: (cb) => { const h = (_e: any, d: any) => cb(d); ipcRenderer.on('agent:plan', h); return () => ipcRenderer.removeListener('agent:plan', h); },
    onGraph: (cb)=>{ const h=(_e:any,d:any)=>cb(d); ipcRenderer.on('agent:graph',h); return ()=>ipcRenderer.removeListener('agent:graph',h); },
    onEdit: (cb)=>{ const h=(_e:any,d:any)=>cb(d); ipcRenderer.on('agent:edit',h); return ()=>ipcRenderer.removeListener('agent:edit',h); },
    onJob: (cb)=>{ const h=(_e:any,d:any)=>cb(d); ipcRenderer.on('agent:job',h); return ()=>ipcRenderer.removeListener('agent:job',h); },
    onError: (cb)=>{ const h=(_e:any,d:any)=>cb(d); ipcRenderer.on('agent:error',h); return ()=>ipcRenderer.removeListener('agent:error',h); },
    onConfirm: (cb)=>{ const h=(_e:any,d:any)=>cb(d); ipcRenderer.on('agent:confirm',h); return ()=>ipcRenderer.removeListener('agent:confirm',h); },
    onDone: (cb) => { const h = (_e: any, d: any) => cb(d); ipcRenderer.on('agent:done', h); return () => ipcRenderer.removeListener('agent:done', h); },
  },
};

contextBridge.exposeInMainWorld('cluster', api);

declare global {
  interface Window {
    cluster: IpcApi;
  }
}
