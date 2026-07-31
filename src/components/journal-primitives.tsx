import type { ReactNode } from "react";
import { ItemSprite } from "@/components/item-sprite";
import { cn } from "@/lib/utils";

export function JournalSpriteSlot({
  children,
  className
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      data-journal-sprite-slot="true"
      className={cn(
        "journal-sprite-slot flex size-12 shrink-0 items-center justify-center overflow-hidden border border-[var(--color-border-strong)] bg-[var(--color-slot)] [&>img]:!max-h-10 [&>img]:!max-w-10",
        className
      )}
    >
      {children}
    </span>
  );
}

export function JournalItemSprite({ id, alt = "" }: { id: number; alt?: string }) {
  return (
    <JournalSpriteSlot>
      <ItemSprite id={id} alt={alt} size={40} className="pixelated" style={{ filter: "none" }} />
    </JournalSpriteSlot>
  );
}

export function JournalStatusMark({ done }: { done: boolean }) {
  return (
    <span
      role="img"
      aria-label={done ? "Done" : "Not done"}
      data-state={done ? "done" : "not-done"}
      className="journal-status-mark"
    >
      <span aria-hidden="true">{done ? "✓" : "×"}</span>
    </span>
  );
}
