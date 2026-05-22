// Skill-gated gear upgrade suggestions. For each tier we know:
//  - the item ID + canonical name (used to match against the player's bank)
//  - skill + min-level required to use it
//  - rough GE price band (live price merged at runtime)
//  - which "slot" the upgrade belongs to (broad bucket, not literal equip slot)
//
// At runtime we pick the top 3 upgrades for the player by:
//   1. Filter upgrades where the player has the skill levels
//   2. Filter out items already in their bank (by id)
//   3. Within each bucket, pick the highest-level upgrade they qualify for
//   4. Sort the resulting list by "impact" (level gate) and trim to 3
//
// Conservative on purpose — we'd rather under-suggest than send someone after
// a Tbow they'll never afford. The "budget < 10M" feel is baked into the
// curation order (cheap meaningful upgrades come first).

import type { OrganizedItem } from "./organizer";
import type { HiscoreSkill } from "./hiscores";

export type UpgradeBucket =
  | "Melee weapon"
  | "Range weapon"
  | "Magic weapon"
  | "Helm"
  | "Body"
  | "Legs"
  | "Cape"
  | "Boots"
  | "Gloves"
  | "Ring"
  | "Amulet"
  | "Utility";

export interface Upgrade {
  id: number;
  name: string;
  bucket: UpgradeBucket;
  // Required skill levels — all must be met.
  reqs: Array<{ skill: string; level: number }>;
  // Approximate market value bucket. We override with live GE prices when
  // available. Used as a fallback + to gate "show only budget" suggestions.
  approxPrice: number;
  why?: string;        // 1-line reason — shown in the suggestion card
}

