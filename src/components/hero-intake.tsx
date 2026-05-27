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

export function HeroIntake() {
  const router = useRouter();
  const [rsn, setRsn] = useState("");
  const [showBank, setShowBank] = useState(false);
  const [bank, setBank] = useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = rsn.trim();
    if (!trimmed) return;
    // Bank-paste mag persistent — voor de hero is sessionStorage genoeg
    // omdat /next 'm meteen consumeert. Geen langdurige opslag.
    if (showBank && bank.trim()) {
      try { sessionStorage.setItem(HERO_BANK_KEY, bank); }
      catch { /* private mode → silently skip; /next valt terug op stat-only */ }
    }
    router.push(`/next?rsn=${encodeURIComponent(trimmed)}`);
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className={cn(
        "group relative rounded-2xl bg-[var(--color-panel)] border border-[var(--color-border)]",
        "focus-within:border-[var(--color-accent)]/60 focus-within:shadow-[0_0_0_4px_rgba(230,165,47,0.10)]",
        "transition-all"
      )}>
        <div className="flex flex-col sm:flex-row sm:items-center">
          <input
            type="text"
            value={rsn}
            onChange={(e) => setRsn(e.target.value)}
            placeholder="Type your OSRS name"
            maxLength={12}
            autoFocus
            className="flex-1 bg-transparent outline-none px-5 py-4 sm:py-5 text-[16px] sm:text-[18px] font-mono text-[var(--color-text)] placeholder:text-[var(--color-text-muted)]"
          />
          <button
            type="submit"
            disabled={!rsn.trim()}
            className={cn(
              "group/btn rounded-xl m-1.5 px-5 py-3 inline-flex items-center justify-center gap-2",
              "bg-[var(--color-accent)] text-[var(--color-bg)] font-semibold text-[14px]",
              "hover:brightness-110 transition-all",
              "disabled:opacity-50 disabled:cursor-not-allowed"
            )}
          >
            Generate
            <ArrowRight className="size-4 group-hover/btn:translate-x-0.5 transition-transform" />
          </button>
        </div>
      </div>

      {/* Secundaire acties — één rustige regel, link-stijl, gescheiden
          door een dot. Geen tweede knop die met Generate concurreert. */}
      <div className="flex items-center justify-center gap-3 text-[12.5px] text-[var(--color-text-dim)]">
        {!showBank && (
          <>
            <button
              type="button"
              onClick={() => setShowBank(true)}
              className="hover:text-[var(--color-accent)] underline underline-offset-4 decoration-dotted transition-colors"
            >
              Add bank for sharper advice
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
        <div className="animate-[fade-in_0.3s_ease-out]">
          <label className="block">
            <span className="text-[10.5px] uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
              Bank export <span className="normal-case tracking-normal">(optional — sharper advice)</span>
            </span>
            <textarea
              value={bank}
              onChange={(e) => setBank(e.target.value)}
              placeholder="Paste your RuneLite Bank Memory export here…"
              rows={4}
              className="mt-2 w-full rounded-lg bg-[var(--color-panel)] border border-[var(--color-border)] focus:border-[var(--color-accent)] outline-none px-3 py-2 text-[12px] font-mono text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] resize-y"
            />
            <button
              type="button"
              onClick={() => { setShowBank(false); setBank(""); }}
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
