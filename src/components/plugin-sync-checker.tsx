"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { AlertTriangle, ArrowRight, CheckCircle2, DatabaseZap, RefreshCw, Search, XCircle } from "lucide-react";
import { pluginSyncStatusAction } from "@/app/actions";
import { CopyCommand } from "@/components/copy-command";
import type { SyncedPlayer } from "@/lib/sync-repo";
import { copyText } from "@/lib/clipboard";
import { pluginSyncHealth } from "@/lib/plugin-sync";
import {
  diagnosticForUnconfiguredSync,
  healthLabel,
  type PluginSyncDiagnostic
} from "@/lib/plugin-sync-diagnostics";
import { PLUGIN_VERIFY_SYNC_HASH } from "@/lib/plugin-bank-bridge";
import { DB_INIT_COMMAND, syncUrlsForOrigin } from "@/lib/plugin-sync-actions";
import { cn } from "@/lib/utils";
import {
  summarizePluginSyncService,
  type PluginSyncServiceStatus,
  type PluginSyncServiceSummary
} from "@/lib/plugin-sync-service";
import { loadSavedRsn, saveSavedRsn } from "@/lib/saved-bank";

type CheckState =
  | { kind: "idle" }
  | { kind: "found"; player: SyncedPlayer }
  | { kind: "missing"; rsn: string }
  | { kind: "unconfigured" }
  | { kind: "error"; message: string };