export const UPGRADES: Upgrade[] = [
  // ── Melee weapons (ordered roughly by tier within the bucket) ────────────
  { id: 1333,  name: "Rune scimitar",       bucket: "Melee weapon", reqs: [{ skill: "Attack", level: 40 }],  approxPrice: 15_000,    why: "Workhorse slash weapon — first real upgrade after addy." },
  { id: 4587,  name: "Dragon scimitar",     bucket: "Melee weapon", reqs: [{ skill: "Attack", level: 60 }],  approxPrice: 100_000,   why: "Best 60-attack slash weapon — pre-whip staple." },
  { id: 4151,  name: "Abyssal whip",        bucket: "Melee weapon", reqs: [{ skill: "Attack", level: 70 }],  approxPrice: 1_800_000, why: "Slash weapon backbone for slayer + many low-tier bosses." },
  { id: 12006, name: "Abyssal tentacle",    bucket: "Melee weapon", reqs: [{ skill: "Attack", level: 75 }],  approxPrice: 16_000_000,why: "Whip + Kraken tentacle — flat damage upgrade over whip." },
  { id: 28688, name: "Voidwaker",           bucket: "Melee weapon", reqs: [{ skill: "Attack", level: 75 }],  approxPrice: 90_000_000,why: "Replaces dragon claws as the meta spec weapon." },
  { id: 22324, name: "Ghrazi rapier",       bucket: "Melee weapon", reqs: [{ skill: "Attack", level: 75 }],  approxPrice: 105_000_000,why:"Best-in-slot stab for many endgame raids." },
  // ── Range weapons ────────────────────────────────────────────────────────
  { id: 9185,  name: "Rune crossbow",       bucket: "Range weapon", reqs: [{ skill: "Ranged", level: 61 }],  approxPrice: 18_000,    why: "Cheap + accurate. Use with broad bolts for slayer." },
  { id: 12926, name: "Toxic blowpipe",      bucket: "Range weapon", reqs: [{ skill: "Ranged", level: 75 }],  approxPrice: 4_800_000, why: "DPS king under 100m budget. Use with mith/adamant darts." },
  { id: 11785, name: "Armadyl crossbow",    bucket: "Range weapon", reqs: [{ skill: "Ranged", level: 70 }],  approxPrice: 45_000_000,why: "Spec weapon for boss damage spikes." },
  { id: 22547, name: "Zaryte crossbow",     bucket: "Range weapon", reqs: [{ skill: "Ranged", level: 80 }],  approxPrice: 200_000_000,why: "Long-form range BIS — most raid bosses benefit." },
  { id: 20997, name: "Twisted bow",         bucket: "Range weapon", reqs: [{ skill: "Ranged", level: 85 }],  approxPrice: 1_500_000_000, why: "Single biggest range upgrade in the game." },
  // ── Magic weapons ────────────────────────────────────────────────────────
  { id: 11907, name: "Trident of the seas", bucket: "Magic weapon", reqs: [{ skill: "Magic", level: 75 }],   approxPrice: 200_000,   why: "Massive magic upgrade once you have charges." },
  { id: 12899, name: "Trident of the swamp",bucket: "Magic weapon", reqs: [{ skill: "Magic", level: 75 }],   approxPrice: 1_500_000, why: "Higher max hit + cheaper charge cost than seas." },
  { id: 11787, name: "Staff of light",      bucket: "Magic weapon", reqs: [{ skill: "Magic", level: 75 }],   approxPrice: 25_000_000,why: "Strong autocast + ironman-friendly." },
  { id: 24417, name: "Sanguinesti staff",   bucket: "Magic weapon", reqs: [{ skill: "Magic", level: 82 }],   approxPrice: 80_000_000,why: "Heals + huge magic damage at TOB / late-game slayer." },
  { id: 24424, name: "Tumeken's shadow",    bucket: "Magic weapon", reqs: [{ skill: "Magic", level: 85 }],   approxPrice: 1_700_000_000, why: "Magic Tbow. Triples gear + base magic damage." },
  // ── Helms ────────────────────────────────────────────────────────────────
  { id: 11865, name: "Slayer helmet (i)",   bucket: "Helm", reqs: [{ skill: "Slayer", level: 55 }, { skill: "Defence", level: 10 }], approxPrice: 0, why: "Best slayer-task helm. Buy at the Vampyric helm at NMZ if Defence-pure." },
  { id: 11774, name: "Serpentine helm",     bucket: "Helm", reqs: [{ skill: "Slayer", level: 75 }, { skill: "Defence", level: 50 }], approxPrice: 4_500_000, why: "Poison immunity + best strength helm under endgame." },
  { id: 21018, name: "Helm of neitiznot",   bucket: "Helm", reqs: [{ skill: "Defence", level: 55 }], approxPrice: 60_000, why: "Free prayer bonus + strength bonus. Quest reward — get it early." },
  { id: 26382, name: "Torva full helm",     bucket: "Helm", reqs: [{ skill: "Defence", level: 80 }], approxPrice: 130_000_000, why: "Best non-raid melee helm." },
  // ── Body ─────────────────────────────────────────────────────────────────
  { id: 10551, name: "Fighter torso",       bucket: "Body", reqs: [{ skill: "Attack", level: 1 }],   approxPrice: 0, why: "Untradeable Barbarian Assault reward — best F2P-eligible strength body." },
  { id: 11335, name: "Dragon chainbody",    bucket: "Body", reqs: [{ skill: "Defence", level: 60 }], approxPrice: 220_000, why: "Cheap melee defence + strength." },
  { id: 26384, name: "Torva platebody",     bucket: "Body", reqs: [{ skill: "Defence", level: 80 }], approxPrice: 120_000_000, why: "Best melee body in slot." },
  { id: 21295, name: "Infernal cape",       bucket: "Cape", reqs: [{ skill: "Defence", level: 1 }],  approxPrice: 0, why: "Untradeable Inferno reward — single biggest cape upgrade." },
  { id: 6570,  name: "Fire cape",           bucket: "Cape", reqs: [{ skill: "Defence", level: 1 }],  approxPrice: 0, why: "Untradeable Fight Caves reward. Pre-infernal staple." },
  // ── Boots ────────────────────────────────────────────────────────────────
  { id: 88,    name: "Climbing boots",      bucket: "Boots", reqs: [],                                approxPrice: 12_000, why: "Cheap +4 strength. First serious upgrade after rune boots." },
  { id: 13239, name: "Primordial boots",    bucket: "Boots", reqs: [{ skill: "Defence", level: 75 }], approxPrice: 30_000_000, why: "Best melee strength boots." },
  // ── Gloves ───────────────────────────────────────────────────────────────
  { id: 11138, name: "Combat bracelet",     bucket: "Gloves", reqs: [{ skill: "Crafting", level: 58 }], approxPrice: 8_500, why: "+ Hits 4 wears for cheap +6 melee stats." },
  { id: 7462,  name: "Barrows gloves",      bucket: "Gloves", reqs: [{ skill: "Defence", level: 1 }], approxPrice: 0, why: "Untradeable Recipe for Disaster reward — endgame melee gloves." },
  // ── Ring ─────────────────────────────────────────────────────────────────
  { id: 6735,  name: "Berserker ring",      bucket: "Ring", reqs: [{ skill: "Defence", level: 1 }], approxPrice: 2_500_000, why: "Cheap +4 strength ring before Brimstone." },
  { id: 22975, name: "Brimstone ring",      bucket: "Ring", reqs: [{ skill: "Defence", level: 1 }], approxPrice: 6_500_000, why: "Hybrid stats — works across all three styles." },
  { id: 28307, name: "Ultor ring",          bucket: "Ring", reqs: [{ skill: "Defence", level: 1 }], approxPrice: 90_000_000, why: "Melee strength BIS — replaces Berserker imbued." },
  // ── Amulet ───────────────────────────────────────────────────────────────
  { id: 1731,  name: "Amulet of power",     bucket: "Amulet", reqs: [{ skill: "Crafting", level: 70 }], approxPrice: 7_000, why: "Balanced cheap amulet. First step after Fury." },
  { id: 6585,  name: "Amulet of fury",      bucket: "Amulet", reqs: [{ skill: "Defence", level: 1 }], approxPrice: 4_500_000, why: "All-rounder. Cheap path to relevant stats." },
  { id: 19553, name: "Amulet of torture",   bucket: "Amulet", reqs: [{ skill: "Defence", level: 1 }], approxPrice: 16_000_000, why: "Melee strength BIS for non-raid." },
  { id: 19547, name: "Necklace of anguish", bucket: "Amulet", reqs: [{ skill: "Defence", level: 1 }], approxPrice: 12_000_000, why: "Range strength BIS." },
];

