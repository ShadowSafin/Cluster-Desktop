import path from 'node:path';
import fs from 'node:fs/promises';
import dotenv from 'dotenv';
import {
  closeLogger,
  getLogger,
  type Session,
  type WorkspaceInfo,
} from '@cluster/shared';
import { detectProjectRoot, loadWorkspaceInfo, watchWorkspace, type WorkspaceWatcher } from '@cluster/workspace';
import { resolveStoragePaths, SessionStore } from '@cluster/storage';
import { createDefaultRegistry, createPhase2Registry, type ToolRegistry } from '@cluster/tool-runtime';
import {
  loadConfig,
  ModelProvider,
  type AgentConfig,
  Coordinator,
  type AgentEvents,
} from '@cluster/agent-core';
import { ContextEngine } from '@cluster/context-engine';
import { MemoryStore } from '@cluster/memory';
import { Emitter } from '@cluster/shared';

/**
 * Application bootstrap.
 *
 * Assembles everything the TUI needs before the first render: configuration,
 * project detection, the session store, the tool registry and the model
 * provider. Keeping it here means the components stay free of setup logic.
 */

export interface BootstrapOptions {
  cwd?: string;
  model?: string;
  baseUrl?: string;
  apiKey?: string;
  /** Resume this session id. */
  sessionId?: string;
  /** Continue the most recent session for this project. */
  continueSession?: boolean;
  /** Title for a newly created session. */
  title?: string;
  /** Watch the filesystem for changes (on by default). */
  watch?: boolean;
}

export interface Bootstrap {
  projectRoot: string;
  workspace: WorkspaceInfo;
  config: AgentConfig;
  store: SessionStore;
  registry: ToolRegistry;
  phase2Registry: ToolRegistry;
  provider: ModelProvider;
  backupsDir: string;
  session: Session;
  watcher: WorkspaceWatcher | null;
  /** True when the session was loaded from disk rather than created. */
  resumed: boolean;
  /** Phase 2 subsystems */
  contextEngine: ContextEngine;
  memory: MemoryStore;
  coordinator: Coordinator;
  events: Emitter<AgentEvents>;
  close(): Promise<void>;
}

/** Load .env files without letting a missing file raise. */
function loadEnvFiles(directories: string[]): void {
  for (const directory of directories) {
    dotenv.config({ path: path.join(directory, '.env'), override: false });
  }
}

export async function createBootstrap(options: BootstrapOptions = {}): Promise<Bootstrap> {
  const logger = getLogger('bootstrap');
  const cwd = path.resolve(options.cwd ?? process.cwd());

  // Load environment in two passes: the working directory first so credentials
  // are available, then the detected project root.
  loadEnvFiles([cwd]);

  const detected = await detectProjectRoot(cwd);
  const projectRoot = detected.root;
  if (projectRoot !== cwd) loadEnvFiles([projectRoot]);

  logger.info({ projectRoot, marker: detected.marker }, 'project root detected');

  const config = await loadConfig(
    {
      ...(options.model ? { model: options.model } : {}),
      ...(options.baseUrl ? { baseUrl: options.baseUrl } : {}),
      ...(options.apiKey ? { apiKey: options.apiKey } : {}),
    },
    { projectRoot },
  );

  const store = await SessionStore.open();
  const paths = resolveStoragePaths(store.paths.home);
  await fs.mkdir(paths.backupsDir, { recursive: true });

  const workspace = await loadWorkspaceInfo(projectRoot);

  let session: Session | null = null;
  let resumed = false;

  if (options.sessionId) {
    session = store.getSession(options.sessionId);
    if (session) resumed = true;
    else logger.warn({ sessionId: options.sessionId }, 'requested session not found');
  } else if (options.continueSession) {
    session = store.latestSession(projectRoot);
    if (session) resumed = true;
  }

  if (!session) {
    session = store.createSession({
      projectRoot,
      model: config.model,
      title: options.title,
    });
  }

  store.setWorkspace(session.id, workspace);
  store.updateState(session.id, { model: config.model });
  await store.flush();

  const registry = createDefaultRegistry();
  const phase2Registry = createPhase2Registry();
  const provider = new ModelProvider(config);

  // Phase 2 engines
  const contextEngine = new ContextEngine({ projectRoot });
  const memory = new MemoryStore({ projectRoot, sessionId: session.id });
  await memory.init().catch(() => undefined);
  const events = new Emitter<AgentEvents>((error) => getLogger('bootstrap').warn({ error }, 'event handler error'));
  const coordinator = new Coordinator({
    config,
    provider,
    registry: phase2Registry,
    projectRoot,
    sessionId: session.id,
    events,
    backupsDir: paths.backupsDir,
  });

  const watcher =
    options.watch === false
      ? null
      : watchWorkspace(projectRoot);

  return {
    projectRoot,
    workspace,
    config,
    store,
    registry,
    phase2Registry,
    provider,
    backupsDir: paths.backupsDir,
    session,
    watcher,
    resumed,
    contextEngine,
    memory,
    coordinator,
    events,
    async close() {
      await watcher?.close().catch(() => undefined);
      await store.flush().catch(() => undefined);
      await memory.persist().catch(() => undefined);
      await closeLogger().catch(() => undefined);
    },
  };
}
