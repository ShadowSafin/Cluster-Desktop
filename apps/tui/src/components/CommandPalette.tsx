import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { theme } from '../theme.js';

export interface CommandItem {
  id: string;
  label: string;
  detail?: string;
  hotkey?: string;
}

export interface CommandPaletteProps {
  items: CommandItem[];
  onSelect: (id: string) => void;
  onCancel: () => void;
  title?: string;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({ items, onSelect, onCancel, title = 'command palette' }) => {
  const [query, setQuery] = useState('');
  const [index, setIndex] = useState(0);

  const filtered = query.trim() === '' ? items : items.filter((item) => `${item.label} ${item.detail ?? ''}`.toLowerCase().includes(query.toLowerCase()));
  const selected = filtered[index];

  useInput((input, key) => {
    if (key.escape) onCancel();
    if (key.upArrow) setIndex((i) => Math.max(0, i - 1));
    if (key.downArrow) setIndex((i) => Math.min(filtered.length - 1, i + 1));
    if (key.return && selected) onSelect(selected.id);
    if (key.backspace || key.delete) setQuery((q) => q.slice(0, -1));
    else if (input && !key.ctrl && !key.meta && input.length === 1) setQuery((q) => q + input);
  });

  return (
    <Box flexDirection="column" borderStyle="double" borderColor={theme.accent} paddingX={1} paddingY={1}>
      <Box justifyContent="space-between">
        <Text color={theme.accent} bold>{title}</Text>
        <Text color={theme.dim}>esc cancel · ↑↓ navigate · enter select · type to search</Text>
      </Box>
      <Box marginTop={1} borderStyle="single" borderColor={theme.border} paddingX={1}>
        <Text color={theme.dim}>› </Text>
        <Text color={theme.primary}>{query}</Text>
        <Text color={theme.accent}>▌</Text>
      </Box>
      <Box flexDirection="column" marginTop={1}>
        {filtered.slice(0, 8).map((item, idx) => (
          <Box key={item.id} paddingX={1} {...(idx === index ? { backgroundColor: 'blue' } : {})}>
            <Text color={idx === index ? 'white' : theme.primary} bold={idx === index}>{item.label}</Text>
            {item.detail ? <Text color={idx === index ? 'white' : theme.dim}> — {item.detail}</Text> : null}
            {item.hotkey ? <Text color={theme.warning}> [{item.hotkey}]</Text> : null}
          </Box>
        ))}
        {filtered.length === 0 ? <Text color={theme.dim}>no matches for "{query}"</Text> : null}
        {filtered.length > 8 ? <Text color={theme.dim}>… {filtered.length - 8} more</Text> : null}
      </Box>
    </Box>
  );
};
