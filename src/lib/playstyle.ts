// Playstyle-aware organisation rules.
//
// The classifier decides *what* an item is; this module decides how a given
// kind of player wants those items presented. A skiller and a maxed main have
// fundamentally different banks — a skiller lives in herbs/seeds/logs, a PvMer
// in gear and supplies — so the same Skilling tab should surface different
// rows first depending on who's looking.
//
// Design choices, drawn from how the OSRS community actually banks (RuneLite
// Bank Tags, r/2007scape bank-tour threads, the Wiki "Bank" guide):
//
//  • Within-tab ordering is a *bias*, never a reclassification. An item stays
//    in its tab; we only nudge what sits near the top.
//  • Junk thresholds vary by playstyle: an ironman keeps everything (every
//    drop is earned and may be needed), a maxed main can afford to bury
//    sub-1k clutter. This matches the community consensus that ironmen should
//    never auto-hide drops.
//  • Variation between organise clicks is deliberately *subtle*: OSRS players
//    build muscle memory for their bank, so we only shuffle items of equal
//    rank within a group. Structure is rock-stable; ties break differently.

import type { Archetype } from "./archetype";

// ── Junk thresholds ─────────────────────────────────────────────────────────
// An item is junk-relegated to Misc when its unit value AND stack size both
// fall under these. Ironmen get a value of 0 → nothing is ever auto-hidden.
export interface JunkThresholds {
  value: number;
  quantity: number;
}

const JUNK_BY_ARCHETYPE: Record<Archetype, JunkThresholds> = {
  // Maxed main — late game, bank is full, happy to bury true clutter.
  main: { value: 1000, quantity: 50 },
  // PvMer — wants a tidy combat bank; clutter under 500 gp can go.
  pvm: { value: 500, quantity: 50 },
  // Skiller — low-value resources ARE the point; only hide near-worthless
  // single items so genuine skilling stock is never relegated.
  skiller: { value: 50, quantity: 5 },
  // Ironman — every item is earned and may be a quest/clue/skill input.
  // Nothing is auto-hidden, ever.
  ironman: { value: 0, quantity: 0 },
  // Unspecified — the original default behaviour.
  unspecified: { value: 500, quantity: 50 }
};

export function junkThresholds(archetype: Archetype): JunkThresholds {
  return JUNK_BY_ARCHETYPE[archetype] ?? JUNK_BY_ARCHETYPE.unspecified;
}

// ── Within-tab subtab priority ──────────────────────────────────────────────
// A per-archetype list of subtab names that should float to the top of their
// tab. Earlier in the list = higher up. Subtabs not listed keep their default
// alphabetical position after the prioritised ones.
const SUBTAB_PRIORITY: Record<Archetype, string[]> = {
  // Skiller — the gathering/production subtabs are the heart of the bank.
  skiller: [
    "Herbs", "Herblore", "Farming", "Logs", "Ore", "Bars", "Gems",
    "Crafting", "Fletching", "Runecraft", "Construction", "Hunter",
    "Skilling tools", "Raw fish"
  ],
  // PvMer — best gear and combat supplies first; weapons before armour.
  pvm: [
    "Weapons", "Armour", "Charged jewellery", "Worn amulets", "Worn rings",
    "Off-hand", "Utility"
  ],
  // Maxed main — same combat-first lean as a PvMer but lighter touch.
  main: [
    "Weapons", "Armour", "Charged jewellery", "Worn amulets", "Worn rings"
  ],
  // Ironman — collection and progression items get pride of place.
  ironman: [
    "Unique drops", "Skill capes", "Diary rewards", "Achievement",
    "Quest", "Rewards", "Pets"
  ],
  unspecified: []
};

// Returns a sort key for a subtab: lower sorts earlier. Prioritised subtabs
// get 0..N by their list position; everything else gets a constant high value
// so it sorts after, still alphabetically among itself (handled by caller).
export function subtabRank(archetype: Archetype, subtab: string): number {
  const list = SUBTAB_PRIORITY[archetype] ?? [];
  const idx = list.indexOf(subtab);
  return idx === -1 ? 1000 : idx;
}

// ── Deterministic subtle shuffle ────────────────────────────────────────────
// A small, stable hash → [0,1) used as the final tie-breaker between items of
// otherwise-equal rank. Seeding it with a per-organise number means each
// "Organize" click produces a slightly different — but still fully grouped —
// arrangement, the way a player re-tidying their bank never lays it out
// identically twice. The same seed always reproduces the same layout.
export function shuffleKey(seed: number, id: number): number {
  // xorshift-ish mix of seed + item id → deterministic pseudo-random.
  let h = (seed ^ (id * 2654435761)) >>> 0;
  h ^= h << 13; h >>>= 0;
  h ^= h >> 17;
  h ^= h << 5; h >>>= 0;
  return h / 0xffffffff;
}

// A fresh seed for a new organise pass. Callers may also pass a fixed seed
// (e.g. from a stored snapshot) to reproduce an exact layout.
export function newShuffleSeed(): number {
  return (Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0;
}
