import { useState, type DragEvent, type ReactNode } from "react";
import { GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";

type ReorderableGridProps<T extends string> = {
  order: T[];
  onReorder: (next: T[]) => void;
  renderItem: (id: T) => ReactNode;
  labelForId: (id: T) => string;
  className?: string;
  itemClassName?: string;
};

export function ReorderableGrid<T extends string>({
  order,
  onReorder,
  renderItem,
  labelForId,
  className,
  itemClassName,
}: ReorderableGridProps<T>) {
  const [draggingId, setDraggingId] = useState<T | null>(null);
  const [dropTargetId, setDropTargetId] = useState<T | null>(null);

  const onDragStart = (e: DragEvent, id: T) => {
    e.dataTransfer.setData("text/plain", id);
    e.dataTransfer.effectAllowed = "move";
    setDraggingId(id);
  };

  const onDragEnd = () => {
    setDraggingId(null);
    setDropTargetId(null);
  };

  const onDragOver = (e: DragEvent, id: T) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (draggingId && draggingId !== id) setDropTargetId(id);
  };

  const onDrop = (e: DragEvent, toId: T) => {
    e.preventDefault();
    const fromRaw = e.dataTransfer.getData("text/plain") as T;
    const fromId = order.includes(fromRaw) ? fromRaw : draggingId;
    if (!fromId || fromId === toId) {
      onDragEnd();
      return;
    }
    onReorder(
      (() => {
        const next = [...order];
        const fromIdx = next.indexOf(fromId);
        const toIdx = next.indexOf(toId);
        if (fromIdx < 0 || toIdx < 0) return order;
        next.splice(fromIdx, 1);
        next.splice(toIdx, 0, fromId);
        return next;
      })(),
    );
    onDragEnd();
  };

  return (
    <div className={className}>
      {order.map((id) => (
        <div
          key={id}
          onDragOver={(e) => onDragOver(e, id)}
          onDragLeave={() => setDropTargetId((current) => (current === id ? null : current))}
          onDrop={(e) => onDrop(e, id)}
          className={cn(
            "relative min-h-0",
            itemClassName,
            draggingId === id && "opacity-60",
            dropTargetId === id && "ring-2 ring-accent/40 ring-offset-2 ring-offset-background rounded-xl",
          )}
        >
          <button
            type="button"
            draggable
            onDragStart={(e) => onDragStart(e, id)}
            onDragEnd={onDragEnd}
            aria-label={`Drag to reorder ${labelForId(id)}`}
            className={cn(
              "absolute right-2 top-2 z-20 flex h-8 w-8 items-center justify-center rounded-lg",
              "border border-border/60 bg-background/90 text-muted-foreground shadow-sm backdrop-blur-sm",
              "cursor-grab transition-opacity active:cursor-grabbing",
              "opacity-70 hover:opacity-100 hover:text-foreground focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40",
            )}
          >
            <GripVertical className="h-4 w-4" aria-hidden />
          </button>
          {renderItem(id)}
        </div>
      ))}
    </div>
  );
}
