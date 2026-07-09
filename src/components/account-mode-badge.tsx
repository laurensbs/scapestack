"use client";

import {
  accountModeVisual,
  type AccountModeAssessment,
  type AccountModeConfidence,
  type PlannerAccountType
} from "@/lib/account-type";
import { cn } from "@/lib/utils";
import { ItemSprite } from "./item-sprite";

interface AccountModeBadgeProps {
  accountType?: PlannerAccountType | null;
  accountMode?: Pick<AccountModeAssessment, "type" | "confidence" | "badgeLabel"> | null;
  confidence?: AccountModeConfidence;
  compact?: boolean;
  showSourceCopy?: boolean;
  className?: string;
}

export function AccountModeBadge({
  accountType,
  accountMode,
  confidence,
  compact = false,
  showSourceCopy = false,
  className
}: AccountModeBadgeProps) {
  const modeType = accountMode?.type ?? accountType ?? null;
  const modeConfidence = accountMode?.confidence ?? confidence ?? (modeType ? "inferred" : "unknown");
  const visual = accountModeVisual(modeType, modeConfidence);
  const label = accountMode?.badgeLabel ?? visual.badgeLabel;

  return (
    <span
      className={cn(
        "inline-flex min-w-0 items-center gap-1.5 rounded-full border font-bold",
        compact ? "px-2 py-1 text-[10.5px]" : "px-2.5 py-1.5 text-[11.5px]",
        visual.tone === "iron" && "border-[#7a8796]/35 bg-[#7a8796]/12 text-[#c7d0dd]",
        visual.tone === "hardcore" && "border-[var(--color-danger)]/35 bg-[var(--color-danger)]/10 text-[var(--color-danger)]",
        visual.tone === "ultimate" && "border-[var(--color-accent)]/35 bg-[var(--color-accent)]/12 text-[var(--color-accent)]",
        visual.tone === "group" && "border-[var(--color-good)]/35 bg-[var(--color-good)]/10 text-[var(--color-good)]",
        visual.tone === "neutral" && "border-[var(--color-border)] bg-[var(--color-bg)]/35 text-[var(--color-text-muted)]",
        visual.tone === "unknown" && "border-[var(--color-warning)]/30 bg-[var(--color-warning)]/10 text-[var(--color-warning)]",
        className
      )}
      title={showSourceCopy ? `${label}: ${visual.sourceCopy}` : visual.planningNote}
      data-account-mode={visual.tone}
    >
      {visual.iconItemId ? (
        <ItemSprite id={visual.iconItemId} alt="" size={compact ? 16 : 18} className="pixelated" />
      ) : null}
      <span className="min-w-0 truncate">{label}</span>
      {showSourceCopy && (
        <span className="hidden max-w-[14rem] truncate font-semibold opacity-80 sm:inline">
          {visual.sourceCopy}
        </span>
      )}
    </span>
  );
}
