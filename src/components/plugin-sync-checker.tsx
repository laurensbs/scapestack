"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { AlertTriangle, ArrowRight, CheckCheck, CheckCircle2, Clock3, Copy, DatabaseZap, RefreshCw, Search, ShieldCheck, XCircle } from "lucide-react";
import { pluginSyncStatusAction } from "@/app/actions";
import { CopyCommand } from "@/components/copy-command";
import type { SyncedPlayer } from "@/lib/sync-repo";
import { copyText } from "@/lib/clipboard";
import { CURRENT_PLUGIN_VERSION, pluginSyncHealth } from "@/lib/plugin-sync";
import { formatPluginSyncProof, formatPluginSyncSessionChecklist } from "@/lib/plugin-sync-proof";
import {
  diagnosticForMissingSync,
  diagnosticForSyncedPlayer,
  diagnosticForUnconfiguredSync,
  actionQueueForSyncedPlayer,
  healthLabel,
  nextReadinessForSyncedPlayer,
  signalCoverageForSyncedPlayer,
  type PluginSignalCoverage,
  type PluginSyncActionQueueItem,
  type PluginNextReadiness,
  type PluginSyncDiagnostic
} from "@/lib/plugin-sync-diagnostics";
import { PLUGIN_VERIFY_SYNC_HASH } from "@/lib/plugin-bank-bridge";
import { DB_INIT_COMMAND, syncUrlsForOrigin } from "@/lib/plugin-sync-actions";
import { TASK_ID_TO_MONSTER } from "@/lib/slayer/task-ids";
import { MONSTERS_BY_ID } from "@/lib/slayer/monsters";
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

function slayerTaskName(player: SyncedPlayer): string {
  const taskId = player.slayer?.currentTaskId ?? 0;
  const monsterSlug = TASK_ID_TO_MONSTER[taskId];
  if (!monsterSlug) return "No mapped live task";
  return MONSTERS_BY_ID.get(monsterSlug)?.name ?? monsterSlug.replaceAll("_", " ");
}

function countLabel(count: number, singular: string, plural: string): string {
  return `${count.toLocaleString()} ${count === 1 ? singular : plural}`;
}

