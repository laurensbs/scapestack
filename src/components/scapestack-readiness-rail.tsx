"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, CheckCircle2, CircleDashed, DatabaseZap, PlugZap, UserRound } from "lucide-react";
import {
  buildScapestackReadiness,
  type ScapestackReadinessInput,
  type ScapestackReadinessSignal
} from "@/lib/scapestack-readiness";
import { cn } from "@/lib/utils";

const signalIcons: Record<ScapestackReadinessSignal["id"], typeof DatabaseZap> = {
  bank: DatabaseZap,
  rsn: UserRound,
  sync: PlugZap
};

function signalTone(signal: ScapestackReadinessSignal): string {
  if (signal.status === "exact") {
    return "border-[var(--color-good)]/35 bg-[var(--color-good)]/8 text-[var(--color-good)]";
  }
  if (signal.status === "ready") {
    return "border-[var(--color-accent)]/35 bg-[var(--color-accent)]/8 text-[var(--color-accent)]";
  }
  return "border-[var(--color-border)] bg-[var(--color-bg)]/35 text-[var(--color-text-muted)]";
}

function statusLabel(signal: ScapestackReadinessSignal): string {
  if (signal.status === "exact") return "Used";
  if (signal.status === "ready") return "Loaded";
  return signal.id === "sync" ? "Later" : "Add";
}

export function ScapestackReadinessRail({
  className,
  ...input
}: ScapestackReadinessInput & { className?: string }) {
  const [rsnDraft, setRsnDraft] = useState(input.rsn?.trim() ?? "");

  const readiness = buildScapestackReadiness({
    ...input,
    rsn: input.hasRsn ? input.rsn : rsnDraft
  });

  return (
    <section className={cn(
      "mb-5 overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-panel)]/55",
      className
    )}>
      <div className="flex flex-col gap-3 p-3.5 sm:p-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <div className="text-[10.5px] font-bold uppercase tracking-[0.18em] text-[var(--color-accent)]">
            {readiness.eyebrow}
          </div>
          <h2 className="mt-1 text-[15px] font-bold tracking-normal text-[var(--color-text)]">
            {readiness.title}
          </h2>
          <p className="mt-1 max-w-3xl text-[12.5px] leading-relaxed text-[var(--color-text-dim)]">
            {readiness.body}
          </p>
        </div>
        <Link
          href={readiness.primaryAction.href}
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-[var(--color-accent)]/35 bg-[var(--color-accent)]/10 px-3 py-2 text-[12px] font-bold text-[var(--color-accent)] transition-colors hover:bg-[var(--color-accent)]/15"
        >
          {readiness.primaryAction.label}
          <ArrowRight className="size-4" />
        </Link>
      </div>

      <div className="grid border-t border-[var(--color-border)] bg-[var(--color-bg)]/18 sm:grid-cols-3">
        {readiness.signals.map((signal) => {
          const Icon = signalIcons[signal.id];
          const StatusIcon = signal.status === "missing" ? CircleDashed : CheckCircle2;
          return (
            <div key={signal.id} className="border-t border-[var(--color-border)] p-3.5 first:border-t-0 sm:border-l sm:border-t-0 sm:first:border-l-0">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-[12.5px] font-bold text-[var(--color-text)]">
                    <Icon className="size-4 text-[var(--color-text-muted)]" />
                    {signal.label}
                  </div>
                  <div className="mt-1 text-[11px] font-semibold text-[var(--color-text-muted)]">
                    {signal.sourceLabel}
                  </div>
                </div>
                <div className={cn(
                  "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2 py-1 text-[10px] font-bold uppercase tracking-[0.14em]",
                  signalTone(signal)
                )}>
                  <StatusIcon className="size-3.5" />
                  {statusLabel(signal)}
                </div>
              </div>
              <p className="mt-1 text-[11.5px] leading-snug text-[var(--color-text-muted)]">
                {signal.detail}
              </p>
              {signal.action && (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {signal.id === "rsn" && signal.status === "missing" && (
                    <input
                      value={rsnDraft}
                      onChange={(event) => setRsnDraft(event.target.value)}
                      placeholder="Type RSN"
                      aria-label="OSRS name for this plan"
                      className="h-8 min-w-[128px] rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-2.5 text-[11.5px] font-semibold text-[var(--color-text)] outline-none transition-colors placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-accent)]/60"
                    />
                  )}
                  <Link
                    href={signal.action.href}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-bold transition-colors",
                      signal.status === "exact"
                        ? "border-[var(--color-good)]/25 bg-[var(--color-good)]/8 text-[var(--color-good)] hover:bg-[var(--color-good)]/12"
                        : "border-[var(--color-accent)]/35 bg-[var(--color-accent)]/10 text-[var(--color-accent)] hover:bg-[var(--color-accent)]/15"
                    )}
                  >
                    {signal.action.label}
                    <ArrowRight className="size-3" />
                  </Link>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
