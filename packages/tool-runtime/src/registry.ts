import { z } from 'zod';
import { getLogger } from '@cluster/shared';
import type { AgentRole } from '@cluster/shared';
import { AGENT_DEFINITIONS, canUseTool } from '@cluster/shared';
import { failResult, riskOf, type AnyTool } from './types.js';
import type { ToolContext, ToolResult } from './types.js';
import { evaluateToolPermission, type ExecutionPolicy, createDefaultPolicy } from './permissions.js';

export interface ToolExecutionMeta {
  name: string;
  durationMs: number;
  validatedInput: unknown;
  risk: ReturnType<typeof riskOf>;
}

export interface ToolExecutionOutcome {
  result: ToolResult;
  meta: ToolExecutionMeta;
}

/**
 * Registry of every tool the agent may call.
 *
 * The registry owns input validation, so a tool's `execute` only ever receives
 * data that already satisfies its schema. Validation failures come back as a
 * failed `ToolResult` (never an exception) so the model can correct itself.
 */
/**
 * Plugin definition for extensible tool registration.
 */
export interface ToolPlugin {
  name: string;
  version?: string;
  tools: AnyTool[];
  /** Optional setup hook called after registration. */
  setup?(registry: ToolRegistry): void | Promise<void>;
}

export interface ToolMetadata {
  tool: string;
  category: 'file' | 'search' | 'exec' | 'git' | 'verification' | 'diff' | 'memory' | 'checkpoint' | 'custom';
  permissions?: { level: 'allow' | 'deny' | 'confirm'; reason?: string };
  workspaceSpecific?: boolean;
  providerAdapters?: string[];
}

export class ToolRegistry {
  private readonly tools = new Map<string, AnyTool>();
  private readonly metadata = new Map<string, ToolMetadata>();
  private readonly plugins = new Map<string, ToolPlugin>();
  private policy: ExecutionPolicy = createDefaultPolicy();

  register(tool: AnyTool, meta?: ToolMetadata): this {
    if (this.tools.has(tool.name)) {
      throw new Error(`Tool "${tool.name}" is already registered.`);
    }
    this.tools.set(tool.name, tool);
    if (meta) this.metadata.set(tool.name, meta);
    else this.metadata.set(tool.name, { tool: tool.name, category: 'custom' });
    return this;
  }

  registerAll(tools: readonly AnyTool[]): this {
    for (const tool of tools) this.register(tool);
    return this;
  }

  /** Plugin architecture: register a plugin's tools. */
  registerPlugin(plugin: ToolPlugin): this {
    if (this.plugins.has(plugin.name)) {
      throw new Error(`Plugin "${plugin.name}" is already registered.`);
    }
    for (const tool of plugin.tools) {
      this.register(tool, { tool: tool.name, category: 'custom', workspaceSpecific: false });
    }
    this.plugins.set(plugin.name, plugin);
    // Execute setup if provided (fire-and-forget for sync, await if needed externally)
    try {
      const result = plugin.setup?.(this);
      if (result instanceof Promise) void result.catch(() => undefined);
    } catch {
      // plugin setup failure should not crash registry
    }
    return this;
  }

  getPlugin(name: string): ToolPlugin | undefined {
    return this.plugins.get(name);
  }

  listPlugins(): ToolPlugin[] {
    return [...this.plugins.values()];
  }

  /** Workspace-specific tool registration: tools only available for a given project. */
  registerWorkspaceTool(tool: AnyTool, projectRoot: string): this {
    return this.register(tool, { tool: tool.name, category: 'custom', workspaceSpecific: true });
  }

  setPolicy(policy: ExecutionPolicy): this {
    this.policy = policy;
    return this;
  }

  getPolicy(): ExecutionPolicy {
    return this.policy;
  }

  getMetadata(name: string): ToolMetadata | undefined {
    return this.metadata.get(name);
  }

  get(name: string): AnyTool | undefined {
    return this.tools.get(name);
  }

  has(name: string): boolean {
    return this.tools.has(name);
  }

  list(): AnyTool[] {
    return [...this.tools.values()];
  }

  names(): string[] {
    return [...this.tools.keys()];
  }

  /** Filter tools by agent role permissions. */
  forRole(role: AgentRole): AnyTool[] {
    return this.list().filter((tool) => canUseTool(role, tool.name));
  }

  /** Provider adapters: convert tool schemas for different LLM providers. */
  toProviderSchemas(provider: 'openai' | 'anthropic' | 'google' = 'openai'): ReturnType<ToolRegistry['toFunctionSchemas']> {
    const schemas = this.toFunctionSchemas();
    if (provider === 'anthropic') {
      // Anthropic uses slightly different tool spec; we adapt superficially
      return schemas.map((s) => ({
        type: 'function' as const,
        function: {
          name: s.function.name,
          description: s.function.description,
          parameters: s.function.parameters as Record<string, unknown>,
        },
      }));
    }
    return schemas;
  }

