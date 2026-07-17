"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, CheckCircle2, ClipboardPaste, PlugZap, RefreshCw, Sword, X } from "lucide-react";
import { pluginSyncStatusAction } from "@/app/actions";
import { AddBankModal } from "@/components/add-bank-modal";
import { RuneliteOpenButton } from "@/components/runelite-open-button";
import { SessionMoodPicker } from "@/components/session-mood-picker";
import { loadAccountSnapshot, type AccountSnapshot } from "@/lib/account-context";
import { ACCOUNT_EVENT, clearRuneliteChecked, hasAccountFirstSetupSeen, markAccountFirstSetupSeen, markAccountPluginBankStatus, markAccountRuneliteProgress, markRuneliteChecked } from "@/lib/account-storage";
import { MOOD_LABEL, type Mood, type TimeBudget } from "@/lib/mood";
import { loadMood, relativeSince } from "@/lib/mood-storage";
import { latestRecommendationMemory, latestStartedRecommendationMemory } from "@/lib/recommendation-feedback";
import { runeliteProgressFromSyncSummary } from "@/lib/runelite-progress-memory";
import { saveSavedBank, saveSavedRsn, SAVED_BANK_EVENT } from "@/lib/saved-bank";
import { cn } from "@/lib/utils";

// Homepage intake: one RSN submit must reach a useful public-stats plan.
// Bank and RuneLite stay optional and can sharpen a later run.

const HERO_BANK_KEY = "scapestack:hero:bank";

