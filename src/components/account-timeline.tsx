"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Bell,
  CheckCircle2,
  ChevronDown,
  Coins,
  ScrollText,
  Shield,
  Sparkles,
  Sword,
  Trophy,
  X
} from "lucide-react";
import type { AccountTimelineMoment, AccountTimelineMomentKind } from "@/lib/account-timeline";
import type { AccountReturnRecap } from "@/lib/account-return-recap";
import {
  loadTripTimeline,
  TRIP_TIMELINE_CHANGE_EVENT,
  type TripTimelineEvent
} from "@/lib/trip-timeline";
import { track } from "@/lib/analytics";
import {
  recommendationSuppressionReason,
  recordRecommendationMemory,
  suppressRecommendation
} from "@/lib/recommendation-feedback";
import { cn } from "@/lib/utils";
import { ItemSprite } from "@/components/item-sprite";
import {
  cancelReturnReminder,
  loadReturnReminder,
  requestReminderDelivery,
  saveReturnReminder,
  type ReturnReminder
} from "@/lib/return-reminder";

interface TimelineResponse {
  ok: boolean;
  account?: { rsn: string; displayName: string };
  moments?: AccountTimelineMoment[];
  nextCursor?: string | null;
  recap?: AccountReturnRecap | null;
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
  const accountResponse = await fetch("/api/account/me", { cache: "no-store" });
  if (!accountResponse.ok) return null;
  const session = await accountResponse.json() as { connected?: boolean };
  if (!session.connected) return null;
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
  if (kind === "outcome") return CheckCircle2;
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
  const [recap, setRecap] = useState<AccountReturnRecap | null>(null);
  const [reminder, setReminder] = useState<ReturnReminder | null>(null);
  const [reminderNote, setReminderNote] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const page = await loadPage(null, limit);
      if (!page?.account || (expectedRsn && normalizeRsn(page.account.rsn) !== normalizeRsn(expectedRsn))) {
        setMoments([]);
        setCursor(null);
        setAccountRsn(null);
        setRecap(null);
        return;
      }
      setAccountRsn(page.account.rsn);
      setMoments(page.moments ?? []);
      setCursor(page.nextCursor ?? null);
      setRecap(page.recap ?? null);
    } catch {
      setMoments([]);
      setRecap(null);
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
  useEffect(() => { setReminder(loadReturnReminder()); }, []);
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
    for (const moment of moments) {
      if (moment.kind !== "outcome" || !moment.outcomeStatus || !moment.evidenceType) continue;
      track("outcome:viewed", {
        status: moment.outcomeStatus,
        evidenceType: moment.evidenceType
      }, { dedupeKey: `outcome-viewed:${moment.id}` });
      if (moment.outcomeStatus === "completed" && moment.recommendationId
          && moment.recommendationKind && accountRsn
          && recommendationSuppressionReason(moment.recommendationId) !== "already_done") {
        recordRecommendationMemory({
          id: moment.recommendationId,
          kind: moment.recommendationKind,
          title: moment.title.replace(/^Finished\s+/i, ""),
          action: "completed_runelite",
          mood: moment.mood,
          routeLens: moment.routeLens,
          minutes: moment.minutes,
          rsn: accountRsn
        });
        suppressRecommendation({
          id: moment.recommendationId,
          kind: moment.recommendationKind,
          title: moment.title.replace(/^Finished\s+/i, ""),
          reason: "already_done",
          mood: moment.mood,
          routeLens: moment.routeLens,
          minutes: moment.minutes,
          rsn: accountRsn
        });
      }
    }
  }, [accountRsn, moments]);

  const visible = useMemo(() => moments.slice(0, 18), [moments]);
  if (visible.length === 0) return null;

  const reminderMatchesRecap = recap && reminder?.href === recap.nextHref && reminder.goal === recap.nextAction;
  const reminderDue = reminderMatchesRecap
    ? new Intl.DateTimeFormat("en", { weekday: "short", hour: "numeric", minute: "2-digit" }).format(new Date(reminder.dueAt))
    : null;

  const armReminder = async () => {
    if (!recap) return;
    const saved = saveReturnReminder({ goal: recap.nextAction, href: recap.nextHref });
    if (!saved) {
      setReminderNote("Could not save a reminder in this browser.");
      track("reminder:created", { source: "return_recap", goalKind: recap.moments[0]?.kind ?? "trip", delivery: "failed" });
      return;
    }
    setReminder(saved);
    const delivery = await requestReminderDelivery(saved);
    const deliveryMode = delivery.ok ? delivery.mode : delivery.mode;
    track("reminder:created", { source: "return_recap", goalKind: recap.moments[0]?.kind ?? "trip", delivery: deliveryMode });
    setReminderNote(delivery.ok
      ? `Reminder set for ${new Intl.DateTimeFormat("en", { weekday: "short", hour: "numeric", minute: "2-digit" }).format(new Date(saved.dueAt))}.`
      : delivery.reason);
  };

  const removeReminder = () => {
    cancelReturnReminder();
    setReminder(null);
    setReminderNote("Reminder cancelled.");
    track("reminder:cancelled", { source: "return_recap" });
  };

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
      {recap && (
        <div
          className="mb-4 grid gap-3 rounded-[var(--radius-panel)] border border-[var(--color-accent)]/35 bg-[var(--color-surface-soft)] p-4 sm:grid-cols-[76px_minmax(0,1fr)_auto] sm:items-center"
          data-return-recap="true"
        >
          <div className="flex size-[68px] items-center justify-center rounded-[var(--radius-card)] border border-[var(--color-accent)]/25 bg-black/30">
            <ItemSprite id={recap.visualItemId} alt="" size={46} className="pixelated" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[var(--color-accent)]">Welcome back</p>
            <h3 className="mt-1 font-serif text-[22px] font-semibold leading-tight text-[var(--color-text)]">{recap.title}</h3>
            <p className="mt-1 max-w-2xl text-[13px] font-medium leading-relaxed text-[var(--color-text-muted)]">{recap.lead}</p>
            <ul className="mt-3 grid gap-1.5 text-[12px] font-semibold text-[var(--color-text)] sm:grid-cols-3">
              {recap.moments.map((moment) => (
                <li key={moment.id} className="min-w-0 rounded-[var(--radius-card)] border border-[var(--color-border)]/60 bg-black/20 px-3 py-2">
                  <span className="block truncate">{moment.title}</span>
                  {moment.detail && <span className="mt-0.5 block truncate text-[11px] text-[var(--color-text-muted)]">{moment.detail}</span>}
                </li>
              ))}
            </ul>
          </div>
          <Link
            href={recap.nextHref}
            onClick={() => track("reminder:opened", { source: "return_recap", goalKind: recap.moments[0]?.kind ?? "trip" })}
            className="inline-flex min-h-11 items-center justify-center rounded-[var(--radius-card)] border border-[var(--color-accent)]/55 px-4 text-[13px] font-black text-[var(--color-accent)] transition hover:bg-[var(--color-accent)] hover:text-black"
          >
            {recap.nextAction}
          </Link>
          <div className="sm:col-start-2 sm:col-end-4">
            {reminderMatchesRecap ? (
              <div className="flex flex-wrap items-center gap-2 text-[12px] font-bold text-[var(--color-text-muted)]">
                <span className="inline-flex min-h-9 items-center gap-2 rounded-full border border-[var(--color-accent)]/35 px-3 text-[var(--color-accent)]">
                  <Bell className="size-3.5" /> Reminder {reminderDue}
                </span>
                <button type="button" onClick={removeReminder} className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-[var(--color-border)]/70 px-3">
                  <X className="size-3.5" /> Cancel
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={armReminder}
                className="inline-flex min-h-9 items-center gap-2 rounded-full border border-[var(--color-border)]/70 px-3 text-[12px] font-black text-[var(--color-text)] transition hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]"
              >
                <Bell className="size-3.5" /> Remind me tomorrow
              </button>
            )}
            {reminderNote && <p className="mt-1.5 text-[11px] font-semibold text-[var(--color-text-muted)]">{reminderNote}</p>}
          </div>
        </div>
      )}
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