function syncAgeLabel(iso: string): string {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return "recently";
  const seconds = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function PluginSyncChecker() {
  const [rsn, setRsn] = useState("");
  const [prefillSource, setPrefillSource] = useState<"url" | "saved" | null>(null);
  const [state, setState] = useState<CheckState>({ kind: "idle" });
  const [serviceStatus, setServiceStatus] = useState<PluginSyncServiceStatus | null>(null);
  const [serviceError, setServiceError] = useState<string | null>(null);
  const [syncOrigin, setSyncOrigin] = useState<string | null>(null);
  const [syncUrlCopyState, setSyncUrlCopyState] = useState<"idle" | "copied" | "error">("idle");
  const [pending, startTransition] = useTransition();
  const autoCheckStarted = useRef(false);

  const syncUrls = useMemo(() => syncUrlsForOrigin(syncOrigin), [syncOrigin]);
  const normalized = rsn.trim();
  const rsnHelpId = "plugin-sync-rsn-help";
  const rsnStatusId = "plugin-sync-rsn-status";
  const serviceSummary = useMemo<PluginSyncServiceSummary>(() => {
    if (serviceError) {
      return {
        tone: "warning",
        label: "RuneLite check paused",
        detail: "Try again in a moment. /next still works from public stats.",
        actions: []
      };
    }
    return summarizePluginSyncService(serviceStatus, syncOrigin);
  }, [serviceError, serviceStatus, syncOrigin]);
  const summary = useMemo(() => {
    if (state.kind !== "found") return null;
    const health = pluginSyncHealth({
      pluginVersion: state.player.pluginVersion,
      syncedAt: state.player.syncedAt
    });
    return {
      health,
      label: healthLabel(health),
      tone: health === "live" ? "good" : health === "stale" ? "warning" : "danger"
    };
  }, [state]);
  const diagnostic = useMemo((): PluginSyncDiagnostic | null => {
    if (state.kind === "unconfigured") return diagnosticForUnconfiguredSync();
    return null;
  }, [state]);
  const foundDisplayName = state.kind === "found" ? state.player.displayName || state.player.rsn : "";
  const foundNextHref = foundDisplayName
    ? `/next?rsn=${encodeURIComponent(foundDisplayName)}&from=plugin&bank=none`
    : "/next?from=plugin&bank=none";

  useEffect(() => {
    setSyncOrigin(window.location.origin);
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function loadServiceStatus() {
      try {
        const response = await fetch("/api/sync", { cache: "no-store" });
        const body = await response.json() as PluginSyncServiceStatus;
        if (!cancelled) setServiceStatus(body);
      } catch (error) {
        if (!cancelled) {
          setServiceError(error instanceof Error ? error.message : "Unable to check sync service");
        }
      }
    }
    void loadServiceStatus();
    return () => {
      cancelled = true;
    };
  }, []);

  const checkRsnValue = useCallback((value: string) => {
    const clean = value.trim();
    if (!clean) return;
    startTransition(async () => {
      try {
        const next = await pluginSyncStatusAction(clean);
        setState(next);
        if (next.kind !== "unconfigured") saveSavedRsn(clean);
      } catch (err) {
        setState({
          kind: "error",
          message: err instanceof Error ? err.message : "Sync check failed"
        });
      }
    });
  }, [startTransition]);

  useEffect(() => {
    if (autoCheckStarted.current) return;
    const params = new URLSearchParams(window.location.search);
    const rsnFromUrl = params.get("rsn")?.trim() ?? "";
    const savedRsn = loadSavedRsn()?.trim() ?? "";
    const initialRsn = rsnFromUrl || savedRsn;
    if (!initialRsn) return;

    setRsn(initialRsn);
    setPrefillSource(rsnFromUrl ? "url" : "saved");
    if (rsnFromUrl) {
      autoCheckStarted.current = true;
      checkRsnValue(rsnFromUrl);
    }
  }, [checkRsnValue]);

  const runCheck = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    checkCurrentRsn();
  };

  const checkCurrentRsn = () => {
    checkRsnValue(normalized);
  };

  const copySyncUrl = async () => {
    const result = await copyText(syncUrls.sync);
    if (result !== "failed") {
      setSyncUrlCopyState("copied");
      window.setTimeout(() => setSyncUrlCopyState((current) => current === "copied" ? "idle" : current), 1600);
    } else {
      setSyncUrlCopyState("error");
    }
  };

  return (
    <section id={PLUGIN_VERIFY_SYNC_HASH} className="mt-6 scroll-mt-16 rounded-2xl border border-[var(--color-border)] bg-[var(--color-panel)]/75 p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-[11px] uppercase tracking-[0.18em] font-bold text-[var(--color-accent)]">
            RuneLite sync
          </div>
          <h2 className="mt-1 text-[22px] font-bold tracking-normal text-[var(--color-text)]">
            Check your RSN
          </h2>
          <p className="mt-2 max-w-2xl text-[13.5px] leading-relaxed text-[var(--color-text-dim)]">
            Same RSN as RuneLite. Found it? Open one plan.
          </p>
        </div>
        {summary && (
          <div className={cn(
            "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[12px] font-bold",
            summary.tone === "good" && "border-[var(--color-good)]/30 bg-[var(--color-good)]/10 text-[var(--color-good)]",
            summary.tone === "warning" && "border-[var(--color-warning)]/30 bg-[var(--color-warning)]/10 text-[var(--color-warning)]",
            summary.tone === "danger" && "border-[var(--color-danger)]/30 bg-[var(--color-danger)]/10 text-[var(--color-danger)]"
          )}>
            {summary.tone === "good" ? <CheckCircle2 className="size-4" /> : <AlertTriangle className="size-4" />}
            {summary.label}
          </div>
        )}
      </div>

      <ServiceReadinessPill summary={serviceSummary} />

      <form onSubmit={runCheck} className="mt-5 flex flex-col sm:flex-row gap-2">
        <label className="sr-only" htmlFor="plugin-sync-rsn">OSRS name</label>
        <input
          id="plugin-sync-rsn"
          name="rsn"
          type="text"
          value={rsn}
          onChange={(event) => {
            setRsn(event.target.value);
            setPrefillSource(null);
          }}
          placeholder="Type your OSRS name"
          maxLength={12}
          autoComplete="off"
          spellCheck={false}
          aria-describedby={`${rsnHelpId} ${rsnStatusId}`}
          className="min-w-0 flex-1 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-3 text-[14px] text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] outline-none focus:border-[var(--color-accent)]/55 focus:shadow-[0_0_0_3px_rgba(15, 118, 110,0.12)]"
        />
        <button
          type="submit"
          disabled={pending || !normalized}
          aria-label={normalized ? `Check RuneLite for ${normalized}` : "Enter an OSRS name before checking RuneLite"}
          aria-describedby={`${rsnHelpId} ${rsnStatusId}`}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--color-accent)] px-4 py-3 text-[13px] font-bold text-[var(--color-bg)] transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-55"
        >
          <Search className="size-4" />
          {pending ? "Checking…" : "Check RuneLite"}
        </button>
      </form>
      <p id={rsnHelpId} className="mt-2 text-[11.5px] leading-relaxed text-[var(--color-text-muted)]">
        Same display name as RuneLite. Max 12 characters.
      </p>
      <p id={rsnStatusId} role="status" aria-live="polite" className="sr-only">
        {pending
          ? `Checking RuneLite for ${normalized || "this RSN"}.`
          : normalized
            ? `Ready to check RuneLite for ${normalized}.`
            : "Enter an OSRS name to check RuneLite."}
      </p>

      {prefillSource && normalized && (
        <div className="mt-2 rounded-lg border border-[var(--color-accent)]/20 bg-[var(--color-accent)]/8 px-3 py-2 text-[11.5px] leading-relaxed text-[var(--color-text-dim)]">
          {prefillSource === "url"
            ? `Checking ${normalized} from /next.`
            : `Loaded ${normalized}. Press Check RuneLite.`}
        </div>
      )}

      <div className="mt-4">
        {state.kind === "idle" && (
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)]/35 px-4 py-3 text-[12.5px] leading-relaxed text-[var(--color-text-dim)]">
            RuneLite helps Scapestack skip stuff you already finished.
          </div>
        )}

        {state.kind === "missing" && (
          <div className="rounded-xl border border-[var(--color-warning)]/30 bg-[var(--color-warning)]/10 px-4 py-3">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="flex min-w-0 items-start gap-2">
                <XCircle className="mt-0.5 size-4 shrink-0 text-[var(--color-warning)]" />
                <div className="min-w-0">
                  <div className="text-[13px] font-bold text-[var(--color-warning)]">No sync for {state.rsn}</div>
                  <p className="mt-1 text-[12.5px] leading-relaxed text-[var(--color-text-dim)]">
                    Open RuneLite, press Sync now, then check again.
                  </p>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={copySyncUrl}
                      className={cn(
                        "inline-flex items-center justify-center gap-1.5 rounded-lg border bg-[var(--color-bg)]/35 px-3 py-2 text-[12px] font-bold transition-colors",
                        syncUrlCopyState === "copied"
                          ? "border-[var(--color-good)]/35 text-[var(--color-good)]"
                          : syncUrlCopyState === "error"
                            ? "border-[var(--color-danger)]/35 text-[var(--color-danger)]"
                            : "border-[var(--color-warning)]/35 text-[var(--color-warning)] hover:bg-[var(--color-warning)]/10"
                      )}
                    >
                      {syncUrlCopyState === "copied" ? "Sync URL copied" : syncUrlCopyState === "error" ? "Copy failed" : "Copy scapestack.org sync URL"}
                    </button>
                    <span role="status" aria-live="polite" className="text-[11px] text-[var(--color-text-muted)]">
                      {syncUrlCopyState === "error" ? syncUrls.sync : ""}
                    </span>
                  </div>
                </div>
              </div>
              <div className="shrink-0">
                <button
                  type="button"
                  onClick={checkCurrentRsn}
                  disabled={pending}
                  aria-label={`Re-check RuneLite sync for ${state.rsn} after logging in`}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-warning)]/35 bg-[var(--color-bg)]/35 px-3 py-2 text-[12px] font-semibold text-[var(--color-warning)] hover:bg-[var(--color-warning)]/10 transition-colors disabled:opacity-50"
                >
                  <RefreshCw className={cn("size-3.5", pending && "animate-spin")} />
                  Check again
                </button>
              </div>
            </div>
          </div>
        )}

        {state.kind === "unconfigured" && (
          <div className="rounded-xl border border-[var(--color-danger)]/30 bg-[var(--color-danger)]/10 px-4 py-3">
            <div className="flex items-start gap-2">
              <DatabaseZap className="mt-0.5 size-4 text-[var(--color-danger)] shrink-0" />
              <div>
                <div className="text-[13px] font-bold text-[var(--color-danger)]">RuneLite check is not ready</div>
                <p className="mt-1 text-[12.5px] leading-relaxed text-[var(--color-text-dim)]">
                  Finish server setup, then check this RSN again. /next still works from public stats.
                </p>
                <CopyCommand value={DB_INIT_COMMAND} label="Copy command" />
              </div>
            </div>
          </div>
        )}

        {state.kind === "error" && (
          <div className="rounded-xl border border-[var(--color-danger)]/30 bg-[var(--color-danger)]/10 px-4 py-3 text-[12.5px] text-[var(--color-text-dim)]">
            {state.message}
          </div>
        )}

        {state.kind === "found" && (
          <div className="rounded-xl border border-[var(--color-good)]/30 bg-[var(--color-good)]/10 px-4 py-3">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-[14px] font-bold text-[var(--color-good)]">
                  <CheckCircle2 className="size-4 shrink-0" />
                  RuneLite is helping {foundDisplayName}
                </div>
                <p className="mt-1 text-[12.5px] leading-relaxed text-[var(--color-text-dim)]">
                  Open one plan that skips finished quests, diary steps, clog slots and wrong Slayer calls.
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5 text-[11px] text-[var(--color-text-muted)]">
                  <span className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg)]/35 px-2 py-1">
                    Synced {syncAgeLabel(state.player.syncedAt)}
                  </span>
                  {state.player.slayer && (
                    <span className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg)]/35 px-2 py-1">
                      Slayer task ready
                    </span>
                  )}
                </div>
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
                <Link
                  href={foundNextHref}
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-[var(--color-accent)] px-3 py-2 text-[12px] font-bold text-[var(--color-bg)] transition-all hover:brightness-110"
                >
                  Open one plan
                  <ArrowRight className="size-3.5" />
                </Link>
                <button
                  type="button"
                  onClick={checkCurrentRsn}
                  disabled={pending}
                  aria-label={`Re-check RuneLite sync for ${foundDisplayName}`}
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)]/35 px-3 py-2 text-[12px] font-bold text-[var(--color-text)] transition-colors hover:border-[var(--color-accent)]/45 hover:text-[var(--color-accent)] disabled:opacity-50"
                >
                  <RefreshCw className={cn("size-3.5", pending && "animate-spin")} />
                  Check again
                </button>
              </div>
            </div>
          </div>
        )}

        {state.kind === "unconfigured" && diagnostic && (
          <div className="mt-3">
            <DiagnosticPanel diagnostic={diagnostic} />
          </div>
        )}
      </div>
    </section>
  );
}

