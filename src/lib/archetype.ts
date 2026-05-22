// Player archetype — a self-described profile that lets the bank organizer
// reorder tabs / show different default views to match what that kind of
// player actually wants to see first.
//
// We don't change classification rules per archetype (an item's still a sword)
// but we DO change the tab ordering, default sort, and which use-case bundle
// the player gets by default.

export type Archetype = "main" | "pvm" | "skiller" | "ironman" | "unspecified";

export interface ArchetypeMeta {
  id: Archetype;
  label: string;
  description: string;
  emoji: string;
}

export const ARCHETYPES: ArchetypeMeta[] = [
  {
    id: "main",
    label: "Maxed Main",
    description: "Late-game account, everything unlocked. PvM gear, raids, lots of supplies.",
    emoji: "👑"
  },
  {
    id: "pvm",
    label: "PvMer",
    description: "Mid-to-late. Boss-focused. Gear matters more than skilling resources.",
    emoji: "⚔️"
  },
  {
    id: "skiller",
    label: "Skiller",
    description: "Skills over combat. Resources, herbs, seeds, supplies dominate the bank.",
    emoji: "🪓"
  },
  {
    id: "ironman",
    label: "Ironman",
    description: "Self-sufficient. Untradeables, quest items, every drop preserved.",
    emoji: "🛡️"
  }
];

const STORAGE_KEY = "scapestack:archetype";
const RSN_KEY = "scapestack:rsn";

export function loadArchetype(): Archetype | null {
  if (typeof window === "undefined") return null;
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (!v) return null;
    if (["main", "pvm", "skiller", "ironman", "unspecified"].includes(v)) {
      return v as Archetype;
    }
    return null;
  } catch {
    return null;
  }
}

export function saveArchetype(a: Archetype): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, a);
  } catch {}
}

export function loadStoredRsn(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(RSN_KEY);
  } catch {
    return null;
  }
}

export function saveStoredRsn(rsn: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(RSN_KEY, rsn);
  } catch {}
}

// Infer the player's archetype from their OSRS Hiscores profile.
// Returns "unspecified" if Hiscores fetch fails or we can't classify.
export interface InferenceInput {
  totalLevel: number;
  combatLevel: number;
  skills: Array<{ name: string; level: number; xp: number }>;
}

export function inferArchetype(input: InferenceInput): Archetype {
  const { totalLevel, combatLevel, skills } = input;

  // Maxed main: total >= 2200 (basically everything 99 or close)
  if (totalLevel >= 2200) return "main";

  // Skiller: very low combat but high non-combat skills
  const combatNames = new Set(["Attack", "Strength", "Defence", "Hitpoints", "Ranged", "Prayer", "Magic"]);
  const nonCombatTotal = skills
    .filter((s) => !combatNames.has(s.name) && s.name !== "Overall")
    .reduce((sum, s) => sum + Math.max(1, s.level), 0);
  const combatTotal = skills
    .filter((s) => combatNames.has(s.name))
    .reduce((sum, s) => sum + Math.max(1, s.level), 0);

  if (combatLevel < 50 && nonCombatTotal > 800) return "skiller";
  // PvMer: combat-heavy build with moderate total
  if (combatTotal >= 600 && totalLevel >= 1500 && combatLevel >= 110) return "pvm";

  return "unspecified";
}

// Tab ordering preference per archetype. Tabs not listed keep their default
// position. Returns a comparator key — lower = earlier in the tab strip.
export function tabPriority(archetype: Archetype, tabName: string): number {
  const orders: Record<Archetype, string[]> = {
    main:    ["Jewellery", "Combat", "Range", "Magic", "Prayer", "Food", "Potions", "Runes", "Skilling", "Resources", "Tools", "Quest", "Clues", "Trophy", "Untradeables", "Misc"],
    pvm:     ["Combat", "Range", "Magic", "Prayer", "Food", "Potions", "Jewellery", "Runes", "Trophy", "Untradeables", "Skilling", "Resources", "Tools", "Quest", "Clues", "Misc"],
    skiller: ["Skilling", "Resources", "Tools", "Jewellery", "Runes", "Food", "Potions", "Quest", "Combat", "Range", "Magic", "Prayer", "Clues", "Trophy", "Untradeables", "Misc"],
    ironman: ["Jewellery", "Untradeables", "Trophy", "Combat", "Range", "Magic", "Prayer", "Food", "Potions", "Runes", "Skilling", "Resources", "Tools", "Quest", "Clues", "Misc"],
    unspecified: ["Jewellery", "Combat", "Range", "Magic", "Prayer", "Food", "Potions", "Runes", "Skilling", "Resources", "Tools", "Quest", "Clues", "Trophy", "Untradeables", "Misc"]
  };
  const order = orders[archetype];
  const idx = order.indexOf(tabName);
  return idx === -1 ? 999 : idx;
}
