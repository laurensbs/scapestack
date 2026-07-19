/**
 * Privacy-safe product analytics.
 *
 * Event properties are allow-listed per event at runtime. Raw RSNs, bank rows,
 * plugin payloads and claim tokens are never part of the contract and are
 * discarded if a caller tries to add them through untyped code.
 */

export type AnalyticsContext =
  | "public_stats"
  | "bank"
  | "runelite"
  | "bank_runelite"
  | "sample";

type Primitive = string | number | boolean;

interface RecommendationEventProps {
  recommendationId: string;
  recommendationKind: string;
  routeFamily: string;
  mood: string;
  accountStage: string;
  context: AnalyticsContext;
  sessionMinutes: number;
  elapsedMs?: number;
}

export interface AnalyticsEventMap {
  "rsn:submitted": {
    source: "homepage" | "next" | "bank_handoff" | "plugin" | "sample";
    context: AnalyticsContext;
    hasBank: boolean;
    sample: boolean;
  };
  "plan:context_ready": {
    serverMs: number;
    criticalMs: number;
    optionalMs: number;
    plannerMs: number;
    timeoutCount: number;
  };
  "plan:first_rendered": RecommendationEventProps;
  "mood:changed": {
    mood: string;
    sessionMinutes: number;
    source: "picker" | "feedback" | "completion" | "onboarding";
  };
  "recommendation:impression": RecommendationEventProps;
  "recommendation:accepted": RecommendationEventProps;
  "recommendation:another": RecommendationEventProps & { nextRouteFamily: string };
  "recommendation:skipped": RecommendationEventProps & {
    reason: "not_today" | "not_my_style" | "too_hard" | "already_done" | "another_plan";
  };
  "trip:started": RecommendationEventProps;
  "trip:completed_manual": RecommendationEventProps;
  "trip:completed_sync": RecommendationEventProps & { evidence: "runelite_progress" };
  "runelite:sync_success": {
    result: "found";
    fresh: boolean;
    bankReady: boolean;
    source: "manual" | "url" | "saved" | "watch";
  };
  "runelite:sync_failure": {
    reason: "not_found" | "unconfigured" | "request_error" | "service_error";
    source: "manual" | "url" | "saved" | "service_probe";
  };
  "bank:attached": { source: "home" | "next" | "header" | "run-bar" | "dps" | "goals" | "slayer" | "bank" | "unknown"; linkedToAccount: boolean };
  "bank:refreshed": { source: "home" | "next" | "header" | "run-bar" | "dps" | "goals" | "slayer" | "bank" | "unknown"; linkedToAccount: boolean };
  "return:visit": {
    hasBank: boolean;
    hasRunelite: boolean;
    hasTripHistory: boolean;
  };
  "timeline:viewed": {
    hasProgress: boolean;
    hasBankUpdate: boolean;
    hasRuneliteProgress: boolean;
    momentCount: number;
  };
  "reminder:created": {
    source: "return_recap";
    goalKind: string;
    delivery: "notification" | "local" | "unsupported" | "denied" | "failed";
  };
  "reminder:cancelled": {
    source: "return_recap";
  };
  "reminder:opened": {
    source: "return_recap";
    goalKind: string;
  };
  "outcome:viewed": {
    status: "completed" | "progressed" | "contradicted";
    evidenceType: string;
  };
  "boss:opened": {
    bossSlug: string;
    source: "next" | "check_kill";
    hasBank: boolean;
  };
  "boss:loadout_used": {
    bossSlug: string;
    source: "next" | "check_kill";
    hasBank: boolean;
    action: "copy_runelite_tab";
  };

  // Existing events remain valid while dashboards migrate to the funnel.
  "next:submit": { hasRsn?: boolean; hasBank?: boolean };
  "homepage:sample": { source?: string; boss?: string; dest?: string };
  "saved-bank:reuse": Record<string, never>;
  "bank:copy": { mode?: string; tabs?: number; tab?: string };
  "bank:snapshot_compare_copy": { added?: number; removed?: number; changedQuantity?: number };
}

export type AnalyticsEvent = keyof AnalyticsEventMap;

export interface AnalyticsEnvelope<E extends AnalyticsEvent = AnalyticsEvent> {
  event: E;
  props: AnalyticsEventMap[E];
}

export type AnalyticsTransport = (envelope: AnalyticsEnvelope) => void;

interface PlausibleFn {
  (event: string, opts?: { props?: Record<string, Primitive> }): void;
}

declare global {
  interface Window {
    plausible?: PlausibleFn;
  }
}

