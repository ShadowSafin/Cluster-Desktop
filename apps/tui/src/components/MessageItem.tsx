import React from 'react';
import { Box, Text } from 'ink';
import { sanitizeForDisplay, truncateLines, type Message } from '@cluster/shared';
import { theme } from '../theme.js';

export interface MessageItemProps {
  message: Message;
  /** Vertical budget for this message, in lines. */
  maxLines?: number;
}

function frameFor(kind: Message['kind']): { prefix: string; color: string } {
  switch (kind) {
    case 'summary':
      return { prefix: '✔', color: theme.success };
    case 'error':
      return { prefix: '✖', color: theme.error };
    case 'warning':
      return { prefix: '!', color: theme.warning };
    case 'info':
      return { prefix: 'ℹ', color: theme.info };
    default:
      return { prefix: '', color: '' };
  }
}

export const MessageItem: React.FC<MessageItemProps> = ({ message, maxLines = 30 }) => {
  const content = sanitizeForDisplay(message.content);

  if (message.role === 'user') {
    return (
      <Box flexDirection="column" marginBottom={1}>
        <Box>
          <Box width={2} flexShrink={0}>
            <Text color={theme.user} bold>
              ❯
            </Text>
          </Box>
          <Box flexGrow={1}>
            <Text color={theme.user} wrap="wrap">
              {content}
            </Text>
          </Box>
        </Box>
      </Box>
    );
  }

  if (message.role === 'tool') {
    // Tool results are verbose by nature; collapse them by default so the
    // conversation stays readable.
    const capped = truncateLines(content, Math.max(6, Math.floor(maxLines / 2)));
    return (
      <Box paddingLeft={2} flexDirection="column">
        <Text color={theme.dim} wrap="wrap">
          {capped}
        </Text>
      </Box>
    );
  }

  if (message.role === 'system') {
    return (
      <Box paddingLeft={2}>
        <Text color={theme.dim} italic wrap="wrap">
          {content}
        </Text>
      </Box>
    );
  }

  const frame = frameFor(message.kind);
  const showFrame = frame.prefix !== '';

  return (
    <Box flexDirection="column" marginBottom={message.kind === 'chat' && content === '' ? 0 : 1}>
      <Box>
        <Box width={2} flexShrink={0}>
          <Text color={frame.color} bold>
            {frame.prefix}
          </Text>
        </Box>
        <Box flexGrow={1}>
          <Text
            color={showFrame ? frame.color : message.kind === 'summary' ? theme.primary : theme.assistant}
            wrap="wrap"
          >
            {content}
          </Text>
        </Box>
      </Box>
    </Box>
  );
};
