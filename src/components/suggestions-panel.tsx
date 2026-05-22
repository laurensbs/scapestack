"use client";

import { useMemo, useState } from "react";
import { Lightbulb, TrendingUp, AlertTriangle, X } from "lucide-react";
import { generateSuggestions, type Suggestion } from "@/lib/suggestions";
import type { OrganizedTab } from "@/lib/organizer";
import { cn, formatGp } from "@/lib/utils";

interface SuggestionsPanelProps {
  tabs: OrganizedTab[];
}

const DISMISSED_KEY = "scapestack-bank:dismissed-suggestions";

export function SuggestionsPanel({ tabs }: SuggestionsPanelProps) {
  const [dismissed, setDismissed] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      return JSON.parse(localStorage.getItem(DISMISSED_KEY) || "[]");
    } catch {
      return [];
    }
  });

  const all = useMemo(() => generateSuggestions(tabs), [tabs]);
  const visible = all.filter((s) => !dismissed.includes(s.id));

  if (visible.length === 0) return null;

  const dismiss = (id: string) => {
    const next = [...dismissed, id];
    setDismissed(next);
    try {
      localStorage.setItem(DISMISSED_KEY, JSON.stringify(next));
    } catch {}
  };

  const reset = () => {
    setDismissed([]);
    try {
      localStorage.removeItem(DISMISSED_KEY);
    } catch {}
  };

  return (
    <section className="mt-7 mb-2">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Lightbulb className="size-4 text-[var(--color-gold-soft)]" />
          <h3 className="text-[11.5px] font-bold uppercase tracking-[0.18em] text-[var(--color-gold-soft)]">
            Smart suggestions
          </h3>
          <span className="text-[11px] text-[var(--color-text-dim)]">
            {visible.length} for your bank
          </span>
        </div>
        {dismissed.length > 0 && (
          <button
            onClick={reset}
            className="text-[11px] text-[var(--color-text-dim)] hover:text-[var(--color-text)] underline-offset-2 hover:underline"
          >
            Restore {dismissed.length} dismissed
          </button>
        )}
      </div>

      <div className="grid sm:grid-cols-2 gap-2.5">
        {visible.map((s, i) => (
          <SuggestionCard key={s.id} suggestion={s} index={i} onDismiss={() => dismiss(s.id)} />
        ))}
      </div>
    </section>
  );
}

function SuggestionCard({
  suggestion,
  index,
  onDismiss
}: {
  suggestion: Suggestion;
  index: number;
  onDismiss: () => void;
}) {
  const { tone, title, body, gpImpact } = suggestion;
  const Icon = tone === "warning" ? AlertTriangle : tone === "win" ? TrendingUp : Lightbulb;
  const accent = {
    tip: { fg: "var(--color-gold-soft)", bg: "oklch(0.32 0.05 65 / 0.18)", line: "var(--color-gold-soft)" },
    warning: { fg: "var(--color-danger)", bg: "oklch(0.32 0.08 25 / 0.18)", line: "var(--color-danger)" },
    win: { fg: "var(--color-good)", bg: "oklch(0.32 0.08 145 / 0.18)", line: "var(--color-good)" }
  }[tone];

  return (
    <div
      className={cn(
        "relative group rounded-xl p-3.5 pr-9",
        "bg-gradient-to-br from-[var(--color-panel)] to-[var(--color-bg-2)]",
        "border border-[var(--color-border)]",
        "shadow-[inset_0_1px_0_oklch(1_0_0/0.03)]",
        "hover:border-[var(--color-border-strong)] transition-colors"
      )}
      style={{ animation: `slide-up 0.3s ease-out ${index * 0.05}s both` }}
    >
      <div
        className="absolute left-0 top-3 bottom-3 w-[3px] rounded-r"
        style={{ background: accent.line }}
      />
      <div className="flex items-start gap-2.5">
        <div
          className="shrink-0 size-7 rounded-md flex items-center justify-center"
          style={{ background: accent.bg, color: accent.fg }}
        >
          <Icon className="size-3.5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="text-[12.5px] font-semibold text-[var(--color-text)] leading-snug">
              {title}
            </h4>
            {gpImpact && (
              <span
                className="text-[10px] font-bold tracking-wider px-1.5 py-0.5 rounded"
                style={{ background: accent.bg, color: accent.fg }}
              >
                {formatGp(gpImpact)} gp
              </span>
            )}
          </div>
          <p className="mt-1 text-[11.5px] leading-relaxed text-[var(--color-text-dim)]">
            {body}
          </p>
        </div>
      </div>
      <button
        onClick={onDismiss}
        className="absolute top-2.5 right-2.5 size-6 rounded flex items-center justify-center text-[var(--color-text-dim)]/60 hover:text-[var(--color-text)] hover:bg-[var(--color-border)] transition-colors opacity-0 group-hover:opacity-100"
        title="Dismiss"
        aria-label="Dismiss"
      >
        <X className="size-3" />
      </button>
    </div>
  );
}
