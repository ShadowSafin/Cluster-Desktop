import { describe, expect, it } from 'vitest';
import { toProviderMessages, trimHistory } from './history.js';
import type { Message, ToolCall } from '@cluster/shared';

const baseToolCall: ToolCall = {
  id: 'call_1',
  sessionId: 'sess_1',
  messageId: 'msg_1',
  name: 'read_file',
  input: { path: 'src/index.ts' },
  createdAt: '2026-01-01T00:00:00.000Z',
  startedAt: '2026-01-01T00:00:00.000Z',
  finishedAt: '2026-01-01T00:00:01.000Z',
  durationMs: 12,
  status: 'success',
  risk: 'safe',
  confirmation: 'not-required',
  result: { ok: true, output: 'ok', data: {} },
};

describe('toProviderMessages', () => {
  it('round-trips a transcript with a tool call and tool response', () => {
    const messages: Message[] = [
      { id: 'm1', sessionId: 's', role: 'user', content: 'hi', createdAt: 't', kind: 'chat' },
      {
        id: 'm2',
        sessionId: 's',
        role: 'assistant',
        content: 'reading',
        createdAt: 't',
        kind: 'chat',
        toolCallIds: ['call_1'],
      },
      {
        id: 'm3',
        sessionId: 's',
        role: 'tool',
        content: 'file contents',
        createdAt: 't',
        kind: 'tool-result',
        toolCallIds: ['call_1'],
      },
    ];
    const out = toProviderMessages(messages, [baseToolCall]);
    expect(out).toEqual([
      { role: 'user', content: 'hi' },
      {
        role: 'assistant',
        content: 'reading',
        tool_calls: [
          {
            id: 'call_1',
            type: 'function',
            function: { name: 'read_file', arguments: '{"path":"src/index.ts"}' },
          },
        ],
      },
      { role: 'tool', content: 'file contents', tool_call_id: 'call_1' },
    ]);
  });

  it('skips system messages', () => {
    const messages: Message[] = [
      { id: 'm1', sessionId: 's', role: 'system', content: 'sys', createdAt: 't', kind: 'chat' },
      { id: 'm2', sessionId: 's', role: 'user', content: 'hi', createdAt: 't', kind: 'chat' },
    ];
    expect(toProviderMessages(messages, []).map((m) => m.role)).toEqual(['user']);
  });

  it('emits null content for blank assistant messages', () => {
    const messages: Message[] = [
      { id: 'm1', sessionId: 's', role: 'user', content: 'hi', createdAt: 't', kind: 'chat' },
      { id: 'm2', sessionId: 's', role: 'assistant', content: '', createdAt: 't', kind: 'chat' },
    ];
    const out = toProviderMessages(messages, []);
    expect(out[1]).toEqual({ role: 'assistant', content: null });
  });

  it('skips assistant tool_call refs whose records are missing', () => {
    const messages: Message[] = [
      { id: 'm1', sessionId: 's', role: 'user', content: 'hi', createdAt: 't', kind: 'chat' },
      {
        id: 'm2',
        sessionId: 's',
        role: 'assistant',
        content: 'try',
        createdAt: 't',
        kind: 'chat',
        toolCallIds: ['call_missing'],
      },
    ];
    const out = toProviderMessages(messages, []);
    expect(out[1]).toEqual({ role: 'assistant', content: 'try' });
  });
});

describe('trimHistory', () => {
  function msg(content: string) {
    return { role: 'user' as const, content };
  }

  it('returns messages unchanged when under the budget', () => {
    const history = [msg('a'), msg('b'), msg('c')];
    expect(trimHistory(history, 100)).toBe(history);
  });

  it('keeps the latest messages when over the budget', () => {
    const history = [msg('aaaa'), msg('bbbb'), msg('cccc'), msg('dddd')];
    const trimmed = trimHistory(history, 6);
    // Each message is 4 chars; the greedy tail-only fit keeps just the newest.
    expect(trimmed.map((m) => m.content)).toEqual(['dddd']);
  });

  it('keeps the last messages up to the budget', () => {
    const history = [msg('aaaa'), msg('bbbb'), msg('cccc'), msg('dddd')];
    const trimmed = trimHistory(history, 12);
    // Budget 12 fits the last three (3 * 4 = 12), keeping the most recent turns.
    expect(trimmed.map((m) => m.content)).toEqual(['bbbb', 'cccc', 'dddd']);
  });

  it('handles messages whose combined size exactly matches the budget', () => {
    const history = [msg('aaaa'), msg('bbbb')];
    expect(trimHistory(history, 8).map((m) => m.content)).toEqual(['aaaa', 'bbbb']);
  });
});
