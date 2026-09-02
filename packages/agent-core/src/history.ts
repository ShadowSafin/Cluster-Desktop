import type { Message, ToolCall } from '@cluster/shared';
import type { ProviderMessage } from './provider.js';

/**
 * Rebuild the provider-visible transcript from a stored session.
 *
 * Stored messages and tool calls are separate collections, but the chat
 * protocol interleaves them: an assistant message carrying `tool_calls` must be
 * followed by a `tool` message for each id. This reassembles that pairing.
 */
export function toProviderMessages(messages: readonly Message[], toolCalls: readonly ToolCall[]): ProviderMessage[] {
  const byId = new Map(toolCalls.map((call) => [call.id, call]));
  const out: ProviderMessage[] = [];

  for (const message of messages) {
    if (message.role === 'system') continue;

    if (message.role === 'assistant') {
      const calls = (message.toolCallIds ?? [])
        .map((id) => byId.get(id))
        .filter((call): call is ToolCall => Boolean(call))
        .map((call) => ({
          id: call.id,
          type: 'function' as const,
          function: { name: call.name, arguments: JSON.stringify(call.input ?? {}) },
        }));

      out.push({
        role: 'assistant',
        content: message.content === '' ? null : message.content,
        ...(calls.length > 0 ? { tool_calls: calls } : {}),
      });
      continue;
    }

    if (message.role === 'tool') {
      const callId = (message.toolCallIds ?? [])[0];
      if (!callId) continue;
      out.push({ role: 'tool', content: message.content, tool_call_id: callId });
      continue;
    }

    // Deduplicate consecutive identical user messages
    const last = out[out.length - 1];
    if (last && last.role === 'user' && last.content === message.content) {
      continue;
    }

    out.push({ role: 'user', content: message.content });
  }

  return out;
}

/**
 * Trim history to a character budget, always keeping the newest turns and the
 * first user message for context.
 */
export function trimHistory(messages: ProviderMessage[], maxChars: number): ProviderMessage[] {
  const total = messages.reduce((sum, message) => sum + (message.content?.length ?? 0), 0);
  if (total <= maxChars) return messages;

  const out: ProviderMessage[] = [];
  let used = 0;

  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index]!;
    const size = message.content?.length ?? 0;
    if (used + size > maxChars && out.length > 0) break;
    used += size;
    out.unshift(message);
  }

  return out;
}
