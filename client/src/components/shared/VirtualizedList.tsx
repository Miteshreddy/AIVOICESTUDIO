import { useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";

interface VirtualizedListProps<T> {
  items: T[];
  itemKey: (item: T) => string;
  estimateSize?: number;
  gap?: number;
  maxHeight?: number;
  renderItem: (item: T) => React.ReactNode;
}

export function VirtualizedList<T>({
  items,
  itemKey,
  estimateSize = 64,
  gap = 8,
  maxHeight = 640,
  renderItem,
}: VirtualizedListProps<T>) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => estimateSize + gap,
    overscan: 6,
  });

  return (
    <div ref={parentRef} style={{ maxHeight, overflowY: "auto" }} className="pr-1">
      <div style={{ height: virtualizer.getTotalSize(), position: "relative", width: "100%" }}>
        {virtualizer.getVirtualItems().map((virtualRow) => {
          const item = items[virtualRow.index];
          return (
            <div
              key={itemKey(item)}
              data-index={virtualRow.index}
              ref={virtualizer.measureElement}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                transform: `translateY(${virtualRow.start}px)`,
                paddingBottom: gap,
              }}
            >
              {renderItem(item)}
            </div>
          );
        })}
      </div>
    </div>
  );
}
