"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  ChevronDown,
  Coins,
  ScrollText,
  Shield,
  Sparkles,
  Sword,
  Trophy
} from "lucide-react";
import type { AccountTimelineMoment, AccountTimelineMomentKind } from "@/lib/account-timeline";
import {
  loadTripTimeline,
  TRIP_TIMELINE_CHANGE_EVENT,
  type TripTimelineEvent
} from "@/lib/trip-timeline";
import { track } from "@/lib/analytics";
import { cn } from "@/lib/utils";

interface TimelineResponse {
  ok: boolean;
  account?: { rsn: string; displayName: string };
  moments?: AccountTimelineMoment[];
  nextCursor?: string | null;
}

interface AccountTimelineProps {
  expectedRsn?: string;
  className?: string;
  limit?: number;
}

function normalizeRsn(value: string | undefined): string {
  return value?.trim().toLowerCase().replace(/\s+/g, " ").slice(0, 12) ?? "";
}

function scopedLegacyEvents(events: TripTimelineEvent[], rsn: string): TripTimelineEvent[] {
  const key = normalizeRsn(rsn);
  return events.filter((event) => normalizeRsn(event.rsnKey) === key);
}

async function loadPage(cursor: string | null, limit: number): Promise<TimelineResponse | null> {
  const params = new URLSearchParams({ limit: String(limit) });
  if (cursor) params.set("cursor", cursor);
  const response = await fetch(`/api/account/timeline?${params}`, { cache: "no-store" });
  if (response.status === 401) return null;
  if (!response.ok) throw new Error("timeline unavailable");
  return response.json() as Promise<TimelineResponse>;
}

function momentIcon(kind: AccountTimelineMomentKind) {
  if (kind === "quest" || kind === "diary") return ScrollText;
  if (kind === "boss" || kind === "slayer") return Sword;
  if (kind === "bank") return Coins;
  if (kind === "trip") return CheckCircle2;
  if (kind === "level" || kind === "collection-log") return Trophy;
  if (kind === "plan") return Shield;
  return Sparkles;
}

function relativeTime(value: string): string {
  const elapsed = Math.max(0, Date.now() - Date.parse(value));
  const minutes = Math.floor(elapsed / 60_000);
  if (minutes < 2) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return days < 7 ? `${days}d ago` : new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(new Date(value));
}

export function AccountTimeline({ expectedRsn, className, limit = 6 }: AccountTimelineProps) {
  const [moments, setMoments] = useState<AccountTimelineMoment[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [accountRsn, setAccountRsn] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const page = await loadPage(null, limit);
      if (!page?.account || (expectedRsn && normalizeRsn(page.account.rsn) !== normalizeRsn(expectedRsn))) {
        setMoments([]);
        setCursor(null);
        setAccountRsn(null);
        return;
      }
      setAccountRsn(page.account.rsn);
      setMoments(page.moments ?? []);
      setCursor(page.nextCursor ?? null);
    } catch {
      setMoments([]);
    }
  }, [expectedRsn, limit]);

  const migrate = useCallback(async () => {
    if (!accountRsn) return;
    const events = scopedLegacyEvents(loadTripTimeline(), accountRsn);
    if (events.length === 0) return;
    const latest = Math.max(...events.map((event) => event.savedAt));
    const markerKey = `scapestack:timeline-imported:v1:${normalizeRsn(accountRsn)}`;
    if (localStorage.getItem(markerKey) === String(latest)) return;
    try {
      const response = await fetch("/api/account/timeline", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ events })
      });
      if (!response.ok) return;
      localStorage.setItem(markerKey, String(latest));
      await refresh();
    } catch {}
  }, [accountRsn, refresh]);

  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => { void migrate(); }, [migrate]);
  useEffect(() => {
    const sync = () => { void migrate(); };
    window.addEventListener(TRIP_TIMELINE_CHANGE_EVENT, sync);
    return () => window.removeEventListener(TRIP_TIMELINE_CHANGE_EVENT, sync);
  }, [migrate]);
  useEffect(() => {
    if (moments.length === 0) return;
    const hasBank = moments.some((moment) => moment.kind === "bank");
    const hasRunelite = moments.some((moment) => !["trip", "plan"].includes(moment.kind));
    const hasTripHistory = moments.some((moment) => moment.kind === "trip" || moment.kind === "plan");
    track("return:visit", { hasBank, hasRunelite, hasTripHistory }, { dedupeKey: "account-timeline-return" });
    track("timeline:viewed", {
      hasProgress: moments.length > 0,
      hasBankUpdate: hasBank,
      hasRuneliteProgress: hasRunelite,
      momentCount: Math.min(50, moments.length)
    }, { dedupeKey: "account-timeline-viewed" });
  }, [moments]);

  const visible = useMemo(() => moments.slice(0, 18), [moments]);
  if (visible.length === 0) return null;

  const loadEarlier = async () => {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const page = await loadPage(cursor, limit);
      if (page) {
        setMoments((current) => [...current, ...(page.moments ?? [])]);
        setCursor(page.nextCursor ?? null);
      }
    } finally {
      setLoadingMore(false);
    }
  };

  return (
    <section className={cn("border-y border-[var(--color-border)]/70 py-4", className)} data-account-timeline="true">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 className="font-serif text-[20px] font-semibold text-[var(--color-text)]">Since last time</h2>
        <span className="text-[11px] font-semibold text-[var(--color-text-muted)]">{accountRsn}</span>
      </div>
      <ol className="divide-y divide-[var(--color-border)]/55">
        {visible.map((moment) => {
          const Icon = momentIcon(moment.kind);
          return (
            <li key={moment.id} className="grid grid-cols-[32px_minmax(0,1fr)_auto] items-start gap-3 py-3 first:pt-0 last:pb-0">
              <span className="flex size-8 items-center justify-center text-[var(--color-accent)]" aria-hidden="true">
                <Icon className="size-4" />
              </span>
              <div className="min-w-0">
                <p className="text-[13px] font-bold leading-snug text-[var(--color-text)]">{moment.title}</p>
                {moment.detail && <p className="mt-0.5 text-[11.5px] font-medium leading-relaxed text-[var(--color-text-muted)]">{moment.detail}</p>}
              </div>
              <time className="pt-0.5 text-[10.5px] font-semibold text-[var(--color-text-muted)]" dateTime={moment.occurredAt}>
                {relativeTime(moment.occurredAt)}
              </time>
            </li>
          );
        })}
      </ol>
      {cursor && (
        <button
          type="button"
          onClick={loadEarlier}
          disabled={loadingMore}
          className="mt-4 inline-flex min-h-10 items-center gap-1.5 text-[12px] font-bold text-[var(--color-accent)] disabled:opacity-50"
        >
          {loadingMore ? "Loading..." : "Earlier"} <ChevronDown className="size-3.5" />
        </button>
      )}
    </section>
  );
}
