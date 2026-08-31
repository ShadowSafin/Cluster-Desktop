import { z } from 'zod';
import {
  createId,
  Emitter,
  getLogger,
  type AgentPhase,
  type Message,
  type Plan,
  type PlanStep,
  type RiskLevel,
  type ToolCall,
  type ToolStatus,
  type WorkspaceInfo,
} from '@cluster/shared';
import {
  capMiddle,
  riskOf,
  type ConfirmationRequest,
  type ToolContext,
  type ToolRegistry,
} from '@cluster/tool-runtime';
import type { AgentConfig } from './config.js';
import {
  ModelProvider,
  ProviderError,
  type ChatResponse,
  type ChatUsage,
  type ProviderMessage,
  type ProviderToolCall,
} from './provider.js';
import { buildSystemPrompt, buildTextProtocol, parseToolBlock, PLAN_SYSTEM_PROMPT } from './prompts.js';
import { trimHistory } from './history.js';
import type { AgentEvents } from './events.js';

export interface AgentLoopDeps {
  config: AgentConfig;
  provider: ModelProvider;
  registry: ToolRegistry;
  projectRoot: string;
  workspace: WorkspaceInfo | null;
  backupsDir: string;
  sessionId: string;
  /** Transcript from previous turns, already in provider format. */
  history: ProviderMessage[];
  events: Emitter<AgentEvents>;
  /** Present a confirmation prompt to the user. Must not throw. */
  requestConfirm: (request: ConfirmationRequest) => Promise<boolean>;
  /** Extra instructions injected into the system prompt. */
  extraInstructions?: string | null;
}

export interface AgentRunResult {
  iterations: number;
  usage: ChatUsage;
  summary: string;
  cancelled: boolean;
  error: string | null;
}

const planSchema = z.object({
  goal: z.string().min(1),
  steps: z.array(z.string().min(1)).min(1).max(6),
});

/** How many identical consecutive tool calls before we assume the model is stuck. */
const REPETITION_LIMIT = 3;

/** Character budget for the rolling transcript, excluding the system prompt. */
const HISTORY_BUDGET_CHARS = 120_000;

const PHASE_BY_TOOL: Record<string, AgentPhase> = {
  read_file: 'reading',
  list_files: 'reading',
  search_text: 'reading',
  workspace_info: 'reading',
  git_status: 'reading',
  write_file: 'editing',
  patch_file: 'editing',
  run_command: 'running',
};

interface CallOutcome {
  response: ChatResponse | null;
  error: string | null;
}

export class AgentLoop {
  private readonly messages: ProviderMessage[];
  private readonly logger = getLogger('agent');
  private systemPrompt: string;
  private useTextProtocol: boolean;
  private toolSignatures: string[] = [];
  private madeEdits = false;
  private ranCommand = false;

  constructor(private readonly deps: AgentLoopDeps) {
    this.messages = [...deps.history];
    this.useTextProtocol = !deps.provider.shouldSendTools();
    this.systemPrompt = this.buildPrompt();
  }

