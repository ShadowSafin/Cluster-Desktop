import React from 'react';
import { Box, Text, useInput } from 'ink';
import { theme } from '../theme.js';

export interface ComposerProps {
  value: string;
  cursor: number;
  focused: boolean;
  disabled: boolean;
  width: number;
  placeholder?: string;
  onChange(value: string, cursor: number): void;
  onSubmit(): void;
  onHistory(direction: -1 | 1): void;
  onCancel(): void;
  /** Typed "/" or "?" into an empty composer. */
  onQuickAction(key: '/' | '?'): void;
}

const MAX_VISIBLE_LINES = 6;

/** Split value + cursor offset into (line, column) coordinates. */
function locate(value: string, cursor: number): { line: number; column: number } {
  const before = value.slice(0, cursor);
  const parts = before.split('\n');
  return { line: parts.length - 1, column: parts[parts.length - 1]?.length ?? 0 };
}

/**
 * Multiline message composer.
 *
 * Enter submits. Newlines are inserted with Shift+Enter where the terminal
 * reports it, and with Ctrl+J or Alt+Enter everywhere else — there is no
 * portable Shift+Enter escape sequence, so one reliable binding is required.
 */
export const Composer: React.FC<ComposerProps> = ({
  value,
  cursor,
  focused,
  disabled,
  width,
  placeholder = 'Describe a task…',
  onChange,
  onSubmit,
  onHistory,
  onCancel,
  onQuickAction,
}) => {
  useInput(
    (input, key) => {
      if (disabled) return;

      const insert = (text: string): void => {
        const next = value.slice(0, cursor) + text + value.slice(cursor);
        onChange(next, cursor + text.length);
      };

      // --- Newline (checked before submit) ---
      if (
        (key.return && key.shift) ||
        (key.return && key.meta) ||
        (key.ctrl && input === 'j') ||
        input === '\n'
      ) {
        insert('\n');
        return;
      }

      if (key.return) {
        onSubmit();
        return;
      }

      if (key.escape) {
        onCancel();
        return;
      }

      if (key.upArrow) {
        // Only reach for history when the caret is already on the first line.
        if (locate(value, cursor).line === 0) onHistory(-1);
        return;
      }
      if (key.downArrow) {
        if (locate(value, cursor).line === value.split('\n').length - 1) onHistory(1);
        return;
      }

      if (key.leftArrow) {
        onChange(value, Math.max(0, cursor - 1));
        return;
      }
      if (key.rightArrow) {
        onChange(value, Math.min(value.length, cursor + 1));
        return;
      }

      if (key.backspace) {
        if (cursor === 0) return;
        onChange(value.slice(0, cursor - 1) + value.slice(cursor), cursor - 1);
        return;
      }
      if (key.delete) {
        onChange(value.slice(0, cursor) + value.slice(cursor + 1), cursor);
        return;
      }

      if (key.ctrl && input === 'u') {
        onChange('', 0);
        return;
      }

      // Ignore bare modifier keystrokes.
      if (key.ctrl || key.meta) return;

      // "/" and "?" open overlays only from an empty buffer, so they never
      // interfere with ordinary typing.
      if (value === '' && (input === '/' || input === '?')) {
        onQuickAction(input);
        return;
      }

      if (input && input.length > 0) insert(input);
    },
    { isActive: focused && !disabled },
  );

  const lines = value.split('\n');
  const { line: cursorLine, column: cursorColumn } = locate(value, cursor);

  // Keep the caret visible when the buffer grows past the visible window.
  const windowStart = Math.max(0, Math.min(lines.length - MAX_VISIBLE_LINES, cursorLine - MAX_VISIBLE_LINES + 1));
  const visibleLines = lines.slice(windowStart, windowStart + MAX_VISIBLE_LINES);

  const borderColor = disabled ? theme.dim : focused ? theme.accent : theme.border;

  return (
    <Box flexDirection="column" width={width}>
      <Box borderStyle="round" borderColor={borderColor} flexDirection="column" paddingX={1}>
        {visibleLines.map((line, index) => {
          const actualLine = windowStart + index;
          const isCursorLine = actualLine === cursorLine && focused && !disabled;

          return (
            <Box key={actualLine}>
              <Text color={theme.accent}>{actualLine === 0 ? '❯ ' : '  '}</Text>
              {line === '' && !isCursorLine ? (
                <Text color={theme.dim}> </Text>
              ) : isCursorLine ? (
                <Text wrap="wrap">
                  {line.slice(0, cursorColumn)}
                  <Text inverse>{line.slice(cursorColumn, cursorColumn + 1) || ' '}</Text>
                  {line.slice(cursorColumn + 1)}
                </Text>
              ) : (
                <Text wrap="wrap">{line}</Text>
              )}
            </Box>
          );
        })}

        {value === '' ? (
          <Box>
            <Text color={theme.dim}>{placeholder}</Text>
          </Box>
        ) : null}

        {lines.length > 1 ? (
          <Box>
            <Text color={theme.dim}>
              {lines.length} lines · Enter to send · Ctrl+J for newline
            </Text>
          </Box>
        ) : null}
      </Box>
    </Box>
  );
};