export function HeroIntake() {
  const router = useRouter();
  const [rsn, setRsn] = useState("");
  const [rememberedRsn, setRememberedRsn] = useState("");
  const [showBankGuide, setShowBankGuide] = useState(false);
  const [showRuneliteGuide, setShowRuneliteGuide] = useState(false);
  const [editingAccount, setEditingAccount] = useState(false);
  const [rememberedRuneliteCheckedAt, setRememberedRuneliteCheckedAt] = useState<number | null>(null);
  const [rememberedPluginBankItems, setRememberedPluginBankItems] = useState(0);
  const [runeliteRefresh, setRuneliteRefresh] = useState<"idle" | "checking" | "found" | "missing" | "error">("idle");
  const [returningMood, setReturningMood] = useState<{ mood: Mood; minutes: TimeBudget; label: string } | null>(null);
  const [returningChangeLines, setReturningChangeLines] = useState<string[]>([]);
  const [accountSnapshot, setAccountSnapshot] = useState<AccountSnapshot | null>(null);
  const [bank, setBank] = useState("");
  const [savedBankAt, setSavedBankAt] = useState<number | null>(null);
  const hasBankPaste = Boolean(bank.trim());
  const hasBankContext = hasBankPaste || Boolean(accountSnapshot?.hasBankContext) || Boolean(savedBankAt) || rememberedPluginBankItems > 0;
  const canSubmit = Boolean(rsn.trim() || hasBankPaste);
  const cleanRsn = rsn.trim();
  const isRememberedRun = Boolean(rememberedRsn && cleanRsn === rememberedRsn);
  const rememberedRuneliteChecked = accountSnapshot?.hasRunelite ?? Boolean(rememberedRuneliteCheckedAt);
  const shouldRefreshRunelite = accountSnapshot?.runeliteNeedsRefresh ?? false;

  useEffect(() => {
    const refreshRememberedAccount = () => {
      const snapshot = loadAccountSnapshot();
      setAccountSnapshot(snapshot);
      const active = snapshot.account;
      const remembered = snapshot.rsn;
      if (!remembered) {
        setRsn("");
        setRememberedRsn("");
        setRememberedRuneliteCheckedAt(null);
        setRememberedPluginBankItems(0);
        setRuneliteRefresh("idle");
        setReturningMood(null);
        setReturningChangeLines([]);
        setEditingAccount(false);
        return;
      }

      setRsn(remembered);
      setRememberedRsn(remembered);
      setRememberedRuneliteCheckedAt(snapshot.runeliteCheckedAt);
      setRememberedPluginBankItems(snapshot.pluginBankItemCount);
      setEditingAccount(false);
      const savedMood = loadMood(remembered);
      setReturningMood(savedMood?.mood
        ? {
            mood: savedMood.mood,
            minutes: savedMood.minutes,
            label: MOOD_LABEL[savedMood.mood].name
          }
        : null);
      const started = latestStartedRecommendationMemory(undefined, { rsn: remembered });
      const latest = latestRecommendationMemory(undefined, { rsn: remembered });
      const progressLines = [
        snapshot.runeliteProgressTitle,
        ...snapshot.runeliteProgressLines,
        snapshot.runeliteProgressLead
      ].filter((line): line is string => Boolean(line));
      const lines: string[] = [...progressLines];
      if (lines.length === 0 && started?.title) {
        lines.push(`Last trip started: ${started.title}.`);
      } else if (lines.length === 0 && latest?.title) {
        lines.push(`Last pick: ${latest.title}.`);
      }
      if (lines.length < 3 && active?.runeliteCheckedAt) {
        lines.push(`Last scan: ${relativeSince(active.runeliteCheckedAt)}.`);
      }
      if (lines.length < 3 && savedMood?.mood) {
        lines.push(`Last vibe: ${MOOD_LABEL[savedMood.mood].name}.`);
      }
      setReturningChangeLines([...new Set(lines)].slice(0, 4));
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
        setRememberedRuneliteCheckedAt(checkedAt);
        setRememberedPluginBankItems(next.player.bankStatus.enabled ? next.player.bankStatus.itemCount : 0);
        setReturningChangeLines([
          snapshot.runeliteProgressTitle,
          ...snapshot.runeliteProgressLines,
          snapshot.runeliteProgressLead
        ].filter((line): line is string => Boolean(line)).slice(0, 4));
        setRuneliteRefresh("found");
      } else {
        clearRuneliteChecked(target);
        setRememberedRuneliteCheckedAt(null);
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

  if (isRememberedRun && !editingAccount) {
    const encodedRsn = encodeURIComponent(rememberedRsn);
    const planHref = accountSnapshot?.planHref ?? (returningMood
      ? `/next?rsn=${encodedRsn}&intent=${encodeURIComponent(returningMood.mood)}&time=${returningMood.minutes}`
      : `/next?rsn=${encodedRsn}`);
    const runeliteStatusLabel = shouldRefreshRunelite
      ? "Refresh RuneLite"
      : accountSnapshot?.runeliteDetail ?? "RuneLite later";
    const bankStatusLabel = accountSnapshot?.bankDetail ?? "Add bank if gear matters";
    const bankButtonLabel = accountSnapshot?.bankLabel ?? (hasBankContext ? "Bank added" : "Add bank");
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
      <div className="osrs-frame p-4 text-left sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="eyebrow text-[var(--color-accent)]">Welcome back</div>
            <h2 className="mt-1 text-[26px] font-semibold leading-tight text-[var(--color-text)]">
              Open today&apos;s trip for {rememberedRsn}.
            </h2>
            <p className="mt-2 max-w-xl text-[13px] font-semibold leading-relaxed text-[var(--color-text-dim)]">
              Scapestack will use the saved setup it can trust, then send you to one clear stop point.
            </p>
            <div className="mt-3 grid gap-1.5 text-[12.5px] font-semibold leading-relaxed text-[var(--color-text-dim)]">
              <ReturningSetupLine active={rememberedRuneliteChecked} text={runeliteStatusLabel} />
              <ReturningSetupLine active={hasBankContext} text={bankStatusLabel} />
              <ReturningSetupLine active={Boolean(returningMood)} text={`${accountSnapshot?.moodLabel ?? returningMood?.label ?? "Best now"} vibe`} />
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-[12px] font-semibold">
              <span className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1",
                hasBankContext
                  ? "border-[var(--color-accent)]/35 bg-[var(--color-accent)]/12 text-[var(--color-accent)]"
                  : "border-[var(--color-border)] bg-[var(--color-bg)]/35 text-[var(--color-text-muted)]"
              )}>
                {hasBankContext && <CheckCircle2 className="size-3.5" />}
                {bankButtonLabel}
              </span>
              <span className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1",
                rememberedRuneliteChecked
                  ? shouldRefreshRunelite
                    ? "border-[var(--color-warning)]/35 bg-[var(--color-warning)]/10 text-[var(--color-warning)]"
                    : "border-[var(--color-accent)]/35 bg-[var(--color-accent)]/12 text-[var(--color-accent)]"
                  : "border-[var(--color-border)] bg-[var(--color-bg)]/35 text-[var(--color-text-muted)]"
              )}>
                {rememberedRuneliteChecked && <CheckCircle2 className="size-3.5" />}
                {runeliteStatusLabel}
              </span>
              <span className="inline-flex items-center rounded-full border border-[var(--color-border)] bg-[var(--color-bg)]/35 px-2.5 py-1 text-[var(--color-text-muted)]">
                {`Vibe: ${accountSnapshot?.moodLabel ?? returningMood?.label ?? "Best now"}`}
              </span>
            </div>
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
            {returningChangeLines.length > 0 && (
              <div className="mt-4 rounded-xl border border-[var(--color-parchment-edge)]/70 bg-[var(--color-parchment-dark)]/45 p-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="eyebrow text-[var(--color-accent)]">Since last scan</p>
                    <p className="mt-1 text-[14px] font-bold leading-tight text-[var(--color-text)]">
                      {returningChangeLines[0]}
                    </p>
                  </div>
                  <Link
                    href={planHref}
                    className="inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-lg border border-[var(--color-accent)]/40 bg-[var(--color-accent)]/12 px-3 py-1.5 text-[12px] font-bold text-[var(--color-accent)] transition-colors hover:bg-[var(--color-accent)] hover:text-[#0b0906]"
                  >
                    Plan from this
                    <ArrowRight className="size-3.5" />
                  </Link>
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {returningChangeLines.slice(1).map((line) => (
                    <span
                      key={line}
                      className="rounded-full border border-[var(--color-parchment-edge)]/65 bg-black/20 px-2.5 py-1 text-[11.5px] font-semibold leading-relaxed text-[var(--color-text-dim)]"
                    >
                      {line}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => setEditingAccount(true)}
            className="inline-flex shrink-0 items-center justify-center rounded-lg border border-[var(--color-border)] px-3 py-2 text-[12px] font-bold text-[var(--color-text-dim)] transition-colors hover:border-[var(--color-accent)]/45 hover:text-[var(--color-accent)]"
          >
            Change RSN
          </button>
        </div>

        <div className="mt-5">
          <Link
            href={planHref}
            className="btn-primary min-h-[62px] w-full justify-between px-4 py-4 text-[15px]"
          >
            Open today&apos;s trip
            <ArrowRight className="size-4" />
          </Link>
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={() => setShowBankGuide(true)}
            className="relative flex min-h-[68px] flex-col items-center justify-center gap-1.5 rounded-lg border border-[var(--color-parchment-edge)]/70 bg-[var(--color-parchment-dark)]/45 px-2 py-3 text-center text-[12px] font-bold text-[var(--color-text)] transition-colors hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]"
          >
            {hasBankContext && <CheckCircle2 className="absolute right-2 top-2 size-3.5 text-[var(--color-accent)]" />}
            <ClipboardPaste className="size-4" />
            {bankButtonLabel}
          </button>
          <Link
            href={accountSnapshot?.dpsHref ?? `/dps?rsn=${encodedRsn}&from=home`}
            className="flex min-h-[68px] flex-col items-center justify-center gap-1.5 rounded-lg border border-[var(--color-parchment-edge)]/70 bg-[var(--color-parchment-dark)]/45 px-2 py-3 text-center text-[12px] font-bold text-[var(--color-text)] transition-colors hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]"
          >
            <Sword className="size-4" />
            Boss
          </Link>
          {rememberedRuneliteChecked || runeliteRefresh === "missing" || runeliteRefresh === "error" ? (
            <button
              type="button"
              onClick={refreshRunelite}
              disabled={runeliteRefresh === "checking"}
              className="relative flex min-h-[68px] flex-col items-center justify-center gap-1.5 rounded-lg border border-[var(--color-parchment-edge)]/70 bg-[var(--color-parchment-dark)]/45 px-2 py-3 text-center text-[12px] font-bold text-[var(--color-text)] transition-colors hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] disabled:opacity-60"
              aria-label={`Refresh RuneLite sync for ${rememberedRsn}`}
            >
              {rememberedRuneliteChecked && <CheckCircle2 className="absolute right-2 top-2 size-3.5 text-[var(--color-accent)]" />}
              <RefreshCw className={cn("size-4", runeliteRefresh === "checking" && "animate-spin")} />
              Refresh
            </button>
          ) : (
            <Link
              href={accountSnapshot?.pluginHref ?? `/plugin?rsn=${encodedRsn}&from=home#verify-sync`}
              className="flex min-h-[68px] flex-col items-center justify-center gap-1.5 rounded-lg border border-[var(--color-parchment-edge)]/70 bg-[var(--color-parchment-dark)]/45 px-2 py-3 text-center text-[12px] font-bold text-[var(--color-text)] transition-colors hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]"
            >
              <PlugZap className="size-4" />
              Add RuneLite
            </Link>
          )}
        </div>

        <div className="mt-3">
          <SessionMoodPicker
            rsn={rememberedRsn}
            label={returningMood?.label ?? "Best now"}
            wide
            onMoodChange={setReturningMood}
          />
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

function ReturningSetupLine({ active, text }: { active: boolean; text: string }) {
  return (
    <div className="flex items-start gap-2">
      <CheckCircle2 className={cn(
        "mt-0.5 size-3.5 shrink-0",
        active ? "text-[var(--color-accent)]" : "text-[var(--color-text-muted)]"
      )} />
      <span>{text}</span>
    </div>
  );
}
