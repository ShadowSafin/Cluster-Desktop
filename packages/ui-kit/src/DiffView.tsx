import React from 'react';
import { Box, Text } from 'ink';

export interface DiffLine {
  type: 'context' | 'add' | 'remove' | 'hunk';
  text: string;
}

export const DiffView: React.FC<{ diff: string; sideBySide?: boolean; maxLines?: number }> = ({ diff, sideBySide = false, maxLines = 50 }) => {
  if (!diff.trim()) return <Text dimColor>(no diff)</Text>;

  const lines = diff.split('\n');
  const truncated = lines.length > maxLines;
  const visible = truncated ? [...lines.slice(0, maxLines - 2), `… ${lines.length - maxLines + 2} lines omitted …`, lines[lines.length - 1]!] : lines;

  if (sideBySide) {
    // Simplified side-by-side: pair adds/removes
    return (
      <Box flexDirection="column" borderStyle="single" borderColor="gray">
        {visible.map((line, idx) => {
          const color = line.startsWith('+') ? 'green' : line.startsWith('-') ? 'red' : line.startsWith('@@') ? 'cyan' : undefined;
          return <Text key={idx} color={color}>{line.slice(0, 80)}</Text>;
        })}
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      {visible.map((line, idx) => {
        let color: string | undefined;
        if (line.startsWith('+++') || line.startsWith('---')) color = 'gray';
        else if (line.startsWith('@@')) color = 'cyan';
        else if (line.startsWith('+')) color = 'green';
        else if (line.startsWith('-')) color = 'red';
        return <Text key={idx} color={color}>{line === '' ? ' ' : line}</Text>;
      })}
    </Box>
  );
};

export const HunkSummary: React.FC<{ header: string; adds: number; dels: number; preview: string }> = ({ header, adds, dels, preview }) => (
  <Box>
    <Text color="cyan">{header}</Text>
    <Text color="green"> +{adds}</Text>
    <Text color="red"> -{dels}</Text>
    <Text color="gray"> {preview.slice(0, 50)}</Text>
  </Box>
);
