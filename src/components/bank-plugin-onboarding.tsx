"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, CheckCircle2, Clock3, DatabaseZap, PlugZap } from "lucide-react";
import { CopyCommand } from "@/components/copy-command";
import { BANK_PLUGIN_ONBOARDING, bankPluginOnboardingActions } from "@/lib/plugin-onboarding";
import { scapestackPluginHubStateFromStatus } from "@/lib/scapestack-readiness";
import type { PluginHubStatus } from "@/lib/plugin-hub-status";
import { cn } from "@/lib/utils";

export function BankPluginOnboarding() {
  const [status, setStatus] = useState<PluginHubStatus | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/plugin-hub/status")
      .then((response) => response.ok ? response.json() as Promise<PluginHubStatus> : null)
      .then((nextStatus) => {
        if (!cancelled) setStatus(nextStatus);
      })
      .catch(() => {
        if (!cancelled) setStatus(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const pluginHubReadinessState = scapestackPluginHubStateFromStatus(status);
  const statusCopy = statusCopyForPluginHub(status, pluginHubReadinessState);
  const isPluginHubLive = pluginHubReadinessState === "merged";
  const actions = bankPluginOnboardingActions(pluginHubReadinessState);
  const SignalIcon = isPluginHubLive ? CheckCircle2 : Clock3;
  const signalTitle = isPluginHubLive
    ? "RuneLite is helping"
    : "RuneLite can skip";

  return (
    <section className="mb-8 overflow-hidden rounded-2xl border border-[var(--color-accent)]/25 bg-gradient-to-br from-[var(--color-panel)] to-[var(--color-bg-2)] shadow-[0_24px_80px_rgba(0,0,0,0.2)]">
      <div className="grid gap-0 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="p-5 sm:p-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-[var(--color-accent)]/25 bg-[var(--color-accent)]/10 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--color-accent)]">
            <PlugZap className="size-3.5" />
            {BANK_PLUGIN_ONBOARDING.eyebrow}
          </div>
          <h2 className="mt-4 max-w-2xl text-[24px] font-bold leading-tight tracking-normal text-[var(--color-text)] sm:text-[30px]">
            {BANK_PLUGIN_ONBOARDING.title}
          </h2>
          <p className="mt-3 max-w-2xl text-[13.5px] leading-relaxed text-[var(--color-text-dim)]">
            {BANK_PLUGIN_ONBOARDING.body}
          </p>
          <div aria-label="Bank plugin onboarding actions" className="mt-5 flex flex-wrap gap-2">
            {actions.map((action) => (
              <Link
                key={action.href}
                href={action.href}
                className={cn(
                  "inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-[13px] font-bold transition-all",
                  action.tone === "primary"
                    ? "bg-[var(--color-accent)] text-[var(--color-bg)] hover:brightness-110"
                    : "border border-[var(--color-border)] bg-[var(--color-bg)]/45 text-[var(--color-text)] hover:border-[var(--color-accent)]/45 hover:text-[var(--color-accent)]"
                )}
              >
                {action.label}
                <ArrowRight className="size-4" />
              </Link>
            ))}
          </div>
          <div className="mt-5 grid gap-2 sm:grid-cols-2">
            {BANK_PLUGIN_ONBOARDING.lanes.map((lane) => (
              <div key={lane.label} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)]/35 p-3.5">
                <div className="flex items-center gap-2 text-[10.5px] font-bold uppercase tracking-[0.16em] text-[var(--color-accent)]">
                  <DatabaseZap className="size-3.5" />
                  {lane.label}
                </div>
                <div className="mt-2 text-[13px] font-bold text-[var(--color-text)]">{lane.title}</div>
                <p className="mt-1 text-[12px] leading-relaxed text-[var(--color-text-dim)]">{lane.body}</p>
                <p className="mt-2 border-t border-[var(--color-border)] pt-2 text-[11px] leading-snug text-[var(--color-text-muted)]">
                  {lane.proof}
                </p>
              </div>
            ))}
          </div>
          <div className="mt-5 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)]/30 p-3.5">
            <div className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">
              Simple path
            </div>
            <div className="mt-3 grid gap-2">
              {BANK_PLUGIN_ONBOARDING.readiness.map((step) => {
                const StepIcon = step.state === "ready" ? CheckCircle2 : Clock3;
                return (
                  <div key={step.title} className="grid gap-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-panel)]/45 px-3 py-2.5">
                    <div className="flex items-center gap-2 text-[11px] font-bold text-[var(--color-text)]">
                      <StepIcon
                        className={cn(
                          "size-3.5 shrink-0",
                          step.state === "ready" ? "text-[var(--color-good)]" : "text-[var(--color-warning)]"
                        )}
                      />
                      <span className="rounded-full bg-[var(--color-bg)] px-2 py-0.5 text-[9.5px] uppercase tracking-[0.14em] text-[var(--color-text-muted)]">
                        {step.label}
                      </span>
                      <span>{step.title}</span>
                    </div>
                    <p className="text-[11.5px] leading-relaxed text-[var(--color-text-dim)]">{step.body}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <aside className="border-t border-[var(--color-border)] bg-[var(--color-bg)]/35 p-5 sm:p-6 lg:border-l lg:border-t-0">
          <div className={cn("mb-4 rounded-xl border px-3 py-2.5", statusCopy.className)}>
            <div className="flex items-center gap-2 text-[10.5px] font-bold uppercase tracking-[0.16em]">
              <Clock3 className="size-3.5" />
              {statusCopy.title}
            </div>
            <p className="mt-1 text-[11.5px] leading-relaxed text-[var(--color-text-dim)]">
              {statusCopy.body}
            </p>
          </div>

          <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
            {signalTitle}
          </div>
          <div className="mt-3 grid gap-2">
            {BANK_PLUGIN_ONBOARDING.signals.map((signal) => (
              <div
                key={signal}
                className={cn(
                  "flex items-center gap-2 rounded-lg border px-3 py-2 text-[12.5px]",
                  isPluginHubLive
                    ? "border-[var(--color-border)] bg-[var(--color-panel)]/60 text-[var(--color-text)]"
                    : "border-[var(--color-warning)]/20 bg-[var(--color-warning)]/5 text-[var(--color-text-dim)]"
                )}
              >
                <SignalIcon className={cn(
                  "size-4 shrink-0",
                  isPluginHubLive ? "text-[var(--color-good)]" : "text-[var(--color-warning)]"
                )} />
                {signal}
              </div>
            ))}
          </div>
          <div className="mt-4">
            <CopyCommand
              value={BANK_PLUGIN_ONBOARDING.copy.value}
              label={BANK_PLUGIN_ONBOARDING.copy.label}
            />
          </div>
        </aside>
      </div>
    </section>
  );
}

function statusCopyForPluginHub(
  status: PluginHubStatus | null,
  readinessState = scapestackPluginHubStateFromStatus(status)
): { title: string; body: string; className: string } {
  if (readinessState === "merged") {
    return {
      title: "RuneLite can help",
      body: "Enable Scapestack Sync in RuneLite, then check this same RSN from /plugin.",
      className: "border-[var(--color-good)]/25 bg-[var(--color-good)]/10 text-[var(--color-good)]"
    };
  }

  if (readinessState === "review-blocked") {
    return {
      title: "Use the plan now",
      body: "Use bank paste and /next now. Check RuneLite later when finished progress matters.",
      className: "border-[var(--color-warning)]/25 bg-[var(--color-warning)]/10 text-[var(--color-warning)]"
    };
  }

  if (readinessState === "pending") {
    return {
      title: "Use the plan now",
      body: "Use bank paste and /next now. Open /plugin when quests, diaries, clog or Slayer should change the pick.",
      className: "border-[var(--color-warning)]/25 bg-[var(--color-warning)]/10 text-[var(--color-warning)]"
    };
  }

  if (readinessState === "closed") {
    return {
      title: "RuneLite later",
      body: "Bank paste, Hiscores and public trackers still work. Check RuneLite later when it has sent progress for this RSN.",
      className: "border-[var(--color-danger)]/25 bg-[var(--color-danger)]/10 text-[var(--color-danger)]"
    };
  }

  return {
    title: "RuneLite status unknown",
    body: "Use /plugin to check whether RuneLite is helping this RSN.",
    className: "border-[var(--color-accent)]/25 bg-[var(--color-accent)]/10 text-[var(--color-accent)]"
  };
}