function toneTextClass(tone: PluginSyncDiagnostic["tone"]): string {
  if (tone === "good") return "text-[var(--color-good)]";
  if (tone === "warning") return "text-[var(--color-warning)]";
  if (tone === "danger") return "text-[var(--color-danger)]";
  return "text-[var(--color-text)]";
}

function tonePanelClass(tone: PluginSyncDiagnostic["tone"]): string {
  if (tone === "good") return "border-[var(--color-good)]/25 bg-[var(--color-good)]/10";
  if (tone === "warning") return "border-[var(--color-warning)]/25 bg-[var(--color-warning)]/10";
  if (tone === "danger") return "border-[var(--color-danger)]/25 bg-[var(--color-danger)]/10";
  return "border-[var(--color-border)] bg-[var(--color-bg)]/35";
}

function serviceTonePanelClass(tone: PluginSyncServiceSummary["tone"]): string {
  if (tone === "good") return "border-[var(--color-good)]/25 bg-[var(--color-good)]/10";
  if (tone === "warning") return "border-[var(--color-warning)]/25 bg-[var(--color-warning)]/10";
  if (tone === "danger") return "border-[var(--color-danger)]/25 bg-[var(--color-danger)]/10";
  return "border-[var(--color-border)] bg-[var(--color-bg)]/35";
}

