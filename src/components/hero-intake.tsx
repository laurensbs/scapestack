"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, ClipboardPaste, PlugZap, Sword, UserRound, X } from "lucide-react";
import { BankSetupSteps } from "@/components/bank-setup-steps";
import { RuneliteOpenButton } from "@/components/runelite-open-button";
import { SessionMoodPicker } from "@/components/session-mood-picker";
import { getActiveAccount, markRuneliteChecked } from "@/lib/account-storage";
import { MOOD_LABEL, type Mood, type TimeBudget } from "@/lib/mood";
import { loadMood, saveMood } from "@/lib/mood-storage";
import { loadSavedBank, loadSavedRsn, saveSavedBank, saveSavedRsn, SAVED_BANK_EVENT } from "@/lib/saved-bank";
import { cn } from "@/lib/utils";

// Homepage hero intake — kleine zus van /next's NextIntake. Eén RSN
// input + first-time intent/setup voor bank/RuneLite. Submit → navigate
// naar /next met RSN, gekozen sessie-vibe en/of bank-paste. /next pakt de
// hero bank op via sessionStorage en saved-bank bewaart hem per RSN.
//
// Returning players houden één duidelijk submit-doel; first timers krijgen
// alleen één korte "waar heb je zin in?" keuze zodat het advies meteen
// minder willekeurig voelt.

const HERO_BANK_KEY = "scapestack:hero:bank";
const HERO_FIRST_SETUP_KEY = "scapestack:first-setup:v1";
const HERO_BANK_TEXTAREA_ID = "hero-bank-paste";
const HERO_BANK_HELP_ID = "hero-bank-paste-help";
const HERO_FIRST_SETUP_BANK_ID = "hero-first-setup-bank";
const HERO_FIRST_SETUP_BANK_HELP_ID = "hero-first-setup-bank-help";

type FirstSetupIntent = "surprise" | "chill" | "cash" | "bossing" | "unlock" | "afk" | "short";

const FIRST_SETUP_INTENTS: Array<{
  intent: FirstSetupIntent;
  mood: Mood;
  minutes: TimeBudget;
  label: string;
  helper: string;
}> = [
  { intent: "surprise", mood: "unlock", minutes: 60, label: "Best now", helper: "Cleanest route for this login" },
  { intent: "chill", mood: "chill", minutes: 30, label: "Chill", helper: "Low effort progress" },
  { intent: "cash", mood: "cash", minutes: 60, label: "GP", helper: "Fund upgrades" },
  { intent: "bossing", mood: "bossing", minutes: 60, label: "Bossing", helper: "Trip or KC block" },
  { intent: "unlock", mood: "unlock", minutes: 120, label: "Unlock", helper: "Quest or diary" },
  { intent: "afk", mood: "afk", minutes: 60, label: "AFK", helper: "Progress while chilling" },
  { intent: "short", mood: "short", minutes: 15, label: "Short", helper: "Quick stop point" }
];

function firstSetupIntentPreset(intent: FirstSetupIntent) {
  return FIRST_SETUP_INTENTS.find((preset) => preset.intent === intent) ?? FIRST_SETUP_INTENTS[0];
}

function setupKeyForRsn(rsn: string): string {
  return `${HERO_FIRST_SETUP_KEY}:${rsn.trim().toLowerCase().replace(/\s+/g, "-")}`;
}

function hasSeenFirstSetup(rsn: string): boolean {
  if (typeof window === "undefined") return true;
  try {
    return localStorage.getItem(setupKeyForRsn(rsn)) === "1";
  } catch {
    return true;
  }
}

function markFirstSetupSeen(rsn: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(setupKeyForRsn(rsn), "1");
  } catch {
  }
}

