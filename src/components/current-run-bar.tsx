"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Package, PlugZap, Sword, UserRound } from "lucide-react";
import { ACCOUNT_EVENT, getActiveAccount, type ScapestackAccount } from "@/lib/account-storage";
import { loadMood } from "@/lib/mood-storage";
import { loadSavedBank, loadSavedRsn, SAVED_BANK_EVENT } from "@/lib/saved-bank";
import { cn } from "@/lib/utils";

interface CurrentRunBarProps {
  className?: string;
  compact?: boolean;
}

export function CurrentRunBar({ className, compact = false }: CurrentRunBarProps) {
  const [account, setAccount] = useState<ScapestackAccount | null>(null);
  const [fallbackRsn, setFallbackRsn] = useState("");
  const [hasSetup, setHasSetup] = useState(false);
  const [vibe, setVibe] = useState("Best now");

  useEffect(() => {
    const refresh = () => {
      const active = getActiveAccount();
      const savedRsn = active?.rsn ?? loadSavedRsn() ?? "";
      const savedMood = loadMood();
      setAccount(active);
      setFallbackRsn(savedRsn);
      setHasSetup(Boolean(active?.bankSavedAt || loadSavedBank(savedRsn)));
      setVibe(savedMood?.mood ? labelForMood(savedMood.mood) : "Best now");
    };
    refresh();
    window.addEventListener(ACCOUNT_EVENT, refresh);
    window.addEventListener(SAVED_BANK_EVENT, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(ACCOUNT_EVENT, refresh);
      window.removeEventListener(SAVED_BANK_EVENT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  const rsn = account?.rsn ?? fallbackRsn;
  const bankHref = rsn ? `/bank?rsn=${encodeURIComponent(rsn)}&from=next` : "/bank";
  const pluginHref = rsn ? `/plugin?rsn=${encodeURIComponent(rsn)}#verify-sync` : "/plugin#verify-sync";
  const nextHref = rsn ? `/next?rsn=${encodeURIComponent(rsn)}` : "/next";

  return (
    <nav
      aria-label="Current Scapestack run"
      className={cn(
        "flex min-w-0 items-center gap-1.5 rounded-full border border-[var(--color-border)] px-2 py-1 text-[11.5px] font-semibold text-[var(--color-text-muted)]",
        compact ? "w-full justify-between rounded-xl bg-[#101010] px-3 py-2" : "max-w-full bg-[var(--color-bg)]/35",
        className
      )}
    >
      <Link
        href={nextHref}
        className="inline-flex min-w-0 items-center gap-1.5 rounded-full px-1.5 py-1 text-[var(--color-text)] transition-colors hover:text-[var(--color-accent)]"
      >
        <UserRound className="size-3.5 shrink-0 text-[var(--color-accent)]" />
        <span className="truncate">{rsn || "Add RSN"}</span>
      </Link>
      <span className="text-[var(--color-border-strong)]" aria-hidden="true">·</span>
      <Link href={bankHref} className="whitespace-nowrap rounded-full px-1.5 py-1 transition-colors hover:text-[var(--color-accent)]">
        <span className="inline-flex items-center gap-1">
          <Package className="size-3.5" />
          {hasSetup ? "Bank added" : "Add bank"}
        </span>
      </Link>
      {!compact && (
        <>
          <span className="text-[var(--color-border-strong)]" aria-hidden="true">·</span>
          <Link href={pluginHref} className="inline-flex items-center gap-1 whitespace-nowrap rounded-full px-1.5 py-1 transition-colors hover:text-[var(--color-accent)]">
            <PlugZap className="size-3.5" />
            {account?.runeliteCheckedAt ? "RuneLite checked" : "RuneLite later"}
          </Link>
          <span className="text-[var(--color-border-strong)]" aria-hidden="true">·</span>
          <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full px-1.5 py-1">
            <Sword className="size-3.5" />
            {vibe}
          </span>
        </>
      )}
    </nav>
  );
}

function labelForMood(mood: string): string {
  switch (mood) {
    case "chill": return "Chill";
    case "cash": return "GP";
    case "bossing": return "Bossing";
    case "unlock":
    case "quest": return "Unlock";
    case "afk": return "AFK";
    case "short": return "Short";
    default: return "Best now";
  }
}
