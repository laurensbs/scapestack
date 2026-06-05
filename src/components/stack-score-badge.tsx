"use client";

import { useState, useEffect, useRef } from "react";
import { ChevronDown, ArrowUp, ArrowDown } from "lucide-react";
import { computeStackScore, scoreTier, type StackScore } from "@/lib/stack-score";
import type { OrganizedTab } from "@/lib/organizer";
import { cn } from "@/lib/utils";

interface Props {
  tabs: OrganizedTab[];
  /** previous score from localStorage for delta display */
  previousScore?: number;
}

export function StackScoreBadge({ tabs, previousScore }: Props) {
  const [expanded, setExpanded] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const score = computeStackScore(tabs);
  const tier = scoreTier(score.total);
  const delta = previousScore !== undefined ? score.total - previousScore : null;

  // Close on outside click — same pattern as the reorganize menu.
  useEffect(() => {
    if (!expanded) return;
    const close = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setExpanded(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [expanded]);

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        title="Stack Score · click for breakdown"
        className={cn(
          "btn-ghost group/score",
          expanded && "border-[var(--color-accent)]/40 text-[var(--color-text)]"
        )}
      >
        <span className="text-[10px] uppercase tracking-[0.16em] font-semibold text-[var(--color-text-muted)]">
          Score
        </span>
        <span
          className="font-semibold text-[14px] leading-none tabular-nums tracking-tight"
          style={{ color: tier.color }}
        >
          {score.total}
        </span>
        <span className="text-[10.5px] font-medium text-[var(--color-text-dim)] leading-none">
          {tier.label}
        </span>
        {delta !== null && delta !== 0 && (
          <span
            className="inline-flex items-center gap-0.5 text-[10px] font-semibold tabular-nums leading-none"
            style={{ color: delta > 0 ? "var(--color-good)" : "var(--color-danger)" }}
          >
            {delta > 0 ? <ArrowUp className="size-2.5" /> : <ArrowDown className="size-2.5" />}
            {Math.abs(delta)}
          </span>
        )}
        <ChevronDown
          className={cn(
            "size-3 text-[var(--color-text-muted)] transition-transform",
            expanded && "rotate-180"
          )}
        />
      </button>

      {expanded && (
        <div
          className={cn(
            "absolute z-30 top-full right-0 mt-2 w-[300px] p-3.5 rounded-lg",
            "bg-[var(--color-panel)] border border-[var(--color-border-strong)]",
            "shadow-[0_18px_50px_-20px_rgb(0_0_0/0.75)]",
            "animate-[pop-in_0.18s_ease-out] origin-top-right"
          )}
        >
          <div className="flex items-baseline justify-between mb-3">
            <div>
              <div className="text-[10.5px] uppercase tracking-[0.16em] font-semibold text-[var(--color-text-muted)]">
                Stack Score
              </div>
              <div className="flex items-baseline gap-2 mt-0.5">
                <span
                  className="font-semibold text-[26px] leading-none tabular-nums tracking-tight"
                  style={{ color: tier.color }}
                >
                  {score.total}
                </span>
                <span className="text-[11px] font-medium text-[var(--color-text-dim)]">{tier.label}</span>
              </div>
            </div>
            {delta !== null && delta !== 0 && (
              <span
                className="inline-flex items-center gap-0.5 px-1.5 py-1 rounded-md text-[10.5px] font-semibold tabular-nums border"
                style={{
                  color: delta > 0 ? "var(--color-good)" : "var(--color-danger)",
                  borderColor: delta > 0 ? "color-mix(in srgb, var(--color-good) 35%, transparent)" : "color-mix(in srgb, var(--color-danger) 35%, transparent)",
                  background: delta > 0 ? "color-mix(in srgb, var(--color-good) 10%, transparent)" : "color-mix(in srgb, var(--color-danger) 10%, transparent)"
                }}
              >
                {delta > 0 ? <ArrowUp className="size-2.5" /> : <ArrowDown className="size-2.5" />}
                {Math.abs(delta)}
              </span>
            )}
          </div>
          <div className="space-y-2 pt-3 border-t border-[var(--color-border)]">
            <ScoreBar label="Wealth"      weight={30} value={score.components.wealth} />
            <ScoreBar label="Diversity"   weight={25} value={score.components.diversity} />
            <ScoreBar label="Untradeable" weight={25} value={score.components.untradeable} />
            <ScoreBar label="Density"     weight={20} value={score.components.density} />
          </div>
          <p className="text-[10.5px] text-[var(--color-text-muted)] mt-3 leading-relaxed">
            A bragging metric — combines wealth, item variety, untradeable progress, and how densely packed your bank is.
          </p>
        </div>
      )}
    </div>
  );
}

function ScoreBar({ label, weight, value }: { label: string; weight: number; value: number }) {
  return (
    <div>
      <div className="flex justify-between items-baseline text-[11px] mb-1">
        <span className="text-[var(--color-text-dim)]">{label}</span>
        <span className="text-[var(--color-text-muted)] font-mono tabular-nums text-[10px]">
          <span className="text-[var(--color-text)]">{value}</span> · {weight}%
        </span>
      </div>
      <div className="h-1 rounded-full bg-[var(--color-bg-2)] overflow-hidden">
        <div
          className="h-full rounded-full transition-[width] duration-500 ease-out"
          style={{
            width: `${Math.max(0, Math.min(100, value))}%`,
            background: "linear-gradient(to right, var(--color-accent-soft), var(--color-accent))"
          }}
        />
      </div>
    </div>
  );
}

// Lightweight wrapper for components that just need the number,
// not the badge UI.
export function getStackScoreValue(tabs: OrganizedTab[]): StackScore {
  return computeStackScore(tabs);
}
