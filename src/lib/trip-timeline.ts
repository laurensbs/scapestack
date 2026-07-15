const KEY = "scapestack:trip-timeline:v1";
const MAX_EVENTS = 80;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
export const TRIP_TIMELINE_CHANGE_EVENT = "scapestack:trip-timeline-change";

export type TripTimelineAction = "planned" | "started" | "done" | "skipped" | "shared";

export interface TripTimelineEvent {
  version: 1;
  id: string;
  kind: string;
  title: string;
  action: TripTimelineAction;
  savedAt: number;
  rsnKey?: string;
  mood?: string;
  routeLens?: string;
  stopPoint?: string;
}

export interface TripTimelineRecap {
  events: TripTimelineEvent[];
  started: number;
  done: number;
  skipped: number;
  shared: number;
  lastPlannedTrip: TripTimelineEvent | null;
  latestDone: TripTimelineEvent | null;
  latestEvent: TripTimelineEvent | null;
}

export function loadTripTimeline(): TripTimelineEvent[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter(isTripTimelineEvent).slice(-MAX_EVENTS) : [];
  } catch {
    return [];
  }
}

export function recordTripEvent(input: {
  id: string;
  kind: string;
  title: string;
  action: TripTimelineAction;
  rsn?: string;
  mood?: string;
  routeLens?: string;
  stopPoint?: string;
  now?: number;
}): TripTimelineEvent[] {
  if (typeof window === "undefined") return [];
  const next = [
    ...loadTripTimeline(),
    {
      version: 1 as const,
      id: input.id,
      kind: input.kind,
      title: input.title,
      action: input.action,
      rsnKey: normalizeRsnKey(input.rsn),
      mood: input.mood,
      routeLens: input.routeLens,
      stopPoint: input.stopPoint,
      savedAt: input.now ?? Date.now()
    }
  ].filter(isTripTimelineEvent).slice(-MAX_EVENTS);
  try { localStorage.setItem(KEY, JSON.stringify(next)); } catch {}
  if (typeof window.dispatchEvent === "function" && typeof Event === "function") {
    window.dispatchEvent(new Event(TRIP_TIMELINE_CHANGE_EVENT));
  }
  return next;
}

export function tripTimelineRecap(
  events = loadTripTimeline(),
  options: { rsn?: string; now?: number; maxAgeMs?: number } = {}
): TripTimelineRecap {
  const rsnKey = normalizeRsnKey(options.rsn);
  const cutoff = (options.now ?? Date.now()) - (options.maxAgeMs ?? WEEK_MS);
  const scoped = events
    .filter((event) => event.savedAt >= cutoff)
    .filter((event) => matchesRsnKey(event, rsnKey))
    .sort((a, b) => b.savedAt - a.savedAt);

  return {
    events: scoped,
    started: scoped.filter((event) => event.action === "started").length,
    done: scoped.filter((event) => event.action === "done").length,
    skipped: scoped.filter((event) => event.action === "skipped").length,
    shared: scoped.filter((event) => event.action === "shared").length,
    lastPlannedTrip: scoped.find((event) => event.action === "planned" || event.action === "started") ?? null,
    latestDone: scoped.find((event) => event.action === "done") ?? null,
    latestEvent: scoped[0] ?? null
  };
}

function normalizeRsnKey(rsn?: string): string | undefined {
  const trimmed = rsn?.trim().toLowerCase();
  return trimmed || undefined;
}

function matchesRsnKey(event: TripTimelineEvent, rsnKey?: string): boolean {
  if (!rsnKey || !event.rsnKey) return true;
  return event.rsnKey === rsnKey;
}

function isTripTimelineEvent(value: unknown): value is TripTimelineEvent {
  if (!value || typeof value !== "object") return false;
  const event = value as Partial<TripTimelineEvent>;
  return event.version === 1
    && typeof event.id === "string"
    && typeof event.kind === "string"
    && typeof event.title === "string"
    && typeof event.action === "string"
    && typeof event.savedAt === "number";
}
