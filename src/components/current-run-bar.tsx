"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CheckCircle2, Package, PlugZap, RefreshCw, UserRound } from "lucide-react";
import { ACCOUNT_EVENT } from "@/lib/account-storage";
import { loadAccountSnapshot, type AccountSnapshot } from "@/lib/account-context";
import { SAVED_BANK_EVENT } from "@/lib/saved-bank";
import { cn } from "@/lib/utils";
import { AddBankModal } from "./add-bank-modal";
import { SessionMoodPicker } from "./session-mood-picker";

interface CurrentRunBarProps {
  className?: string;
  compact?: boolean;
}

export function CurrentRunBar({ className, compact = false }: CurrentRunBarProps) {
  const [snapshot, setSnapshot] = useState<AccountSnapshot | null>(null);
  const [bankModalOpen, setBankModalOpen] = useState(false);

  useEffect(() => {
    const refresh = () => {
      setSnapshot(loadAccountSnapshot());
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

  const rsn = snapshot?.rsn ?? "";
  const pluginHref = snapshot?.pluginHref ?? (rsn ? `/plugin?rsn=${encodeURIComponent(rsn)}#verify-sync` : "/plugin#verify-sync");
  const nextHref = snapshot?.planHref ?? (rsn ? `/next?rsn=${encodeURIComponent(rsn)}` : "/next");
  const hasSetup = Boolean(snapshot?.hasBankContext);
  const runeliteReady = Boolean(snapshot?.hasRunelite);
  const bankLabel = snapshot?.bankLabel ?? "Add bank";
  const bankTitle = snapshot?.bankDetail ?? bankLabel;
  const runeliteLabel = snapshot?.runeliteLabel ?? "Add RuneLite";
  const vibe = snapshot?.moodLabel ?? "Best now";

  return (
    <>
      <nav
        aria-label="Scapestack account setup"
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
        <button
          type="button"
          onClick={() => setBankModalOpen(true)}
          title={bankTitle}
          className="whitespace-nowrap rounded-full px-1.5 py-1 transition-colors hover:text-[var(--color-accent)]"
        >
          <span className="inline-flex items-center gap-1">
            <Package className="size-3.5" />
            {hasSetup && <CheckCircle2 className="size-3 text-[var(--color-accent)]" />}
            {bankLabel}
          </span>
        </button>
        {!compact && (
          <>
            <span className="text-[var(--color-border-strong)]" aria-hidden="true">·</span>
            <Link href={pluginHref} className="inline-flex items-center gap-1 whitespace-nowrap rounded-full px-1.5 py-1 transition-colors hover:text-[var(--color-accent)]">
              {runeliteReady ? <RefreshCw className="size-3.5" /> : <PlugZap className="size-3.5" />}
              {runeliteReady && <CheckCircle2 className="size-3 text-[var(--color-accent)]" />}
              {runeliteLabel}
            </Link>
            <span className="text-[var(--color-border-strong)]" aria-hidden="true">·</span>
            <SessionMoodPicker rsn={rsn} label={vibe} />
          </>
        )}
      </nav>
      <AddBankModal
        open={bankModalOpen}
        onClose={() => setBankModalOpen(false)}
        rsn={rsn}
        source="run-bar"
      />
    </>
  );
}
