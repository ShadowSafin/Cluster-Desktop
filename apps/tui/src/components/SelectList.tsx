import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { theme } from '../theme.js';

export interface SelectItem {
  id: string;
  label: string;
  detail?: string;
}

export interface SelectListProps {
  title: string;
  items: SelectItem[];
  onSelect(id: string): void;
  onCancel(): void;
  emptyMessage?: string;
}

/** Keyboard-driven picker shared by the session browser and quick actions. */
export const SelectList: React.FC<SelectListProps> = ({
  title,
  items,
  onSelect,
  onCancel,
  emptyMessage = 'Nothing to show.',
}) => {
  const [index, setIndex] = useState(0);

  useInput((input, key) => {
    if (key.escape) {
      onCancel();
      return;
    }
    if (items.length === 0) return;

    if (key.upArrow || (key.ctrl && input === 'p')) {
      setIndex((current) => (current - 1 + items.length) % items.length);
      return;
    }
    if (key.downArrow || (key.ctrl && input === 'n')) {
      setIndex((current) => (current + 1) % items.length);
      return;
    }
    if (key.return) {
      const item = items[index];
      if (item) onSelect(item.id);
    }
  });

  return (
    <Box flexDirection="column" borderStyle="round" borderColor={theme.accent} paddingX={1} paddingY={1}>
      <Text color={theme.accent} bold>
        {title}
      </Text>

      {items.length === 0 ? (
        <Box marginTop={1}>
          <Text color={theme.dim}>{emptyMessage}</Text>
        </Box>
      ) : (
        <Box marginTop={1} flexDirection="column">
          {items.map((item, itemIndex) => {
            const selected = itemIndex === index;
            return (
              <Box key={item.id}>
                <Box width={2}>
                  <Text color={selected ? theme.accent : theme.dim}>{selected ? '❯' : ' '}</Text>
                </Box>
                <Text color={selected ? theme.primary : theme.dim} wrap="truncate">
                  {item.label}
                </Text>
                {item.detail ? (
                  <>
                    <Text color={theme.dim}>  </Text>
                    <Text color={theme.dim} wrap="truncate">
                      {item.detail}
                    </Text>
                  </>
                ) : null}
              </Box>
            );
          })}
        </Box>
      )}

      <Box marginTop={1}>
        <Text color={theme.dim}>↑/↓ to move · Enter to select · Esc to cancel</Text>
      </Box>
    </Box>
  );
};
