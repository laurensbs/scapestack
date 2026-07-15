"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, CheckCircle2, Clock3, Sparkles } from "lucide-react";
import { latestSnapshot } from "@/lib/snapshot-history";
import { loadTripTimeline, tripTimelineRecap, type TripTimelineRecap } from "@/lib/trip-timeline";
import { track } from "@/lib/analytics";

interface WeeklyRecapProps {
  rsn: string;
  nextHref: string;
  syncXpLine?: string | null;
}

export function WeeklyRecap({ rsn, nextHref, syncXpLine }: WeeklyRecapProps) {
  const [recap, setRecap] = useState<TripTimelineRecap | null>(null);
  const [bankUpdatedAt, setBankUpdatedAt] = useState<number | null>(null);

  useEffect(() => {
    const nextRecap = tripTimelineRecap(loadTripTimeline(), { rsn });
    const nextBankUpdatedAt = latestSnapshot(rsn)?.ts ?? null;
    setRecap(nextRecap);
    setBankUpdatedAt(nextBankUpdatedAt);
    track("return:visit", {
      hasBank: Boolean(nextBankUpdatedAt),
      hasRunelite: Boolean(syncXpLine),
      hasTripHistory: nextRecap.events.length > 0
    }, { dedupeKey: "profile-return-visit" });
    track("recap:viewed", {
      hasProgress: nextRecap.events.length > 0,
      hasBankUpdate: Boolean(nextBankUpdatedAt),
      hasRuneliteProgress: Boolean(syncXpLine),
      period: "week"
    }, { dedupeKey: "weekly-recap-viewed" });
  }, [rsn, syncXpLine]);

  const lines = useMemo(() => weeklyLines({
    recap,
    bankUpdatedAt,
    syncXpLine
  }), [bankUpdatedAt, recap, syncXpLine]);

  return (
    <section className="mb-6 scapestack-route-card max-w-full overflow-hidden p-4 sm:p-5" data-weekly-recap="true">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="mb-2 flex items-center gap-2">
            <Sparkles className="size-4 text-[var(--color-accent)]" />
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[var(--color-accent)]">
              This week
            </p>
          </div>
          <h2 className="text-[22px] font-black leading-tight text-[var(--color-text)]">
            Keep the route moving.
          </h2>
          <p className="mt-1 text-[12.5px] font-semibold leading-relaxed text-[var(--color-text-muted)]">
            Trips you touched on this device, plus the latest RuneLite or bank change.
          </p>
        </div>
        <Link
          href={nextHref}
          className="scapestack-command-button scapestack-primary-action w-full shrink-0 px-4 py-2.5 text-[12.5px] font-black sm:w-auto"
        >
          Next clean trip <ArrowRight className="size-4" />
        </Link>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        {lines.map((line) => (
          <div
            key={`${line.label}:${line.value}`}
            className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)]/42 px-3 py-3"
          >
            <div className="mb-1 flex items-center gap-1.5 text-[10.5px] font-black uppercase tracking-[0.14em] text-[var(--color-accent)]">
              {line.tone === "done" ? <CheckCircle2 className="size-3.5" /> : <Clock3 className="size-3.5" />}
              {line.label}
            </div>
            <div className="text-[12.5px] font-semibold leading-relaxed text-[var(--color-text-dim)]">
              {line.value}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function weeklyLines({
  recap,
  bankUpdatedAt,
  syncXpLine
}: {
  recap: TripTimelineRecap | null;
  bankUpdatedAt: number | null;
  syncXpLine?: string | null;
}): Array<{ label: string; value: string; tone?: "done" }> {
  const lines: Array<{ label: string; value: string; tone?: "done" }> = [];
  if (recap?.latestDone) {
    lines.push({
      label: "Done",
      value: `${recap.latestDone.title} (${recap.done} done this week)`,
      tone: "done"
    });
  } else if (recap?.lastPlannedTrip) {
    lines.push({
      label: "Last trip",
      value: `${recap.lastPlannedTrip.title}${recap.lastPlannedTrip.stopPoint ? ` - ${recap.lastPlannedTrip.stopPoint}` : ""}`
    });
  } else {
    lines.push({
      label: "Start",
      value: "Start one trip, mark it done, then this page remembers the chain."
    });
  }

  if (syncXpLine) {
    lines.push({ label: "RuneLite", value: syncXpLine });
  }

  if (bankUpdatedAt) {
    lines.push({ label: "Bank", value: `Bank refreshed ${relativeShort(bankUpdatedAt)}.` });
  }

  if (lines.length < 3) {
    lines.push({
      label: "Next",
      value: recap?.skipped
        ? `${recap.skipped} route${recap.skipped === 1 ? "" : "s"} skipped, so the next pick can move.`
        : "Open the next trip after your stop point."
    });
  }

  return lines.slice(0, 3);
}

function relativeShort(epochMs: number): string {
  const minutes = Math.max(0, Math.round((Date.now() - epochMs) / 60_000));
  if (minutes < 2) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}