export function PluginSyncChecker() {
  const [rsn, setRsn] = useState("");
  const [prefillSource, setPrefillSource] = useState<"url" | "saved" | null>(null);
  const [state, setState] = useState<CheckState>({ kind: "idle" });
  const [serviceStatus, setServiceStatus] = useState<PluginSyncServiceStatus | null>(null);
  const [serviceError, setServiceError] = useState<string | null>(null);
  const [syncOrigin, setSyncOrigin] = useState<string | null>(null);
  const [proofCopyState, setProofCopyState] = useState<"idle" | "copied" | "error">("idle");
  const [checklistCopyState, setChecklistCopyState] = useState<"idle" | "copied" | "error">("idle");
  const [manualProofText, setManualProofText] = useState("");
  const [manualChecklistText, setManualChecklistText] = useState("");
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
        label: "Sync service check failed",
        detail: serviceError,
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
    if (state.kind === "found") return diagnosticForSyncedPlayer(state.player, { origin: syncOrigin });
    if (state.kind === "missing") return diagnosticForMissingSync(state.rsn, { origin: syncOrigin });
    if (state.kind === "unconfigured") return diagnosticForUnconfiguredSync();
    return null;
  }, [state, syncOrigin]);
  const nextReadiness = useMemo((): PluginNextReadiness | null => {
    if (state.kind !== "found") return null;
    return nextReadinessForSyncedPlayer(state.player);
  }, [state]);
  const signalCoverage = useMemo((): PluginSignalCoverage[] => {
    if (state.kind !== "found") return [];
    return signalCoverageForSyncedPlayer(state.player);
  }, [state]);
  const actionQueue = useMemo((): PluginSyncActionQueueItem[] => {
    if (state.kind !== "found") return [];
    return actionQueueForSyncedPlayer(state.player, { origin: syncOrigin });
  }, [state, syncOrigin]);

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
          setServiceError(error instanceof Error ? error.message : "Unable to check /api/sync readiness");
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

  const copySyncProof = async () => {
    if (state.kind !== "found") return;
    const proofText = formatPluginSyncProof(state.player);
    const result = await copyText(proofText);
    if (result !== "failed") {
      setProofCopyState("copied");
      window.setTimeout(() => setProofCopyState((current) => current === "copied" ? "idle" : current), 1600);
    } else {
      setManualProofText(proofText);
      setProofCopyState("error");
    }
  };

  const copySessionChecklist = async () => {
    if (state.kind !== "found") return;
    const checklistText = formatPluginSyncSessionChecklist(state.player, { origin: syncOrigin });
    const result = await copyText(checklistText);
    if (result !== "failed") {
      setChecklistCopyState("copied");
      window.setTimeout(() => setChecklistCopyState((current) => current === "copied" ? "idle" : current), 1600);
    } else {
      setManualChecklistText(checklistText);
      setChecklistCopyState("error");
    }
  };

  return (
    <section id={PLUGIN_VERIFY_SYNC_HASH} className="mt-6 scroll-mt-24 rounded-2xl border border-[var(--color-border)] bg-[var(--color-panel)]/75 p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-[11px] uppercase tracking-[0.18em] font-bold text-[var(--color-accent)]">
            Verify your sync
          </div>
          <h2 className="mt-1 text-[22px] font-bold tracking-tight text-[var(--color-text)]">
            Check whether Scapestack sees your RuneLite data
          </h2>
          <p className="mt-2 max-w-2xl text-[13.5px] leading-relaxed text-[var(--color-text-dim)]">
            Enter the same RSN you use in RuneLite. This checks the latest stored plugin payload: version, freshness, quests, diaries, CL items and Slayer state.
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
          placeholder="e.g. Lynx Titan"
          maxLength={12}
          autoComplete="off"
          spellCheck={false}
          aria-describedby={`${rsnHelpId} ${rsnStatusId}`}
          className="min-w-0 flex-1 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-3 text-[14px] text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] outline-none focus:border-[var(--color-accent)]/55 focus:shadow-[0_0_0_3px_rgba(230,165,47,0.12)]"
        />
        <button
          type="submit"
          disabled={pending || !normalized}
          aria-label={normalized ? `Check RuneLite sync payload for ${normalized}` : "Enter an OSRS name before checking RuneLite sync"}
          aria-describedby={`${rsnHelpId} ${rsnStatusId}`}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--color-accent)] px-4 py-3 text-[13px] font-bold text-[var(--color-bg)] transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-55"
        >
          <Search className="size-4" />
          {pending ? "Checking…" : "Check sync"}
        </button>
      </form>
      <p id={rsnHelpId} className="mt-2 text-[11.5px] leading-relaxed text-[var(--color-text-muted)]">
        Use the exact RuneLite display name for the account that enabled Scapestack Sync. Names are capped at 12 characters.
      </p>
      <p id={rsnStatusId} role="status" aria-live="polite" className="sr-only">
        {pending
          ? `Checking RuneLite sync for ${normalized || "this RSN"}.`
          : normalized
            ? `Ready to check RuneLite sync for ${normalized}.`
            : "Enter an OSRS name to check RuneLite sync."}
      </p>

      {prefillSource && normalized && (
        <div className="mt-2 rounded-lg border border-[var(--color-accent)]/20 bg-[var(--color-accent)]/8 px-3 py-2 text-[11.5px] leading-relaxed text-[var(--color-text-dim)]">
          {prefillSource === "url"
            ? `Loaded ${normalized} from the handoff URL and started the sync check automatically.`
            : `Loaded saved RSN ${normalized}. Press Check sync to verify the latest plugin payload.`}
        </div>
      )}

      <div className="mt-4">
        {state.kind === "idle" && (
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)]/35 px-4 py-3 text-[12.5px] leading-relaxed text-[var(--color-text-dim)]">
            This is the fastest sanity check after logging in with the plugin: if this finds your RSN, /next can use the verified payload and show which signals are verified, partial or missing.
          </div>
        )}

        {state.kind === "missing" && (
          <div className="rounded-xl border border-[var(--color-warning)]/30 bg-[var(--color-warning)]/10 px-4 py-3">
            <div className="flex items-start gap-2">
              <XCircle className="mt-0.5 size-4 text-[var(--color-warning)] shrink-0" />
              <div>
                <div className="text-[13px] font-bold text-[var(--color-warning)]">No Scapestack sync found for {state.rsn}</div>
                <p className="mt-1 text-[12.5px] leading-relaxed text-[var(--color-text-dim)]">
                  Open RuneLite, enable Scapestack Sync, confirm the Sync URL points to this site&apos;s /api/sync endpoint, then sync the same RSN and re-run this check.
                </p>
                <div className="mt-3 grid gap-2">
                  <CopyCommand value={syncUrls.sync} label="Copy sync URL" />
                  <CopyCommand value={syncUrls.claim} label="Copy claim URL" />
                </div>
                <button
                  type="button"
                  onClick={checkCurrentRsn}
                  disabled={pending}
                  aria-label={`Re-check RuneLite sync for ${state.rsn} after logging in`}
                  className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-warning)]/35 bg-[var(--color-bg)]/35 px-3 py-2 text-[12px] font-semibold text-[var(--color-warning)] hover:bg-[var(--color-warning)]/10 transition-colors disabled:opacity-50"
                >
                  <RefreshCw className={cn("size-3.5", pending && "animate-spin")} />
                  Re-check after login
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
                <div className="text-[13px] font-bold text-[var(--color-danger)]">Sync database is not configured</div>
                <p className="mt-1 text-[12.5px] leading-relaxed text-[var(--color-text-dim)]">
                  Add <code className="rounded border border-[var(--color-border)] bg-[var(--color-bg)] px-1 py-0.5 text-[11.5px] text-[var(--color-text)]">DATABASE_URL</code>, then initialize the schema. Without that, the plugin can POST but Scapestack cannot store or verify sync payloads.
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
          <div className="space-y-3">
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-3">
              <Metric label="Synced" value={syncAgeLabel(state.player.syncedAt)} icon={<Clock3 className="size-4" />} />
              <Metric label="Plugin" value={`v${state.player.pluginVersion || "unknown"}`} detail={`current v${CURRENT_PLUGIN_VERSION}`} icon={<ShieldCheck className="size-4" />} />
              <Metric
                label="Quest/diary"
                value={`${state.player.questsCompleted.length}/${state.player.diariesCompleted.length}`}
                detail={`${countLabel(state.player.questsCompleted.length, "quest", "quests")} / ${countLabel(state.player.diariesCompleted.length, "diary tier", "diary tiers")}`}
              />
              <Metric
                label="Collection log"
                value={state.player.collectionLogItemIds.length.toLocaleString()}
                detail={countLabel(state.player.collectionLogItemIds.length, "item id synced", "item ids synced")}
              />
              <div className="md:col-span-2 lg:col-span-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)]/35 px-4 py-3">
                <div className="text-[11px] uppercase tracking-[0.18em] font-bold text-[var(--color-accent)]">Slayer payload</div>
                <div className="mt-2 grid sm:grid-cols-5 gap-2 text-[12.5px] text-[var(--color-text-dim)]">
                  <div><span className="font-semibold text-[var(--color-text)]">{slayerTaskName(state.player)}</span><br />current task</div>
                  <div><span className="font-semibold text-[var(--color-text)]">{state.player.slayer?.taskRemaining ?? "—"}</span><br />remaining</div>
                  <div><span className="font-semibold text-[var(--color-text)]">{state.player.slayer?.points ?? "—"}</span><br />points</div>
                  <div><span className="font-semibold text-[var(--color-text)]">{state.player.slayer?.streak ?? "—"}</span><br />streak</div>
                  <div><span className="font-semibold text-[var(--color-text)]">{state.player.slayer?.blocks.length ?? 0}</span><br />blocks</div>
                </div>
              </div>
            </div>
            <PluginPayloadReceipt player={state.player} />
            <SyncProofCard
              player={state.player}
              copyState={proofCopyState}
              checklistCopyState={checklistCopyState}
              manualProofText={manualProofText}
              manualChecklistText={manualChecklistText}
              onCopy={copySyncProof}
              onCopyChecklist={copySessionChecklist}
            />
            <SignalCoveragePanel signals={signalCoverage} />
            <ActionQueuePanel actions={actionQueue} />
            {diagnostic && <DiagnosticPanel diagnostic={diagnostic} />}
            {nextReadiness && (
              <NextReadinessPanel
                readiness={nextReadiness}
                pending={pending}
                onRefresh={checkCurrentRsn}
              />
            )}
          </div>
        )}

        {(state.kind === "missing" || state.kind === "unconfigured") && diagnostic && (
          <div className="mt-3">
            <DiagnosticPanel diagnostic={diagnostic} />
          </div>
        )}
      </div>
    </section>
  );
}

