import type { Recommendation } from "@/lib/next-up";
import { buildItemIdentity, type ItemIdentity } from "@/lib/item-identity";

export interface RecommendationIdentity {
  item: ItemIdentity;
  label: string;
  helper: string;
}

export function buildRecommendationIdentity(rec: Pick<Recommendation, "iconItemId" | "kind" | "title">): RecommendationIdentity | null {
  if (!rec.iconItemId) return null;
  const item = buildItemIdentity({
    id: rec.iconItemId,
    name: rec.title,
    quantity: 1
  });

  return {
    item,
    label: `Visual ID #${item.itemId}`,
    helper: `${rec.kind} recommendation sprite uses OSRS item #${item.itemId}.`
  };
}