export function HeroIntake() {
  const router = useRouter();
  const [rsn, setRsn] = useState("");
  const [rememberedRsn, setRememberedRsn] = useState("");
  const [showFirstSetup, setShowFirstSetup] = useState(false);
  const [showBankGuide, setShowBankGuide] = useState(false);
  const [showRuneliteGuide, setShowRuneliteGuide] = useState(false);
  const [editingAccount, setEditingAccount] = useState(false);
  const [rememberedRuneliteChecked, setRememberedRuneliteChecked] = useState(false);
  const [returningMood, setReturningMood] = useState<{ mood: Mood; minutes: TimeBudget; label: string } | null>(null);
  const [selectedFirstSetupIntent, setSelectedFirstSetupIntent] = useState<FirstSetupIntent>("surprise");
  const [showFirstSetupBank, setShowFirstSetupBank] = useState(false);
  const [firstSetupRunelite, setFirstSetupRunelite] = useState(false);
  const [bank, setBank] = useState("");
  const [savedBankAt, setSavedBankAt] = useState<number | null>(null);
  const hasBankPaste = Boolean(bank.trim());
  const hasBankContext = hasBankPaste || Boolean(savedBankAt);
  const canSubmit = Boolean(rsn.trim() || hasBankPaste);
  const cleanRsn = rsn.trim();
  const isRememberedRun = Boolean(rememberedRsn && cleanRsn === rememberedRsn);

  useEffect(() => {
    const active = getActiveAccount();
    const remembered = active?.rsn ?? loadSavedRsn() ?? "";
    if (remembered) {
      setRsn(remembered);
      setRememberedRsn(remembered);
      setRememberedRuneliteChecked(Boolean(active?.runeliteCheckedAt));
      const savedMood = loadMood(remembered);
      if (savedMood?.mood) {
        setReturningMood({
          mood: savedMood.mood,
          minutes: savedMood.minutes,
          label: MOOD_LABEL[savedMood.mood].name
        });
      }
    }
  }, []);

  useEffect(() => {
    const refreshSavedBank = () => {
      const saved = cleanRsn ? loadSavedBank(cleanRsn) : loadSavedBank();
      setSavedBankAt(saved?.savedAt ?? null);
    };
    refreshSavedBank();
    window.addEventListener(SAVED_BANK_EVENT, refreshSavedBank);
    window.addEventListener("storage", refreshSavedBank);
    return () => {
      window.removeEventListener(SAVED_BANK_EVENT, refreshSavedBank);
      window.removeEventListener("storage", refreshSavedBank);
    };
  }, [cleanRsn]);

  const openPlan = (options: { markSetup?: boolean; includeSetupIntent?: boolean } = {}) => {
    const trimmed = cleanRsn;
    const intentPreset = firstSetupIntentPreset(selectedFirstSetupIntent);
    if (trimmed) {
      saveSavedRsn(trimmed);
      if (options.markSetup) markFirstSetupSeen(trimmed);
      if (firstSetupRunelite) markRuneliteChecked(trimmed);
    }
    if (options.includeSetupIntent) {
      saveMood({
        mood: intentPreset.mood,
        minutes: intentPreset.minutes
      }, trimmed || undefined);
    }
    if (hasBankPaste) {
      if (trimmed) saveSavedBank(bank, trimmed);
      try { sessionStorage.setItem(HERO_BANK_KEY, bank); }
      catch { /* private mode → silently skip; /next valt terug op stat-only */ }
    }
    const params = new URLSearchParams();
    if (trimmed) params.set("rsn", trimmed);
    if (!hasBankContext) params.set("bank", "none");
    if (options.includeSetupIntent && selectedFirstSetupIntent !== "surprise") {
      params.set("intent", selectedFirstSetupIntent);
      params.set("time", String(intentPreset.minutes));
    }
    router.push(`/next?${params.toString()}`);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = cleanRsn;
    if (!canSubmit) return;
    if (trimmed) saveSavedRsn(trimmed);
    if (trimmed && !hasSeenFirstSetup(trimmed)) {
      setShowFirstSetup(true);
      return;
    }
    openPlan();
  };

  if (isRememberedRun && !editingAccount) {
    const encodedRsn = encodeURIComponent(rememberedRsn);
    const planHref = returningMood
      ? `/next?rsn=${encodedRsn}&intent=${encodeURIComponent(returningMood.mood)}&time=${returningMood.minutes}`
      : `/next?rsn=${encodedRsn}`;
    const readyLine = [
      hasBankContext ? "Bank added" : "Add bank",
      rememberedRuneliteChecked ? "RuneLite checked" : "RuneLite later",
      returningMood ? `Last vibe: ${returningMood.label}` : "Last vibe: Best now"
    ].join(" · ");
    return (
      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-panel)] p-4 text-left shadow-[0_18px_48px_-40px_rgba(0,0,0,0.82)] sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="inline-flex items-center gap-2 rounded-full border border-[var(--color-accent)]/30 bg-[var(--color-accent)]/10 px-3 py-1 text-[11.5px] font-bold text-[var(--color-accent)]">
              <UserRound className="size-3.5" />
              {rememberedRsn}
            </div>
            <h2 className="mt-3 text-[26px] font-semibold leading-tight text-[var(--color-text)]">
              Welcome back, {rememberedRsn}.
            </h2>
            <p className="mt-1 text-[12.5px] font-semibold leading-relaxed text-[var(--color-text-muted)]">
              {readyLine}
            </p>
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
            className="inline-flex min-h-[62px] w-full items-center justify-between gap-3 rounded-xl bg-[var(--color-accent)] px-4 py-4 text-[15px] font-bold text-[#0B0F0D] transition-colors hover:bg-[var(--color-accent-soft)]"
          >
            Plan next trip
            <ArrowRight className="size-4" />
          </Link>
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2">
          <Link
            href={`/bank?rsn=${encodedRsn}&from=home`}
            className="flex min-h-[68px] flex-col items-center justify-center gap-1.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)]/45 px-2 py-3 text-center text-[12px] font-bold text-[var(--color-text)] transition-colors hover:border-[var(--color-accent)]/45 hover:text-[var(--color-accent)]"
          >
            <ClipboardPaste className="size-4" />
            {hasBankContext ? "Bank" : "Add bank"}
          </Link>
          <Link
            href={`/dps?rsn=${encodedRsn}&from=home`}
            className="flex min-h-[68px] flex-col items-center justify-center gap-1.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)]/45 px-2 py-3 text-center text-[12px] font-bold text-[var(--color-text)] transition-colors hover:border-[var(--color-accent)]/45 hover:text-[var(--color-accent)]"
          >
            <Sword className="size-4" />
            Check kill
          </Link>
          <Link
            href={`/plugin?rsn=${encodedRsn}&from=home#verify-sync`}
            className="flex min-h-[68px] flex-col items-center justify-center gap-1.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)]/45 px-2 py-3 text-center text-[12px] font-bold text-[var(--color-text)] transition-colors hover:border-[var(--color-accent)]/45 hover:text-[var(--color-accent)]"
          >
            <PlugZap className="size-4" />
            RuneLite
          </Link>
        </div>

        <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)]/35 px-3 py-2">
          <span className="text-[12.5px] font-semibold text-[var(--color-text-muted)]">
            What are you in the mood for?
          </span>
          <SessionMoodPicker
            rsn={rememberedRsn}
            label={returningMood?.label ?? "Best now"}
            compact
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
            "bg-[var(--color-accent)] text-[#0B0F0D] text-[14px] font-bold",
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
            : savedBankAt
            ? "Bank saved for this account. Scapestack can use it when gear matters."
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

      {showFirstSetup && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="hero-first-setup-title"
          className="fixed inset-0 z-[110] overflow-y-auto bg-black/72 px-4 pb-8 pt-20 backdrop-blur-sm sm:grid sm:place-items-center sm:py-8"
          onClick={() => setShowFirstSetup(false)}
        >
          <div
            className="w-full max-w-2xl overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[#090909] text-left shadow-[0_32px_120px_-42px_rgba(0,0,0,0.92)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 border-b border-[var(--color-border)] px-5 py-4 sm:px-6">
              <div>
                <p className="eyebrow text-[var(--color-accent)]">Before we pick</p>
                <h2 id="hero-first-setup-title" className="mt-1 text-[24px] font-semibold leading-tight text-[var(--color-text)]">
                  What do you feel like doing?
                </h2>
                <p className="mt-1 text-[13px] leading-relaxed text-[var(--color-text-muted)]">
                  Pick a route. Add bank or RuneLite now only if you want the first plan sharper.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowFirstSetup(false)}
                aria-label="Close first setup"
                className="inline-flex size-9 shrink-0 items-center justify-center rounded-full border border-[var(--color-border)] text-[var(--color-text-muted)] transition-colors hover:border-[var(--color-accent)]/55 hover:text-[var(--color-accent)]"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="border-b border-[var(--color-border)] p-5 sm:p-6">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {FIRST_SETUP_INTENTS.map((choice) => {
                  const selected = selectedFirstSetupIntent === choice.intent;
                  return (
                    <button
                      key={choice.intent}
                      type="button"
                      onClick={() => setSelectedFirstSetupIntent(choice.intent)}
                      aria-pressed={selected}
                      className={cn(
                        "min-h-[74px] rounded-xl border px-3 py-3 text-left transition-colors",
                        selected
                          ? "border-[var(--color-accent)]/55 bg-[var(--color-accent)]/12 text-[var(--color-text)]"
                          : "border-[var(--color-border)] bg-[var(--color-panel)] text-[var(--color-text-dim)] hover:border-[var(--color-accent)]/35 hover:text-[var(--color-text)]"
                      )}
                    >
                      <span className="block text-[14px] font-bold text-[var(--color-text)]">{choice.label}</span>
                      <span className="mt-1 block text-[11.5px] leading-snug text-[var(--color-text-muted)]">{choice.helper}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid gap-3 p-5 sm:grid-cols-2 sm:p-6">
              <button
                type="button"
                onClick={() => setShowFirstSetupBank((value) => !value)}
                aria-expanded={showFirstSetupBank}
                aria-controls={HERO_FIRST_SETUP_BANK_ID}
                className={cn(
                  "rounded-2xl border p-4 text-left transition-colors",
                  hasBankContext
                    ? "border-[var(--color-accent)]/40 bg-[var(--color-accent)]/10"
                    : "border-[var(--color-border)] bg-[var(--color-panel)] hover:border-[var(--color-accent)]/45"
                )}
              >
                <span className="inline-flex size-9 items-center justify-center rounded-xl border border-[var(--color-accent)]/25 bg-[var(--color-accent)]/10 text-[var(--color-accent)]">
                  <ClipboardPaste className="size-4" />
                </span>
                <span className="mt-3 block text-[16px] font-bold text-[var(--color-text)]">
                  {hasBankContext ? "Bank added" : "Add bank"}
                </span>
                <span className="mt-1 block text-[12.5px] leading-relaxed text-[var(--color-text-muted)]">
                  Better gear, supplies and GP calls for this RSN.
                </span>
              </button>

              <div
                className={cn(
                  "rounded-2xl border p-4 transition-colors",
                  firstSetupRunelite
                    ? "border-[var(--color-accent)]/40 bg-[var(--color-accent)]/10"
                    : "border-[var(--color-border)] bg-[var(--color-panel)]"
                )}
              >
                <button
                  type="button"
                  onClick={() => setFirstSetupRunelite(true)}
                  className="w-full text-left"
                >
                  <span className="inline-flex size-9 items-center justify-center rounded-xl border border-[var(--color-accent)]/25 bg-[var(--color-accent)]/10 text-[var(--color-accent)]">
                    <PlugZap className="size-4" />
                  </span>
                  <span className="mt-3 block text-[16px] font-bold text-[var(--color-text)]">
                    {firstSetupRunelite ? "RuneLite selected" : "Add RuneLite plugin"}
                  </span>
                  <span className="mt-1 block text-[12.5px] leading-relaxed text-[var(--color-text-muted)]">
                    Helps avoid finished quests, diary steps, clog slots and Slayer mistakes.
                  </span>
                </button>
                {firstSetupRunelite && (
                  <div className="mt-3">
                    <RuneliteOpenButton className="w-full" />
                  </div>
                )}
              </div>
            </div>

            {showFirstSetupBank && (
              <div id={HERO_FIRST_SETUP_BANK_ID} className="border-t border-[var(--color-border)] px-5 py-5 sm:px-6">
                <label className="block">
                  <span className="text-[10.5px] font-bold uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
                    Bank Memory or Bank Tags
                  </span>
                  <textarea
                    value={bank}
                    onChange={(event) => setBank(event.target.value)}
                    placeholder="Paste your bank here..."
                    rows={6}
                    spellCheck={false}
                    aria-describedby={HERO_FIRST_SETUP_BANK_HELP_ID}
                    className="mt-2 w-full resize-y rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-3 font-mono text-[12px] text-[var(--color-text)] outline-none placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-accent)]"
                  />
                </label>
                <span
                  id={HERO_FIRST_SETUP_BANK_HELP_ID}
                  role="status"
                  aria-live="polite"
                  className="mt-2 block text-[12px] leading-relaxed text-[var(--color-text-muted)]"
                >
                {hasBankPaste
                  ? "Saved for this account and used for the first plan."
                    : "Optional. Paste only if gear, supplies or GP should change the route."}
                </span>
              </div>
            )}

            <div className="flex flex-col gap-2 border-t border-[var(--color-border)] px-5 pb-5 sm:flex-row sm:px-6 sm:pb-6">
              <button
                type="button"
                onClick={() => openPlan({ markSetup: true, includeSetupIntent: true })}
                className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-[var(--color-accent)] px-4 text-[14px] font-bold text-[#0B0F0D] transition-colors hover:bg-[var(--color-accent-soft)]"
              >
                Plan this session
                <ArrowRight className="size-4" />
              </button>
              <button
                type="button"
                onClick={() => {
                  if (cleanRsn) markFirstSetupSeen(cleanRsn);
                  openPlan({ markSetup: false, includeSetupIntent: true });
                }}
                className="inline-flex h-11 items-center justify-center rounded-lg border border-[var(--color-border)] px-4 text-[13px] font-bold text-[var(--color-text-dim)] transition-colors hover:border-[var(--color-accent)]/45 hover:text-[var(--color-accent)]"
              >
                Skip setup
              </button>
            </div>
          </div>
        </div>
      )}

      {showBankGuide && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="hero-bank-guide-title"
          className="fixed inset-0 z-[100] overflow-y-auto bg-black/72 px-4 pb-8 pt-20 backdrop-blur-sm sm:grid sm:place-items-center sm:py-8"
          onClick={() => setShowBankGuide(false)}
        >
          <div
            className="w-full max-w-3xl overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[#090909] text-left shadow-[0_32px_120px_-42px_rgba(0,0,0,0.92)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 border-b border-[var(--color-border)] px-5 py-4 sm:px-6">
              <div>
                <p className="eyebrow text-[var(--color-accent)]">Add bank</p>
                <h2 id="hero-bank-guide-title" className="mt-1 text-[22px] font-semibold leading-tight text-[var(--color-text)]">
                  Paste your bank once.
                </h2>
                <p className="mt-1 text-[13px] leading-relaxed text-[var(--color-text-muted)]">
                  Use Bank Memory or Bank Tags from RuneLite. Scapestack uses it for gear, supplies and GP.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowBankGuide(false)}
                aria-label="Close bank guide"
                className="inline-flex size-9 shrink-0 items-center justify-center rounded-full border border-[var(--color-border)] text-[var(--color-text-muted)] transition-colors hover:border-[var(--color-accent)]/55 hover:text-[var(--color-accent)]"
              >
                <X className="size-4" />
              </button>
            </div>

            <BankSetupSteps className="p-5 sm:p-6" />

            <div className="border-t border-[var(--color-border)] px-5 py-5 sm:px-6">
              <label className="block">
                <span
                  id={`${HERO_BANK_TEXTAREA_ID}-label`}
                  className="text-[10.5px] font-bold uppercase tracking-[0.18em] text-[var(--color-text-muted)]"
                >
                  Bank Memory or Bank Tags
                </span>
                <textarea
                  id={HERO_BANK_TEXTAREA_ID}
                  name="bank"
                  value={bank}
                  onChange={(e) => setBank(e.target.value)}
                  placeholder="Paste your bank here..."
                  rows={7}
                  spellCheck={false}
                  aria-labelledby={`${HERO_BANK_TEXTAREA_ID}-label`}
                  aria-describedby={HERO_BANK_HELP_ID}
                  className="mt-2 w-full resize-y rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-3 font-mono text-[12px] text-[var(--color-text)] outline-none placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-accent)]"
                />
              </label>
              <span
                id={HERO_BANK_HELP_ID}
                role="status"
                aria-live="polite"
                className="mt-2 block text-[12px] leading-relaxed text-[var(--color-text-muted)]"
              >
                {bank.trim()
                  ? "Bank added. Gear, supplies and GP can shape the trip."
                  : "Optional. Add this only when gear, supplies or GP should change the answer."}
              </span>
            </div>

            <div className="flex flex-col gap-2 border-t border-[var(--color-border)] px-5 pb-5 sm:flex-row sm:px-6 sm:pb-6">
              <button
                type="button"
                onClick={() => setShowBankGuide(false)}
                className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-[var(--color-accent)] px-4 text-[14px] font-bold text-[#0B0F0D] transition-colors hover:bg-[var(--color-accent-soft)]"
              >
                <ClipboardPaste className="size-4" />
                Use this bank
              </button>
              <button
                type="button"
                onClick={() => { setBank(""); setShowBankGuide(false); }}
                className="inline-flex h-11 items-center justify-center rounded-lg border border-[var(--color-border)] px-4 text-[13px] font-bold text-[var(--color-text-dim)] transition-colors hover:border-[var(--color-danger)]/45 hover:text-[var(--color-danger)]"
              >
                Skip bank
              </button>
            </div>
          </div>
        </div>
      )}

      {showRuneliteGuide && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="hero-runelite-guide-title"
          className="fixed inset-0 z-[100] overflow-y-auto bg-black/72 px-4 pb-8 pt-20 backdrop-blur-sm sm:grid sm:place-items-center sm:py-8"
          onClick={() => setShowRuneliteGuide(false)}
        >
          <div
            className="w-full max-w-xl overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[#090909] text-left shadow-[0_32px_120px_-42px_rgba(0,0,0,0.92)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 border-b border-[var(--color-border)] px-5 py-4 sm:px-6">
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

            <div className="space-y-3 p-5 sm:p-6">
              {[
                "Open RuneLite.",
                "Search Plugin Hub for Scapestack Sync.",
                "Press Sync now, then check the same RSN."
              ].map((step, index) => (
                <div key={step} className="flex items-center gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-panel)] px-3 py-3">
                  <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg border border-[var(--color-accent)]/35 bg-[var(--color-accent)]/10 text-[13px] font-bold text-[var(--color-accent)]">
                    {index + 1}
                  </span>
                  <span className="text-[13px] font-semibold text-[var(--color-text)]">{step}</span>
                </div>
              ))}
            </div>

            <div className="border-t border-[var(--color-border)] px-5 pb-5 sm:px-6 sm:pb-6">
              <RuneliteOpenButton className="w-full" />
              <button
                type="button"
                onClick={() => setShowRuneliteGuide(false)}
                className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-[var(--color-border)] px-4 py-3 text-[13px] font-bold text-[var(--color-text-dim)] transition-colors hover:border-[var(--color-accent)]/45 hover:text-[var(--color-accent)]"
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
