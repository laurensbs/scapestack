import type { Recommendation } from "./next-up";
import { brandUrl } from "./brand";

export interface ShareableTripCard {
  version: 1;
  result: string;
  title: string;
  kind: string;
  why: string;
  stopPoint: string;
  iconItemId?: number;
  bossSlug?: string;
  previewText: string;
  ogImageUrl: string;
}

const PRIVATE_COPY = /\b(rsn|bank contents?|bank rows?|raw stats?|payload|token|claim|inventory dump|item ids?|quantity|quantities|screenshot|login|password)\b/i;

function sanitizeText(value: string | undefined, fallback: string, max = 150): string {
  const text = value?.replace(/\s+/g, " ").trim();
  if (!text || PRIVATE_COPY.test(text)) return fallback;
  return text.slice(0, max);
}

function resultFor(rec: Recommendation, options: { bankContext?: boolean; accountSafeProgress?: string }): string {
  const progress = sanitizeText(options.accountSafeProgress, "", 90);
  if (progress) return progress;
  if (options.bankContext && rec.kind === "boss") return `My bank supports this ${rec.title.replace(/^Push\s+/i, "").replace(/\s+to\s+\d+\s+KC$/i, "")} trip`;
  if (options.bankContext && rec.kind === "skill") return `This bank helps with ${rec.title.replace(/^Pick a maxing lane:\s*/i, "")}`;
  if (rec.kind === "goal" || rec.kind === "milestone") return `One unlock worth doing next: ${rec.title}`;
  if (rec.kind === "boss") return `One KC block worth trying: ${rec.title}`;
  return `One OSRS trip worth doing now: ${rec.title}`;
}

function ogImageUrl(card: Pick<ShareableTripCard, "result" | "why" | "stopPoint" | "iconItemId">): string {
  const params = new URLSearchParams({
    result: card.result,
    why: card.why,
    stop: card.stopPoint
  });
  if (card.iconItemId) params.set("item", String(card.iconItemId));
  return brandUrl(`/share/trip/opengraph-image?${params.toString()}`);
}

export function shareableTripFromRecommendation(
  rec: Recommendation,
  options: { stopPoint: string; bankContext?: boolean; accountSafeProgress?: string } = { stopPoint: "Stop at the chosen stop point." }
): ShareableTripCard {
  const title = sanitizeText(rec.title, "Scapestack picked one OSRS trip.", 110);
  const why = sanitizeText(rec.decisionReason ?? rec.why, "Scapestack found a cleaner next trip.", 145);
  const stopPoint = sanitizeText(options.stopPoint, "Stop at the chosen stop point.", 120);
  const result = resultFor({ ...rec, title } as Recommendation, options);
  const card = {
    version: 1,
    result,
    title,
    kind: rec.kind,
    why,
    stopPoint,
    iconItemId: rec.iconItemId,
    bossSlug: rec.bossSlug,
    previewText: "",
    ogImageUrl: ""
  } satisfies ShareableTripCard;
  return {
    ...card,
    previewText: formatShareableTripCard(card),
    ogImageUrl: ogImageUrl(card)
  };
}

export function formatShareableTripCard(card: ShareableTripCard): string {
  const lines = [
    card.result,
    "",
    `Do this first: ${card.title}`,
    `Why: ${card.why}`,
    `Stop at: ${card.stopPoint}`,
    "",
    "Shared from Scapestack. No bank contents, RSN or raw stats included."
  ];
  return lines.join("\n");
}
