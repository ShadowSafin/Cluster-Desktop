#!/usr/bin/env node
import path from 'node:path';
import fs from 'node:fs/promises';
import React from 'react';
import { Command } from 'commander';
import { render } from 'ink';
import dotenv from 'dotenv';
import { clusterHome } from '@cluster/shared';
import { detectProjectRoot, loadWorkspaceInfo } from '@cluster/workspace';
import { SessionStore, resolveStoragePaths } from '@cluster/storage';
import { createDefaultRegistry } from '@cluster/tool-runtime';
import { diagnoseConfig, loadConfig, ModelProvider, type AgentConfig } from '@cluster/agent-core';
import { createBootstrap } from './bootstrap.js';
import { App } from './App.js';
import { SelectList } from './components/SelectList.js';

const VERSION = '0.1.0';

// Load .env from the working directory before anything reads configuration.
dotenv.config();

const program = new Command();

/* -------------------------------------------------------------------------- */
/* Helpers                                                                     */
/* -------------------------------------------------------------------------- */

function maskKey(key: string): string {
  if (!key) return '(not set)';
  if (key.length <= 8) return '•'.repeat(key.length);
  return `${key.slice(0, 4)}${'•'.repeat(8)}${key.slice(-4)}`;
}

async function resolveRoot(cwd?: string): Promise<string> {
  const detected = await detectProjectRoot(cwd ? path.resolve(cwd) : process.cwd());
  return detected.root;
}

/** Launch the full TUI for a session. */
async function startTui(options: {
  cwd?: string;
  model?: string;
  baseUrl?: string;
  sessionId?: string;
  continueSession?: boolean;
  title?: string;
  watch?: boolean;
}): Promise<void> {
  if (!process.stdout.isTTY) {
    console.error(
      'cluster needs an interactive terminal. Run it from a TTY, or use `cluster doctor` / `cluster sessions` for non-interactive checks.',
    );
    process.exitCode = 1;
    return;
  }

  const bootstrap = await createBootstrap(options);

  const { waitUntilExit } = render(
    React.createElement(App, { bootstrap, onExit: () => undefined }),
    // Ctrl+C is handled inside the app so the first press cancels work and a
    // second press exits, instead of killing the process mid-write.
    { exitOnCtrlC: false },
  );

  await waitUntilExit();
}

/* -------------------------------------------------------------------------- */
/* Commands                                                                    */
/* -------------------------------------------------------------------------- */

program
  .name('cluster')
  .description('Cluster CLI — a terminal-first AI coding assistant')
  .version(VERSION);

program
  .command('start', { isDefault: true })
  .description('start the interactive TUI (default command)')
  .option('-c, --cwd <dir>', 'project directory (defaults to the detected project root)')
  .option('-m, --model <model>', 'model name')
  .option('--base-url <url>', 'OpenAI-compatible API base URL')
  .option('-s, --session <id>', 'resume a specific session id')
  .option('--continue', 'continue the most recent session for this project')
  .option('--title <title>', 'title for a new session')
  .option('--no-watch', 'disable filesystem watching')
  .action(async (options) => {
    await startTui({
      cwd: options.cwd,
      model: options.model,
      baseUrl: options.baseUrl,
      sessionId: options.session,
      continueSession: Boolean(options.continue),
      title: options.title,
      watch: options.watch !== false,
    });
  });

program
  .command('resume [id]')
  .description('resume a saved session (omit the id to pick from a list)')
  .option('-c, --cwd <dir>', 'project directory')
  .action(async (id, options) => {
    const root = await resolveRoot(options.cwd);
    const store = await SessionStore.open();

    if (id) {
      const session = store.getSession(id);
      if (!session) {
        console.error(`Session not found: ${id}`);
        console.error('Run `cluster sessions` to list available sessions.');
        process.exitCode = 1;
        return;
      }
      await startTui({ cwd: options.cwd, sessionId: id });
      return;
    }

    const sessions = store.listSessions({ projectRoot: root });
    if (sessions.length === 0) {
      console.error('No saved sessions for this project.');
      process.exitCode = 1;
      return;
    }

    const items = sessions.map((session) => ({
      id: session.id,
      label: session.title,
      detail: `${session.messageCount} msgs · ${new Date(session.updatedAt).toLocaleString()}`,
    }));

    const selected = await new Promise<string | null>((resolve) => {
      const { unmount } = render(
        React.createElement(SelectList, {
          title: 'Resume a session',
          items,
          onSelect: (value) => {
            unmount();
            resolve(value);
          },
          onCancel: () => {
            unmount();
            resolve(null);
          },
        }),
      );
    });

    if (!selected) return;
    await startTui({ cwd: options.cwd, sessionId: selected });
  });

program
  .command('sessions')
  .description('list saved sessions')
  .option('-c, --cwd <dir>', 'project directory')
  .option('-a, --all', 'show sessions for all projects')
  .option('-n, --limit <count>', 'maximum number of sessions', '20')
  .action(async (options) => {
    const store = await SessionStore.open();
    const root = options.all ? undefined : await resolveRoot(options.cwd);
    const sessions = store.listSessions({ ...(root ? { projectRoot: root } : {}), limit: Number(options.limit) });

    if (sessions.length === 0) {
      console.log('No saved sessions.');
      return;
    }

    console.log(`${sessions.length} session(s)\n`);
    for (const session of sessions) {
      const updated = new Date(session.updatedAt).toLocaleString();
      console.log(
        `  ${session.id}  ${session.title}\n` +
          `      ${session.projectRoot}\n` +
          `      ${session.messageCount} messages · ${session.toolCallCount} tool calls · ` +
          `${session.editCount} edits · ${session.model} · ${updated}\n`,
      );
    }
  });

