import React from 'react';
import { Box, Text } from 'ink';
import { theme } from '../theme.js';
import type { Checkpoint } from '@cluster/shared';

export interface CheckpointPanelProps {
  checkpoints: Checkpoint[];
  currentId?: string;
}

export const CheckpointPanel: React.FC<CheckpointPanelProps> = ({ checkpoints, currentId }) => {
  if (checkpoints.length === 0) {
    return (
      <Box flexDirection="column" borderStyle="single" borderColor={theme.border} paddingX={1} paddingY={1}>
        <Text color={theme.dim} bold>checkpoints</Text>
        <Text color={theme.dim}>No checkpoints. One is created before each edit.</Text>
      </Box>
    );
  }
  return (
    <Box flexDirection="column" borderStyle="single" borderColor={theme.border} paddingX={1} paddingY={1}>
      <Text color={theme.accent} bold>checkpoints · rollback</Text>
      {checkpoints.slice(0, 6).map((chk) => (
        <Box key={chk.id}>
          <Text color={currentId === chk.id ? theme.success : theme.dim}>{currentId === chk.id ? '●' : '○'} </Text>
          <Text color={theme.primary}>{chk.id.slice(0, 8)}</Text>
          <Text color={theme.dim}> {new Date(chk.createdAt).toLocaleTimeString()} — {chk.message.slice(0, 40)}</Text>
          <Text color={theme.dim}> ({chk.files.length} files)</Text>
        </Box>
      ))}
      {checkpoints.length > 6 ? <Text color={theme.dim}>… {checkpoints.length - 6} more</Text> : null}
      <Box marginTop={1}>
        <Text color={theme.dim}>[c] create · [u] rollback · visual risk indicators</Text>
      </Box>
    </Box>
  );
};
