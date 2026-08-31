import React from 'react';
import { Box, Text } from 'ink';
import { theme } from '../theme.js';
import type { ActivityLine } from '../hooks/useAgent.js';

export interface ActivityFeedProps {
  lines: ActivityLine[];
  rows: number;
  width: number;
}

/**
 * Rolling activity log.
 *
 * Newest entries are at the bottom so the feed reads like a tail, and the view
 * is bounded by `rows` so noisy command output cannot push the composer off
 * screen.
 */
export const ActivityFeed: React.FC<ActivityFeedProps> = ({ lines, rows, width }) => {
  const visible = lines.slice(-Math.max(1, rows - 2));

  return (
    <Box
      flexDirection="column"
      borderStyle="single"
      borderColor={theme.border}
      width={width}
      height={rows}
      paddingX={1}
      overflow="hidden"
    >
      <Text color={theme.dim} bold>
        activity
      </Text>
      {visible.length === 0 ? (
        <Text color={theme.dim}>no activity yet</Text>
      ) : (
        visible.map((line) => (
          <Text
            key={line.id}
            color={
              line.level === 'error' ? theme.error : line.level === 'warn' ? theme.warning : theme.dim
            }
            wrap="truncate"
          >
            {line.text}
          </Text>
        ))
      )}
    </Box>
  );
};
