import type { BankTip } from "./tips";
import { wikiSearchUrl } from "./wiki";

export interface BankTipAction {
  label: string;
  href: string | null;
  instruction: string;
  steps: string[];
}

export function buildTipAction(tip: BankTip): BankTipAction {
  if (tip.kind === "decant" && tip.subKind === "jewellery") {
    return {
      label: "Open recharge guide",
      href: wikiSearchUrl("OSRS recharge jewellery"),
      instruction: "Recharge the mixed-charge jewellery, then keep the highest-charge stack and clear the leftovers.",
      steps: [
        "Withdraw every mixed-charge jewellery stack shown in this tip.",
        "Recharge them through your POH, Fountain of Rune, or the relevant recharge method.",
        "Keep one highest-charge stack in the travel tab and remove the leftover charge variants.",
        "Run Smart tidy again so the freed bank slots collapse cleanly."
      ]
    };
  }

  if (tip.kind === "decant" && tip.subKind === "potions") {
    return {
      label: "Open decant guide",
      href: wikiSearchUrl("OSRS potion decanting"),
      instruction: "Use Bob Barter / a decanter to combine dose states into clean 4-dose stacks.",
      steps: [
        "Withdraw the mixed-dose potion stacks shown in this tip.",
        "Talk to Bob Barter at the Grand Exchange or another potion decanter.",
        "Decant into 4-dose stacks unless you intentionally need lower doses.",
        "Rebuild the supplies tab around trip-ready 4-dose potions."
      ]
    };
  }

  if (tip.kind === "outfit-incomplete") {
    const family = tip.title.split(" outfit ")[0];
    return {
      label: `Open ${family} guide`,
      href: wikiSearchUrl(`${family} outfit OSRS`),
      instruction: "Check the missing pieces, finish the set, then move the full outfit into one Skilling tab.",
      steps: [
        `Check which ${family} outfit pieces are missing.`,
        "Decide if the full set bonus is relevant to your next skilling goal.",
        "Unlock or buy the missing pieces before reorganising the Skilling tab.",
        "Keep all owned pieces together so the set remains visually obvious."
      ]
    };
  }

  if (tip.kind === "untradeable-pickup") {
    const reward = tip.title.replace(/^Pick up your\s+/i, "");
    return {
      label: `Open ${reward} wiki`,
      href: wikiSearchUrl(reward),
      instruction: "Claim or assemble the reward, then re-run the organizer so the account state stops looking incomplete.",
      steps: [
        `Confirm the account has the prerequisite for ${reward}.`,
        "Claim, imbue, assemble, or unlock the reward in-game.",
        "Place the reward in the relevant gear, cape, or PvM utility section.",
        "Re-run the organizer so this tip disappears from the bank plan."
      ]
    };
  }

  return {
    label: "Review affected items",
    href: null,
    instruction: "Keep the best variant, remove duplicates, then re-run Smart tidy to collapse the bank layout.",
    steps: [
      "Compare the affected item variants listed in this tip.",
      "Keep the imbued, charged, or actively-used version.",
      "Sell, drop, or archive redundant variants that no longer serve a goal.",
      "Re-run Smart tidy to collapse the cleaned-up slots."
    ]
  };
}

export function formatTipActionPlan(tips: BankTip[], heading = "Scapestack bank tip action plan"): string {
  const uniqueTips = dedupeTips(tips);
  const lines = [
    heading,
    "",
    ...uniqueTips.flatMap((tip, index) => {
      const action = buildTipAction(tip);
      return [
        `${index + 1}. ${tip.title}`,
        tip.detail,
        formatTipItemsLine(tip),
        tip.slotsFreed ? `Potential slots freed: ${tip.slotsFreed}` : null,
        `Do this: ${action.instruction}`,
        ...action.steps.map((step, stepIndex) => `   ${stepIndex + 1}. ${step}`),
        action.href ? `Guide: ${action.href}` : null,
        ""
      ].filter((line): line is string => line !== null);
    })
  ];
  return lines.join("\n").trim();
}

function formatTipItemsLine(tip: BankTip): string | null {
  if (tip.itemRefs?.length) {
    return `Matched items: ${tip.itemRefs.map((item) => `${item.name} (#${item.id})`).join(", ")}`;
  }
  if (tip.itemIds.length) {
    return `Matched item IDs: ${tip.itemIds.join(", ")}`;
  }
  return null;
}

function dedupeTips(tips: BankTip[]): BankTip[] {
  const seen = new Set<string>();
  const out: BankTip[] = [];
  for (const tip of tips) {
    if (seen.has(tip.id)) continue;
    seen.add(tip.id);
    out.push(tip);
  }
  return out;
}
