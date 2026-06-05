import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Layers } from "lucide-react";
import { decodeSnapshot, snapshotToInput } from "@/lib/share";
import { organize, exportTabs } from "@/lib/organizer";
import { SharedBankView } from "./shared-bank-view";

interface Props {
  params: Promise<{ code: string }>;
}

const privateSharedBankRobots: Metadata["robots"] = {
  index: false,
  follow: false,
  googleBot: {
    index: false,
    follow: false
  }
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { code } = await params;
  const snap = decodeSnapshot(code);
  if (!snap) return { title: "Shared bank", robots: privateSharedBankRobots };
  return {
    title: `${snap.n || "Shared bank"} · Scapestack`,
    description: `A private shared OSRS bank layout with ${snap.i.length} items, organized by Scapestack.`,
    robots: privateSharedBankRobots
  };
}

export default async function SharedBankPage({ params }: Props) {
  const { code } = await params;
  const snap = decodeSnapshot(code);
  if (!snap) notFound();

  const input = snapshotToInput(snap);
  const result = await organize({ input, includePrices: true, junkFilter: snap.jf });
  const strings = exportTabs(result.tabs);

  return (
    <main className="relative z-10 mx-auto max-w-6xl px-5 py-7 pb-20">
      {/* Shared-banner */}
      <div className="mb-5 flex items-center justify-between gap-3 p-3 rounded-xl bg-gradient-to-br from-[oklch(0.22_0.03_55)] to-[oklch(0.16_0.018_50)] border border-[var(--color-gold-soft)]/30">
        <div className="flex items-center gap-3 min-w-0">
          <Layers className="size-4 text-[var(--color-gold-soft)] shrink-0" />
          <div className="min-w-0">
            <div className="text-[12px] uppercase tracking-widest text-[var(--color-gold-soft)] font-bold">
              Shared bank — read only
            </div>
            <div className="text-[12px] text-[var(--color-text-dim)] truncate">
              Viewing someone else&apos;s organized bank. Want one for yourself? Paste your own export.
            </div>
          </div>
        </div>
        <Link
          href="/bank"
          className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12.5px] font-semibold bg-gradient-to-b from-[oklch(0.92_0.14_85)] to-[oklch(0.62_0.16_65)] text-[oklch(0.15_0.02_50)] border border-[oklch(0.46_0.13_60)] shadow-[0_2px_0_oklch(0_0_0/0.4)] hover:brightness-110"
        >
          <ArrowLeft className="size-3.5" /> My bank
        </Link>
      </div>

      <SharedBankView result={result} strings={strings} />
    </main>
  );
}
