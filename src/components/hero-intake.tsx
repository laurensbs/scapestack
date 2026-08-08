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
    router.push(playerPath(cleanRsn));
  };

  return (
    <form onSubmit={submit} className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
      <label htmlFor="hero-rsn-input" className="sr-only">
        OSRS name
      </label>
      <input
        id="hero-rsn-input"
        name="rsn"
        type="text"
        value={rsn}
        onChange={(event) => setRsn(event.target.value)}
        placeholder="Your OSRS name"
        maxLength={12}
        required
        autoComplete="off"
        autoCapitalize="none"
        autoCorrect="off"
        enterKeyHint="go"
        spellCheck={false}
        className="h-13 min-w-0 rounded-none border border-[var(--color-border-strong)] bg-[var(--color-bg)] px-3.5 text-[length:var(--text-subject)] font-normal text-[var(--color-text)] outline-none placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-accent)] sm:h-12"
      />
      {/* Not disabled: on first paint rsn is always "" — SSR and pre-hydration
          both — so the page's only call to action rendered grey-on-grey and
          read as broken. The submit handler already returns early on an empty
          name, so the button can stay alive and just do nothing. */}
      <button
        type="submit"
        className="inline-flex h-13 items-center justify-center rounded-none bg-[var(--color-accent)] px-6 text-[length:var(--text-body)] font-semibold text-[#0B0906] transition-colors hover:bg-[var(--color-accent-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]/35 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg)] sm:h-12"
      >
        Open my page
      </button>
    </form>
  );
}
