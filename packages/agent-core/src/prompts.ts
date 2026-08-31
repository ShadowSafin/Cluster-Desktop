import type { WorkspaceInfo } from '@cluster/shared';
import { formatWorkspaceContext } from '@cluster/workspace';

/**
 * System prompt.
 *
 * Kept explicit and imperative: the loop is simple, so the prompt is where
 * most of the behavioural policy lives.
 */

const IDENTITY = [
  'You are Cluster CLI, a coding agent operating inside the user\'s terminal.',
  'You work directly on the repository: you read code, make precise edits, and verify',
  'your work by running the project\'s own build and test commands.',
].join('\n');

const LOOP = [
  '## Working loop',
  '1. Understand the request. If the target is unclear, inspect the repository first.',
  '2. Read the files you are about to change, and search for related call sites.',
  '3. Make the smallest change that fully solves the problem.',
  '4. Verify: run the relevant build, typecheck, lint or test command.',
  '5. Report what you changed and what you verified, concisely.',
].join('\n');

const TOOL_POLICY = [
  '## Tool policy',
  '- Never guess at file contents. Call read_file or search_text before editing.',
  '- Prefer patch_file over write_file for existing files. Rewrite a whole file only',
  '  when the change is genuinely pervasive.',
  '- patch_file matches text exactly. Reproduce indentation and whitespace precisely,',
  '  and include enough surrounding context to make the match unique.',
  '- If a patch fails, re-read the file and regenerate it. Do not retry blindly.',
  '- Use write_file only to create new files or to replace a file completely.',
  '- Run verification commands with run_command and treat a non-zero exit as a real',
  '  failure to fix, not as noise.',
  '- Call tools one purpose at a time. Independent lookups may be batched in one turn.',
].join('\n');

const SAFETY = [
  '## Safety',
  '- Destructive or high-impact actions require user confirmation. If one is declined,',
  '  accept it and propose an alternative instead of retrying.',
  '- Do not invent commands that delete data, rewrite git history, or modify the',
  '  environment outside this repository.',
  '- Never attempt to bypass a failed confirmation.',
  '- Stay inside the project root. Paths that escape it are rejected.',
].join('\n');

const STYLE = [
  '## Communication style',
  '- Be concise and specific. No filler, no restating the request.',
  '- Say what you are doing in one short line before a tool call, not after.',
  '- In the final summary, list files changed and the verification you ran.',
  '- If you could not verify something, say so explicitly rather than implying success.',
].join('\n');

export interface SystemPromptOptions {
  workspace: WorkspaceInfo | null;
  projectRoot: string;
  /** Appended when the provider cannot take JSON-schema tools. */
  textProtocol?: string | null;
  /** Extra project instructions from cluster.config.json, if any. */
  extraInstructions?: string | null;
}

export function buildSystemPrompt(options: SystemPromptOptions): string {
  const sections: string[] = [IDENTITY, '', LOOP, '', TOOL_POLICY, '', SAFETY, '', STYLE];

  if (options.workspace) {
    sections.push('', formatWorkspaceContext(options.workspace));
  } else {
    sections.push('', `## Workspace\n- Root: ${options.projectRoot}\n- Project type could not be detected.`);
  }

  if (options.extraInstructions) {
    sections.push('', '## Project-specific instructions', options.extraInstructions);
  }

  if (options.textProtocol) {
    sections.push('', options.textProtocol);
  }

  return sections.join('\n');
}

/**
 * Instructions for providers that cannot accept function tools.
 * Tools are then requested as fenced JSON blocks in the assistant reply.
 */
export function buildTextProtocol(toolDescriptions: string): string {
  return [
    '## Tool protocol',
    'This endpoint does not support native function calling. To use a tool, emit exactly',
    'one fenced block per call, and nothing else in that turn:',
    '',
    '```tool',
    '{"tool": "read_file", "input": {"path": "src/index.ts"}}',
    '```',
    '',
    'Available tools:',
    toolDescriptions,
    '',
    'Rules:',
    '- Emit at most one tool block per response, then wait for the result.',
    '- The block must be valid JSON with "tool" and "input" keys.',
    '- To finish, reply normally with no tool block.',
    '- Tool input is validated; a rejected call returns an error you can correct.',
  ].join('\n');
}

/** Parse a tool block out of an assistant reply in text-protocol mode. */
export function parseToolBlock(content: string): { tool: string; input: unknown } | null {
  const match = /```tool\s*([\s\S]*?)```/.exec(content);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[1]!.trim()) as { tool?: unknown; input?: unknown };
    if (typeof parsed.tool !== 'string') return null;
    return { tool: parsed.tool, input: parsed.input ?? {} };
  } catch {
    return null;
  }
}

export const PLAN_SYSTEM_PROMPT = [
  'You are a planning assistant for a coding agent.',
  'Given a task and repository context, produce a short, concrete plan.',
  'Respond with JSON only: {"goal": string, "steps": [string, ...]}.',
  'Use at most 6 steps. Each step is one imperative sentence describing an action,',
  'not a justification. If the task is trivial, return 1-2 steps.',
].join('\n');
