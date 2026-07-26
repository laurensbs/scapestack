// The account Scapestack demonstrates itself with.
//
// This is not a marketing fixture. It is the same account behind "Try a sample
// plan", so anything computed from it is the real engine answering about a real
// set of levels and items — which is the whole reason direction B is credible.
// A table on the homepage built from an invented bank would break the one thing
// the design is arguing for.
//
// Two rules for changing it:
//
//   1. Keep it mid-to-late game, not best-in-slot. At BiS the engine picks
//      Tumeken's shadow for all 59 bosses and every table computed from it is
//      degenerate — every row identical, nothing learned.
//   2. Keep the levels and the bank consistent with each other. A 92-Ranged
//      account with no ranged weapon produces advice that reads as broken
//      rather than as restrained.

import type { HiscoreSkill } from "./hiscores";

/** Named so a reader knows what they are looking at in a screenshot. */
export const REFERENCE_ACCOUNT_LABEL = "Demo account";

export const REFERENCE_LEVELS: Record<string, number> = {
  Attack: 90, Defence: 80, Strength: 90, Hitpoints: 85, Ranged: 92,
  Prayer: 74, Magic: 85, Cooking: 80, Woodcutting: 70, Fletching: 80,
  Fishing: 70, Firemaking: 70, Crafting: 75, Smithing: 70, Mining: 72,
  Herblore: 78, Agility: 70, Thieving: 80, Slayer: 80, Farming: 75,
  Runecraft: 70, Hunter: 70, Construction: 75, Sailing: 34
};

export const REFERENCE_SKILL_NAMES = Object.keys(REFERENCE_LEVELS);

export const REFERENCE_BANK: Array<{ id: number; name: string }> = [
  { id: 4151, name: "Abyssal whip" },
  { id: 28688, name: "Blazing blowpipe" },
  { id: 11804, name: "Bandos godsword" },
  { id: 11832, name: "Bandos chestplate" },
  { id: 11834, name: "Bandos tassets" },
  { id: 19553, name: "Amulet of torture" },
  { id: 12954, name: "Dragon defender" },
  { id: 7462, name: "Barrows gloves" },
  { id: 21295, name: "Infernal cape" },
  { id: 21907, name: "Vorkath's head" },
  { id: 12921, name: "Magic fang" }
];

/** Hiscores-shaped rows, including the Overall total the engine expects. */
export function referenceSkills(): HiscoreSkill[] {
  const skills = REFERENCE_SKILL_NAMES.map((name, index) => ({
    id: index + 1,
    name,
    rank: 100_000,
    level: REFERENCE_LEVELS[name] ?? 1,
    xp: (REFERENCE_LEVELS[name] ?? 1) >= 99 ? 13_034_431 : 737_627
  }));
  const total = skills.reduce((sum, skill) => sum + skill.level, 0);
  return [{ id: 0, name: "Overall", rank: 100_000, level: total, xp: 0 }, ...skills];
}
