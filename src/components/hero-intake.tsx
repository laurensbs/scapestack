"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

// Homepage hero intake — kleine zus van /next's NextIntake. Eén RSN
// input + optionele bank-paste. Submit → navigate naar /next met RSN en/of
// bank-paste via sessionStorage. /next pakt het op via z'n useEffect en runt
// direct (skip de intake-step).
//
// Bewust geen mood/time-keuze hier — dat zit in /next's WhatToDo en
// die heeft een localStorage-default. We willen op de homepage één
// duidelijk submit-doel.

const HERO_BANK_KEY = "scapestack:hero:bank";
const HERO_BANK_PANEL_ID = "hero-bank-paste-panel";
const HERO_BANK_TEXTAREA_ID = "hero-bank-paste";
const HERO_BANK_HELP_ID = "hero-bank-paste-help";

export function HeroIntake() {
  const router = useRouter();
  const [rsn, setRsn] = useState("");
  const [showBank, setShowBank] = useState(false);
  const [bank, setBank] = useState("");
  const hasBankPaste = showBank && Boolean(bank.trim());
  const canSubmit = Boolean(rsn.trim() || hasBankPaste);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = rsn.trim();
    if (!canSubmit) return;
    // Bank-paste mag persistent — voor de hero is sessionStorage genoeg
    // omdat /next 'm meteen consumeert. Geen langdurige opslag.
    if (hasBankPaste) {
      try { sessionStorage.setItem(HERO_BANK_KEY, bank); }
      catch { /* private mode → silently skip; /next valt terug op stat-only */ }
    }
    const params = new URLSearchParams();
    if (trimmed) params.set("rsn", trimmed);
    if (!hasBankPaste) params.set("bank", "none");
    router.push(`/next?${params.toString()}`);
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      {/* Compact account form. Keep the CTA visually important without
          turning the whole intake into one heavy glowing capsule. */}
      <div
        className={cn(
          "grid gap-2 rounded-2xl border border-[var(--color-border)] bg-[var(--color-panel)] p-2",
          "shadow-[0_18px_48px_-36px_rgba(65,49,25,0.38),inset_0_1px_0_rgba(255,255,255,0.72)]",
          "transition-colors duration-200 ease-out focus-within:border-[var(--color-accent)]/45",
          "focus-within:bg-white focus-within:shadow-[0_20px_52px_-38px_rgba(15,118,110,0.34),0_0_0_3px_rgba(15,118,110,0.08)]",
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
              "h-13 w-full min-w-0 rounded-xl border border-transparent bg-[var(--color-bg)]/72 px-3.5 outline-none",
              "text-[16px] font-semibold text-[var(--color-text)] placeholder:text-[var(--color-text-muted)]/72",
              "transition-all duration-200 focus:bg-white focus:shadow-[inset_0_0_0_1px_rgba(15,118,110,0.16)]",
              "sm:h-12 sm:text-[15px]"
            )}
          />
        </div>
        <button
          type="submit"
          aria-label={
            hasBankPaste
              ? rsn.trim()
                ? "Plan my next move with OSRS name and gear"
                : "Plan my next move with this gear"
              : "Plan my next move with OSRS name"
          }
          aria-describedby="hero-plan-disabled-help"
          disabled={!canSubmit}
          className={cn(
            "inline-flex h-13 w-full shrink-0 items-center justify-center gap-2 rounded-xl px-4",
            "bg-[var(--color-accent)] text-white text-[14px] font-bold",
            "shadow-[inset_0_1px_0_rgba(255,255,255,0.22),0_12px_24px_-18px_rgba(15,118,110,0.82)]",
            "transition-all duration-200 hover:bg-[var(--color-accent-soft)] active:translate-y-px",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]/35 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg)]",
            "disabled:cursor-not-allowed disabled:bg-[var(--color-border-strong)] disabled:text-[var(--color-text-muted)] disabled:shadow-none",
            "sm:h-12 sm:w-auto sm:min-w-[174px]"
          )}
        >
          <span>Plan my next move</span>
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
            ? "Ready: stats and gear can shape the plan."
            : "Ready: public stats are enough to start."
          : hasBankPaste
            ? "Ready: gear-only plan. Add a name for stats and KC."
            : "Enter an OSRS name to get one clear next move."}
      </p>

      {/* Secundaire acties — één rustige regel, link-stijl, gescheiden
          door een dot. Geen tweede knop die met Generate concurreert. */}
      <div className="flex items-center justify-center gap-3 text-[12.5px] text-[var(--color-text-dim)]">
        {!showBank && (
          <>
            <button
              type="button"
              onClick={() => setShowBank(true)}
              aria-controls={HERO_BANK_PANEL_ID}
              aria-expanded={showBank}
              aria-label="Show optional gear paste field"
              className="hover:text-[var(--color-accent)] underline underline-offset-4 decoration-dotted transition-colors"
            >
              Add gear
            </button>
            <span aria-hidden="true" className="text-[var(--color-border-strong)]">·</span>
            <Link
              href="/plugin#verify-sync"
              className="hover:text-[var(--color-accent)] underline underline-offset-4 decoration-dotted transition-colors"
            >
              RuneLite later
            </Link>
          </>
        )}
      </div>

      {/* Bank-paste textarea — alleen zichtbaar als toggle aan staat. */}
      {showBank && (
        <div
          id={HERO_BANK_PANEL_ID}
          role="region"
          aria-label="Optional bank paste"
          className="animate-[fade-in_0.3s_ease-out]"
        >
          <label className="block">
            <span
              id={`${HERO_BANK_TEXTAREA_ID}-label`}
              className="text-[10.5px] uppercase tracking-[0.18em] text-[var(--color-text-muted)]"
            >
              Gear paste <span className="normal-case tracking-normal">(optional)</span>
            </span>
            <textarea
              id={HERO_BANK_TEXTAREA_ID}
              name="bank"
              value={bank}
              onChange={(e) => setBank(e.target.value)}
              placeholder="Paste Bank Memory or Bank Tags here…"
              rows={4}
              spellCheck={false}
              aria-labelledby={`${HERO_BANK_TEXTAREA_ID}-label`}
              aria-describedby={HERO_BANK_HELP_ID}
              className="mt-2 w-full rounded-lg bg-[var(--color-panel)] border border-[var(--color-border)] focus:border-[var(--color-accent)] outline-none px-3 py-2 text-[12px] font-mono text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] resize-y"
            />
            <span
              id={HERO_BANK_HELP_ID}
              role="status"
              aria-live="polite"
              className="mt-1 block text-[11px] leading-relaxed text-[var(--color-text-muted)]"
            >
              {bank.trim()
                ? "Gear added. Supplies and GP can shape the plan."
                : "Optional: add gear when supplies or GP matters."}
            </span>
            <button
              type="button"
              onClick={() => { setShowBank(false); setBank(""); }}
              aria-controls={HERO_BANK_PANEL_ID}
              aria-label="Hide gear paste and plan from public stats only"
              className="mt-1.5 text-[11px] text-[var(--color-text-muted)] hover:text-[var(--color-text-dim)] transition-colors"
            >
              Hide gear
            </button>
          </label>
        </div>
      )}
    </form>
  );
}
