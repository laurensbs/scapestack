import type { Recommendation } from "./next-up";

export interface ShareableTripCard {
  version: 1;
  title: string;
  kind: string;
  rsn?: string;
  why: string;
  stopPoint: string;
  iconItemId?: number;
  bossSlug?: string;
}

export function shareableTripFromRecommendation(
  rec: Recommendation,
  options: { rsn?: string; stopPoint: string }
): ShareableTripCard {
  return {
    version: 1,
    title: rec.title,
    kind: rec.kind,
    rsn: options.rsn?.trim() || undefined,
    why: rec.decisionReason ?? rec.why,
    stopPoint: options.stopPoint,
    iconItemId: rec.iconItemId,
    bossSlug: rec.bossSlug
  };
}

export function formatShareableTripCard(card: ShareableTripCard): string {
  const lines = [
    card.rsn ? `Scapestack trip for ${card.rsn}` : "Scapestack trip",
    "",
    `Do this first: ${card.title}`,
    `Why: ${card.why}`,
    `Stop at: ${card.stopPoint}`,
    "",
    "No bank contents included."
  ];
  return lines.join("\n");
}