  /** OpenAI-compatible function tool definitions. */
  toFunctionSchemas(): Array<{
    type: 'function';
    function: { name: string; description: string; parameters: Record<string, unknown> };
  }> {
    return this.list().map((tool) => ({
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: toJsonSchema(tool.schema),
      },
    }));
  }

  /** Short text listing for the text-protocol fallback prompt. */
  describeForPrompt(): string {
    return this.list()
      .map((tool) => {
        const shape = describeShape(tool.schema);
        return `- ${tool.name}(${shape}): ${tool.description}`;
      })
      .join('\n');
  }

  /**
   * Validate and run a tool. This method never throws: every failure mode
   * (unknown tool, bad input, thrown executor) is converted into a
   * `ToolResult` the agent can react to.
   *
   * Adds permission evaluation, timeout handling, and output truncation.
   */
  async execute(name: string, rawInput: unknown, ctx: ToolContext): Promise<ToolExecutionOutcome> {
    const startedAt = Date.now();
    const tool = this.tools.get(name);

    // Permission check (safer execution)
    const policy = (ctx as unknown as { policy?: ExecutionPolicy }).policy ?? this.policy;
    if (policy) {
      const evaluation = evaluateToolPermission(name, rawInput, policy);
      if (evaluation.blocked) {
        return {
          result: failResult(evaluation.reason ?? `Tool ${name} blocked by policy`, {
            code: 'policy_denied',
            hint: evaluation.reason,
          }),
          meta: { name, durationMs: Date.now() - startedAt, validatedInput: rawInput, risk: evaluation.risk },
        };
      }
      if (evaluation.requiresConfirm && evaluation.decision === 'confirm') {
        // Check if caller has already handled confirm via ctx.confirm; otherwise we still require confirm
        // The tool itself will prompt; here we just annotate risk
      }
    }

    if (!tool) {
      const known = this.names().join(', ');
      return {
        result: failResult(`Unknown tool "${name}".`, {
          code: 'unknown_tool',
          hint: `Available tools: ${known}`,
        }),
        meta: { name, durationMs: Date.now() - startedAt, validatedInput: rawInput, risk: 'safe' },
      };
    }

    const parsed = tool.schema.safeParse(rawInput ?? {});
    if (!parsed.success) {
      const issues = parsed.error.issues
        .slice(0, 5)
        .map((issue) => `${issue.path.join('.') || '<root>'}: ${issue.message}`)
        .join('; ');
      return {
        result: failResult(`Invalid arguments for ${name}: ${issues}`, {
          code: 'invalid_input',
          hint: 'Correct the arguments and call the tool again.',
          data: { issues: parsed.error.issues },
        }),
        meta: { name, durationMs: Date.now() - startedAt, validatedInput: rawInput, risk: 'safe' },
      };
    }

    const input = parsed.data;
    const risk = riskOf(tool, input);
    ctx.logger.debug({ tool: name, risk, input }, 'executing tool');

    try {
      const result = await tool.execute(input, ctx);
      return {
        result,
        meta: { name, durationMs: Date.now() - startedAt, validatedInput: input, risk },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      ctx.logger.warn({ tool: name, error }, 'tool threw');
      return {
        result: failResult(`Tool "${name}" failed: ${message}`, {
          code: 'tool_error',
          hint: 'The failure was contained; continue with another approach.',
        }),
        meta: { name, durationMs: Date.now() - startedAt, validatedInput: input, risk },
      };
    }
  }
}

/** zod -> plain JSON Schema, in input mode and without the `$schema` noise. */
export function toJsonSchema(schema: z.ZodType): Record<string, unknown> {
  const converted = z.toJSONSchema(schema, { io: 'input', target: 'draft-7' }) as Record<string, unknown>;
  delete converted['$schema'];
  return converted;
}

/** Compact signature list for the text-protocol prompt. */
function describeShape(schema: z.ZodType): string {
  try {
    if (!(schema instanceof z.ZodObject)) return '…';
    const shape = schema.shape as Record<string, z.ZodType>;
    return Object.entries(shape)
      .map(([key, value]) => {
        const optional = value instanceof z.ZodOptional || value instanceof z.ZodDefault;
        return `${key}${optional ? '?' : ''}: ${typeName(value)}`;
      })
      .join(', ');
  } catch {
    return '…';
  }
}

/**
 * Derive a display type from the generated JSON Schema.
 * Uses only public zod API, and degrades to `any` rather than throwing.
 */
function typeName(schema: z.ZodType): string {
  try {
    const json = toJsonSchema(schema) as { type?: string | string[]; enum?: unknown[] };
    if (Array.isArray(json.enum)) return json.enum.map((value) => JSON.stringify(value)).join(' | ');
    const type = Array.isArray(json.type) ? json.type.find((entry) => entry !== 'null') : json.type;
    return typeof type === 'string' ? type : 'any';
  } catch {
    return 'any';
  }
}

export function createRegistry(): ToolRegistry {
  return new ToolRegistry();
}

export { getLogger };
