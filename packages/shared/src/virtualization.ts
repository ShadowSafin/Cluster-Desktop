export interface VirtualItem {
  index: number;
  start: number;
  size: number;
}

/**
 * Computes prefix sums (offsets) and total scroll height for an array of items.
 */
export function computeOffsets(
  itemsCount: number,
  getHeight: (index: number) => number
): { offsets: number[]; totalHeight: number } {
  if (itemsCount <= 0) {
    return { offsets: [], totalHeight: 0 };
  }
  const arr: number[] = new Array(itemsCount);
  let runningTotal = 0;
  for (let i = 0; i < itemsCount; i++) {
    arr[i] = runningTotal;
    runningTotal += Math.max(1, getHeight(i));
  }
  return { offsets: arr, totalHeight: runningTotal };
}

/**
 * Performs binary search O(log N) to find the largest item index whose offset is <= scrollOffset.
 */
export function findStartIndex(offsets: number[], scrollOffset: number): number {
  if (!offsets || offsets.length === 0) return 0;
  let low = 0;
  let high = offsets.length - 1;
  let result = 0;

  while (low <= high) {
    const mid = (low + high) >> 1;
    if (offsets[mid] <= scrollOffset) {
      result = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }
  return result;
}

/**
 * Calculates the visible range [startIndex, endIndex] and virtual slice based on scroll position and viewport height.
 */
export function computeVisibleRange({
  itemsCount,
  offsets,
  scrollTop,
  viewportHeight,
  overscan = 4,
  getHeight,
}: {
  itemsCount: number;
  offsets: number[];
  scrollTop: number;
  viewportHeight: number;
  overscan?: number;
  getHeight: (index: number) => number;
}): { startIndex: number; endIndex: number; virtualItems: VirtualItem[] } {
  if (itemsCount <= 0 || offsets.length === 0) {
    return { startIndex: 0, endIndex: 0, virtualItems: [] };
  }

  const clampedScrollTop = Math.max(0, scrollTop);
  const rawStart = findStartIndex(offsets, clampedScrollTop);
  const start = Math.max(0, rawStart - overscan);

  const endTarget = clampedScrollTop + viewportHeight;
  let rawEnd = rawStart;
  while (rawEnd < itemsCount - 1 && offsets[rawEnd] < endTarget) {
    rawEnd++;
  }
  const end = Math.min(itemsCount - 1, rawEnd + overscan);

  const items: VirtualItem[] = [];
  for (let i = start; i <= end; i++) {
    items.push({
      index: i,
      start: offsets[i],
      size: Math.max(1, getHeight(i)),
    });
  }

  return { startIndex: start, endIndex: end, virtualItems: items };
}