program
  .command('config')
  .description('show effective configuration')
  .option('-c, --cwd <dir>', 'project directory')
  .action(async (options) => {
    const root = await resolveRoot(options.cwd);
    const config = await loadConfig({}, { projectRoot: root });
    printConfig(config, root);
  });

program
  .command('config-get <key>')
  .description('read a value from the global config file')
  .action(async (key) => {
    const file = path.join(clusterHome(), 'config.json');
    try {
      const raw = JSON.parse(await fs.readFile(file, 'utf8')) as Record<string, unknown>;
      if (!(key in raw)) {
        console.error(`Key not set: ${key}`);
        process.exitCode = 1;
        return;
      }
      console.log(String(raw[key]));
    } catch {
      console.error(`No global config file at ${file}`);
      process.exitCode = 1;
    }
  });

program
  .command('config-set <key> <value>')
  .description('write a value to the global config file (~/.cluster/config.json)')
  .action(async (key, value) => {
    const file = path.join(clusterHome(), 'config.json');
    let current: Record<string, unknown> = {};
    try {
      current = JSON.parse(await fs.readFile(file, 'utf8')) as Record<string, unknown>;
    } catch {
      current = {};
    }

    // Coerce obvious primitives so the stored config stays typed.
    let parsed: unknown = value;
    if (value === 'true') parsed = true;
    else if (value === 'false') parsed = false;
    else if (/^\d+$/.test(value)) parsed = Number(value);

    current[key] = parsed;
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, `${JSON.stringify(current, null, 2)}\n`, 'utf8');
    console.log(`Set ${key} = ${String(parsed)} in ${file}`);
  });

program
  .command('doctor')
  .description('check the environment, project detection and model connectivity')
  .option('-c, --cwd <dir>', 'project directory')
  .option('--ping', 'make a live request to the model endpoint')
  .action(async (options) => {
    await runDoctor(options);
  });

/* -------------------------------------------------------------------------- */

function printConfig(config: AgentConfig, root: string): void {
  const lines: Array<[string, string]> = [
    ['api key', maskKey(config.apiKey)],
    ['base url', config.baseUrl],
    ['model', config.model],
    ['temperature', String(config.temperature)],
    ['tool mode', config.toolMode],
    ['max iterations', String(config.maxIterations)],
    ['command timeout', `${config.commandTimeoutMs}ms`],
    ['confirm destructive', String(config.confirmDestructive)],
    ['confirm all commands', String(config.confirmAllCommands)],
    ['project root', root],
    ['data directory', resolveStoragePaths().home],
  ];
  for (const [label, value] of lines) console.log(`  ${label.padEnd(20)} ${value}`);
}

async function runDoctor(options: { cwd?: string; ping?: boolean }): Promise<void> {
  let failures = 0;
  const check = (label: string, ok: boolean, detail: string): void => {
    if (!ok) failures += 1;
    console.log(`  ${ok ? '✔' : '✖'} ${label.padEnd(18)} ${detail}`);
  };

  console.log('cluster doctor\n');

  // Runtime
  const major = Number(process.versions.node.split('.')[0]);
  check('node', major >= 20, `${process.version} (need >= 20.10)`);
  check('platform', true, `${process.platform} ${process.arch}`);

  // Project
  const cwd = options.cwd ? path.resolve(options.cwd) : process.cwd();
  const detected = await detectProjectRoot(cwd);
  check('project root', !detected.fallback, `${detected.root}${detected.marker ? ` (via ${detected.marker})` : ' (fallback)'}`);

  const workspace = await loadWorkspaceInfo(detected.root);
  check(
    'project type',
    workspace.project.kind !== 'unknown',
    `${workspace.project.kind}${workspace.project.packageManager ? ` / ${workspace.project.packageManager}` : ''}`,
  );
  check('git', Boolean(workspace.git), workspace.git ? `${workspace.git.branch}${workspace.git.dirty ? ' (dirty)' : ''}` : 'not a repository');
  check('languages', workspace.languages.length > 0, workspace.languages.join(', ') || 'none detected');

  // Configuration
  const config = await loadConfig({}, { projectRoot: detected.root });
  check('api key', Boolean(config.apiKey), maskKey(config.apiKey));
  check('endpoint', /^https?:\/\//.test(config.baseUrl), config.baseUrl);
  check('model', Boolean(config.model), config.model);

  for (const problem of diagnoseConfig(config)) {
    check('config', problem.level !== 'error', `${problem.message}${problem.hint ? ` — ${problem.hint}` : ''}`);
  }

  // Storage
  const store = await SessionStore.open();
  const sessionCount = store.listSessions().length;
  check('storage', true, `${resolveStoragePaths().home} (${sessionCount} session${sessionCount === 1 ? '' : 's'})`);

  // Tools
  const registry = createDefaultRegistry();
  check('tools', registry.list().length > 0, registry.names().join(', '));

  // Connectivity
  if (options.ping) {
    if (!config.apiKey) {
      check('endpoint ping', false, 'skipped: no API key');
    } else {
      try {
        const provider = new ModelProvider(config);
        const started = Date.now();
        const response = await provider.complete({
          messages: [{ role: 'user', content: 'Reply with the single word: ok' }],
          maxTokens: 16,
        });
        const elapsed = Date.now() - started;
        check(
          'endpoint ping',
          true,
          `${String(response.content).trim().slice(0, 40) || '(empty)'} (${elapsed}ms)`,
        );
      } catch (error) {
        check('endpoint ping', false, (error as Error).message);
      }
    }
  }

  console.log(`\n${failures === 0 ? 'All checks passed.' : `${failures} check(s) need attention.`}`);
  if (failures > 0) process.exitCode = 1;
}

/* -------------------------------------------------------------------------- */

program.parseAsync(process.argv).catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