function PluginPayloadReceipt({ player }: { player: SyncedPlayer }) {
  const displayName = player.displayName || player.rsn;
  const bankHref = `/bank?rsn=${encodeURIComponent(displayName)}&from=plugin`;

  return (
    <div
      data-testid="plugin-payload-receipt"
      className="rounded-xl border border-[var(--color-accent)]/25 bg-[var(--color-accent)]/8 px-4 py-3"
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-[0.18em] font-bold text-[var(--color-accent)]">
            <ShieldCheck className="size-3.5" />
            RuneLite payload receipt
          </div>
          <p className="mt-1 max-w-3xl text-[12px] leading-relaxed text-[var(--color-text-dim)]">
            Scapestack received account-state only: quest completions, diary tiers, collection-log item IDs and optional Slayer state.
            Bank, inventory, equipment, chat, screenshots and login credentials are not part of the plugin payload.
          </p>
        </div>
        <Link
          href={bankHref}
          className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg border border-[var(--color-accent)]/35 bg-[var(--color-bg)]/35 px-3 py-2 text-[12px] font-bold text-[var(--color-accent)] hover:bg-[var(--color-accent)]/10 transition-colors"
          aria-label={`Add browser-only bank context for ${displayName}`}
        >
          Add bank context
          <ArrowRight className="size-3.5" />
        </Link>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <PluginPayloadFact label="Quests" value={countLabel(player.questsCompleted.length, "completed quest", "completed quests")} />
        <PluginPayloadFact label="Diaries" value={countLabel(player.diariesCompleted.length, "diary tier", "diary tiers")} />
        <PluginPayloadFact label="Collection log" value={countLabel(player.collectionLogItemIds.length, "item ID", "item IDs")} />
        <PluginPayloadFact
          label="Slayer"
          value={player.slayer ? `${player.slayer.taskRemaining.toLocaleString()} left · ${player.slayer.points.toLocaleString()} pts` : "Not present"}
        />
      </div>
    </div>
  );
}

function PluginPayloadFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)]/35 px-3 py-2">
      <div className="text-[9.5px] uppercase tracking-[0.14em] font-bold text-[var(--color-text-muted)]">{label}</div>
      <div className="mt-1 text-[12px] font-semibold text-[var(--color-text)]">{value}</div>
    </div>
  );
}

function SyncProofCard({
  player,
  copyState,
  checklistCopyState,
  manualProofText,
  manualChecklistText,
  onCopy,
  onCopyChecklist
}: {
  player: SyncedPlayer;
  copyState: "idle" | "copied" | "error";
  checklistCopyState: "idle" | "copied" | "error";
  manualProofText: string;
  manualChecklistText: string;
  onCopy: () => void;
  onCopyChecklist: () => void;
}) {
  return (
    <div className="rounded-xl border border-[var(--color-good)]/25 bg-[var(--color-good)]/10 px-4 py-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-[0.18em] font-bold text-[var(--color-good)]">
            <ShieldCheck className="size-3.5" />
            Sync proof
          </div>
          <p className="mt-1 max-w-2xl text-[12px] leading-relaxed text-[var(--color-text-dim)]">
            Copy a safe payload receipt for support or self-checking: RSN, sync time, plugin version and signal counts. It never includes tokens, bank, inventory, chat, screenshots or account login.
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5 text-[10.5px] text-[var(--color-text-muted)]">
            <span className="rounded border border-[var(--color-border)] bg-[var(--color-bg)]/35 px-1.5 py-0.5 font-mono">
              {player.displayName || player.rsn}
            </span>
            <span className="rounded border border-[var(--color-border)] bg-[var(--color-bg)]/35 px-1.5 py-0.5 font-mono">
              v{player.pluginVersion || "unknown"}
            </span>
            <span className="rounded border border-[var(--color-border)] bg-[var(--color-bg)]/35 px-1.5 py-0.5">
              {player.questsCompleted.length} quests
            </span>
            <span className="rounded border border-[var(--color-border)] bg-[var(--color-bg)]/35 px-1.5 py-0.5">
              {player.collectionLogItemIds.length} CL IDs
            </span>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <button
            type="button"
            onClick={onCopyChecklist}
            aria-label={`Copy RuneLite to Scapestack session checklist for ${player.displayName || player.rsn}`}
            className={cn(
              "inline-flex items-center justify-center gap-1.5 rounded-lg border bg-[var(--color-bg)]/35 px-3 py-2 text-[12px] font-bold transition-colors",
              checklistCopyState === "error"
                ? "border-[var(--color-danger)]/35 text-[var(--color-danger)] hover:bg-[var(--color-danger)]/10"
                : "border-[var(--color-accent)]/35 text-[var(--color-accent)] hover:bg-[var(--color-accent)]/10"
            )}
          >
            {checklistCopyState === "copied" ? <CheckCheck className="size-3.5" /> : checklistCopyState === "error" ? <AlertTriangle className="size-3.5" /> : <Copy className="size-3.5" />}
            {checklistCopyState === "copied" ? "Checklist copied" : checklistCopyState === "error" ? "Copy failed" : "Copy checklist"}
          </button>
          <button
            type="button"
            onClick={onCopy}
            aria-label={`Copy safe sync proof for ${player.displayName || player.rsn}`}
            className={cn(
              "inline-flex items-center justify-center gap-1.5 rounded-lg border bg-[var(--color-bg)]/35 px-3 py-2 text-[12px] font-bold transition-colors",
              copyState === "error"
                ? "border-[var(--color-danger)]/35 text-[var(--color-danger)] hover:bg-[var(--color-danger)]/10"
                : "border-[var(--color-good)]/35 text-[var(--color-good)] hover:bg-[var(--color-good)]/10"
            )}
          >
            {copyState === "copied" ? <CheckCheck className="size-3.5" /> : copyState === "error" ? <AlertTriangle className="size-3.5" /> : <Copy className="size-3.5" />}
            {copyState === "copied" ? "Proof copied" : copyState === "error" ? "Copy failed" : "Copy proof"}
          </button>
        </div>
      </div>
      {checklistCopyState === "error" && (
        <div className="mt-3 rounded-lg border border-[var(--color-danger)]/25 bg-[var(--color-danger)]/8 p-2" aria-live="polite">
          <label className="mb-1 block text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--color-danger)]">
            Clipboard failed — copy session checklist manually
          </label>
          <textarea
            readOnly
            value={manualChecklistText}
            onFocus={(event) => event.currentTarget.select()}
            className="min-h-[130px] w-full resize-y rounded border border-[var(--color-border)] bg-[var(--color-bg)] p-2 font-mono text-[10.5px] leading-relaxed text-[var(--color-text)]"
            aria-label={`Manual session checklist fallback for ${player.displayName || player.rsn}`}
          />
        </div>
      )}
      {copyState === "error" && (
        <div className="mt-3 rounded-lg border border-[var(--color-danger)]/25 bg-[var(--color-danger)]/8 p-2" aria-live="polite">
          <label className="mb-1 block text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--color-danger)]">
            Clipboard failed — copy sync proof manually
          </label>
          <textarea
            readOnly
            value={manualProofText}
            onFocus={(event) => event.currentTarget.select()}
            className="min-h-[110px] w-full resize-y rounded border border-[var(--color-border)] bg-[var(--color-bg)] p-2 font-mono text-[10.5px] leading-relaxed text-[var(--color-text)]"
            aria-label={`Manual sync proof fallback for ${player.displayName || player.rsn}`}
          />
        </div>
      )}
    </div>
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
  const Icon = summary.tone === "good"
    ? CheckCircle2
    : summary.tone === "danger"
      ? DatabaseZap
      : AlertTriangle;

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

function signalToneClass(status: PluginSignalCoverage["status"]): string {
  if (status === "exact") return "border-[var(--color-good)]/25 bg-[var(--color-good)]/10 text-[var(--color-good)]";
  if (status === "partial" || status === "refresh") return "border-[var(--color-warning)]/25 bg-[var(--color-warning)]/10 text-[var(--color-warning)]";
  return "border-[var(--color-danger)]/25 bg-[var(--color-danger)]/10 text-[var(--color-danger)]";
}

function signalStatusLabel(status: PluginSignalCoverage["status"]): string {
  if (status === "exact") return "Verified";
  if (status === "partial") return "Partial";
  if (status === "refresh") return "Refresh";
  if (status === "update") return "Update";
  return "Missing";
}

function SignalCoveragePanel({ signals }: { signals: PluginSignalCoverage[] }) {
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)]/35 px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-[11px] uppercase tracking-[0.18em] font-bold text-[var(--color-accent)]">
            /next payload coverage
          </div>
          <p className="mt-1 text-[12px] leading-relaxed text-[var(--color-text-dim)]">
            These are the plugin signals Scapestack can trust before falling back to public trackers or inference.
          </p>
        </div>
      </div>
      <div className="mt-3 grid sm:grid-cols-2 lg:grid-cols-4 gap-2">
        {signals.map((signal) => (
          <div key={signal.label} className="rounded-lg border border-[var(--color-border)] bg-[var(--color-panel)]/50 px-3 py-2.5">
            <div className="flex items-center justify-between gap-2">
              <div className="text-[12px] font-bold text-[var(--color-text)]">{signal.label}</div>
              <span className={cn("rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em]", signalToneClass(signal.status))}>
                {signalStatusLabel(signal.status)}
              </span>
            </div>
            <div className="mt-2 text-[14px] font-bold text-[var(--color-text)]">{signal.summary}</div>
            <p className="mt-1 text-[11.5px] leading-relaxed text-[var(--color-text-muted)]">{signal.detail}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function ActionQueuePanel({ actions }: { actions: PluginSyncActionQueueItem[] }) {
  if (actions.length === 0) return null;

  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)]/35 px-4 py-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="text-[11px] uppercase tracking-[0.18em] font-bold text-[var(--color-accent)]">
            Session action queue
          </div>
          <p className="mt-1 text-[12px] leading-relaxed text-[var(--color-text-dim)]">
            The next concrete moves from this payload, ordered like an OSRS session checklist.
          </p>
        </div>
      </div>
      <div className="mt-3 grid gap-2">
        {actions.map((action, index) => (
          <div key={`${action.title}-${index}`} className={cn("rounded-lg border px-3 py-2.5", tonePanelClass(action.tone))}>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="flex size-5 shrink-0 items-center justify-center rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] text-[10px] font-bold text-[var(--color-text-muted)]">
                    {index + 1}
                  </span>
                  <h3 className="text-[13px] font-bold text-[var(--color-text)]">{action.title}</h3>
                </div>
                <p className="mt-1 text-[12px] leading-relaxed text-[var(--color-text-dim)]">{action.body}</p>
                <p className="mt-1 text-[11px] leading-relaxed text-[var(--color-text-muted)]">{action.proof}</p>
              </div>
              {(action.href || action.copy) && (
                <div className="shrink-0">
                  {action.copy ? (
                    <CopyCommand value={action.copy} label={action.actionLabel ?? "Copy"} />
                  ) : action.href ? (
                    <Link
                      href={action.href}
                      className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-[var(--color-accent)] px-3 py-2 text-[12px] font-bold text-[var(--color-bg)] hover:brightness-110 transition-all"
                    >
                      {action.actionLabel ?? "Open"}
                      <ArrowRight className="size-3.5" />
                    </Link>
                  ) : null}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function NextReadinessPanel({ readiness, pending, onRefresh }: {
  readiness: PluginNextReadiness;
  pending: boolean;
  onRefresh: () => void;
}) {
  return (
    <div className={cn("flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border px-4 py-3", tonePanelClass(readiness.tone))}>
      <div>
        <div className={cn("text-[12.5px] font-bold", toneTextClass(readiness.tone))}>
          {readiness.title}
        </div>
        <p className="mt-1 text-[12px] leading-relaxed text-[var(--color-text-dim)]">
          {readiness.body}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {readiness.href && (
          <Link
            href={readiness.href}
            aria-label={`${readiness.actionLabel} for verified RuneLite sync`}
            className={cn(
              "inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-[12px] font-bold transition-all hover:brightness-110",
              readiness.tone === "good"
                ? "bg-[var(--color-good)] text-[var(--color-bg)]"
                : "bg-[var(--color-accent)] text-[var(--color-bg)]"
            )}
          >
            {readiness.actionLabel}
            <ArrowRight className="size-3.5" />
          </Link>
        )}
        <button
          type="button"
          onClick={onRefresh}
          disabled={pending}
          aria-label="Re-check RuneLite sync payload before opening /next"
          className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)]/35 px-3 py-2 text-[12px] font-semibold text-[var(--color-text-dim)] hover:text-[var(--color-text)] hover:border-[var(--color-border-strong)] transition-colors disabled:opacity-50"
        >
          <RefreshCw className={cn("size-3.5", pending && "animate-spin")} />
          Re-check
        </button>
      </div>
    </div>
  );
}

function DiagnosticPanel({ diagnostic }: { diagnostic: PluginSyncDiagnostic }) {
  return (
    <div className={cn("rounded-xl border px-4 py-3", tonePanelClass(diagnostic.tone))}>
      <div className="text-[11px] uppercase tracking-[0.18em] font-bold text-[var(--color-text-muted)]">
        Diagnosis
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

function Metric({ label, value, detail, icon }: { label: string; value: string | number; detail?: string; icon?: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)]/35 px-4 py-3">
      <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] font-bold text-[var(--color-text-muted)]">
        {icon}
        {label}
      </div>
      <div className="mt-2 text-[20px] font-bold tracking-tight text-[var(--color-text)]">{value}</div>
      {detail && <div className="mt-0.5 text-[11.5px] text-[var(--color-text-muted)]">{detail}</div>}
    </div>
  );
}