const EVENT_KEYS = {
  "rsn:submitted": ["source", "context", "hasBank", "sample"],
  "plan:context_ready": ["serverMs", "criticalMs", "optionalMs", "plannerMs", "timeoutCount"],
  "plan:first_rendered": ["recommendationId", "recommendationKind", "routeFamily", "mood", "accountStage", "context", "sessionMinutes", "elapsedMs"],
  "mood:changed": ["mood", "sessionMinutes", "source"],
  "recommendation:impression": ["recommendationId", "recommendationKind", "routeFamily", "mood", "accountStage", "context", "sessionMinutes", "elapsedMs"],
  "recommendation:accepted": ["recommendationId", "recommendationKind", "routeFamily", "mood", "accountStage", "context", "sessionMinutes", "elapsedMs"],
  "recommendation:another": ["recommendationId", "recommendationKind", "routeFamily", "mood", "accountStage", "context", "sessionMinutes", "elapsedMs", "nextRouteFamily"],
  "recommendation:skipped": ["recommendationId", "recommendationKind", "routeFamily", "mood", "accountStage", "context", "sessionMinutes", "elapsedMs", "reason"],
  "trip:started": ["recommendationId", "recommendationKind", "routeFamily", "mood", "accountStage", "context", "sessionMinutes", "elapsedMs"],
  "trip:completed_manual": ["recommendationId", "recommendationKind", "routeFamily", "mood", "accountStage", "context", "sessionMinutes", "elapsedMs"],
  "trip:completed_sync": ["recommendationId", "recommendationKind", "routeFamily", "mood", "accountStage", "context", "sessionMinutes", "elapsedMs", "evidence"],
  "runelite:sync_success": ["result", "fresh", "bankReady", "source"],
  "runelite:sync_failure": ["reason", "source"],
  "bank:attached": ["source", "linkedToAccount"],
  "bank:refreshed": ["source", "linkedToAccount"],
  "return:visit": ["hasBank", "hasRunelite", "hasTripHistory"],
  "timeline:viewed": ["hasProgress", "hasBankUpdate", "hasRuneliteProgress", "momentCount"],
  "reminder:created": ["source", "goalKind", "delivery"],
  "reminder:cancelled": ["source"],
  "reminder:opened": ["source", "goalKind"],
  "outcome:viewed": ["status", "evidenceType"],
  "boss:opened": ["bossSlug", "source", "hasBank"],
  "boss:loadout_used": ["bossSlug", "source", "hasBank", "action"],
  "next:submit": ["hasRsn", "hasBank"],
  "homepage:sample": ["source", "boss", "dest"],
  "saved-bank:reuse": [],
  "bank:copy": ["mode", "tabs", "tab"],
  "bank:snapshot_compare_copy": ["added", "removed", "changedQuantity"]
} as const satisfies { [E in AnalyticsEvent]: readonly (keyof AnalyticsEventMap[E])[] };

const REQUIRED_KEYS: { [E in AnalyticsEvent]: readonly (keyof AnalyticsEventMap[E])[] } = {
  "rsn:submitted": EVENT_KEYS["rsn:submitted"],
  "plan:context_ready": EVENT_KEYS["plan:context_ready"],
  "plan:first_rendered": EVENT_KEYS["plan:first_rendered"].filter((key) => key !== "elapsedMs"),
  "mood:changed": EVENT_KEYS["mood:changed"],
  "recommendation:impression": EVENT_KEYS["recommendation:impression"].filter((key) => key !== "elapsedMs"),
  "recommendation:accepted": EVENT_KEYS["recommendation:accepted"].filter((key) => key !== "elapsedMs"),
  "recommendation:another": EVENT_KEYS["recommendation:another"].filter((key) => key !== "elapsedMs"),
  "recommendation:skipped": EVENT_KEYS["recommendation:skipped"].filter((key) => key !== "elapsedMs"),
  "trip:started": EVENT_KEYS["trip:started"].filter((key) => key !== "elapsedMs"),
  "trip:completed_manual": EVENT_KEYS["trip:completed_manual"].filter((key) => key !== "elapsedMs"),
  "trip:completed_sync": EVENT_KEYS["trip:completed_sync"].filter((key) => key !== "elapsedMs"),
  "runelite:sync_success": EVENT_KEYS["runelite:sync_success"],
  "runelite:sync_failure": EVENT_KEYS["runelite:sync_failure"],
  "bank:attached": EVENT_KEYS["bank:attached"],
  "bank:refreshed": EVENT_KEYS["bank:refreshed"],
  "return:visit": EVENT_KEYS["return:visit"],
  "timeline:viewed": EVENT_KEYS["timeline:viewed"],
  "reminder:created": EVENT_KEYS["reminder:created"],
  "reminder:cancelled": EVENT_KEYS["reminder:cancelled"],
  "reminder:opened": EVENT_KEYS["reminder:opened"],
  "outcome:viewed": EVENT_KEYS["outcome:viewed"],
  "boss:opened": EVENT_KEYS["boss:opened"],
  "boss:loadout_used": EVENT_KEYS["boss:loadout_used"],
  "next:submit": [],
  "homepage:sample": [],
  "saved-bank:reuse": [],
  "bank:copy": [],
  "bank:snapshot_compare_copy": []
};

