import React, { useState } from 'react';
import { Box, Text } from 'ink';
import { theme } from '../theme.js';
import type { Edit } from '@cluster/shared';

export interface DiffPanelProps {
  edits: Edit[];
  width?: number;
  focused?: boolean;
}

export const DiffPanel: React.FC<DiffPanelProps> = ({ edits }) => {
  const [mode, setMode] = useState<'unified' | 'side-by-side'>('unified');
  const [selected, setSelected] = useState<number>(0);
  const current = edits[selected];

  if (edits.length === 0) {
    return (
      <Box flexDirection="column" borderStyle="single" borderColor={theme.border} paddingX={1} paddingY={1}>
        <Text color={theme.dim} bold>diff</Text>
        <Text color={theme.dim}>No changes yet.</Text>
        <Box marginTop={1}>
          <Text color={theme.dim}>side-by-side · hunk accept/reject · apply-all · checkpoints</Text>
        </Box>
      </Box>
    );
  }

  const grouped = new Map<string, Edit[]>();
  for (const e of edits) {
    const arr = grouped.get(e.path) ?? [];
    arr.push(e);
    grouped.set(e.path, arr);
  }

  return (
    <Box flexDirection="column" borderStyle="single" borderColor={theme.border} paddingX={1} paddingY={1}>
      <Box justifyContent="space-between">
        <Text color={theme.accent} bold>diff · {edits.length} edits</Text>
        <Text color={theme.dim}>{mode} · tab switch · a/r accept/reject · u apply-all</Text>
      </Box>

      <Box flexDirection="column" marginTop={1}>
        <Text color={theme.dim} bold>by file</Text>
        {[...grouped.entries()].slice(0, 6).map(([path, list]) => {
          const adds = list.reduce((s, e) => s + e.additions, 0);
          const dels = list.reduce((s, e) => s + e.deletions, 0);
          return (
            <Box key={path}>
              <Text color={theme.primary}>{path}</Text>
              <Text color={theme.success}> +{adds}</Text>
              <Text color={theme.error}> -{dels}</Text>
              <Text color={theme.dim}> ({list.length} hunks)</Text>
            </Box>
          );
        })}
        {grouped.size > 6 ? <Text color={theme.dim}>… {grouped.size - 6} more files</Text> : null}
      </Box>

      {current ? (
        <Box flexDirection="column" marginTop={1} borderStyle="single" borderColor={theme.border} paddingX={1}>
          <Box justifyContent="space-between">
            <Text color={theme.primary} bold>{current.path}</Text>
            <Text color={current.kind === 'create' ? theme.success : theme.warning}>+{current.additions} -{current.deletions}</Text>
          </Box>
          <Box>
            <Text color={theme.dim}>hunks: </Text>
            <Text color={theme.dim}>{current.diff.split('@@').length - 1} · {mode === 'side-by-side' ? 'side-by-side' : 'unified'}</Text>
          </Box>
          <Box flexDirection="column" marginTop={1} height={10} overflow="hidden">
            {current.diff.split('\n').slice(0, 20).map((line, idx) => {
              let color: string | undefined;
              if (line.startsWith('+')) color = theme.diffAdd;
              else if (line.startsWith('-')) color = theme.diffRemove;
              else if (line.startsWith('@@')) color = theme.diffHunk;
              else if (line.startsWith('---') || line.startsWith('+++')) color = theme.dim;
              return <Text key={idx} color={color} wrap="truncate">{line.slice(0, 60)}</Text>;
            })}
          </Box>
          <Box marginTop={1}>
            <Text color={theme.dim}>[←→] file · [s] side-by-side · [a] accept all · [r] reject all · [c] checkpoint</Text>
          </Box>
        </Box>
      ) : null}

      <Box marginTop={1}>
        <Text color={theme.dim}>patch history: {edits.length} entries · rollback via checkpoint</Text>
      </Box>
    </Box>
  );
};
