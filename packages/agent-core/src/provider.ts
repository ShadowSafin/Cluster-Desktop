import { getLogger } from '@cluster/shared';
import type { AgentConfig } from './config.js';

/**
 * OpenAI-compatible chat completions client.
 *
 * Speaks only the standard `/chat/completions` protocol with SSE streaming so
 * it works against OpenAI and any compatible endpoint. Transport details are
 * isolated here: the agent loop depends on `ModelProvider`, not on fetch.
 */

export interface ProviderToolSchema {
  type: 'function';
  function: { name: string; description: string; parameters: Record<string, unknown> };
}

export interface ProviderToolCall {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
}

export type ProviderRole = 'system' | 'user' | 'assistant' | 'tool';

export interface ProviderMessage {
  role: ProviderRole;
  content: string | null;
  /** Present on assistant messages that request tool calls. */
  tool_calls?: ProviderToolCall[];
  /** Present on tool result messages. */
  tool_call_id?: string;
  name?: string;
}

export interface ChatUsage {
  prompt: number;
  completion: number;
  total: number;
}

export interface ChatResponse {
  content: string;
  toolCalls: ProviderToolCall[];
  finishReason: string | null;
  usage: ChatUsage;
}

export interface ChatRequest {
  messages: ProviderMessage[];
  tools?: ProviderToolSchema[];
  signal?: AbortSignal;
  temperature?: number;
  maxTokens?: number;
  /** Force a JSON object response (used for planning). */
  jsonMode?: boolean;
  onDelta?: (text: string) => void;
}

export class ProviderError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body: string,
  ) {
    super(message);
    this.name = 'ProviderError';
  }

  /**
   * True when the endpoint rejected the request because it does not support
   * function calling. Used to fall back to the text protocol.
   */
  get isToolUnsupported(): boolean {
    if (this.status !== 400 && this.status !== 422 && this.status !== 404) return false;
    return /tool|function/i.test(this.body);
  }

  get isAuthError(): boolean {
    return this.status === 401 || this.status === 403;
  }
}

interface StreamDelta {
  content?: string | null;
  tool_calls?: Array<{
    index: number;
    id?: string;
    type?: string;
    function?: { name?: string; arguments?: string };
  }>;
}

interface StreamChunk {
  choices?: Array<{
    delta?: StreamDelta;
    finish_reason?: string | null;
    message?: { content?: string | null; tool_calls?: ProviderToolCall[] };
  }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
}

export class ModelProvider {
  private toolSupport: 'unknown' | 'yes' | 'no' = 'unknown';

  constructor(
    private readonly config: AgentConfig,
    private readonly logger = getLogger('provider'),
  ) {}

  get endpoint(): string {
    return `${this.config.baseUrl.replace(/\/+$/, '')}/chat/completions`;
  }

  /** Whether to advertise tools, given the configured mode and what we learned. */
  shouldSendTools(forceOff = false): boolean {
    if (forceOff) return false;
    if (this.config.toolMode === 'text') return false;
    if (this.config.toolMode === 'native') return true;
    return this.toolSupport !== 'no';
  }

  markToolsUnsupported(): void {
    this.toolSupport = 'no';
  }

  async chat(request: ChatRequest): Promise<ChatResponse> {
    const payload: Record<string, unknown> = {
      model: this.config.model,
      messages: request.messages,
      stream: true,
      temperature: request.temperature ?? this.config.temperature,
    };

    if (request.tools && request.tools.length > 0 && this.shouldSendTools()) {
      payload['tools'] = request.tools;
      payload['tool_choice'] = 'auto';
    }
    if (request.maxTokens) payload['max_tokens'] = request.maxTokens;
    if (request.jsonMode) payload['response_format'] = { type: 'json_object' };

    const response = await this.post(payload, request.signal);
    return this.readStream(response, request.onDelta);
  }

  /** Non-streaming request, used as a fallback and by `doctor --ping`. */
  async complete(request: ChatRequest): Promise<ChatResponse> {
    const payload: Record<string, unknown> = {
      model: this.config.model,
      messages: request.messages,
      stream: false,
      temperature: request.temperature ?? this.config.temperature,
    };
    if (request.maxTokens) payload['max_tokens'] = request.maxTokens;
    if (request.jsonMode) payload['response_format'] = { type: 'json_object' };

    const response = await this.post(payload, request.signal);
    const body = (await response.json()) as StreamChunk & { error?: { message?: string } };

    if (body.error) {
      throw new ProviderError(body.error.message ?? 'Provider returned an error.', response.status, JSON.stringify(body));
    }

    const choice = body.choices?.[0];
    return {
      content: choice?.message?.content ?? '',
      toolCalls: choice?.message?.tool_calls ?? [],
      finishReason: choice?.finish_reason ?? null,
      usage: toUsage(body.usage),
    };
  }