const ENUM_VALUES: Partial<Record<AnalyticsEvent, Record<string, readonly Primitive[]>>> = {
  "rsn:submitted": {
    source: ["homepage", "next", "bank_handoff", "plugin", "sample"],
    context: ["public_stats", "bank", "runelite", "bank_runelite", "sample"]
  },
  "mood:changed": { source: ["picker", "feedback", "completion", "onboarding"] },
  "recommendation:skipped": { reason: ["not_today", "too_hard", "already_done", "another_plan"] },
  "trip:completed_sync": { evidence: ["runelite_progress"] },
  "runelite:sync_success": { result: ["found"], source: ["manual", "url", "saved", "watch"] },
  "runelite:sync_failure": {
    reason: ["not_found", "unconfigured", "request_error", "service_error"],
    source: ["manual", "url", "saved", "service_probe"]
  },
  "bank:attached": { source: ["home", "next", "header", "run-bar", "dps", "goals", "slayer", "bank", "unknown"] },
  "bank:refreshed": { source: ["home", "next", "header", "run-bar", "dps", "goals", "slayer", "bank", "unknown"] },
  "reminder:created": { source: ["return_recap"], delivery: ["notification", "local", "unsupported", "denied", "failed"] },
  "reminder:cancelled": { source: ["return_recap"] },
  "reminder:opened": { source: ["return_recap"] },
  "outcome:viewed": { status: ["completed", "progressed", "contradicted"] },
  "boss:opened": { source: ["next", "check_kill"] },
  "boss:loadout_used": { source: ["next", "check_kill"], action: ["copy_runelite_tab"] }
};

const seenDedupeKeys = new Set<string>();
let injectedTransport: AnalyticsTransport | null = null;

function isPrimitive(value: unknown): value is Primitive {
  return typeof value === "string"
    || typeof value === "boolean"
    || (typeof value === "number" && Number.isFinite(value));
}

export function isAnalyticsEvent(value: string): value is AnalyticsEvent {
  return Object.prototype.hasOwnProperty.call(EVENT_KEYS, value);
}

/** Runtime boundary for calls coming from JavaScript or loosely typed code. */
export function validateAnalyticsEnvelope(
  event: string,
  unsafeProps: Record<string, unknown> = {}
): AnalyticsEnvelope | null {
  if (!isAnalyticsEvent(event)) return null;
  const allowed = new Set<string>(EVENT_KEYS[event]);
  const props: Record<string, Primitive> = {};
  for (const [key, value] of Object.entries(unsafeProps)) {
    const acceptedValues = ENUM_VALUES[event]?.[key];
    if (allowed.has(key) && isPrimitive(value) && (!acceptedValues || acceptedValues.includes(value))) {
      props[key] = value;
    }
  }
  if (REQUIRED_KEYS[event].some((key) => !(key in props))) return null;
  return { event, props } as AnalyticsEnvelope;
}

function plausibleTransport({ event, props }: AnalyticsEnvelope): void {
  if (typeof window === "undefined") return;
  window.plausible?.(event, Object.keys(props).length ? { props: props as Record<string, Primitive> } : undefined);
}

export function track<E extends AnalyticsEvent>(
  event: E,
  props: AnalyticsEventMap[E] = {} as AnalyticsEventMap[E],
  options: { dedupeKey?: string } = {}
): void {
  const envelope = validateAnalyticsEnvelope(event, props as Record<string, unknown>);
  if (!envelope) return;
  if (options.dedupeKey) {
    if (seenDedupeKeys.has(options.dedupeKey)) return;
    seenDedupeKeys.add(options.dedupeKey);
  }
  try {
    (injectedTransport ?? plausibleTransport)(envelope);
  } catch {
    // Analytics must never break the player flow.
  }
}

/** Test/local adapter hook. Passing null restores the Plausible adapter. */
export function setAnalyticsTransport(transport: AnalyticsTransport | null): void {
  injectedTransport = transport;
}

export function resetAnalyticsState(): void {
  injectedTransport = null;
  seenDedupeKeys.clear();
}
