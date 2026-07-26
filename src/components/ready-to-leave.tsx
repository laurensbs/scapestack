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
  | "UIM setup"
  | "Check items";

/**
 * Each status placed on the site-wide verdict ramp.
 *
 * A verdict colour has to mean the same thing on /bank as it does on /dps and
 * on the homepage, or a player learns the ramp twice. It lives beside the union
 * rather than beside its one caller so that adding a status here fails the
 * build instead of quietly rendering grey.
 */
export const READY_GATE: Record<ReadyToLeaveStatus, "ready" | "test" | "blocked"> = {
  "Good first trip": "ready",
  "Worth doing": "ready",
  "Good AFK loop": "ready",
  "Bank first": "test",
  "Bring food": "test",
  "Pick a teleport": "test",
  "UIM setup": "test",
  "Check items": "test",
  "Skip for now": "blocked",
  "Unlock first": "blocked"
};

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
  // READY_GATE is exported from this very file, twenty lines up, with a comment
  // saying a verdict colour has to mean the same thing everywhere "or a player
  // learns the ramp twice". This component then ignored it and painted a pill
  // in --color-good / --color-warning — two tokens that are byte-identical
  // (#FF981F), so the whole conditional produced the same pixel either way. A
  // branch with no visible effect, inside the file that forbids the branch.
  const gate = READY_GATE[status];
  const Icon = gate === "ready" ? CheckCircle2 : AlertCircle;
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
        "mt-3 border-t border-[var(--color-border)] bg-transparent",
        compact ? "py-2" : "py-3"
      )}
    >
      {/* The shared verdict primitive: word first, one colour scale, and the
          icon carries the same meaning in shape so it does not depend on hue. */}
      <div className="mb-2 inline-flex items-center gap-1.5">
        <Icon className="size-3.5 text-[var(--color-text-muted)]" />
        <span className="scape-verdict" data-gate={gate}>{status}</span>
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
                // Same rule one level down: an item tone is a verdict too.
                item.tone === "good" && "text-[var(--color-gate-easy)]",
                item.tone === "warn" && "text-[var(--color-gate-even)]"
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
