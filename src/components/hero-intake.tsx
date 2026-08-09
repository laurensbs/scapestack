"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { playerPath } from "@/lib/player-route";
import { saveSavedRsn } from "@/lib/saved-bank";

export function HeroIntake() {
  const router = useRouter();
  const [rsn, setRsn] = useState("");

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const cleanRsn = rsn.trim();
    if (!cleanRsn) return;
    saveSavedRsn(cleanRsn);
    // Straight to the answer, deliberately. Onboarding step 1 (§3.1) lives on
    // that page as the opened goal line, not as a screen in front of it —
    // tests/first-run-flow.test.ts holds the name → answer path open, and it
    // is guarding a setup screen this repo already removed once.
    router.push(playerPath(cleanRsn));
  };

  return (
    <form onSubmit={submit} className="grid gap-2">
      {/* REBRAND.md Section 7 direction C, the Field Ledger. The slot is cut
          INTO the stone — inverted bevel, dark bottom-right on top-left — and
          the button is a raised gold face above it. Stacked rather than
          side-by-side because that is the shape an OSRS side panel has, and
          because the column is 460px at every width, so one grammar serves
          both breakpoints instead of two. */}
      <label
        htmlFor="hero-rsn-input"
        className="font-[family-name:var(--font-body)] text-[length:var(--text-label)] font-semibold uppercase tracking-[0.18em] text-[var(--stone-text-muted)]"
      >
        Your name in Gielinor
      </label>
      <input
        id="hero-rsn-input"
        name="rsn"
        type="text"
        value={rsn}
        onChange={(event) => setRsn(event.target.value)}
        placeholder="e.g. Zezima"
        maxLength={12}
        required
        autoComplete="off"
        autoCapitalize="none"
        autoCorrect="off"
        enterKeyHint="go"
        spellCheck={false}
        className="h-12 w-full min-w-0 border border-[var(--stone-900)] bg-[var(--stone-900)] px-3 font-[family-name:var(--font-body)] text-[length:var(--text-subject)] font-normal text-[var(--stone-text)] outline-none placeholder:text-[var(--stone-text-muted)] focus:border-[var(--gold-500)]"
        style={{
          borderRadius: "var(--radius-sm)",
          boxShadow: "inset 1px 1px 0 var(--bevel-dark), inset -1px -1px 0 rgba(255,236,190,0.10)"
        }}
      />
      {/* Not disabled: on first paint rsn is always "" — SSR and pre-hydration
          both — so the page's only call to action rendered grey-on-grey and
          read as broken. The submit handler already returns early on an empty
          name, so the button can stay alive and just do nothing. */}
      <button
        type="submit"
        className="h-12 w-full font-[family-name:var(--font-body)] text-[length:var(--text-body)] font-semibold text-[var(--ink-900)] transition-[filter] hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gold-300)]"
        style={{
          background: "var(--gold-500)",
          borderRadius: "var(--radius-sm)",
          boxShadow: "inset 1px 1px 0 var(--bevel-light), inset -1px -1px 0 var(--bevel-dark)"
        }}
      >
        Show my next step
      </button>
      <p className="font-[family-name:var(--font-body)] text-[length:var(--text-micro)] font-normal italic text-[var(--stone-text-muted)]">
        Free. Your bank stays in this browser.
      </p>
    </form>
  );
}