  /** Run one user turn to completion. Never throws. */
  async run(userInput: string, signal: AbortSignal): Promise<AgentRunResult> {
    const { deps } = this;
    const events = deps.events;
    const usage: ChatUsage = { prompt: 0, completion: 0, total: 0 };
    const maxIterations = deps.config.maxIterations;

    events.emit('message', this.makeMessage('user', userInput, 'chat'));
    this.messages.push({ role: 'user', content: userInput });

    this.emitState('planning', 'Planning', 0, maxIterations);
    const plan = await this.createPlan(userInput, signal);
    if (plan) events.emit('plan', plan);

    let iterations = 0;
    let summary = '';
    let cancelled = false;
    let error: string | null = null;

    for (let iteration = 1; iteration <= maxIterations; iteration += 1) {
      if (signal.aborted) {
        cancelled = true;
        break;
      }
      iterations = iteration;
      this.emitState('thinking', 'Thinking', iteration, maxIterations);

      const messageId = createId('msg');
      const outcome = await this.callModel(messageId, signal);

      if (!outcome.response) {
        if (signal.aborted) cancelled = true;
        else error = outcome.error ?? 'Unknown error.';
        break;
      }

      const response = outcome.response;
      usage.prompt += response.usage.prompt;
      usage.completion += response.usage.completion;
      usage.total += response.usage.total;

      // In text-protocol mode the model expresses tool calls inside its reply.
      const toolCalls =
        response.toolCalls.length > 0 ? response.toolCalls : this.toolCallsFromText(response.content);

      events.emit(
        'message',
        this.makeMessage(
          'assistant',
          response.content,
          toolCalls.length > 0 ? 'chat' : 'summary',
          toolCalls.map((call) => call.id),
          messageId,
        ),
      );

      this.messages.push({
        role: 'assistant',
        content: response.content === '' ? null : response.content,
        ...(toolCalls.length > 0 ? { tool_calls: toolCalls } : {}),
      });

      if (toolCalls.length === 0) {
        summary = response.content.trim();
        if (summary === '') {
          summary = 'The model returned an empty response.';
          events.emit('error', {
            source: 'provider',
            message: 'The model returned an empty response with no tool calls.',
            recoverable: true,
          });
        }
        break;
      }

      const result = await this.runToolCalls(toolCalls, messageId, signal);

      if (result === 'cancelled') {
        cancelled = true;
        break;
      }
      if (result === 'stalled') {
        error = 'Stopped: the agent repeated the same tool call without making progress.';
        this.messages.push({
          role: 'user',
          content:
            'You repeated the same tool call without changing the input. Stop and either take ' +
            'a different approach or explain to the user what is blocking you.',
        });
        events.emit('error', { source: 'agent', message: error, recoverable: true });
        break;
      }
    }

    if (!cancelled && !error && iterations >= maxIterations && summary === '') {
      summary = `Reached the iteration limit (${maxIterations}) without a final answer.`;
      events.emit('error', {
        source: 'agent',
        message: summary,
        code: 'iteration_limit',
        recoverable: true,
      });
    }

    if (this.madeEdits && !this.ranCommand && !cancelled) {
      events.emit(
        'message',
        this.makeMessage(
          'assistant',
          'Note: files were changed but no verification command was run. ' +
            'Consider running the project build or tests to confirm the change.',
          'warning',
        ),
      );
    }

    const finalPhase: AgentPhase = cancelled ? 'cancelled' : error ? 'error' : 'done';
    this.emitState(
      finalPhase,
      cancelled ? 'Cancelled' : error ? 'Failed' : 'Done',
      iterations,
      maxIterations,
    );

    events.emit('done', {
      summary: cancelled ? 'Cancelled by user.' : summary || error || 'Finished.',
      usage,
      cancelled,
      iterations,
    });

    return { iterations, usage, summary, cancelled, error };
  }

  /* ---------------------------------------------------------------------- */
  /* Model interaction                                                       */
  /* ---------------------------------------------------------------------- */