  private async post(payload: Record<string, unknown>, signal?: AbortSignal): Promise<Response> {
    if (!this.config.apiKey) {
      throw new ProviderError(
        'No API key configured. Set CLUSTER_API_KEY or OPENAI_API_KEY.',
        0,
        'missing api key',
      );
    }

    this.logger.debug({ model: this.config.model, endpoint: this.endpoint }, 'chat request');

    let response: Response;
    try {
      response = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify(payload),
        signal,
      });
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') throw error;
      throw new ProviderError(
        `Could not reach ${this.endpoint}: ${(error as Error).message}`,
        0,
        String(error),
      );
    }

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      const message = extractErrorMessage(body) ?? `Request failed with status ${response.status}.`;
      throw new ProviderError(message, response.status, body);
    }

    return response;
  }

  private async readStream(response: Response, onDelta?: (text: string) => void): Promise<ChatResponse> {
    if (!response.body) {
      return this.completeFromEmpty(response);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    let content = '';
    let reasoningContent = '';
    let finishReason: string | null = null;
    let usage: ChatUsage = { prompt: 0, completion: 0, total: 0 };
    const toolCalls = new Map<number, { id: string; name: string; arguments: string }>();

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        let newlineIndex = buffer.indexOf('\n');
        while (newlineIndex !== -1) {
          const line = buffer.slice(0, newlineIndex).trim();
          buffer = buffer.slice(newlineIndex + 1);
          newlineIndex = buffer.indexOf('\n');

          if (line === '' || !line.startsWith('data:')) continue;
          const data = line.slice(5).trim();
          if (data === '' || data === '[DONE]') continue;

          let chunk: StreamChunk;
          try {
            chunk = JSON.parse(data) as StreamChunk;
          } catch {
            continue; // Ignore malformed keep-alives.
          }

          if (chunk.usage) usage = toUsage(chunk.usage);

          const choice = chunk.choices?.[0];
          if (!choice) continue;

          if (choice.finish_reason) finishReason = choice.finish_reason;

          const delta = choice.delta as any;
          if (delta?.content) {
            content += delta.content;
            onDelta?.(delta.content);
          } else if (delta?.text) {
            content += delta.text;
            onDelta?.(delta.text);
          } else if (delta?.reasoning_content) {
            reasoningContent += delta.reasoning_content;
            onDelta?.(delta.reasoning_content);
          }

          for (const call of delta?.tool_calls ?? []) {
            const existing = toolCalls.get(call.index) ?? { id: '', name: '', arguments: '' };
            const merged = {
              id: call.id ?? existing.id,
              name: call.function?.name ?? existing.name,
              arguments: existing.arguments + (call.function?.arguments ?? ''),
            };
            toolCalls.set(call.index, merged);
          }
        }
      }
    } finally {
      reader.releaseLock?.();
    }

    const finalContent = content.trim() !== '' ? content : (reasoningContent.trim() !== '' ? reasoningContent : content);

    return {
      content: finalContent,
      toolCalls: [...toolCalls.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([index, call]) => ({
          id: call.id || `call_${index}`,
          type: 'function' as const,
          function: { name: call.name, arguments: call.arguments || '{}' },
        })),
      finishReason,
      usage,
    };
  }

  private async completeFromEmpty(response: Response): Promise<ChatResponse> {
    const body = (await response.json()) as StreamChunk;
    const choice = body.choices?.[0];
    return {
      content: choice?.message?.content ?? '',
      toolCalls: choice?.message?.tool_calls ?? [],
      finishReason: choice?.finish_reason ?? null,
      usage: toUsage(body.usage),
    };
  }
}

function toUsage(usage: StreamChunk['usage']): ChatUsage {
  return {
    prompt: usage?.prompt_tokens ?? 0,
    completion: usage?.completion_tokens ?? 0,
    total: usage?.total_tokens ?? 0,
  };
}

function extractErrorMessage(body: string): string | null {
  try {
    const parsed = JSON.parse(body) as { error?: { message?: string } };
    return parsed.error?.message ?? null;
  } catch {
    return body.slice(0, 300) || null;
  }
}
