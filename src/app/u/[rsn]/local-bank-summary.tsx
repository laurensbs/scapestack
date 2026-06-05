"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, DatabaseZap, Sparkles } from "lucide-react";
import { ItemSprite } from "@/components/item-sprite";
import { latestSnapshot } from "@/lib/snapshot-history";
import { bankOrganizerHref } from "@/lib/bank-handoff-url";
import { toolHandoffUrl } from "@/lib/bank-tool-routes";
import { persistBankHandoffPayloadFromItems } from "@/lib/next-bank-handoff";
import { bankHandoffItemsFromSnapshot } from "@/lib/profile-bank-handoff";
import type { BankSnapshot } from "@/lib/diff";
import { cn, formatGp, formatQty, qtyColor } from "@/lib/utils";

interface Props {
  rsn: string;
}

export function LocalBankSummary({ rsn }: Props) {
  const [snap, setSnap] = useState<BankSnapshot | null>(null);

  useEffect(() => {
    setSnap(latestSnapshot(rsn));
  }, [rsn]);

  if (!snap || snap.items.length === 0) return null;

  const totalValue = snap.items.reduce((s, it) => s + it.stackValue, 0);
  const topByValue = [...snap.items]
    .sort((a, b) => b.stackValue - a.stackValue)
    .slice(0, 8);
  const daysOld = Math.floor((Date.now() - snap.ts) / (1000 * 60 * 60 * 24));
  const bankHref = bankOrganizerHref(rsn, "profile");
  const nextHref = toolHandoffUrl("/next", "profile", rsn);
  const openNextWithBank = () => {
    persistBankHandoffPayloadFromItems(bankHandoffItemsFromSnapshot(snap), window);
    window.location.href = nextHref;
  };

  return (
    <section className="mb-6 animate-[slide-up_0.35s_ease-out_0.1s_both]">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <h2 className="text-[11px] uppercase tracking-[0.2em] font-bold text-[var(--color-gold-soft)]">
          Last uploaded bank
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] text-[var(--color-text-dim)]">
            {daysOld === 0 ? "today" : daysOld === 1 ? "1 day ago" : `${daysOld} days ago`}
          </span>
          <Link
            href={bankHref}
            className="inline-flex items-center gap-1 rounded-md border border-[var(--color-border)] bg-[var(--color-panel)]/65 px-2 py-1 text-[11px] font-semibold text-[var(--color-text-dim)] hover:border-[var(--color-gold)]/55 hover:text-[var(--color-gold)]"
          >
            <DatabaseZap className="size-3" />
            Refresh bank
          </Link>
          <button
            type="button"
            onClick={openNextWithBank}
            className="inline-flex items-center gap-1 rounded-md border border-[var(--color-gold)]/40 bg-[var(--color-gold)]/10 px-2 py-1 text-[11px] font-semibold text-[var(--color-gold)] hover:bg-[var(--color-gold)]/15"
          >
            <Sparkles className="size-3" />
            Plan with this bank
            <ArrowRight className="size-3" />
          </button>
        </div>
      </div>

      <div className={cn(
        "rounded-2xl p-5",
        "bg-gradient-to-br from-[var(--color-panel)] to-[var(--color-bg-2)]",
        "border border-[var(--color-border)]"
      )}>
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <div>
            <div className="text-[10px] text-[var(--color-text-dim)] uppercase tracking-widest mb-1">
              Total wealth
            </div>
            <div className="text-2xl font-black text-[var(--color-gold)] leading-none">
              {formatGp(totalValue)} gp
            </div>
          </div>
          <div className="text-right">
            <div className="text-[10px] text-[var(--color-text-dim)] uppercase tracking-widest mb-1">
              Distinct items
            </div>
            <div className="text-2xl font-black text-[var(--color-text)] leading-none">
              {snap.items.length}
            </div>
          </div>
        </div>

        <div className="text-[10px] uppercase tracking-widest font-bold text-[var(--color-gold-soft)] mb-2">
          Top items by value
        </div>
        <div className="grid grid-cols-4 sm:grid-cols-8 gap-1.5">
          {topByValue.map((it) => (
            <div
              key={it.id}
              className="group relative aspect-square flex items-center justify-center bg-[var(--color-osrs-slot)] border border-[var(--color-osrs-slot-edge)]"
              title={`${it.name} — ${formatGp(it.stackValue)} gp`}
            >
              <ItemSprite
                id={it.id}
                alt={it.name}
                loading="lazy"
                className="pixelated pointer-events-none"
                style={{
                  maxWidth: "32px",
                  maxHeight: "32px",
                  width: "auto",
                  height: "auto"
                }}
              />
              {it.quantity > 0 && (
                <span
                  className="absolute top-0.5 left-1 text-[10px] font-bold drop-shadow-[1px_1px_0_rgb(0_0_0)] pointer-events-none"
                  style={{ color: qtyColor(it.quantity) }}
                >
                  {formatQty(it.quantity)}
                </span>
              )}
              {it.stackValue >= 1_000_000 && (
                <span className="absolute bottom-0.5 right-1 text-[9px] font-semibold text-[var(--color-gold-soft)] drop-shadow-[1px_1px_0_rgb(0_0_0)] pointer-events-none">
                  {formatGp(it.stackValue)}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