function serviceToneTextClass(tone: PluginSyncServiceSummary["tone"]): string {
  if (tone === "good") return "text-[var(--color-good)]";
  if (tone === "warning") return "text-[var(--color-warning)]";
  if (tone === "danger") return "text-[var(--color-danger)]";
  return "text-[var(--color-text)]";
}

function ServiceReadinessPill({ summary }: { summary: PluginSyncServiceSummary }) {
  if (summary.tone === "good") return null;

  const Icon = summary.tone === "danger" ? DatabaseZap : AlertTriangle;

  return (
    <div className={cn("mt-4 flex items-start gap-2 rounded-xl border px-3 py-2.5", serviceTonePanelClass(summary.tone))}>
      <Icon className={cn("mt-0.5 size-4 shrink-0", serviceToneTextClass(summary.tone))} />
      <div>
        <div className={cn("text-[12px] font-bold", serviceToneTextClass(summary.tone))}>
          {summary.label}
        </div>
        <p className="mt-0.5 text-[11.5px] leading-relaxed text-[var(--color-text-dim)]">
          {summary.detail}
        </p>
        {summary.actions.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {summary.actions.map((action) => (
              <CopyCommand key={action.label} value={action.copy} label={action.label} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function DiagnosticPanel({ diagnostic }: { diagnostic: PluginSyncDiagnostic }) {
  return (
    <div className={cn("rounded-xl border px-4 py-3", tonePanelClass(diagnostic.tone))}>
      <div className="text-[11px] uppercase tracking-[0.18em] font-bold text-[var(--color-text-muted)]">
        Fix
      </div>
      <h3 className="mt-1 text-[15px] font-bold text-[var(--color-text)]">{diagnostic.title}</h3>
      <p className="mt-1 text-[12.5px] leading-relaxed text-[var(--color-text-dim)]">{diagnostic.body}</p>
      <ol className="mt-3 grid gap-1.5 text-[12.5px] leading-relaxed text-[var(--color-text-dim)]">
        {diagnostic.steps.map((step, index) => (
          <li key={step} className="flex gap-2">
            <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] text-[10px] font-bold text-[var(--color-text-muted)]">
              {index + 1}
            </span>
            <span>{step}</span>
          </li>
        ))}
      </ol>
      {(diagnostic.primaryAction || diagnostic.secondaryAction) && (
        <div className="mt-3 flex flex-wrap gap-2">
          {[diagnostic.primaryAction, diagnostic.secondaryAction].filter(Boolean).map((action) => {
            if (!action) return null;
            if (action.copy) return <CopyCommand key={action.label} value={action.copy} label={action.label} />;
            if (action.href) {
              return (
                <Link
                  key={action.label}
                  href={action.href}
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-[var(--color-accent)] px-3 py-2 text-[12px] font-bold text-[var(--color-bg)] hover:brightness-110 transition-all"
                >
                  {action.label}
                  <ArrowRight className="size-3.5" />
                </Link>
              );
            }
            return null;
          })}
        </div>
      )}
    </div>
  );
}
