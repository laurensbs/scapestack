"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { AlertTriangle, ArrowRight, CheckCircle2, ChevronDown, RefreshCw, Search } from "lucide-react";
import { pluginSyncStatusAction } from "@/app/actions";
import { CopyCommand } from "@/components/copy-command";
import { RuneliteOpenButton } from "@/components/runelite-open-button";
import {
  ACCOUNT_EVENT,
  clearRuneliteChecked,
  getActiveAccount,
  markAccountPluginBankStatus,
  markRuneliteChecked
} from "@/lib/account-storage";
import { track } from "@/lib/analytics";
import { PLUGIN_VERIFY_SYNC_HASH } from "@/lib/plugin-bank-bridge";
import { pluginConnectionView } from "@/lib/plugin-connection-view";
import { DB_INIT_COMMAND } from "@/lib/plugin-sync-actions";
import type { SyncedPlayer } from "@/lib/sync-repo";
import { cn } from "@/lib/utils";
import { loadSavedRsn, saveSavedRsn } from "@/lib/saved-bank";

type CheckState =
  | { kind: "idle" }
  | { kind: "found"; player: SyncedPlayer }
  | { kind: "missing"; rsn: string }
  | { kind: "unconfigured" }
  | { kind: "error"; message: string };

type CheckSource = "manual" | "url" | "active" | "saved" | "refresh";

