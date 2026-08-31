import React from 'react';
import { Box, Text } from 'ink';
import { formatDuration, sanitizeForDisplay, truncateLines, type ToolCall } from '@cluster/shared';
import { riskColors, statusIcons, theme } from '../theme.js';
import { DiffView } from './DiffView.js';

export interface ToolCallCardProps {
  call: ToolCall;
  /** Live stdout/stderr for a command that is still running. */
  liveOutput?: string;
  expanded: boolean;
}

/** One-line description of what a call is doing, for the activity line. */
export function summarizeToolInput(name: string, input: unknown): string {
  if (!input || typeof input !== 'object') return '';
  const record = input as Record<string, unknown>;

  switch (name) {
    case 'read_file':
    case 'write_file':
    case 'patch_file':
      return String(record['path'] ?? '');
    case 'list_files':
      return String(record['pattern'] ?? record['path'] ?? '.');
    case 'search_text':
      return `"${String(record['query'] ?? '')}"`;
    case 'run_command':
      return String(record['command'] ?? '');
    default:
      return '';
  }
}

export const ToolCallCard: React.FC<ToolCallCardProps> = ({ call, liveOutput, expanded }) => {
  const target = summarizeToolInput(call.name, call.input);
  const icon = statusIcons[call.status] ?? '•';
  const color =
    call.status === 'error' || call.status === 'rejected'
      ? theme.error
      : call.status === 'success'
        ? theme.success
        : call.status === 'running'
          ? theme.accent
          : theme.dim;

  const duration = call.durationMs === undefined ? '' : formatDuration(call.durationMs);

  return (
    <Box flexDirection="column" paddingLeft={2} marginBottom={expanded ? 1 : 0}>
      <Box>
        <Box width={2} flexShrink={0}>
          <Text color={color}>{icon}</Text>
        </Box>
        <Box flexGrow={1}>
          <Text color={theme.tool} bold>
            {call.name}
          </Text>
          {target ? (
            <>
              <Text color={theme.dim}>{'  '}</Text>
              <Text color={theme.primary} wrap="truncate">
                {target}
              </Text>
            </>
          ) : null}
          {call.risk !== 'safe' ? (
            <>
              <Text color={theme.dim}>{'  '}</Text>
              <Text color={riskColors[call.risk]}>{call.risk}</Text>
            </>
          ) : null}
          {duration ? (
            <>
              <Text color={theme.dim}>{'  '}</Text>
              <Text color={theme.dim}>{duration}</Text>
            </>
          ) : null}
        </Box>
      </Box>

      <ToolCallBody call={call} liveOutput={liveOutput} expanded={expanded} />
    </Box>
  );
};

const ToolCallBody: React.FC<ToolCallCardProps> = ({ call, liveOutput, expanded }) => {
  // A running command shows its output live; that is the whole point of the
  // streaming path.
  if (call.status === 'running' && liveOutput) {
    const tail = truncateLines(sanitizeForDisplay(liveOutput), 12);
    return (
      <Box paddingLeft={2} flexDirection="column">
        <Text color={theme.dim} wrap="wrap">
          {tail}
        </Text>
      </Box>
    );
  }

  if (!expanded) return null;

  const diff = call.result?.artifacts?.find((artifact) => artifact.type === 'diff');

  return (
    <Box paddingLeft={2} flexDirection="column">
      {call.result?.error ? (
        <Box flexDirection="column">
          <Text color={theme.error} wrap="wrap">
            {call.result.error.message}
          </Text>
          {call.result.error.hint ? (
            <Text color={theme.dim} wrap="wrap">
              hint: {call.result.error.hint}
            </Text>
          ) : null}
        </Box>
      ) : null}

      {diff && diff.type === 'diff' ? <DiffView diff={diff.diff} maxLines={30} /> : null}

      {call.result && !call.result.ok && !call.result.error ? (
        <Text color={theme.error} wrap="wrap">
          {truncateLines(sanitizeForDisplay(call.result.output), 15)}
        </Text>
      ) : null}

      {call.result?.ok && !diff ? (
        <Text color={theme.dim} wrap="wrap">
          {truncateLines(sanitizeForDisplay(call.result.output), 15)}
        </Text>
      ) : null}
    </Box>
  );
};
