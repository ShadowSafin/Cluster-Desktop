import React, { useRef } from 'react';
import { useVirtualList } from '../hooks/useVirtualList';
import { ArrowDown } from 'lucide-react';

export interface VirtualListProps<T> {
  items: T[];
  renderItem: (item: T, index: number) => React.ReactNode;
  estimateHeight?: number | ((index: number) => number);
  overscan?: number;
  className?: string;
  keyExtractor?: (item: T, index: number) => string | number;
  emptyPlaceholder?: React.ReactNode;
  initialScrollToBottom?: boolean;
  showScrollToBottomButton?: boolean;
}

export function VirtualList<T>({
  items,
  renderItem,
  estimateHeight = 80,
  overscan = 4,
  className = '',
  keyExtractor,
  emptyPlaceholder,
  initialScrollToBottom = false,
  showScrollToBottomButton = true,
}: VirtualListProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null);

  const {
    virtualItems,
    totalHeight,
    isAtBottom,
    measureElement,
    scrollToBottom,
  } = useVirtualList({
    itemsCount: items.length,
    containerRef,
    estimateHeight,
    overscan,
    initialScrollToBottom,
  });

  if (items.length === 0 && emptyPlaceholder) {
    return <div className={`h-full overflow-y-auto ${className}`}>{emptyPlaceholder}</div>;
  }

  return (
    <div className="relative h-full w-full overflow-hidden flex flex-col">
      <div
        ref={containerRef}
        className={`flex-1 overflow-y-auto overflow-x-hidden min-h-0 w-full relative ${className}`}
        style={{ willChange: 'scroll-position' }}
      >
        {/* Virtual spacer matching total estimated height */}
        <div style={{ height: `${totalHeight}px`, width: '100%', position: 'relative' }}>
          {virtualItems.map(({ index, start }) => {
            const item = items[index];
            if (!item) return null;
            const key = keyExtractor ? keyExtractor(item, index) : index;

            return (
              <div
                key={key}
                data-index={index}
                ref={(node) => measureElement(index, node)}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  transform: `translateY(${start}px)`,
                }}
              >
                {renderItem(item, index)}
              </div>
            );
          })}
        </div>
      </div>

      {/* Floating Scroll to Bottom Button when detached from bottom */}
      {showScrollToBottomButton && !isAtBottom && items.length > 5 && (
        <button
          onClick={() => scrollToBottom(true)}
          title="Scroll to latest"
          className="absolute bottom-4 right-6 z-30 px-3 py-1.5 rounded-full bg-cyan-600/90 hover:bg-cyan-500 text-white text-xs font-semibold shadow-xl border border-cyan-400/40 flex items-center gap-1.5 backdrop-blur-md transition-all animate-in fade-in slide-in-from-bottom-2"
        >
          <ArrowDown className="w-3.5 h-3.5 animate-bounce" />
          <span>Latest</span>
        </button>
      )}
    </div>
  );
}