export function PluginSyncChecker() {
  const [rsn, setRsn] = useState("");
  const [state, setState] = useState<CheckState>({ kind: "idle" });
  const [editingRsn, setEditingRsn] = useState(false);
  const [pending, startTransition] = useTransition();
  const initialCheckStarted = useRef(false);
  const requestIdRef = useRef(0);
  const rsnRef = useRef("");

  const normalized = rsn.trim();
  const rsnHelpId = "plugin-sync-rsn-help";
  const rsnStatusId = "plugin-sync-rsn-status";
  const connection = useMemo(
    () => state.kind === "found" ? pluginConnectionView(state.player) : null,
    [state]
  );
  const foundDisplayName = state.kind === "found" ? state.player.displayName || state.player.rsn : normalized;
  const foundPluginBankReady = state.kind === "found"
    && state.player.bankStatus.enabled
    && state.player.bankStatus.itemCount > 0;
  const foundNextHref = foundDisplayName
    ? `/next?rsn=${encodeURIComponent(foundDisplayName)}&from=plugin${foundPluginBankReady ? "" : "&bank=none"}`
    : "/next?from=plugin&bank=none";

  useEffect(() => {
    rsnRef.current = normalized;
  }, [normalized]);

  const checkRsnValue = useCallback((value: string, source: CheckSource = "manual") => {
    const clean = value.trim().slice(0, 12);
    if (!clean) return;
    const requestId = ++requestIdRef.current;
    const analyticsSource = source === "active" ? "saved" : source === "refresh" ? "manual" : source;
    rsnRef.current = clean;
    setRsn(clean);
    setEditingRsn(false);
    startTransition(async () => {
      try {
        const next = await pluginSyncStatusAction(clean);
        if (requestId !== requestIdRef.current) return;
        setState(next);
        saveSavedRsn(clean);

        if (next.kind === "found") {
          const syncedAt = new Date(next.player.syncedAt).getTime();
          markRuneliteChecked(clean, Number.isFinite(syncedAt) ? syncedAt : Date.now());
          markAccountPluginBankStatus(clean, next.player.bankStatus);
          const view = pluginConnectionView(next.player);
          track("runelite:sync_success", {
            result: "found",
            fresh: view.health === "live",
            bankReady: next.player.bankStatus.enabled && next.player.bankStatus.itemCount > 0,
            source: analyticsSource
          });
          return;
        }

        if (next.kind === "missing") {
          clearRuneliteChecked(clean);
          markAccountPluginBankStatus(clean, null);
          track("runelite:sync_failure", { reason: "not_found", source: analyticsSource });
          return;
        }

        if (next.kind === "unconfigured") {
          track("runelite:sync_failure", { reason: "unconfigured", source: analyticsSource });
        }
      } catch (error) {
        if (requestId !== requestIdRef.current) return;
        track("runelite:sync_failure", { reason: "request_error", source: analyticsSource });
        setState({
          kind: "error",
          message: error instanceof Error ? error.message : "RuneLite check failed"
        });
      }
    });
  }, []);

  useEffect(() => {
    if (initialCheckStarted.current) return;
    initialCheckStarted.current = true;
    const params = new URLSearchParams(window.location.search);
    const fromUrl = params.get("rsn")?.trim() ?? "";
    const active = getActiveAccount()?.rsn?.trim() ?? "";
    const saved = loadSavedRsn()?.trim() ?? "";
    const initialRsn = fromUrl || active || saved;
    if (!initialRsn) return;
    checkRsnValue(initialRsn, fromUrl ? "url" : active ? "active" : "saved");
  }, [checkRsnValue]);

  useEffect(() => {
    const handleAccountChange = () => {
      const active = getActiveAccount()?.rsn?.trim() ?? "";
      if (!active) {
        requestIdRef.current += 1;
        rsnRef.current = "";
        setRsn("");
        setState({ kind: "idle" });
        setEditingRsn(false);
        return;
      }
      if (active.toLowerCase() === rsnRef.current.toLowerCase()) return;
      setState({ kind: "idle" });
      checkRsnValue(active, "active");
    };
    window.addEventListener(ACCOUNT_EVENT, handleAccountChange);
    return () => window.removeEventListener(ACCOUNT_EVENT, handleAccountChange);
  }, [checkRsnValue]);

  const submitRsn = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    checkRsnValue(normalized, "manual");
  };

  const refresh = () => checkRsnValue(normalized, "refresh");

  return (
    <section
      id={PLUGIN_VERIFY_SYNC_HASH}
      className="osrs-frame mt-6 scroll-mt-16 overflow-hidden"
      aria-label="RuneLite connection"
    >
      <div className="px-5 py-5 sm:px-7 sm:py-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="eyebrow text-[var(--color-accent)]">RuneLite</p>
            <h2 className="mt-1 font-serif text-[28px] font-bold leading-tight text-[var(--color-text)] sm:text-[34px]">
              {normalized ? `For ${normalized}` : "Connect your account"}
            </h2>
          </div>
          {normalized && (
            <button
              type="button"
              onClick={() => setEditingRsn((value) => !value)}
              className="min-h-11 rounded-lg border border-[var(--color-border)] px-3 text-[12px] font-bold text-[var(--color-text-dim)] transition-colors hover:border-[var(--color-accent)]/45 hover:text-[var(--color-text)]"
            >
              Use another RSN
            </button>
          )}
        </div>

        {(!normalized || editingRsn) && (
          <RsnForm
            rsn={rsn}
            pending={pending}
            helpId={rsnHelpId}
            statusId={rsnStatusId}
            onChange={(value) => setRsn(value)}
            onSubmit={submitRsn}
          />
        )}

        <p id={rsnStatusId} role="status" aria-live="polite" className="sr-only">
          {pending
            ? `Checking RuneLite for ${normalized || "this RSN"}.`
            : normalized
              ? `RuneLite status shown for ${normalized}.`
              : "Enter an OSRS name to check RuneLite."}
        </p>

        {pending && <CheckingState rsn={normalized} />}

        {!pending && state.kind === "idle" && normalized && (
          <div className="mt-5 border-t border-[var(--color-border)] pt-5">
            <p className="text-[14px] font-bold text-[var(--color-text)]">Ready to check RuneLite</p>
            <button type="button" onClick={refresh} className="btn-primary mt-3 min-h-11 px-4 text-[13px]">
              <Search className="size-4" />
              Check RuneLite
            </button>
          </div>
        )}

        {!pending && state.kind === "missing" && (
          <ConnectionActionState
            icon={<AlertTriangle className="size-5" />}
            title="Press Sync now"
            body={`No RuneLite scan is connected to ${state.rsn} yet. Open RuneLite, install or enable Scapestack Sync, then press Sync now.`}
            tone="warning"
          >
            <RuneliteOpenButton compact />
            <button
              type="button"
              onClick={refresh}
              aria-label={`Re-check RuneLite sync for ${state.rsn} after pressing Sync now`}
              className="btn-ghost min-h-11 justify-center px-4 text-[13px]"
            >
              <RefreshCw className="size-4" />
              Check again
            </button>
          </ConnectionActionState>
        )}

        {!pending && state.kind === "found" && connection && (
          <div className="mt-5 border-t border-[var(--color-border)] pt-5">
            <div className="flex items-start gap-3">
              {connection.health === "live" ? (
                <CheckCircle2 className="mt-1 size-6 shrink-0 text-[var(--color-accent)]" />
              ) : (
                <AlertTriangle className="mt-1 size-6 shrink-0 text-[var(--color-accent)]" />
              )}
              <div className="min-w-0 flex-1">
                <h3 className="font-serif text-[25px] font-bold leading-tight text-[var(--color-text)]">
                  {connection.title}
                </h3>
                <p className="mt-2 text-[14px] font-semibold leading-relaxed text-[var(--color-text-dim)]">
                  {connection.instruction}
                </p>
                <p className="mt-4 text-[13px] font-bold text-[var(--color-text)]">{connection.scanLabel}</p>
                <p className="mt-1 text-[12.5px] font-semibold leading-relaxed text-[var(--color-text-dim)]">
                  {connection.changedLine}
                </p>
                <p className="mt-1 text-[12.5px] font-semibold leading-relaxed text-[var(--color-text-dim)]">
                  {connection.bankLine}
                </p>
              </div>
            </div>

            <div className="mt-5 flex flex-col gap-2 sm:flex-row">
              {connection.health === "live" ? (
                <Link href={foundNextHref} className="btn-primary min-h-12 flex-1 justify-center px-4 text-[13px]">
                  Open next plan
                  <ArrowRight className="size-4" />
                </Link>
              ) : (
                <RuneliteOpenButton compact className="flex-1" />
              )}
              <button
                type="button"
                onClick={refresh}
                aria-label={`Refresh RuneLite status for ${foundDisplayName}`}
                className="btn-ghost min-h-12 flex-1 justify-center px-4 text-[13px]"
              >
                <RefreshCw className="size-4" />
                {connection.health === "live" ? "Check for a newer scan" : "Check again"}
              </button>
            </div>
          </div>
        )}

        {!pending && state.kind === "error" && (
          <ConnectionError message={state.message} onRetry={refresh} />
        )}

        {!pending && state.kind === "unconfigured" && (
          <ConnectionError
            message="Scapestack cannot check RuneLite right now. Your next plan still works from your OSRS name."
            onRetry={refresh}
            technical
          />
        )}
      </div>
    </section>
  );
}

