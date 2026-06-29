"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { ArrowRight, ClipboardPaste, PlugZap, X } from "lucide-react";
import { RuneliteOpenButton } from "@/components/runelite-open-button";
import { getActiveAccount, markRuneliteChecked } from "@/lib/account-storage";
import { loadSavedRsn, saveSavedBank, saveSavedRsn } from "@/lib/saved-bank";
import { cn } from "@/lib/utils";

// Homepage hero intake — kleine zus van /next's NextIntake. Eén RSN
// input + first-time setup voor bank/RuneLite. Submit → navigate naar
// /next met RSN en/of bank-paste. /next pakt de hero bank op via
// sessionStorage en saved-bank bewaart hem per RSN.
//
// Bewust geen mood/time-keuze hier — dat zit in /next's WhatToDo en
// die heeft een localStorage-default. We willen op de homepage één
// duidelijk submit-doel.

const HERO_BANK_KEY = "scapestack:hero:bank";
const HERO_FIRST_SETUP_KEY = "scapestack:first-setup:v1";
const HERO_BANK_TEXTAREA_ID = "hero-bank-paste";
const HERO_BANK_HELP_ID = "hero-bank-paste-help";
const HERO_FIRST_SETUP_BANK_ID = "hero-first-setup-bank";
const HERO_FIRST_SETUP_BANK_HELP_ID = "hero-first-setup-bank-help";

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
  const [showFirstSetupBank, setShowFirstSetupBank] = useState(false);
  const [firstSetupRunelite, setFirstSetupRunelite] = useState(false);
  const [bank, setBank] = useState("");
  const hasBankPaste = Boolean(bank.trim());
  const canSubmit = Boolean(rsn.trim() || hasBankPaste);
  const cleanRsn = rsn.trim();
  const isRememberedRun = Boolean(rememberedRsn && cleanRsn === rememberedRsn);

  useEffect(() => {
    const remembered = getActiveAccount()?.rsn ?? loadSavedRsn() ?? "";
    if (remembered) {
      setRsn(remembered);
      setRememberedRsn(remembered);
    }
  }, []);

  const openPlan = (options: { markSetup?: boolean } = {}) => {
    const trimmed = cleanRsn;
    if (trimmed) {
      saveSavedRsn(trimmed);
      if (options.markSetup) markFirstSetupSeen(trimmed);
      if (firstSetupRunelite) markRuneliteChecked(trimmed);
    }
    if (hasBankPaste) {
      if (trimmed) saveSavedBank(bank, trimmed);
      try { sessionStorage.setItem(HERO_BANK_KEY, bank); }
      catch { /* private mode → silently skip; /next valt terug op stat-only */ }
    }
    const params = new URLSearchParams();
    if (trimmed) params.set("rsn", trimmed);
    if (!hasBankPaste) params.set("bank", "none");
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
          aria-label={hasBankPaste ? "Edit bank paste for Scapestack" : "Add bank to Scapestack"}
          className={cn(
            "inline-flex items-center gap-1.5 underline underline-offset-4 decoration-dotted transition-colors",
            hasBankPaste ? "text-[var(--color-accent)] hover:text-[var(--color-accent-soft)]" : "hover:text-[var(--color-accent)]"
          )}
        >
          <ClipboardPaste className="size-3.5" />
          {hasBankPaste ? "Bank added" : "Add bank"}
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
                <p className="eyebrow text-[var(--color-accent)]">First setup</p>
                <h2 id="hero-first-setup-title" className="mt-1 text-[24px] font-semibold leading-tight text-[var(--color-text)]">
                  Make {cleanRsn || "this account"} smarter?
                </h2>
                <p className="mt-1 text-[13px] leading-relaxed text-[var(--color-text-muted)]">
                  RSN is enough for a first plan. Bank and RuneLite make the pick better when gear, supplies or finished progress matter.
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

            <div className="grid gap-3 p-5 sm:grid-cols-2 sm:p-6">
              <button
                type="button"
                onClick={() => setShowFirstSetupBank((value) => !value)}
                aria-expanded={showFirstSetupBank}
                aria-controls={HERO_FIRST_SETUP_BANK_ID}
                className={cn(
                  "rounded-2xl border p-4 text-left transition-colors",
                  hasBankPaste
                    ? "border-[var(--color-accent)]/40 bg-[var(--color-accent)]/10"
                    : "border-[var(--color-border)] bg-[var(--color-panel)] hover:border-[var(--color-accent)]/45"
                )}
              >
                <span className="inline-flex size-9 items-center justify-center rounded-xl border border-[var(--color-accent)]/25 bg-[var(--color-accent)]/10 text-[var(--color-accent)]">
                  <ClipboardPaste className="size-4" />
                </span>
                <span className="mt-3 block text-[16px] font-bold text-[var(--color-text)]">
                  {hasBankPaste ? "Bank added" : "Add bank"}
                </span>
                <span className="mt-1 block text-[12.5px] leading-relaxed text-[var(--color-text-muted)]">
                  Better gear, supplies and GP checks for this RSN.
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
                    Helps skip finished quests, diary steps, clog slots and Slayer mistakes.
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
                    : "Optional. Paste only if gear, supplies or GP should affect the answer."}
                </span>
              </div>
            )}

            <div className="flex flex-col gap-2 border-t border-[var(--color-border)] px-5 pb-5 sm:flex-row sm:px-6 sm:pb-6">
              <button
                type="button"
                onClick={() => openPlan({ markSetup: true })}
                className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-[var(--color-accent)] px-4 text-[14px] font-bold text-[#0B0F0D] transition-colors hover:bg-[var(--color-accent-soft)]"
              >
                Get my best plan
                <ArrowRight className="size-4" />
              </button>
              <button
                type="button"
                onClick={() => {
                  if (cleanRsn) markFirstSetupSeen(cleanRsn);
                  openPlan({ markSetup: false });
                }}
                className="inline-flex h-11 items-center justify-center rounded-lg border border-[var(--color-border)] px-4 text-[13px] font-bold text-[var(--color-text-dim)] transition-colors hover:border-[var(--color-accent)]/45 hover:text-[var(--color-accent)]"
              >
                Skip for now
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

            <div className="grid gap-4 p-5 sm:grid-cols-2 sm:p-6">
              {[
                {
                  src: "/intro/step1.png",
                  title: "1. Open your bank",
                  body: "In RuneLite, open the bank view you want Scapestack to use."
                },
                {
                  src: "/intro/step2.png",
                  title: "2. Copy Bank Memory",
                  body: "Copy the Bank Memory text, then paste it below."
                }
              ].map((step) => (
                <div key={step.title} className="overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-panel)]">
                  <div className="relative aspect-[16/10] bg-black">
                    <Image
                      src={step.src}
                      alt={step.title}
                      width={720}
                      height={450}
                      sizes="(max-width: 640px) 90vw, 360px"
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <div className="p-4">
                    <h3 className="text-[15px] font-semibold text-[var(--color-text)]">{step.title}</h3>
                    <p className="mt-1 text-[12.5px] leading-relaxed text-[var(--color-text-muted)]">{step.body}</p>
                  </div>
                </div>
              ))}
            </div>

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
