import fs from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import { clusterHome } from '@cluster/shared';

/**
 * Configuration.
 *
 * Resolution order: explicit overrides > project config (`cluster.config.json`)
 * > global config (`~/.cluster/config.json`) > environment > defaults.
 */

export const projectConfigSchema = z
  .object({
    model: z.string().optional(),
    baseUrl: z.string().optional(),
    apiKey: z.string().optional(),
    maxIterations: z.number().int().positive().optional(),
    temperature: z.number().min(0).max(2).optional(),
    commands: z
      .object({
        build: z.string().optional(),
        test: z.string().optional(),
        lint: z.string().optional(),
        format: z.string().optional(),
      })
      .optional(),
    ignore: z.array(z.string()).optional(),
    confirmDestructive: z.boolean().optional(),
  })
  .passthrough();

export type ProjectConfig = z.infer<typeof projectConfigSchema>;

export type ToolMode = 'auto' | 'native' | 'text';

export interface AgentConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
  temperature: number;
  toolMode: ToolMode;
  maxIterations: number;
  commandTimeoutMs: number;
  confirmDestructive: boolean;
  /**
   * Paranoid mode: ask before every shell command, including ones classified as
   * safe. Off by default; `confirmDestructive` governs the normal path.
   */
  confirmAllCommands: boolean;
  /** Characters of tool output fed back to the model. */
  maxToolOutputChars: number;
}

export const DEFAULT_CONFIG: Omit<AgentConfig, 'apiKey'> = {
  baseUrl: 'https://api.openai.com/v1',
  model: 'gpt-4o-mini',
  temperature: 0.2,
  toolMode: 'auto',
  maxIterations: 40,
  commandTimeoutMs: 120_000,
  confirmDestructive: true,
  confirmAllCommands: false,
  maxToolOutputChars: 24_000,
};

function envNumber(value: string | undefined, fallback: number): number {
  if (value === undefined || value.trim() === '') return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function envBool(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined || value.trim() === '') return fallback;
  return /^(1|true|yes|on)$/i.test(value.trim());
}

/** Read a JSON config file, returning null when absent or malformed. */
export async function readConfigFile<T>(file: string, schema: z.ZodType<T>): Promise<T | null> {
  try {
    const raw = await fs.readFile(file, 'utf8');
    const parsed = schema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export async function loadProjectConfig(root: string): Promise<ProjectConfig | null> {
  return readConfigFile(path.join(root, 'cluster.config.json'), projectConfigSchema);
}

export async function loadGlobalConfig(): Promise<ProjectConfig | null> {
  return readConfigFile(path.join(clusterHome(), 'config.json'), projectConfigSchema);
}

export type ConfigOverrides = Partial<AgentConfig>;

/**
 * Build the effective configuration.
 *
 * Missing credentials are tolerated here: `doctor` reports on configuration
 * problems without needing a key, and the agent surfaces a clear error when a
 * request is actually attempted.
 */
export async function loadConfig(
  overrides: ConfigOverrides = {},
  options: { projectRoot?: string; env?: NodeJS.ProcessEnv } = {},
): Promise<AgentConfig> {
  const env = options.env ?? process.env;

  const project = options.projectRoot ? await loadProjectConfig(options.projectRoot) : null;
  const global = await loadGlobalConfig();

  const apiKey =
    overrides.apiKey ??
    project?.apiKey ??
    global?.apiKey ??
    env.CLUSTER_API_KEY ??
    env.OPENAI_API_KEY ??
    '';

  const toolModeRaw = (env.CLUSTER_TOOL_MODE ?? 'auto').toLowerCase();
  const toolMode: ToolMode =
    toolModeRaw === 'native' || toolModeRaw === 'text' ? toolModeRaw : 'auto';

  return {
    apiKey,
    baseUrl: overrides.baseUrl ?? project?.baseUrl ?? global?.baseUrl ?? env.CLUSTER_BASE_URL ?? env.OPENAI_BASE_URL ?? DEFAULT_CONFIG.baseUrl,
    model: overrides.model ?? project?.model ?? global?.model ?? env.CLUSTER_MODEL ?? DEFAULT_CONFIG.model,
    temperature: overrides.temperature ?? project?.temperature ?? envNumber(env.CLUSTER_TEMPERATURE, DEFAULT_CONFIG.temperature),
    toolMode: overrides.toolMode ?? toolMode,
    maxIterations:
      overrides.maxIterations ?? project?.maxIterations ?? envNumber(env.CLUSTER_MAX_ITERATIONS, DEFAULT_CONFIG.maxIterations),
    commandTimeoutMs: overrides.commandTimeoutMs ?? envNumber(env.CLUSTER_COMMAND_TIMEOUT_MS, DEFAULT_CONFIG.commandTimeoutMs),
    confirmDestructive:
      overrides.confirmDestructive ??
      project?.confirmDestructive ??
      envBool(env.CLUSTER_CONFIRM_DESTRUCTIVE, DEFAULT_CONFIG.confirmDestructive),
    confirmAllCommands: overrides.confirmAllCommands ?? envBool(env.CLUSTER_CONFIRM_COMMANDS, DEFAULT_CONFIG.confirmAllCommands),
    maxToolOutputChars: overrides.maxToolOutputChars ?? DEFAULT_CONFIG.maxToolOutputChars,
  };
}

export interface ConfigProblem {
  level: 'error' | 'warn';
  message: string;
  hint?: string;
}

/** Validation used by the `doctor` command. */
export function diagnoseConfig(config: AgentConfig): ConfigProblem[] {
  const problems: ConfigProblem[] = [];

  if (!config.apiKey) {
    problems.push({
      level: 'error',
      message: 'No API key configured.',
      hint: 'Set CLUSTER_API_KEY (or OPENAI_API_KEY) in your environment or .env file.',
    });
  }
  if (!/^https?:\/\//.test(config.baseUrl)) {
    problems.push({ level: 'error', message: `baseUrl is not a valid URL: ${config.baseUrl}` });
  }
  if (config.maxIterations < 1) {
    problems.push({ level: 'warn', message: 'maxIterations is below 1; the agent will not be able to act.' });
  }

  return problems;
}
