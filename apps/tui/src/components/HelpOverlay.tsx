import React from 'react';
import { Box, Text, useInput } from 'ink';
import { theme } from '../theme.js';

export interface HelpOverlayProps {
  onClose(): void;
}

const SHORTCUTS: Array<[string, string]> = [
  ['Enter', 'Send the prompt'],
  ['Shift+Enter / Ctrl+J', 'Insert a newline (multiline input)'],
  ['Esc', 'Cancel the current run, or close this overlay'],
  ['Ctrl+C', 'Stop current work · press again to quit'],
  ['Tab', 'Cycle focus: composer → chat'],
  ['↑ / ↓', 'Prompt history (in composer) · scroll (in chat)'],
  ['PgUp / PgDn', 'Scroll the conversation'],
  ['Ctrl+A', 'Toggle the activity panel'],
  ['Ctrl+R', 'Reload the session from disk'],
  ['Ctrl+T', 'Expand or collapse every tool call'],
  ['?', 'Show this help'],
];

const COMMANDS: Array<[string, string]> = [
  ['/help', 'Show this help'],
  ['/clear', 'Clear the visible conversation'],
  ['/plan', 'Show the current plan'],
  ['/status', 'Show workspace and session status'],
  ['/edits', 'List files changed in this session'],
  ['/exit', 'Quit'],
];

export const HelpOverlay: React.FC<HelpOverlayProps> = ({ onClose }) => {
  useInput((input, key) => {
    if (key.escape || input === '?' || key.return) onClose();
  });

  return (
    <Box flexDirection="column" borderStyle="round" borderColor={theme.accent} paddingX={2} paddingY={1}>
      <Text color={theme.accent} bold>
        Keyboard
      </Text>

      <Box marginTop={1} flexDirection="column">
        {SHORTCUTS.map(([keys, description]) => (
          <Box key={keys}>
            <Box width={26}>
              <Text color={theme.primary}>{keys}</Text>
            </Box>
            <Text color={theme.dim}>{description}</Text>
          </Box>
        ))}
      </Box>

      <Box marginTop={1}>
        <Text color={theme.accent} bold>
          Slash commands
        </Text>
      </Box>

      <Box marginTop={1} flexDirection="column">
        {COMMANDS.map(([command, description]) => (
          <Box key={command}>
            <Box width={26}>
              <Text color={theme.primary}>{command}</Text>
            </Box>
            <Text color={theme.dim}>{description}</Text>
          </Box>
        ))}
      </Box>

      <Box marginTop={1}>
        <Text color={theme.dim}>Press Esc to close</Text>
      </Box>
    </Box>
  );
};