function RsnForm({
  rsn,
  pending,
  helpId,
  statusId,
  onChange,
  onSubmit
}: {
  rsn: string;
  pending: boolean;
  helpId: string;
  statusId: string;
  onChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const normalized = rsn.trim();
  return (
    <form onSubmit={onSubmit} className="mt-5 border-t border-[var(--color-border)] pt-5">
      <label htmlFor="plugin-sync-rsn" className="text-[13px] font-bold text-[var(--color-text)]">OSRS name</label>
      <div className="mt-2 flex flex-col gap-2 sm:flex-row">
        <input
          id="plugin-sync-rsn"
          name="rsn"
          type="text"
          value={rsn}
          onChange={(event) => onChange(event.target.value)}
          placeholder="Type your OSRS name"
          maxLength={12}
          autoComplete="off"
          autoCapitalize="none"
          autoCorrect="off"
          enterKeyHint="go"
          spellCheck={false}
          aria-label="Type your OSRS name"
          aria-describedby={`${helpId} ${statusId}`}
          className="min-h-12 min-w-0 flex-1 rounded-xl border border-[var(--color-border)] bg-black/30 px-4 text-[16px] text-[var(--color-text)] outline-none placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-accent)]/55 sm:text-[15px]"
        />
        <button
          type="submit"
          disabled={pending || !normalized}
          aria-label={normalized ? `Check RuneLite for ${normalized}` : "Enter an OSRS name before checking RuneLite"}
          className="btn-primary min-h-12 justify-center px-5 text-[13px] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Search className="size-4" />
          Check RuneLite
        </button>
      </div>
      <p id={helpId} className="mt-2 text-[11.5px] text-[var(--color-text-muted)]">Same display name as RuneLite. Max 12 characters.</p>
    </form>
  );
}

function CheckingState({ rsn }: { rsn: string }) {
  return (
    <div className="mt-5 flex min-h-28 items-center gap-3 border-t border-[var(--color-border)] pt-5 text-[var(--color-text-dim)]">
      <RefreshCw className="size-5 animate-spin text-[var(--color-accent)]" />
      <div>
        <p className="text-[14px] font-bold text-[var(--color-text)]">Checking {rsn}</p>
        <p className="mt-1 text-[12.5px]">Looking for the latest RuneLite scan.</p>
      </div>
    </div>
  );
}

function ConnectionActionState({
  icon,
  title,
  body,
  tone,
  children
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  tone: "warning" | "danger";
  children: React.ReactNode;
}) {
  return (
    <div className="mt-5 border-t border-[var(--color-border)] pt-5">
      <div className={cn("flex items-start gap-3", tone === "danger" ? "text-[var(--color-danger)]" : "text-[var(--color-accent)]")}>
        <span className="mt-0.5 shrink-0">{icon}</span>
        <div>
          <h3 className="font-serif text-[24px] font-bold leading-tight text-[var(--color-text)]">{title}</h3>
          <p className="mt-2 max-w-2xl text-[13.5px] font-semibold leading-relaxed text-[var(--color-text-dim)]">{body}</p>
        </div>
      </div>
      <div className="mt-5 flex flex-col gap-2 sm:flex-row">{children}</div>
    </div>
  );
}

function ConnectionError({ message, onRetry, technical = false }: { message: string; onRetry: () => void; technical?: boolean }) {
  return (
    <ConnectionActionState
      icon={<AlertTriangle className="size-5" />}
      title="Could not check RuneLite"
      body={message}
      tone="danger"
    >
      <button type="button" onClick={onRetry} className="btn-primary min-h-11 justify-center px-4 text-[13px]">
        <RefreshCw className="size-4" />
        Try again
      </button>
      {technical && (
        <details className="group w-full rounded-lg border border-[var(--color-border)] bg-black/20 px-3 sm:max-w-sm">
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 text-[12px] font-bold text-[var(--color-text-dim)] marker:hidden">
            Technical troubleshooting
            <ChevronDown className="size-4 transition-transform group-open:rotate-180" />
          </summary>
          <div className="border-t border-[var(--color-border)] py-3">
            <p className="text-[11.5px] leading-relaxed text-[var(--color-text-muted)]">Service setup is incomplete. This is not a RuneLite account problem.</p>
            <CopyCommand value={DB_INIT_COMMAND} label="Copy service setup command" />
          </div>
        </details>
      )}
    </ConnectionActionState>
  );
}