export interface UpgradeSuggestion {
  upgrade: Upgrade;
  livePrice: number | null;   // null if no GE data
}

export function suggestUpgrades(
  skills: HiscoreSkill[],
  ownedIds: Set<number>,
  prices: Map<number, number> | null,
  budgetMax = Infinity
): UpgradeSuggestion[] {
  const levelOf = (name: string): number =>
    skills.find((s) => s.name.toLowerCase() === name.toLowerCase())?.level ?? 1;

  const eligible = UPGRADES.filter((u) => {
    if (ownedIds.has(u.id)) return false;
    if (!u.reqs.every((r) => levelOf(r.skill) >= r.level)) return false;
    const livePrice = prices?.get(u.id) ?? u.approxPrice;
    if (livePrice > budgetMax) return false;
    return true;
  });

  // Within each bucket, keep the highest-tier one the player qualifies for.
  const bestPerBucket = new Map<UpgradeBucket, Upgrade>();
  for (const u of eligible) {
    const cur = bestPerBucket.get(u.bucket);
    if (!cur) {
      bestPerBucket.set(u.bucket, u);
      continue;
    }
    const curMaxLevel = Math.max(...cur.reqs.map((r) => r.level), 0);
    const newMaxLevel = Math.max(...u.reqs.map((r) => r.level), 0);
    if (newMaxLevel > curMaxLevel) bestPerBucket.set(u.bucket, u);
  }

  const suggestions: UpgradeSuggestion[] = [...bestPerBucket.values()].map((u) => ({
    upgrade: u,
    livePrice: prices?.get(u.id) ?? null
  }));

  // Rank by max-required level desc — higher gates are more "earned" upgrades.
  // Then by price asc so quick wins surface alongside aspirational ones.
  suggestions.sort((a, b) => {
    const al = Math.max(...a.upgrade.reqs.map((r) => r.level), 0);
    const bl = Math.max(...b.upgrade.reqs.map((r) => r.level), 0);
    if (al !== bl) return bl - al;
    const ap = a.livePrice ?? a.upgrade.approxPrice;
    const bp = b.livePrice ?? b.upgrade.approxPrice;
    return ap - bp;
  });

  return suggestions.slice(0, 3);
}

export function ownedIdSet(items: OrganizedItem[]): Set<number> {
  return new Set(items.map((it) => it.id));
}
