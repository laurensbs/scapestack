"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

// Homepage hero intake — kleine zus van /next's NextIntake. Eén RSN
// input + optionele bank-paste. Submit → navigate naar /next?rsn=X met
// optioneel bank-paste via sessionStorage. /next pakt het op via z'n
// useEffect en runt direct (skip de intake-step).
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

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = rsn.trim();
    if (!trimmed) return;
    // Bank-paste mag persistent — voor de hero is sessionStorage genoeg
    // omdat /next 'm meteen consumeert. Geen langdurige opslag.
    if (hasBankPaste) {
      try { sessionStorage.setItem(HERO_BANK_KEY, bank); }
      catch { /* private mode → silently skip; /next valt terug op stat-only */ }
    }
    router.push(`/next?rsn=${encodeURIComponent(trimmed)}${hasBankPaste ? "" : "&bank=none"}`);
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      {/* Apple-style pill-input: rounded-full, frosted bg, subtle inner
          shadow voor depth; focus geeft een vol accent-ring. */}
      <div
        className={cn(
          "group relative rounded-full bg-white/[0.03] backdrop-blur-sm",
          "border border-white/10",
          "shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04),inset_0_-1px_0_0_rgba(0,0,0,0.4)]",
          "focus-within:border-[var(--color-accent)]/50 focus-within:bg-white/[0.05]",
          "focus-within:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06),inset_0_-1px_0_0_rgba(0,0,0,0.4),0_0_0_4px_rgba(230,165,47,0.10)]",
          "transition-all duration-300 ease-out"
        )}
      >
        <div className="flex items-center pl-6 pr-1.5 py-1.5">
          <label htmlFor="hero-rsn-input" className="sr-only">
            OSRS name for /next planning
          </label>
          <input
            id="hero-rsn-input"
            name="rsn"
            type="text"
            value={rsn}
            onChange={(e) => setRsn(e.target.value)}
            placeholder="Type your OSRS name"
            maxLength={12}
            autoComplete="off"
            autoFocus
            spellCheck={false}
            aria-describedby="hero-plan-disabled-help"
            className={cn(
              "flex-1 bg-transparent outline-none",
              "text-[17px] sm:text-[18px] font-medium tracking-[-0.01em]",
              "text-[var(--color-text)] placeholder:text-[var(--color-text-muted)]/70",
              "py-2.5"
            )}
          />
          <button
            type="submit"
            aria-label={hasBankPaste ? "Open /next planner with RSN and browser-only bank paste" : "Open /next planner with RSN and Hiscores only"}
            aria-describedby="hero-plan-disabled-help"
            disabled={!rsn.trim()}
            className={cn(
              "group/btn relative overflow-hidden",
              "rounded-full px-5 sm:px-6 py-3 inline-flex items-center justify-center gap-2 shrink-0",
              "bg-gradient-to-b from-[#F0B43F] to-[#D4972A] text-[#0F0E0B] font-semibold text-[14px]",
              "shadow-[inset_0_1px_0_0_rgba(255,255,255,0.35),0_4px_14px_-4px_rgba(230,165,47,0.55)]",
              "hover:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.45),0_6px_22px_-4px_rgba(230,165,47,0.75)]",
              "hover:scale-[1.02] active:scale-[0.98]",
              "transition-all duration-200 ease-out",
              "disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:hover:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.35),0_4px_14px_-4px_rgba(230,165,47,0.55)]"
            )}
          >
            <span className="relative z-10">{hasBankPaste ? "Plan with bank" : "Plan from stats"}</span>
            <ArrowRight className="relative z-10 size-4 group-hover/btn:translate-x-0.5 transition-transform" />
            {/* Sheen-overlay die over de knop zwiept bij hover */}
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 opacity-0 group-hover/btn:opacity-100 transition-opacity duration-500"
              style={{
                background: "linear-gradient(115deg, transparent 30%, rgba(255,255,255,0.35) 50%, transparent 70%)",
                transform: "translateX(-100%)",
                animation: "btn-sheen 0.9s ease-out"
              }}
            />
          </button>
        </div>
      </div>
      <p
        id="hero-plan-disabled-help"
        aria-live="polite"
        className="text-center text-[11.5px] leading-relaxed text-[var(--color-text-muted)]"
      >
        {rsn.trim()
          ? hasBankPaste
            ? "Ready: /next will use this RSN plus your browser-only bank paste."
            : "Ready: /next will use Hiscores and ignore stale bank handoff data."
          : "Type an OSRS name to unlock the planner. Add bank paste only if you want gear-aware advice."}
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
              aria-label="Show optional browser-only bank paste field"
              className="hover:text-[var(--color-accent)] underline underline-offset-4 decoration-dotted transition-colors"
            >
              Add browser-only bank paste
            </button>
            <span aria-hidden="true" className="text-[var(--color-border-strong)]">·</span>
            <Link
              href="/bank?sample=1"
              className="hover:text-[var(--color-accent)] underline underline-offset-4 decoration-dotted transition-colors"
            >
              Try a sample
            </Link>
          </>
        )}
      </div>

      {/* Bank-paste textarea — alleen zichtbaar als toggle aan staat. */}
      {showBank && (
        <div
          id={HERO_BANK_PANEL_ID}
          role="region"
          aria-label="Optional browser-only bank paste"
          className="animate-[fade-in_0.3s_ease-out]"
        >
          <label className="block">
            <span
              id={`${HERO_BANK_TEXTAREA_ID}-label`}
              className="text-[10.5px] uppercase tracking-[0.18em] text-[var(--color-text-muted)]"
            >
              Bank export <span className="normal-case tracking-normal">(optional — browser-only, sharper gear advice)</span>
            </span>
            <textarea
              id={HERO_BANK_TEXTAREA_ID}
              name="bank"
              value={bank}
              onChange={(e) => setBank(e.target.value)}
              placeholder="Paste your RuneLite Bank Memory export here…"
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
                ? "Bank paste detected. It stays in this browser session and is consumed by /next."
                : "Optional: paste Bank Memory for gear-aware advice. RuneLite sync never receives this bank."}
            </span>
            <button
              type="button"
              onClick={() => { setShowBank(false); setBank(""); }}
              aria-controls={HERO_BANK_PANEL_ID}
              aria-label="Hide bank paste and plan from Hiscores only"
              className="mt-1.5 text-[11px] text-[var(--color-text-muted)] hover:text-[var(--color-text-dim)] transition-colors"
            >
              Hide — just use my stats
            </button>
          </label>
        </div>
      )}
    </form>
  );
}
