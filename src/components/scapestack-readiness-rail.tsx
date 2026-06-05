"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowRight, CheckCheck, CheckCircle2, CircleDashed, Copy, DatabaseZap, PlugZap, UserRound } from "lucide-react";
import {
  buildScapestackReadiness,
  scapestackPluginHubStateFromStatus,
  type ScapestackReadinessInput,
  type ScapestackPluginHubState,
  type ScapestackReadinessSignal
} from "@/lib/scapestack-readiness";
import type { PluginHubStatus } from "@/lib/plugin-hub-status";
import { copyText } from "@/lib/clipboard";
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
  if (signal.status === "exact") return "Verified";
  if (signal.status === "ready") return "Ready";
  return "Missing";
}

export function ScapestackReadinessRail({
  className,
  ...input
}: ScapestackReadinessInput & { className?: string }) {
  const [rsnDraft, setRsnDraft] = useState(input.rsn?.trim() ?? "");
  const [copyState, setCopyState] = useState<"idle" | "copied" | "error">("idle");
  const [pluginHubState, setPluginHubState] = useState<ScapestackPluginHubState>(input.pluginHubState ?? "pending");

  useEffect(() => {
    if (input.hasPluginSync) return;
    let active = true;

    fetch("/api/plugin-hub/status")
      .then(async (response) => response.ok ? await response.json() as PluginHubStatus : null)
      .then((status) => {
        if (!active) return;
        setPluginHubState(scapestackPluginHubStateFromStatus(status));
      })
      .catch(() => {
        if (active) setPluginHubState(input.pluginHubState ?? "pending");
      });

    return () => {
      active = false;
    };
  }, [input.hasPluginSync, input.pluginHubState]);

  const readiness = buildScapestackReadiness({
    ...input,
    pluginHubState,
    rsn: input.hasRsn ? input.rsn : rsnDraft
  });

  const copySyncValue = async (value: string) => {
    const result = await copyText(value);
    if (result !== "failed") {
      setCopyState("copied");
      setTimeout(() => setCopyState((current) => current === "copied" ? "idle" : current), 1600);
    } else {
      setCopyState("error");
    }
  };

  return (
    <section className={cn(
      "mb-6 overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-panel)]/80",
      "shadow-[0_18px_60px_rgba(0,0,0,0.18)]",
      className
    )}>
      <div className="flex flex-col gap-4 p-4 sm:p-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <div className="text-[10.5px] font-bold uppercase tracking-[0.18em] text-[var(--color-accent)]">
            {readiness.eyebrow}
          </div>
          <h2 className="mt-1 text-[17px] font-bold tracking-tight text-[var(--color-text)]">
            {readiness.title}
          </h2>
          <p className="mt-1 max-w-3xl text-[12.5px] leading-relaxed text-[var(--color-text-dim)]">
            {readiness.body}
          </p>
        </div>
        <Link
          href={readiness.primaryAction.href}
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-[var(--color-accent)]/40 bg-[var(--color-accent)]/12 px-4 py-2.5 text-[12.5px] font-bold text-[var(--color-accent)] transition-colors hover:bg-[var(--color-accent)]/18"
        >
          {readiness.primaryAction.label}
          <ArrowRight className="size-4" />
        </Link>
      </div>

      <div className="grid border-t border-[var(--color-border)] bg-[var(--color-bg)]/25 sm:grid-cols-3">
        {readiness.signals.map((signal) => {
          const Icon = signalIcons[signal.id];
          const StatusIcon = signal.status === "missing" ? CircleDashed : CheckCircle2;
          return (
            <div key={signal.id} className="border-t border-[var(--color-border)] p-3 first:border-t-0 sm:border-l sm:border-t-0 sm:first:border-l-0">
              <div className={cn(
                "mb-2 inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-[10px] font-bold uppercase tracking-[0.14em]",
                signalTone(signal)
              )}>
                <StatusIcon className="size-3.5" />
                {statusLabel(signal)}
              </div>
              <div className="flex items-center gap-2 text-[12.5px] font-bold text-[var(--color-text)]">
                <Icon className="size-4 text-[var(--color-text-muted)]" />
                {signal.label}
              </div>
              <div className="mt-1 inline-flex max-w-full items-center rounded-full border border-[var(--color-border)] bg-[var(--color-bg)]/45 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--color-text-muted)]">
                <span className="mr-1 text-[var(--color-text-dim)]">Source:</span>
                <span className="truncate">{signal.sourceLabel}</span>
              </div>
              <p className="mt-1 text-[11.5px] leading-snug text-[var(--color-text-muted)]">
                {signal.detail}
              </p>
              <div className="mt-2 flex flex-wrap gap-1">
                {signal.adds.map((item) => (
                  <span
                    key={`${signal.id}:${item}`}
                    className="rounded-full border border-[var(--color-accent)]/20 bg-[var(--color-accent)]/8 px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-[0.11em] text-[var(--color-accent)]"
                  >
                    Adds {item}
                  </span>
                ))}
              </div>
              <p className="mt-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)]/30 px-2.5 py-2 text-[10.5px] font-semibold leading-snug text-[var(--color-text-dim)]">
                {signal.boundary}
              </p>
              {signal.notice && (
                <div className="mt-2 rounded-lg border border-[var(--color-warning)]/30 bg-[var(--color-warning)]/8 px-2.5 py-2 text-[11px] font-semibold leading-snug text-[var(--color-warning)]">
                  {signal.notice}
                </div>
              )}
              {signal.steps && (
                <ol className="mt-2 space-y-1.5">
                  {signal.steps.map((step, index) => (
                    <li
                      key={step.label}
                      className="grid grid-cols-[18px_1fr] gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)]/35 px-2.5 py-2"
                    >
                      <span className="flex size-[18px] items-center justify-center rounded-full bg-[var(--color-accent)]/12 text-[10px] font-black text-[var(--color-accent)]">
                        {index + 1}
                      </span>
                      <span className="min-w-0">
                        <span className="block text-[11.5px] font-bold text-[var(--color-text)]">{step.label}</span>
                        <span className="mt-0.5 block text-[10.5px] leading-snug text-[var(--color-text-muted)]">{step.body}</span>
                      </span>
                    </li>
                  ))}
                </ol>
              )}
              {signal.copy && (
                <div
                  className={cn(
                    "mt-2 overflow-hidden rounded-lg border bg-[var(--color-bg)]/50",
                    copyState === "copied" && "border-[var(--color-good)]/35",
                    copyState === "error" && "border-[var(--color-danger)]/35",
                    copyState === "idle" && "border-[var(--color-border)]"
                  )}
                >
                  <div className="flex items-stretch">
                    <code className="min-w-0 flex-1 break-all px-2.5 py-2 font-mono text-[10.5px] leading-relaxed text-[var(--color-accent)]">
                      {signal.copy.value}
                    </code>
                    <button
                      type="button"
                      onClick={() => copySyncValue(signal.copy!.value)}
                      className={cn(
                        "inline-flex shrink-0 items-center gap-1.5 border-l px-2.5 text-[11px] font-bold transition-colors",
                        copyState === "copied" && "border-[var(--color-good)]/35 bg-[var(--color-good)]/10 text-[var(--color-good)]",
                        copyState === "error" && "border-[var(--color-danger)]/35 bg-[var(--color-danger)]/10 text-[var(--color-danger)]",
                        copyState === "idle" && "border-[var(--color-border)] text-[var(--color-text-dim)] hover:bg-[var(--color-panel)]/60 hover:text-[var(--color-text)]"
                      )}
                      aria-label={`${signal.copy.label}: ${signal.copy.value}`}
                    >
                      {copyState === "copied" ? <CheckCheck className="size-3.5" /> : copyState === "error" ? <AlertTriangle className="size-3.5" /> : <Copy className="size-3.5" />}
                      {copyState === "copied" ? "Copied" : copyState === "error" ? "Failed" : signal.copy.label}
                    </button>
                  </div>
                  <div role="status" aria-live="polite" className="sr-only">
                    {copyState === "copied" ? "Copied sync URL." : copyState === "error" ? "Clipboard failed. Select and copy the sync URL manually." : ""}
                  </div>
                  {copyState === "error" && (
                    <p className="border-t border-[var(--color-danger)]/25 px-2.5 py-2 text-[10.5px] font-semibold leading-snug text-[var(--color-danger)]">
                      Clipboard failed — select the sync URL and copy it manually.
                    </p>
                  )}
                </div>
              )}
              {signal.action && (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {signal.id === "rsn" && signal.status === "missing" && (
                    <input
                      value={rsnDraft}
                      onChange={(event) => setRsnDraft(event.target.value)}
                      placeholder="Type RSN"
                      aria-label="OSRS name for Scapestack readiness"
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
