import { useState, type DragEvent, type ReactNode } from "react";
import { GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";

type ReorderableSectionsProps<T extends string> = {
  order: T[];
  onReorder: (next: T[]) => void;
  renderSection: (id: T) => ReactNode;
  labelForId: (id: T) => string;
  className?: string;
};

export function ReorderableSections<T extends string>({
  order,
  onReorder,
  renderSection,
  labelForId,
  className,
}: ReorderableSectionsProps<T>) {
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
    const next = [...order];
    const fromIdx = next.indexOf(fromId);
    const toIdx = next.indexOf(toId);
    if (fromIdx >= 0 && toIdx >= 0) {
      next.splice(fromIdx, 1);
      next.splice(toIdx, 0, fromId);
      onReorder(next);
    }
    onDragEnd();
  };

  return (
    <div className={cn("space-y-8", className)}>
      {order.map((id) => (
        <section
          key={id}
          onDragOver={(e) => onDragOver(e, id)}
          onDragLeave={() => setDropTargetId((current) => (current === id ? null : current))}
          onDrop={(e) => onDrop(e, id)}
          className={cn(
            "relative",
            draggingId === id && "opacity-60",
            dropTargetId === id && "rounded-2xl ring-2 ring-accent/35 ring-offset-4 ring-offset-background",
          )}
        >
          <div className="mb-2 flex justify-end">
            <button
              type="button"
              draggable
              onDragStart={(e) => onDragStart(e, id)}
              onDragEnd={onDragEnd}
              aria-label={`Drag to reorder ${labelForId(id)}`}
              className={cn(
                "inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border/60 bg-card/80 text-muted-foreground shadow-sm",
                "cursor-grab transition-colors active:cursor-grabbing hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40",
              )}
            >
              <GripVertical className="h-4 w-4" aria-hidden />
            </button>
          </div>
          {renderSection(id)}
        </section>
      ))}
    </div>
  );
}
