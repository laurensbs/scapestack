"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, CheckCircle2, ClipboardPaste, PlugZap, RefreshCw, X } from "lucide-react";
import { pluginSyncStatusAction } from "@/app/actions";
import { AddBankModal } from "@/components/add-bank-modal";
import { RuneliteOpenButton } from "@/components/runelite-open-button";
import type { AccountTimelineMoment } from "@/lib/account-timeline";
import { hydrateConnectedAccount } from "@/lib/account-connection";
import { loadAccountSnapshot, type AccountSnapshot } from "@/lib/account-context";
import { ACCOUNT_EVENT, clearRuneliteChecked, hasAccountFirstSetupSeen, markAccountFirstSetupSeen, markAccountPluginBankStatus, markAccountRuneliteProgress, markRuneliteChecked } from "@/lib/account-storage";
import { latestRecommendationMemory, latestStartedRecommendationMemory } from "@/lib/recommendation-feedback";
import { buildReturnHomeSummary, type ReturnHomeFallback } from "@/lib/return-home";
import { runeliteProgressFromSyncSummary } from "@/lib/runelite-progress-memory";
import { saveSavedBank, saveSavedRsn, SAVED_BANK_EVENT } from "@/lib/saved-bank";
import { cn } from "@/lib/utils";

// Homepage intake: one RSN submit must reach a useful public-stats plan.
// Bank and RuneLite stay optional and can sharpen a later run.

const HERO_BANK_KEY = "scapestack:hero:bank";
const RETURN_HOME_SEEN_KEY = "scapestack:return-home-seen:v1";

function normalizeRsn(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ").slice(0, 12);
}

function returnSeenKey(rsn: string): string {
  return `${RETURN_HOME_SEEN_KEY}:${normalizeRsn(rsn)}`;
}

async function loadConnectedMoments(expectedRsn: string): Promise<AccountTimelineMoment[]> {
  const response = await fetch("/api/account/timeline?limit=10", { cache: "no-store" });
  if (!response.ok) return [];
  const body = await response.json() as {
    account?: { rsn?: string };
    moments?: AccountTimelineMoment[];
  };
  if (normalizeRsn(body.account?.rsn ?? "") !== normalizeRsn(expectedRsn)) return [];
  return body.moments ?? [];
}

