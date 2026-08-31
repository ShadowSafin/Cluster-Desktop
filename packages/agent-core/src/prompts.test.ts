import { describe, expect, it } from 'vitest';
import { parseToolBlock } from './prompts.js';

describe('parseToolBlock', () => {
  it('parses a well-formed tool block', () => {
    const content = [
      'I will read the file.',
      '```tool',
      '{"tool": "read_file", "input": {"path": "src/index.ts"}}',
      '```',
    ].join('\n');
    expect(parseToolBlock(content)).toEqual({
      tool: 'read_file',
      input: { path: 'src/index.ts' },
    });
  });

  it('returns null when there is no tool block', () => {
    expect(parseToolBlock('just a normal reply')).toBeNull();
  });

  it('returns null for malformed JSON', () => {
    expect(parseToolBlock('```tool\n{not json}\n```')).toBeNull();
  });

  it('returns null when the block has no tool field', () => {
    expect(parseToolBlock('```tool\n{"input": {}}\n```')).toBeNull();
  });

  it('defaults input to {} when missing', () => {
    expect(parseToolBlock('```tool\n{"tool": "list_files"}\n```')).toEqual({
      tool: 'list_files',
      input: {},
    });
  });

  it('ignores stray triple backticks that are not a tool block', () => {
    expect(parseToolBlock('Use ```ts\nconst x = 1;\n``` for the example.')).toBeNull();
  });
});