  private async callModel(messageId: string, signal: AbortSignal): Promise<CallOutcome> {
    try {
      const response = await this.deps.provider.chat({
        messages: [
          { role: 'system', content: this.systemPrompt },
          ...trimHistory(this.messages, HISTORY_BUDGET_CHARS),
        ],
        tools: this.useTextProtocol ? undefined : this.deps.registry.toFunctionSchemas(),
        signal,
        onDelta: (text) => this.deps.events.emit('delta', { messageId, text }),
      });
      return { response, error: null };
    } catch (caught) {
      if (signal.aborted || (caught instanceof Error && caught.name === 'AbortError')) {
        return { response: null, error: 'Cancelled.' };
      }

      if (caught instanceof ProviderError && caught.isToolUnsupported && !this.useTextProtocol) {
        // Endpoints that reject function calling are common; degrade instead of
        // failing the task outright.
        this.logger.warn({ status: caught.status }, 'provider rejected tools; using text protocol');
        this.useTextProtocol = true;
        this.deps.provider.markToolsUnsupported();
        this.systemPrompt = this.buildPrompt();
        this.deps.events.emit(
          'message',
          this.makeMessage(
            'assistant',
            'This endpoint does not support function calling; switching to the text tool protocol.',
            'info',
          ),
        );
        return this.callModel(messageId, signal);
      }

      if (caught instanceof ProviderError) {
        const message = caught.isAuthError
          ? `Authentication failed (HTTP ${caught.status}). Check CLUSTER_API_KEY and CLUSTER_BASE_URL.`
          : `Provider error (HTTP ${caught.status}): ${caught.message}`;
        this.deps.events.emit('error', { source: 'provider', message, recoverable: true });
        return { response: null, error: message };
      }

      const message = caught instanceof Error ? caught.message : String(caught);
      this.deps.events.emit('error', { source: 'provider', message, recoverable: true });
      return { response: null, error: message };
    }
  }

  private buildPrompt(): string {
    return buildSystemPrompt({
      workspace: this.deps.workspace,
      projectRoot: this.deps.projectRoot,
      extraInstructions: this.deps.extraInstructions ?? null,
      textProtocol: this.useTextProtocol
        ? buildTextProtocol(this.deps.registry.describeForPrompt())
        : null,
    });
  }

  private toolCallsFromText(content: string): ProviderToolCall[] {
    if (!this.useTextProtocol) return [];
    const parsed = parseToolBlock(content);
    if (!parsed) return [];
    return [
      {
        id: createId('call'),
        type: 'function',
        function: { name: parsed.tool, arguments: JSON.stringify(parsed.input) },
      },
    ];
  }

  /* ---------------------------------------------------------------------- */
  /* Tool execution                                                          */
  /* ---------------------------------------------------------------------- */

  private async runToolCalls(
    toolCalls: readonly ProviderToolCall[],
    assistantMessageId: string,
    signal: AbortSignal,
  ): Promise<'ok' | 'cancelled' | 'stalled'> {
    for (const call of toolCalls) {
      if (signal.aborted) return 'cancelled';

      let input: unknown;
      try {
        input = JSON.parse(call.function.arguments || '{}');
      } catch {
        input = {};
      }

      const tool = this.deps.registry.get(call.function.name);
      const risk: RiskLevel = tool ? riskOf(tool, input) : 'safe';

      const record: ToolCall = {
        id: call.id,
        sessionId: this.deps.sessionId,
        messageId: assistantMessageId,
        name: call.function.name,
        input,
        createdAt: new Date().toISOString(),
        status: 'running',
        risk,
        confirmation: 'not-required',
        startedAt: new Date().toISOString(),
      };

      const signature = `${call.function.name}:${JSON.stringify(input)}`;
      this.toolSignatures.push(signature);
      if (this.toolSignatures.length > REPETITION_LIMIT) this.toolSignatures.shift();
      const stalled =
        this.toolSignatures.length === REPETITION_LIMIT &&
        this.toolSignatures.every((entry) => entry === signature);

      const phase = PHASE_BY_TOOL[call.function.name] ?? 'thinking';
      this.emitState(phase, `Using ${call.function.name}`, 0, this.deps.config.maxIterations);
      this.deps.events.emit('tool:start', record);

      const context = this.createToolContext(signal, record.id);
      const outcome = await this.deps.registry.execute(call.function.name, input, context);

      record.finishedAt = new Date().toISOString();
      record.durationMs = outcome.meta.durationMs;
      record.result = outcome.result;
      record.risk = outcome.meta.risk;
      record.status = statusFromOutcome(outcome.result.ok, outcome.result.error?.code, signal.aborted);
      if (outcome.meta.risk !== 'safe') record.confirmation = 'approved';

      this.deps.events.emit('tool:end', record);

      if (call.function.name === 'write_file' || call.function.name === 'patch_file') {
        const changed = outcome.result.data as { changed?: boolean } | undefined;
        if (outcome.result.ok && changed?.changed !== false) this.madeEdits = true;
      }
      if (call.function.name === 'run_command') this.ranCommand = true;

      const feedback = capMiddle(outcome.result.output, this.deps.config.maxToolOutputChars).text;
      this.deps.events.emit('message', this.makeMessage('tool', feedback, 'tool-result', [call.id]));
      this.messages.push({ role: 'tool', content: feedback, tool_call_id: call.id });

      if (stalled) {
        this.logger.warn({ tool: call.function.name }, 'agent stalled on repeated tool call');
        return 'stalled';
      }
    }

    return 'ok';
  }