export function HeroIntake() {
  const router = useRouter();
  const [rsn, setRsn] = useState("");
  const [rememberedRsn, setRememberedRsn] = useState("");
  const [showBankGuide, setShowBankGuide] = useState(false);
  const [showRuneliteGuide, setShowRuneliteGuide] = useState(false);
  const [rememberedPluginBankItems, setRememberedPluginBankItems] = useState(0);
  const [runeliteRefresh, setRuneliteRefresh] = useState<"idle" | "checking" | "found" | "missing" | "error">("idle");
  const [returningFallback, setReturningFallback] = useState<ReturnHomeFallback>({});
  const [returningMoments, setReturningMoments] = useState<AccountTimelineMoment[]>([]);
  const [lastSeenReturnMomentId, setLastSeenReturnMomentId] = useState<string | null>(null);
  const [accountSnapshot, setAccountSnapshot] = useState<AccountSnapshot | null>(null);
  const [bank, setBank] = useState("");
  const [savedBankAt, setSavedBankAt] = useState<number | null>(null);
  const hasBankPaste = Boolean(bank.trim());
  const hasBankContext = hasBankPaste || Boolean(accountSnapshot?.hasBankContext) || Boolean(savedBankAt) || rememberedPluginBankItems > 0;
  const canSubmit = Boolean(rsn.trim() || hasBankPaste);
  const cleanRsn = rsn.trim();
  const isRememberedRun = Boolean(rememberedRsn && cleanRsn === rememberedRsn);
  const shouldRefreshRunelite = accountSnapshot?.runeliteNeedsRefresh ?? false;

  useEffect(() => {
    const refreshRememberedAccount = () => {
      const snapshot = loadAccountSnapshot();
      setAccountSnapshot(snapshot);
      const remembered = snapshot.rsn;
      if (!remembered) {
        setRsn("");
        setRememberedRsn("");
        setRememberedPluginBankItems(0);
        setRuneliteRefresh("idle");
        setReturningFallback({});
        setReturningMoments([]);
        setLastSeenReturnMomentId(null);
        return;
      }

      setRsn(remembered);
      setRememberedRsn(remembered);
      setRememberedPluginBankItems(snapshot.pluginBankItemCount);
      const started = latestStartedRecommendationMemory(undefined, { rsn: remembered });
      const latest = latestRecommendationMemory(undefined, { rsn: remembered });
      setReturningFallback({
        progressTitle: snapshot.runeliteProgressTitle,
        progressDetail: snapshot.runeliteProgressLead ?? snapshot.runeliteProgressLines[0] ?? null,
        startedTitle: started?.title ?? null,
        lastPlanTitle: latest?.title ?? snapshot.lastHeadlineTitle
      });
      try {
        setLastSeenReturnMomentId(localStorage.getItem(returnSeenKey(remembered)));
      } catch {
        setLastSeenReturnMomentId(null);
      }
    };
    refreshRememberedAccount();
    window.addEventListener(ACCOUNT_EVENT, refreshRememberedAccount);
    window.addEventListener("storage", refreshRememberedAccount);
    return () => {
      window.removeEventListener(ACCOUNT_EVENT, refreshRememberedAccount);
      window.removeEventListener("storage", refreshRememberedAccount);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const hydrateReturnHome = async () => {
      try {
        const connected = await hydrateConnectedAccount();
        if (!connected || cancelled) return;
        const connectedRsn = connected.displayName || connected.rsn;
        const moments = await loadConnectedMoments(connectedRsn);
        if (cancelled) return;
        setReturningMoments(moments);
        const snapshot = loadAccountSnapshot(connectedRsn);
        setAccountSnapshot(snapshot);
        setRsn(connectedRsn);
        setRememberedRsn(connectedRsn);
        try {
          setLastSeenReturnMomentId(localStorage.getItem(returnSeenKey(connectedRsn)));
        } catch {
          setLastSeenReturnMomentId(null);
        }
      } catch {
        // A local RSN still has a useful return path when no server session exists.
      }
    };
    void hydrateReturnHome();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const refreshSavedBank = () => {
      const snapshot = loadAccountSnapshot(cleanRsn || rememberedRsn);
      setAccountSnapshot(snapshot);
      setSavedBankAt(snapshot.bankSavedAt);
      setRememberedPluginBankItems(snapshot.pluginBankItemCount);
    };
    refreshSavedBank();
    window.addEventListener(SAVED_BANK_EVENT, refreshSavedBank);
    window.addEventListener("storage", refreshSavedBank);
    return () => {
      window.removeEventListener(SAVED_BANK_EVENT, refreshSavedBank);
      window.removeEventListener("storage", refreshSavedBank);
    };
  }, [cleanRsn]);

  const openPlan = (options: { firstRun?: boolean } = {}) => {
    const trimmed = cleanRsn;
    if (trimmed) {
      saveSavedRsn(trimmed);
      if (options.firstRun) markAccountFirstSetupSeen(trimmed);
    }
    if (hasBankPaste) {
      if (trimmed) saveSavedBank(bank, trimmed);
      try { sessionStorage.setItem(HERO_BANK_KEY, bank); }
      catch { /* private mode → silently skip; /next valt terug op stat-only */ }
    }
    const params = new URLSearchParams();
    params.set("from", "home");
    if (trimmed) params.set("rsn", trimmed);
    if (!hasBankContext) params.set("bank", "none");
    if (options.firstRun) params.set("first", "1");
    router.push(`/next?${params.toString()}`);
  };

  const refreshRunelite = async () => {
    const target = rememberedRsn.trim();
    if (!target || runeliteRefresh === "checking") return;
    setRuneliteRefresh("checking");
    try {
      const next = await pluginSyncStatusAction(target);
      if (next.kind === "found") {
        const syncedAt = new Date(next.player.syncedAt).getTime();
        const checkedAt = Number.isFinite(syncedAt) ? syncedAt : Date.now();
        markRuneliteChecked(target, checkedAt);
        markAccountPluginBankStatus(target, next.player.bankStatus);
        markAccountRuneliteProgress(target, runeliteProgressFromSyncSummary(
          next.player.lastSyncSummary,
          { syncedAt: next.player.syncedAt }
        ));
        const snapshot = loadAccountSnapshot(target);
        setAccountSnapshot(snapshot);
        setRememberedPluginBankItems(next.player.bankStatus.enabled ? next.player.bankStatus.itemCount : 0);
        setReturningFallback((current) => ({
          ...current,
          progressTitle: snapshot.runeliteProgressTitle,
          progressDetail: snapshot.runeliteProgressLead ?? snapshot.runeliteProgressLines[0] ?? null
        }));
        const moments = await loadConnectedMoments(target);
        if (moments.length > 0) setReturningMoments(moments);
        setRuneliteRefresh("found");
      } else {
        clearRuneliteChecked(target);
        setRuneliteRefresh("missing");
      }
    } catch {
      setRuneliteRefresh("error");
    }
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = cleanRsn;
    if (!canSubmit) return;
    const firstRun = Boolean(trimmed && !hasAccountFirstSetupSeen(trimmed));
    openPlan({ firstRun });
  };

  const returnSummary = useMemo(() => buildReturnHomeSummary({
    moments: returningMoments,
    lastSeenMomentId: lastSeenReturnMomentId,
    fallback: returningFallback
  }), [lastSeenReturnMomentId, returningFallback, returningMoments]);

  const rememberReturnMoment = useCallback(() => {
    if (!rememberedRsn || !returnSummary.latestMomentId) return;
    try {
      localStorage.setItem(returnSeenKey(rememberedRsn), returnSummary.latestMomentId);
    } catch {
      // Private browsing can keep the current visit without persistence.
    }
  }, [rememberedRsn, returnSummary.latestMomentId]);

  useEffect(() => {
    window.addEventListener("pagehide", rememberReturnMoment);
    return () => window.removeEventListener("pagehide", rememberReturnMoment);
  }, [rememberReturnMoment]);

  if (isRememberedRun) {
    const encodedRsn = encodeURIComponent(rememberedRsn);
    const planHref = accountSnapshot?.planHref ?? `/next?rsn=${encodedRsn}`;
    const runeliteRefreshMessage = runeliteRefresh === "checking"
      ? "Checking RuneLite…"
      : runeliteRefresh === "found"
        ? "RuneLite refreshed."
        : runeliteRefresh === "missing"
          ? "No fresh sync yet. Open RuneLite, press Sync now, then refresh."
          : runeliteRefresh === "error"
            ? "RuneLite check failed. Try again."
            : null;
    return (
      <div className="osrs-frame overflow-hidden text-left" data-return-home="true">
        <div className="osrs-title-bar px-5 py-4 sm:px-6">
          <p className="eyebrow text-[var(--color-accent)]">Welcome back, {rememberedRsn}</p>
        </div>
        <div className="osrs-body px-5 py-5 sm:px-6 sm:py-6" aria-live="polite">
          <p className="eyebrow text-[var(--color-text-muted)]">{returnSummary.eyebrow}</p>
          <h2 className="mt-2 max-w-2xl text-[clamp(26px,4vw,38px)] font-semibold leading-[1.08] text-[var(--color-text)]">
            {returnSummary.headline}
          </h2>
          <p className="mt-3 max-w-2xl text-[14px] font-medium leading-relaxed text-[var(--color-text-dim)]">
            {returnSummary.detail}
          </p>

          {returnSummary.stopPoint && (
            <p className="mt-4 flex items-start gap-2 border-l-2 border-[var(--color-accent)] pl-3 text-[12.5px] font-bold leading-relaxed text-[var(--color-text)]">
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-[var(--color-accent)]" />
              {returnSummary.stopPoint}
            </p>
          )}

          <Link
            href={planHref}
            onClick={rememberReturnMoment}
            className="btn-primary mt-6 min-h-[58px] w-full justify-between px-4 py-4 text-[15px] sm:max-w-sm"
          >
            Open next trip
            <ArrowRight className="size-4" />
          </Link>

          {shouldRefreshRunelite && (
            <button
              type="button"
              onClick={refreshRunelite}
              disabled={runeliteRefresh === "checking"}
              className="mt-4 inline-flex min-h-10 items-center gap-2 text-[12px] font-bold text-[var(--color-warning)] transition-colors hover:text-[var(--color-accent)] disabled:opacity-60"
              aria-label={`Refresh RuneLite sync for ${rememberedRsn}`}
            >
              <RefreshCw className={cn("size-4", runeliteRefresh === "checking" && "animate-spin")} />
              Refresh RuneLite before a long trip
            </button>
          )}
          {runeliteRefreshMessage && (
            <p
              role="status"
              aria-live="polite"
              className={cn(
                "mt-2 text-[12px] font-semibold leading-relaxed",
                runeliteRefresh === "found" ? "text-[var(--color-accent)]" : "text-[var(--color-warning)]"
              )}
            >
              {runeliteRefreshMessage}
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {/* Compact account form. Keep the CTA visually important without
          turning the whole intake into one heavy glowing capsule. */}
      <div
        className={cn(
          "grid gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-panel)] p-2",
          "shadow-[0_18px_48px_-40px_rgba(0,0,0,0.82),inset_0_1px_0_rgba(238,231,218,0.06)]",
          "transition-colors duration-200 ease-out focus-within:border-[var(--color-accent)]/45",
          "focus-within:bg-[var(--color-panel-2)] focus-within:shadow-[0_20px_52px_-42px_rgba(200, 154, 61,0.26),0_0_0_3px_rgba(200, 154, 61,0.07)]",
          "sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:p-1.5"
        )}
      >
        <label htmlFor="hero-rsn-input" className="sr-only">
          OSRS name for /next planning
        </label>
        <div className="relative min-w-0">
          <input
            id="hero-rsn-input"
            name="rsn"
            type="text"
            value={rsn}
            onChange={(e) => setRsn(e.target.value)}
            placeholder="Type your OSRS name"
            maxLength={12}
            autoComplete="off"
            spellCheck={false}
            aria-describedby="hero-plan-disabled-help"
            className={cn(
              "h-13 w-full min-w-0 rounded-lg border border-transparent bg-[var(--color-bg)]/72 px-3.5 outline-none",
              "text-[16px] font-semibold text-[var(--color-text)] placeholder:text-[var(--color-text-muted)]/72",
              "transition-all duration-200 focus:bg-[var(--color-bg)] focus:shadow-[inset_0_0_0_1px_rgba(200, 154, 61,0.16)]",
              "sm:h-12 sm:text-[15px]"
            )}
          />
        </div>
        <button
          type="submit"
          aria-label={
            hasBankPaste
              ? rsn.trim()
              ? "Plan my next trip with OSRS name and bank"
                : "Plan my next trip with this bank"
              : "Plan my next trip with OSRS name"
          }
          aria-describedby="hero-plan-disabled-help"
          disabled={!canSubmit}
          className={cn(
            "inline-flex h-13 w-full shrink-0 items-center justify-center gap-2 rounded-lg px-4",
            "bg-[var(--color-accent)] text-[#0B0906] text-[14px] font-bold",
            "shadow-[inset_0_1px_0_rgba(238,231,218,0.18),0_12px_24px_-18px_rgba(200, 154, 61,0.68)]",
            "transition-all duration-200 hover:bg-[var(--color-accent-soft)] hover:shadow-[inset_0_1px_0_rgba(238,231,218,0.2),0_16px_28px_-20px_rgba(200, 154, 61,0.78)] active:translate-y-px",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]/35 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg)]",
            "disabled:cursor-not-allowed disabled:bg-[var(--color-border-strong)] disabled:text-[var(--color-text-secondary)] disabled:shadow-none",
            "sm:h-12 sm:w-auto sm:min-w-[174px]"
          )}
        >
          <span className="sm:hidden">{isRememberedRun ? "Continue" : "Plan"}</span>
          <span className="hidden sm:inline">
            {isRememberedRun ? `Continue as ${rememberedRsn}` : "Plan my next move"}
          </span>
          <ArrowRight className="size-4" />
        </button>
      </div>
      <p
        id="hero-plan-disabled-help"
        aria-live="polite"
        className="text-center text-[11.5px] leading-relaxed text-[var(--color-text-muted)]"
      >
        {rsn.trim()
          ? hasBankPaste
            ? "Bank added. Scapestack can check gear, supplies and GP."
            : accountSnapshot?.hasBankContext
            ? `${accountSnapshot.bankLabel}. Scapestack can use it when gear matters.`
            : "One name is enough to plan your next trip."
          : hasBankPaste
            ? "Bank added. Add a name for stats and KC."
            : "Enter an OSRS name to get one clear trip."}
      </p>

      {/* Secundaire acties — één rustige regel, link-stijl, gescheiden
          door een dot. Geen tweede knop die met Generate concurreert. */}
      <div className="flex items-center justify-center gap-3 text-[12.5px] text-[var(--color-text-dim)]">
        <button
          type="button"
          onClick={() => setShowBankGuide(true)}
          aria-haspopup="dialog"
          aria-expanded={showBankGuide}
          aria-label={hasBankContext ? "Edit bank paste for Scapestack" : "Add bank to Scapestack"}
          className={cn(
            "inline-flex items-center gap-1.5 underline underline-offset-4 decoration-dotted transition-colors",
            hasBankContext ? "text-[var(--color-accent)] hover:text-[var(--color-accent-soft)]" : "hover:text-[var(--color-accent)]"
          )}
        >
          <ClipboardPaste className="size-3.5" />
          {hasBankContext ? "Bank added" : "Add bank"}
        </button>
        {hasBankPaste && (
          <button
            type="button"
            onClick={() => setBank("")}
            aria-label="Remove pasted bank from this plan"
            className="text-[11.5px] font-semibold text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-danger)]"
          >
            Remove
          </button>
        )}
        <span aria-hidden="true" className="text-[var(--color-border-strong)]">·</span>
        <button
          type="button"
          onClick={() => setShowRuneliteGuide(true)}
          aria-haspopup="dialog"
          aria-label="Show RuneLite plugin setup"
          className="hover:text-[var(--color-accent)] underline underline-offset-4 decoration-dotted transition-colors"
        >
          RuneLite later
        </button>
      </div>

      <AddBankModal
        open={showBankGuide}
        onClose={() => setShowBankGuide(false)}
        rsn={cleanRsn || rememberedRsn}
        initialBank={bank}
        source="home"
        onSaved={(savedBank, savedRsn) => {
          setBank(savedBank);
          setSavedBankAt(Date.now());
          if (savedRsn) setRsn(savedRsn);
        }}
      />

      {showRuneliteGuide && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="hero-runelite-guide-title"
          className="fixed inset-0 z-[100] overflow-y-auto bg-black/72 px-4 pb-8 pt-20 backdrop-blur-sm sm:grid sm:place-items-center sm:py-8"
          onClick={() => setShowRuneliteGuide(false)}
        >
          <div
            className="osrs-frame w-full max-w-xl text-left"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="osrs-title-bar flex items-start justify-between gap-4 px-5 py-4 sm:px-6">
              <div>
                <p className="eyebrow text-[var(--color-accent)]">RuneLite</p>
                <h2 id="hero-runelite-guide-title" className="mt-1 text-[22px] font-semibold leading-tight text-[var(--color-text)]">
                  Let Scapestack skip finished stuff.
                </h2>
                <p className="mt-1 text-[13px] leading-relaxed text-[var(--color-text-muted)]">
                  Install Scapestack Sync when you want quests, diaries, clog and Slayer to shape the next plan.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowRuneliteGuide(false)}
                aria-label="Close RuneLite guide"
                className="inline-flex size-9 shrink-0 items-center justify-center rounded-full border border-[var(--color-border)] text-[var(--color-text-muted)] transition-colors hover:border-[var(--color-accent)]/55 hover:text-[var(--color-accent)]"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="osrs-body space-y-3 p-5 sm:p-6">
              {[
                "Open RuneLite.",
                "Search Plugin Hub for Scapestack Sync.",
                "Press Sync now, then check the same RSN."
              ].map((step, index) => (
                <div key={step} className="flex items-center gap-3 rounded-lg border border-[var(--color-parchment-edge)]/70 bg-[var(--color-parchment-dark)]/45 px-3 py-3">
                  <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg border border-[var(--color-accent)]/35 bg-[var(--color-accent)]/10 text-[13px] font-bold text-[var(--color-accent)]">
                    {index + 1}
                  </span>
                  <span className="text-[13px] font-semibold text-[var(--color-text)]">{step}</span>
                </div>
              ))}
            </div>

            <div className="osrs-body border-t border-[var(--color-parchment-edge)] px-5 pb-5 sm:px-6 sm:pb-6">
              <RuneliteOpenButton className="w-full" />
              <button
                type="button"
                onClick={() => setShowRuneliteGuide(false)}
                className="btn-ghost mt-3 w-full justify-center px-4 py-3 text-[13px] font-bold"
              >
                <PlugZap className="size-4" />
                Do this later
              </button>
            </div>
          </div>
        </div>
      )}
    </form>
  );
}
