"use client";

import Link from "next/link";
import { ArrowRight, Crosshair, DatabaseZap, Search, Skull, Trash2, Trophy } from "lucide-react";
import { useEffect, useState } from "react";
import { ItemSprite } from "@/components/item-sprite";
import {
  clearBankHandoffPayload,
  readBankHandoffPayload,
  summarizeBankHandoff,
  type BankHandoffSummary
} from "@/lib/next-bank-handoff";
import { buildPluginBankBridgeActions, PLUGIN_BANK_SYNC_SIGNALS } from "@/lib/plugin-bank-bridge";
import { cn, formatGp } from "@/lib/utils";

export function PluginBankHandoffBanner() {
  const [summary, setSummary] = useState<BankHandoffSummary | null>(null);
  const [rsn, setRsn] = useState("");
  const actions = buildPluginBankBridgeActions(rsn);

  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      setRsn(params.get("rsn")?.trim() ?? "");
      if (params.get("bank") === "none") {
        setSummary(null);
        return;
      }
      const items = readBankHandoffPayload(window);
      if (items.length > 0) setSummary(summarizeBankHandoff(items));
    } catch {
      setSummary(null);
    }
  }, []);

  if (!summary) return null;

  const onClear = () => {
    try {
      clearBankHandoffPayload(window);
    } catch {
    }
    setSummary(null);
  };

  return (
    <section className="mt-8 rounded-2xl border border-[var(--color-accent)]/30 bg-[var(--color-accent)]/8 p-4 sm:p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 gap-3">
          <span className="mt-0.5 inline-flex size-10 shrink-0 items-center justify-center rounded-xl border border-[var(--color-accent)]/25 bg-[var(--color-bg)]/35 text-[var(--color-accent)]">
            <DatabaseZap className="size-5" />
          </span>
          <div className="min-w-0">
            <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--color-accent)]">
              Bank added
            </div>
            <h2 className="mt-1 text-[17px] font-bold tracking-normal text-[var(--color-text)]">
              Use sync if /next repeats finished progress.
            </h2>
            <p className="mt-1 max-w-2xl text-[13px] leading-relaxed text-[var(--color-text-dim)]">
              {summary.label} is still available in this browser.
            </p>
            <p className="mt-1 max-w-2xl text-[11px] leading-relaxed text-[var(--color-text-muted)]">
              This browser bank never goes back to RuneLite. Plugin bank checks send item IDs, names and quantities only, and can be turned off.
            </p>
            {summary.topItems.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {summary.topItems.map((item) => (
                  <span
                    key={item.id}
                    title={`${item.name}: ${item.stackValue.toLocaleString()} gp`}
                    className="inline-flex items-center gap-1.5 rounded-md border border-[var(--color-border)] bg-[var(--color-bg)]/45 px-2 py-1 text-[11px] text-[var(--color-text-dim)]"
                  >
                    <ItemSprite id={item.id} alt="" size={16} />
                    <span className="max-w-[140px] truncate">{item.name}</span>
                    <span className="font-mono text-[var(--color-text-muted)]">{formatGp(item.stackValue)}</span>
                  </span>
                ))}
              </div>
            )}
            <details className="mt-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)]/30 px-3 py-2">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-[12px] font-bold text-[var(--color-text)] marker:hidden">
                <span>What sync can add</span>
                <span className="rounded-full border border-[var(--color-border)] px-2 py-0.5 text-[10px] font-bold text-[var(--color-text-muted)]">
                  Show
                </span>
              </summary>
              <div
                data-testid="plugin-bank-sync-signals"
                className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4"
              >
                {PLUGIN_BANK_SYNC_SIGNALS.map((signal) => (
                  <div
                    key={signal.id}
                    className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)]/35 px-3 py-2"
                  >
                    <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--color-text-muted)]">
                      {signal.label}
                    </div>
                    <div className="mt-1 text-[12px] font-bold text-[var(--color-text)]">
                      {signal.summary}
                    </div>
                    <p className="mt-1 text-[11px] leading-relaxed text-[var(--color-text-dim)]">
                      {signal.detail}
                    </p>
                  </div>
                ))}
              </div>
            </details>
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap gap-2">
          <button
            type="button"
            onClick={onClear}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)]/45 px-3 py-2 text-[12px] font-bold text-[var(--color-text)] transition-colors hover:border-[var(--color-danger)]/45 hover:text-[var(--color-danger)]"
          >
            Clear bank
            <Trash2 className="size-3.5" />
          </button>
          {actions.map((action) => {
            const Icon = action.id === "next"
              ? ArrowRight
              : action.id === "dps"
                ? Crosshair
                : action.id === "slayer"
                  ? Skull
                  : action.id === "sync"
                    ? Search
                    : Trophy;
            return (
              <Link
                key={action.id}
                href={action.href}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-[12px] font-bold transition-colors",
                  action.primary
                    ? "border border-[var(--color-accent)]/35 bg-[var(--color-accent)]/10 text-[var(--color-accent)] hover:bg-[var(--color-accent)]/15"
                    : "border border-[var(--color-border)] bg-[var(--color-bg)]/45 text-[var(--color-text)] hover:border-[var(--color-accent)]/45 hover:text-[var(--color-accent)]"
                )}
              >
                {action.label}
                <Icon className="size-3.5" />
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