  private createToolContext(signal: AbortSignal, callId: string): ToolContext {
    return {
      projectRoot: this.deps.projectRoot,
      workspace: this.deps.workspace,
      signal,
      logger: this.logger,
      backupsDir: this.deps.backupsDir,
      sessionId: this.deps.sessionId,
      alwaysConfirmCommands: this.deps.config.confirmAllCommands,
      confirm: async (request) => {
        // Trust mode: only genuinely destructive actions interrupt the user.
        if (!this.deps.config.confirmDestructive && request.risk !== 'destructive') return true;
        const approved = await this.deps.requestConfirm(request);
        if (!approved) {
          this.deps.events.emit('progress', { message: `Declined: ${request.summary}` });
        }
        return approved;
      },
      emitOutput: (chunk) => this.deps.events.emit('tool:output', { callId, chunk }),
      emitProgress: (message) => this.deps.events.emit('progress', { message }),
    };
  }

  /* ---------------------------------------------------------------------- */
  /* Planning                                                                */
  /* ---------------------------------------------------------------------- */

  /** Planning is an enhancement, never a blocker: any failure is non-fatal. */
  private async createPlan(userInput: string, signal: AbortSignal): Promise<Plan | null> {
    try {
      const response = await this.deps.provider.chat({
        messages: [
          { role: 'system', content: PLAN_SYSTEM_PROMPT },
          {
            role: 'user',
            content: [
              `Repository: ${this.deps.projectRoot}`,
              this.deps.workspace ? `Project type: ${this.deps.workspace.project.kind}` : '',
              this.deps.workspace?.git ? `Branch: ${this.deps.workspace.git.branch}` : '',
              '',
              `Task: ${userInput}`,
            ]
              .filter(Boolean)
              .join('\n'),
          },
        ],
        signal,
        maxTokens: 500,
        jsonMode: true,
      });

      const parsed = planSchema.safeParse(JSON.parse(response.content));
      if (!parsed.success) return null;

      const steps: PlanStep[] = parsed.data.steps.map((text) => ({
        id: createId('step'),
        text,
        status: 'pending' as const,
      }));

      return { goal: parsed.data.goal, steps, createdAt: new Date().toISOString() };
    } catch (error) {
      this.logger.debug({ error }, 'planning skipped');
      return null;
    }
  }

  /* ---------------------------------------------------------------------- */
  /* Helpers                                                                 */
  /* ---------------------------------------------------------------------- */

  private makeMessage(
    role: Message['role'],
    content: string,
    kind: Message['kind'],
    toolCallIds?: string[],
    id?: string,
  ): Message {
    return {
      id: id ?? createId('msg'),
      sessionId: this.deps.sessionId,
      role,
      content,
      createdAt: new Date().toISOString(),
      kind,
      ...(toolCallIds && toolCallIds.length > 0 ? { toolCallIds } : {}),
    };
  }

  private emitState(phase: AgentPhase, label: string, iteration: number, maxIterations: number): void {
    this.deps.events.emit('state', { phase, label, iteration, maxIterations });
  }
}

function statusFromOutcome(ok: boolean, code: string | undefined, aborted: boolean): ToolStatus {
  if (code === 'rejected') return 'rejected';
  if (code === 'cancelled' || aborted) return 'cancelled';
  return ok ? 'success' : 'error';
}
