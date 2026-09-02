/// <reference types="vite/client" />

interface ClusterAPI {
  sessions: {
    list: (filter?: any) => Promise<any[]>;
    get: (id: string) => Promise<any>;
    create: (opts: any) => Promise<any>;
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
    get: (root?: string) => Promise<any>;
    set: (key:string, value:any, projectRoot?:string)=>Promise<any>;
  };
  checkpoints: {
    list: (sid: string) => Promise<any[]>;
    create: (opts: any) => Promise<any>;
    rollback: (opts: any) => Promise<any>;
  };
  app: { info: () => Promise<any>; };
  shell: { openPath: (p: string) => Promise<string>; };
  dialog: { openDirectory: () => Promise<string|null>; };
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
    list: (opts?: any) => Promise<any[]>;
    search: (opts: { projectRoot?: string; sessionId?: string; query: string; limit?: number }) => Promise<any[]>;
    add: (opts: any) => Promise<any>;
    update: (opts: { id: string; updates: any }) => Promise<any>;
    pin: (opts: { id: string; pinned: boolean }) => Promise<boolean>;
    archive: (opts: { id: string; archived: boolean }) => Promise<boolean>;
    delete: (opts: { id: string }) => Promise<boolean>;
    clearProject: (opts: { projectRoot: string }) => Promise<number>;
    stats: (opts?: { projectRoot?: string }) => Promise<any>;
    getRetrievedForTask: (opts: { sessionId: string; limit?: number }) => Promise<any[]>;
  };
  diagnostics: {
    get: (projectRoot?: string) => Promise<any>;
  };
  agent: {
    send: (payload: any) => Promise<any>;
    cancel: (sid: string) => Promise<any>;
    confirm: (sessionId:string, requestId:string, approved:boolean)=>void;
    onMemoryRecalled: (cb: (d:any)=>void) => () => void;
    onMessage: (cb: (d:any)=>void) => () => void;
    onDelta: (cb: (d:any)=>void) => () => void;
    onToolStart: (cb: (d:any)=>void) => () => void;
    onToolEnd: (cb: (d:any)=>void) => () => void;
    onToolOutput: (cb:(data:any)=>void)=>()=>void;
    onProgress: (cb: (d:any)=>void) => () => void;
    onState: (cb: (d:any)=>void) => () => void;
    onPlan: (cb: (d:any)=>void) => () => void;
    onGraph: (cb:(data:any)=>void)=>()=>void;
    onEdit: (cb:(data:any)=>void)=>()=>void;
    onJob: (cb:(data:any)=>void)=>()=>void;
    onError: (cb:(data:any)=>void)=>()=>void;
    onConfirm: (cb:(data:any)=>void)=>()=>void;
    onDone: (cb: (d:any)=>void) => () => void;
  };
}

interface Window {
  cluster: ClusterAPI;
}
