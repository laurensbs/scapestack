"use client";

import { AlertCircle, ArrowRight, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

export type ReadyToLeaveStatus =
  | "Good first trip"
  | "Worth doing"
  | "Good AFK loop"
  | "Bank first"
  | "Bring food"
  | "Pick a teleport"
  | "Skip for now"
  | "Unlock first"
  | "Check items";

export type ReadyToLeaveTone = "good" | "warn" | "neutral";

export interface ReadyToLeaveItem {
  label:
    | "Start"
    | "Need"
    | "Stop"
    | "Gear"
    | "Bank"
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
    status === "Good first trip" ||
    status === "Worth doing" ||
    status === "Good AFK loop";
  const Icon = good ? CheckCircle2 : AlertCircle;
  const displayLabel = (label: ReadyToLeaveItem["label"]): string => {
    switch (label) {
      case "Skill":
      case "Train":
      case "Method":
      case "Activity":
      case "Unlock":
      case "Task":
      case "Style":
      case "Start at":
        return "Start";
      case "Supplies":
      case "Items":
      case "Food":
      case "Gear":
      case "Bring":
      case "Teleport":
      case "Tele out":
        return label === "Gear" || label === "Food" ? "Bank" : label;
      case "Stop at":
      case "Stop point":
      case "Cash out":
        return "Stop";
      case "Go to":
      case "Location":
        return "Bank";
      default:
        return label;
    }
  };

  return (
    <div
      className={cn(
        "mt-3 bg-transparent",
        good ? "border-[var(--color-good)]/22" : "border-[var(--color-warning)]/24",
        compact ? "py-2" : "py-3"
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
      <dl className="divide-y divide-[var(--color-border)]/45 border-y border-[var(--color-border)]/45">
        {items.map((item) => (
          <div
            key={item.label}
            className="grid min-w-0 gap-1 py-2 sm:grid-cols-[82px_minmax(0,1fr)] sm:gap-4"
          >
            <dt className="inline-flex items-center gap-1.5 text-[10.5px] font-bold text-[var(--color-accent)]">
              <ArrowRight className="size-3" />
              {displayLabel(item.label)}
            </dt>
            <dd
              className={cn(
                "text-[12px] font-semibold leading-relaxed text-[var(--color-text-dim)]",
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
