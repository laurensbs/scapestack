// Stack Score — the brandable Scapestack metric, single number 0-100.
//
// Components (weighted):
//   30% Wealth     — log scale, 0 at 0 gp, 100 at 1B+ gp
//   25% Diversity  — distinct item count, 100 at 500 items
//   25% Untradeable Index — achievement gear claimed, 100 at 20 items
//   20% Density    — share of slots holding ≥1M gp value
//
// Goal: a memorable, shareable bragging stat. Lookable up on every share
// card. Roughly mirrors what WOM does with EHP/EHB but rooted in our wedge
// (bank data, not Hiscores).

import type { OrganizedTab, OrganizedItem } from "./organizer";

export interface StackScore {
  total: number;          // 0-100, integer
  components: {
    wealth: number;
    diversity: number;
    untradeable: number;
    density: number;
  };
}

// Items that signal an account-progression milestone — earned, not bought.
const UNTRADEABLE_MILESTONES: RegExp[] = [
  /^(fire cape|infernal cape)$/i,
  /^imbued saradomin cape$/i,
  /^ardougne cloak \d$/i,
  /^fighter torso$/i,
  /^(barrows gloves|ferocious gloves)$/i,
  /^void (knight |elite |melee |range |mage )?(top|robe|gloves|knight helm)/i,
  /^(quest point cape|achievement diary cape|music cape|champion's cape|max cape|completionist cape)\(t\)?$/i,
  /^(crafting|magic|attack|strength|defence|hitpoints|ranged|prayer|thieving|slayer|fletching|fishing|mining|smithing|woodcutting|firemaking|cooking|herblore|farming|runecraft|construction|hunter|agility) cape\(?t?\)?$/i,
  /^(karamja gloves|falador shield|morytania legs|desert amulet|kandarin headgear|fremennik sea boots|wilderness sword|varrock armour|western banner|kourend headgear|explorer's ring|ardougne cloak) \d$/i,
  /^(graceful) (hood|cape|top|legs|gloves|boots)$/i,
  /^(crystal helm|crystal body|crystal legs|bow of faerdhinen)/i,
  /^(slayer helmet|black mask)/i,
  /^(rada's blessing|drakan's medallion|royal seed pod|ring of endurance|amulet of the damned)/i
];

export function computeStackScore(tabs: OrganizedTab[]): StackScore {
  const items: OrganizedItem[] = tabs.flatMap((t) => t.items);

  // Wealth — log10 normalised to 1B = 100.
  const totalValue = items.reduce((s, it) => s + it.stackValue, 0);
  const wealth = totalValue <= 0
    ? 0
    : Math.min(100, (Math.log10(Math.max(1, totalValue)) / Math.log10(1_000_000_000)) * 100);

  // Diversity — distinct items / 500.
  const diversity = Math.min(100, (items.length / 500) * 100);

  // Untradeable Index — milestone items / 20.
  const milestoneHits = items.filter((it) =>
    UNTRADEABLE_MILESTONES.some((re) => re.test(it.name))
  ).length;
  const untradeable = Math.min(100, (milestoneHits / 20) * 100);

  // Density — fraction of items with stack value ≥ 1M.
  const heavy = items.filter((it) => it.stackValue >= 1_000_000).length;
  const density = items.length === 0
    ? 0
    : Math.min(100, (heavy / Math.max(1, items.length)) * 200); // 50% heavy = 100

  const total = Math.round(
    wealth * 0.30 +
    diversity * 0.25 +
    untradeable * 0.25 +
    density * 0.20
  );

  return {
    total: Math.max(0, Math.min(100, total)),
    components: {
      wealth: Math.round(wealth),
      diversity: Math.round(diversity),
      untradeable: Math.round(untradeable),
      density: Math.round(density)
    }
  };
}

// Tier label for color/badge styling. Mirrors OSRS skill cape thresholds.
export function scoreTier(score: number): { label: string; color: string } {
  // Monochrome with mint accent for top tiers — matches the Linear/Vercel brand.
  // Tier name carries the personality; colour is restrained so the number reads.
  if (score >= 90) return { label: "Mythical",  color: "var(--color-accent)" };
  if (score >= 75) return { label: "Legendary", color: "var(--color-accent)" };
  if (score >= 60) return { label: "Master",    color: "var(--color-accent-soft)" };
  if (score >= 45) return { label: "Skilled",   color: "var(--color-text)" };
  if (score >= 30) return { label: "Capable",   color: "var(--color-text)" };
  if (score >= 15) return { label: "Novice",    color: "var(--color-text-dim)" };
  return            { label: "Starter",   color: "var(--color-text-muted)" };
}
