"use client";

import { AlertCircle, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

export type ReadyToLeaveStatus =
  | "Ready to leave"
  | "Ready to train"
  | "Ready to AFK"
  | "Ready to make GP"
  | "Ready to start"
  | "Missing food"
  | "Missing teleport"
  | "Gear looks weak"
  | "Add gear first"
  | "Check items first";

export type ReadyToLeaveTone = "good" | "warn" | "neutral";

export interface ReadyToLeaveItem {
  label:
    | "Gear"
    | "Food"
    | "Teleport"
    | "Tele out"
    | "Stop point"
    | "Stop at"
    | "Skill"
    | "Train"
    | "Supplies"
    | "Bring"
    | "Location"
    | "Go to"
    | "Unlock"
    | "Items"
    | "Start at"
    | "Method"
    | "Setup"
    | "Cash out"
    | "Task"
    | "Style"
    | "Activity"
    | "Attention";
  value: string;
  tone?: ReadyToLeaveTone;
}

export function ReadyToLeave({
  status,
  items,
  compact = false
}: {
  status: ReadyToLeaveStatus;
  items: ReadyToLeaveItem[];
  compact?: boolean;
}) {
  const good =
    status === "Ready to leave" ||
    status === "Ready to train" ||
    status === "Ready to AFK" ||
    status === "Ready to make GP" ||
    status === "Ready to start";
  const Icon = good ? CheckCircle2 : AlertCircle;

  return (
    <div
      className={cn(
        "mt-3 rounded-lg border bg-[var(--color-bg)]/35",
        good ? "border-[var(--color-good)]/30" : "border-[var(--color-warning)]/28",
        compact ? "p-2.5" : "p-3"
      )}
    >
      <div
        className={cn(
          "mb-2 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold",
          good
            ? "border-[var(--color-good)]/35 bg-[var(--color-good)]/10 text-[var(--color-good)]"
            : "border-[var(--color-warning)]/35 bg-[var(--color-warning)]/10 text-[var(--color-warning)]"
        )}
      >
        <Icon className="size-3.5" />
        {status}
      </div>
      <dl className="grid gap-1.5 sm:grid-cols-4">
        {items.map((item) => (
          <div
            key={item.label}
            className="min-w-0 rounded-md border border-[var(--color-border)] bg-[var(--color-panel)]/45 px-2.5 py-2"
          >
            <dt className="text-[9.5px] font-bold uppercase tracking-[0.14em] text-[var(--color-text-muted)]">
              {item.label}
            </dt>
            <dd
              className={cn(
                "mt-1 truncate text-[12px] font-semibold text-[var(--color-text-dim)]",
                item.tone === "good" && "text-[var(--color-good)]",
                item.tone === "warn" && "text-[var(--color-warning)]"
              )}
              title={item.value}
            >
              {item.value}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
