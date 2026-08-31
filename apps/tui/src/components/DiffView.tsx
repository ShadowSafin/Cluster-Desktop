import React from 'react';
import { Box, Text } from 'ink';
import { theme } from '../theme.js';

export interface DiffViewProps {
  diff: string;
  /** Maximum number of diff lines to render. */
  maxLines?: number;
}

/**
 * Render a unified diff.
 *
 * Long diffs are truncated from the middle so the UI never collapses under a
 * single large change.
 */
export const DiffView: React.FC<DiffViewProps> = ({ diff, maxLines = 40 }) => {
  if (!diff.trim()) {
    return (
      <Text color={theme.dim} italic>
        (no textual changes)
      </Text>
    );
  }

  const lines = diff.replace(/\r\n/g, '\n').split('\n');
  const overflow = lines.length - maxLines;
  const visible = overflow > 0 ? [...lines.slice(0, maxLines - 4), '…', `${overflow} more diff lines`, '…'] : lines;

  return (
    <Box flexDirection="column">
      {visible.map((line, index) => (
        <Text key={index} {...diffLineStyle(line)}>
          {line === '' ? ' ' : line}
        </Text>
      ))}
    </Box>
  );
};

function diffLineStyle(line: string): { color?: string; dimColor?: boolean } {
  if (line.startsWith('@@')) return { color: theme.diffHunk };
  if (line.startsWith('+++') || line.startsWith('---')) return { color: theme.diffHeader, dimColor: true };
  if (line.startsWith('+')) return { color: theme.diffAdd };
  if (line.startsWith('-')) return { color: theme.diffRemove };
  if (line.startsWith('…')) return { color: theme.dim };
  return { color: undefined };
}
