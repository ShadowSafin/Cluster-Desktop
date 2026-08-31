import React, { useCallback, useMemo } from 'react';
import { Box, Text } from 'ink';
import { truncateLines, type Message } from '@cluster/shared';
import { theme } from '../theme.js';
import { MessageItem } from './MessageItem.js';
import { ToolCallCard } from './ToolCallCard.js';
import type { TimelineEntry } from '../hooks/useAgent.js';

export interface ChatViewProps {
  entries: TimelineEntry[];
  liveOutput: Record<string, string>;
  streamingText: string;
  /** Vertical space available, in terminal rows. */
  rows: number;
  width: number;
  /** How many entries are scrolled up from the bottom. */
  scrollOffset: number;
  /** Tool call ids whose details are expanded (Ctrl+T toggles all). */
  expandedTools: Set<string>;
}

/**
 * Scrollable conversation view.
 *
 * Ink has no scrolling container, so visibility is computed here: entries are
 * measured (estimated, then clamped by `rows`) and only the ones that fit are
 * rendered, anchored to the bottom unless the user has scrolled up.
 */
export const ChatView: React.FC<ChatViewProps> = ({
  entries,
  liveOutput,
  streamingText,
  rows,
  width,
  scrollOffset,
  expandedTools,
}) => {
  const innerWidth = Math.max(20, width - 4);

  // Failed calls are always expanded: an error the user cannot see is an error
  // they cannot act on.
  const isExpanded = useCallback(
    (entry: TimelineEntry): boolean =>
      expandedTools.has(entry.id) || (entry.kind === 'tool' && entry.call.status === 'error'),
    [expandedTools],
  );

  const heights = useMemo(
    () => entries.map((entry) => estimateEntryHeight(entry, innerWidth, isExpanded(entry), liveOutput)),
    [entries, innerWidth, isExpanded, liveOutput],
  );

  const visible = useMemo(() => {
    const bottom = Math.max(0, entries.length - 1 - scrollOffset);
    const result: TimelineEntry[] = [];
    let used = 0;

    for (let index = bottom; index >= 0; index -= 1) {
      const entry = entries[index];
      const height = heights[index];
      if (!entry || height === undefined) continue;
      if (used + height > rows && result.length > 0) break;
      used += height;
      result.unshift(entry);
    }
    return result;
  }, [entries, heights, rows, scrollOffset]);

  const streamingHeight = streamingText ? estimateTextHeight(streamingText, innerWidth) : 0;
  const streamingRows = Math.min(streamingHeight, Math.max(2, Math.floor(rows / 2)));

  if (entries.length === 0 && !streamingText) {
    return (
      <Box flexDirection="column" paddingLeft={2}>
        <Text color={theme.dim}>No messages yet. Describe a task to get started.</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" paddingLeft={1} paddingRight={1}>
      {visible.map((entry) =>
        entry.kind === 'message' ? (
          <MessageItem key={entry.id} message={entry.message} maxLines={Math.max(8, Math.floor(rows / 2))} />
        ) : (
          <ToolCallCard
            key={entry.id}
            call={entry.call}
            liveOutput={liveOutput[entry.id]}
            expanded={isExpanded(entry)}
          />
        ),
      )}

      {streamingText ? (
        <Box paddingLeft={2} flexDirection="column" height={streamingRows} overflow="hidden">
          <Text color={theme.assistant} wrap="wrap">
            {truncateLines(streamingText, streamingRows)}
          </Text>
          <Text color={theme.accent}>▌</Text>
        </Box>
      ) : null}
    </Box>
  );
};

function estimateTextHeight(text: string, width: number): number {
  if (!text) return 0;
  let total = 0;
  for (const line of text.split('\n')) {
    total += Math.max(1, Math.ceil(Math.max(1, line.length) / width));
  }
  return total;
}

function estimateMessageHeight(message: Message, width: number): number {
  if (message.role === 'tool') {
    // Tool results are rendered collapsed.
    return Math.min(estimateTextHeight(truncateLines(message.content, 15), width), 15);
  }
  const body = estimateTextHeight(message.content, width);
  return body + (message.content === '' ? 0 : 1);
}

function estimateEntryHeight(
  entry: TimelineEntry,
  width: number,
  expanded: boolean,
  liveOutput: Record<string, string>,
): number {
  if (entry.kind === 'message') return estimateMessageHeight(entry.message, width);

  const call = entry.call;
  let height = 1;

  if (call.status === 'running' && liveOutput[entry.id]) {
    height += Math.min(estimateTextHeight(truncateLines(liveOutput[entry.id] ?? '', 12), width), 12);
  } else if (expanded) {
    const diff = call.result?.artifacts?.find((artifact) => artifact.type === 'diff');
    if (diff && diff.type === 'diff') {
      height += Math.min(diff.diff.split('\n').length, 30);
    } else if (call.result) {
      height += Math.min(estimateTextHeight(truncateLines(call.result.output, 15), width), 15);
    }
  }

  return height + (expanded ? 1 : 0);
}
