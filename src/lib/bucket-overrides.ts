// Per-item bucket overrides. Used by bucketFor() to short-circuit the regex
// patterns when a specific item ID needs to land in a non-obvious bucket.
//
// Most items are routed correctly by the regex rules in use-case-tabs.ts.
// This table is for the long-tail cases where:
//   - the regex misfires (e.g. "void" inside "voidwaker"), or
//   - an item's name is too generic to disambiguate, or
//   - community convention disagrees with the regex-derived bucket.
//
// Keep this list small and quote the reason for each override in a comment.
// If you find yourself adding many entries for one category, fix the regex
// in use-case-tabs.ts instead.

import type { UseCaseTab } from "./use-case-tabs";

export const BUCKET_OVERRIDES: Record<number, UseCaseTab> = {
  // ── Combat gear that the regex would misroute ────────────────────────────
  27690: "PvM Gear",  // Voidwaker — "void" substring matched untradeable void gear
  28997: "PvM Gear",  // Dual macuahuitl — DT2 successor, no regex anchor for it
  21003: "PvM Gear",  // Elder maul — already gets PvM Gear via "Combat" classifier, but pinned for safety
  28262: "PvM Gear",  // Ice ancient sceptre (DT2 reward variant)
  29801: "PvM Gear",  // Amulet of rancour — DT2 amulet, doesn't match "amulet of (fury|torture|…)" regex
  29804: "PvM Gear",  // Amulet of rancour (s)
  25975: "PvM Gear",  // Lightbearer — DT2 reward, regex misses it
  25485: "PvM Gear",  // Ultor ring
  25486: "PvM Gear",  // Magus ring
  25487: "PvM Gear",  // Venator ring
  25488: "PvM Gear",  // Bellator ring
  22322: "PvM Gear",  // Avernic defender — was being treated as untradeable utility
  20714: "PvM Gear",  // Tome of fire — combat off-hand, not utility
  25574: "PvM Gear",  // Tome of water
  30064: "PvM Gear",  // Tome of earth

  // ── Quest / collection capes (Quest tab, not PvM Gear) ──────────────────
  9813:  "Quest",     // Quest point cape
  13221: "Quest",     // Music cape
  21439: "Quest",     // Champion's cape
  21913: "Quest",     // Mythical cape — Dragon Slayer II reward
  19476: "Quest",     // Achievement diary cape
  13069: "Quest",     // Achievement diary cape (t)
  13280: "Quest",     // Max cape — collection cape, not gear
  // Skill capes — pure collection items, belong in Quest tab.
  9747:  "Quest",     // Attack cape
  9748:  "Quest",     // Attack cape (t)
  9750:  "Quest",     // Strength cape
  9753:  "Quest",     // Defence cape
  9756:  "Quest",     // Ranged cape
  9759:  "Quest",     // Prayer cape
  9762:  "Quest",     // Magic cape
  9765:  "Quest",     // Hitpoints cape (legacy)
  9768:  "Quest",     // Hitpoints cape

  // ── Holiday rares (Cosmetic tab, not Drops) ──────────────────────────────
  1037:  "Cosmetic",  // Bunny ears
  1959:  "Cosmetic",  // Pumpkin
  1961:  "Cosmetic",  // Easter egg

  // ── Drops (Vorkath's head + DT2 voidwaker components) ────────────────────
  2425:  "Drops",     // Vorkath's head — diary reward / drop, not gear
  27681: "Drops",     // Voidwaker hilt — unfinished spec drop
  27684: "Drops",     // Voidwaker blade
  27687: "Drops",     // Voidwaker gem
};

export function bucketOverride(id: number): UseCaseTab | undefined {
  return BUCKET_OVERRIDES[id];
}
