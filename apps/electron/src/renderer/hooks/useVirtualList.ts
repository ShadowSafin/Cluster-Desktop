import { useState, useEffect, useRef, useCallback, useMemo } from 'react';

export interface UseVirtualListOptions {
  itemsCount: number;
  containerRef: React.RefObject<HTMLElement>;
  estimateHeight?: number | ((index: number) => number);
  overscan?: number;
  initialScrollToBottom?: boolean;
}

export interface VirtualItem {
  index: number;
  start: number;
  size: number;
}

export interface UseVirtualListReturn {
  virtualItems: VirtualItem[];
  totalHeight: number;
  startIndex: number;
  endIndex: number;
  isAtBottom: boolean;
  measureElement: (index: number, element: HTMLElement | null) => void;
  scrollToBottom: (smooth?: boolean) => void;
  scrollToIndex: (index: number) => void;
}

// Pure helper functions for testing and computing virtual metrics
export function computeOffsets(
  itemsCount: number,
  getHeight: (index: number) => number
): { offsets: number[]; totalHeight: number } {
  const arr: number[] = new Array(itemsCount);
  let runningTotal = 0;
  for (let i = 0; i < itemsCount; i++) {
    arr[i] = runningTotal;
    runningTotal += getHeight(i);
  }
  return { offsets: arr, totalHeight: runningTotal };
}

export function findStartIndex(offsets: number[], scrollOffset: number): number {
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
  if (itemsCount === 0) {
    return { startIndex: 0, endIndex: 0, virtualItems: [] };
  }

  const rawStart = findStartIndex(offsets, scrollTop);
  const start = Math.max(0, rawStart - overscan);

  const endTarget = scrollTop + viewportHeight;
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
      size: getHeight(i),
    });
  }

  return { startIndex: start, endIndex: end, virtualItems: items };
}

export function useVirtualList({
  itemsCount,
  containerRef,
  estimateHeight = 80,
  overscan = 4,
  initialScrollToBottom = false,
}: UseVirtualListOptions): UseVirtualListReturn {
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(600);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [measureRevision, setMeasureRevision] = useState(0);

  // Height cache for measured dynamic items
  const measuredHeights = useRef<Map<number, number>>(new Map());
  const nodeObservers = useRef<Map<number, ResizeObserver>>(new Map());
  const prevItemsCount = useRef(itemsCount);
  const isAtBottomRef = useRef(true);

  // Clean up observers on unmount
  useEffect(() => {
    const observers = nodeObservers.current;
    return () => {
      observers.forEach((ro) => ro.disconnect());
      observers.clear();
    };
  }, []);

  // Helper to get estimated or measured height for an index
  const getItemHeight = useCallback(
    (index: number): number => {
      const cached = measuredHeights.current.get(index);
      if (typeof cached === 'number' && cached > 0) return cached;
      return typeof estimateHeight === 'function' ? estimateHeight(index) : estimateHeight;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [estimateHeight, measureRevision]
  );

  // Compute prefix sums (offsets) for all items
  const { offsets, totalHeight } = useMemo(
    () => computeOffsets(itemsCount, getItemHeight),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [itemsCount, getItemHeight, measureRevision]
  );

  // Calculate visible range
  const { startIndex, endIndex, virtualItems } = useMemo(
    () =>
      computeVisibleRange({
        itemsCount,
        offsets,
        scrollTop,
        viewportHeight,
        overscan,
        getHeight: getItemHeight,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [itemsCount, offsets, scrollTop, viewportHeight, overscan, getItemHeight, measureRevision]
  );

  // Measure an item dynamically via ref with ResizeObserver
  const measureElement = useCallback(
    (index: number, element: HTMLElement | null) => {
      if (!element) {
        const existing = nodeObservers.current.get(index);
        if (existing) {
          existing.disconnect();
          nodeObservers.current.delete(index);
        }
        return;
      }

      const updateHeight = () => {
        const height = element.getBoundingClientRect().height;
        if (height > 0 && Math.abs((measuredHeights.current.get(index) || 0) - height) > 1) {
          measuredHeights.current.set(index, height);
          setMeasureRevision((r) => r + 1);
        }
      };

      updateHeight();

      if (!nodeObservers.current.has(index)) {
        try {
          const ro = new ResizeObserver(() => {
            updateHeight();
          });
          ro.observe(element);
          nodeObservers.current.set(index, ro);
        } catch {}
      }
    },
    []
  );

  // Scroll methods
  const scrollToBottom = useCallback(
    (smooth = false) => {
      const container = containerRef.current;
      if (!container) return;
      if (smooth) {
        container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
      } else {
        container.scrollTop = container.scrollHeight;
      }
      setIsAtBottom(true);
      isAtBottomRef.current = true;
    },
    [containerRef]
  );

  const scrollToIndex = useCallback(
    (index: number) => {
      const container = containerRef.current;
      if (!container || index < 0 || index >= offsets.length) return;
      container.scrollTop = offsets[index];
    },
    [containerRef, offsets]
  );

  // Setup scroll listener and resize observer on container
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let rafId: number | null = null;

    const handleScroll = () => {
      if (rafId !== null) return;
      rafId = requestAnimationFrame(() => {
        rafId = null;
        if (!container) return;
        const currentTop = container.scrollTop;
        const currentHeight = container.clientHeight;
        const scrollBottom = container.scrollHeight - currentTop - currentHeight;

        setScrollTop(currentTop);
        const atBottom = scrollBottom <= 80;
        setIsAtBottom(atBottom);
        isAtBottomRef.current = atBottom;
      });
    };

    container.addEventListener('scroll', handleScroll, { passive: true });

    // Measure container size
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const height = entry.contentRect.height;
        if (height > 0) {
          setViewportHeight(height);
        }
      }
    });
    resizeObserver.observe(container);

    // Initial check
    handleScroll();

    if (initialScrollToBottom) {
      requestAnimationFrame(() => {
        container.scrollTop = container.scrollHeight;
      });
    }

    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      container.removeEventListener('scroll', handleScroll);
      resizeObserver.disconnect();
    };
  }, [containerRef, initialScrollToBottom]);

  // Handle auto-scroll when new items arrive
  useEffect(() => {
    if (itemsCount > prevItemsCount.current) {
      if (isAtBottomRef.current) {
        // Only auto-scroll if user was already at the bottom
        requestAnimationFrame(() => {
          if (containerRef.current) {
            containerRef.current.scrollTop = containerRef.current.scrollHeight;
          }
        });
      }
    }
    prevItemsCount.current = itemsCount;
  }, [itemsCount, containerRef]);

  return {
    virtualItems,
    totalHeight,
    startIndex,
    endIndex,
    isAtBottom,
    measureElement,
    scrollToBottom,
    scrollToIndex,
  };
}
