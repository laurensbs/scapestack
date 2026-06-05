import { formatGp } from "./utils";

export type ItemVerdictTone = "keep" | "review" | "sell" | "info";

export interface ItemVerdictInput {
  name: string;
  quantity: number;
  unitPrice: number;
  stackValue: number;
  highalch?: number;
  geLimit?: number;
  isJunk: boolean;
  isStale: boolean;
  goalCount: number;
}

export interface ItemVerdict {
  tone: ItemVerdictTone;
  title: string;
  body: string;
  bullets: string[];
}

export function wikiPriceUrl(itemId: number): string {
  const cleanId = Math.abs(Math.trunc(itemId));
  return `https://prices.runescape.wiki/osrs/item/${cleanId || 995}`;
}

export function buildItemVerdict(input: ItemVerdictInput): ItemVerdict {
  const highalch = input.highalch ?? 0;
  const geLimit = input.geLimit ?? 0;
  const stackValue = input.stackValue || input.unitPrice * Math.max(1, input.quantity);
  const alchDelta = highalch > 0 && input.unitPrice > 0 ? highalch - input.unitPrice : 0;

  if (input.goalCount > 0) {
    return {
      tone: "keep",
      title: "Keep: active goal item",
      body: `${input.name} contributes to ${input.goalCount} tracked goal${input.goalCount === 1 ? "" : "s"}. Do not clean this out blindly.`,
      bullets: [
        "Keep it visible in the relevant progression tab.",
        "Open the wiki if you need the exact quest, diary, boss, or skilling step.",
        "Pin it if this is part of the next session."
      ]
    };
  }

  if (input.isJunk) {
    return {
      tone: "sell",
      title: "Cleanup candidate",
      body: stackValue > 0
        ? `This looks low-impact for progression. Estimated stack value: ${formatGp(stackValue)} gp.`
        : "This looks low-impact for progression and can probably leave the main bank layout.",
      bullets: [
        "Sell, alch, drop, or move it into a junk/archive tab.",
        "Check the wiki first if the item is untradeable or account-specific.",
        "Re-run Smart tidy after removing it."
      ]
    };
  }

  if (alchDelta >= 1_000) {
    return {
      tone: "sell",
      title: "High-alch beats GE",
      body: `High alchemy is about ${formatGp(alchDelta)} gp better per item than the current GE unit estimate.`,
      bullets: [
        "Consider alching instead of selling instantly.",
        "Use the GE page to confirm the live spread before doing a large stack.",
        "Move it near runes/nature runes if you keep it for alching."
      ]
    };
  }

  if (input.isStale && stackValue >= 1_000_000) {
    return {
      tone: "review",
      title: "Valuable but stale",
      body: `This stack is worth roughly ${formatGp(stackValue)} gp and has not moved recently.`,
      bullets: [
        "Decide whether it still supports your current goals.",
        "Sell it if it is dead capital.",
        "Pin it if you want to force it back into your active plan."
      ]
    };
  }

  if (stackValue >= 10_000_000) {
    return {
      tone: "keep",
      title: "High-value stack",
      body: `This is a meaningful bank-value holder at roughly ${formatGp(stackValue)} gp.`,
      bullets: [
        "Keep it in a high-signal tab, not buried in Misc.",
        "Use the GE page before buying or selling.",
        "Pin it if it is part of your active setup."
      ]
    };
  }

  if (geLimit > 0 || input.unitPrice > 0) {
    return {
      tone: "info",
      title: "Tradeable item",
      body: geLimit > 0
        ? `Known GE item with a ${geLimit.toLocaleString()} four-hour limit.`
        : "Known GE item with a price estimate.",
      bullets: [
        "Use the price page for current spread.",
        "Keep only the dose, charge, or variant you actually use.",
        "Move duplicates into cleanup if this keeps fragmenting tabs."
      ]
    };
  }

  return {
    tone: "info",
    title: "Known bank item",
    body: "Scapestack has an item ID and wiki link for this entry, but no stronger action signal yet.",
    bullets: [
      "Open the wiki for requirements and use cases.",
      "Copy the item ID if you need to debug a Bank Tags import.",
      "Pin it if it belongs in your active plan."
    ]
  };
}
