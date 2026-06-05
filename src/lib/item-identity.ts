import { ICON_URL, spriteIdForItem } from "@/lib/utils";
import { wikiPriceUrl } from "@/lib/item-action";
import { wikiSearchUrl } from "@/lib/wiki";

export interface ItemIdentityInput {
  id: number;
  name: string;
  quantity: number;
}

export interface ItemIdentity {
  itemId: number;
  spriteId: number;
  badge: string;
  bankTagsToken: string;
  spriteUrl: string;
  wikiUrl: string;
  priceUrl: string;
  facts: string[];
}

export function normalizeOsrsItemId(id: number, fallback = 995): number {
  const clean = Math.abs(Math.trunc(id));
  return Number.isFinite(clean) && clean > 0 ? clean : fallback;
}

export function buildItemIdentity(input: ItemIdentityInput): ItemIdentity {
  const itemId = normalizeOsrsItemId(input.id);
  const spriteId = normalizeOsrsItemId(spriteIdForItem(itemId, input.quantity));
  const itemLabel = `#${itemId}`;
  const badge = itemId === spriteId ? `OSRS item ${itemLabel}` : `OSRS item ${itemLabel} · sprite #${spriteId}`;
  const wikiUrl = wikiSearchUrl(input.name || itemLabel);

  return {
    itemId,
    spriteId,
    badge,
    bankTagsToken: String(itemId),
    spriteUrl: ICON_URL(spriteId),
    wikiUrl,
    priceUrl: wikiPriceUrl(itemId),
    facts: [
      `BankTags export token: ${itemId}`,
      `Sprite proxy: ${ICON_URL(spriteId)}`,
      `OSRS Wiki search: ${input.name || itemLabel}`,
      `Wiki price ID: ${itemId}`
    ]
  };
}
