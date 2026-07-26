// DPS calculator for OSRS.
//
// Formula (simplified, matches oldschool.runescape.wiki/w/Damage_per_second):
//
//   effective_str   = floor(((strength * prayer_str) + style_bonus) * void_str_mod) + 8
//   max_hit         = floor((effective_str * (str_bonus + 64)) / 640) * damage_modifiers
//   effective_atk   = floor(((attack * prayer_atk) + style_bonus) * void_atk_mod) + 8
//   attack_roll     = effective_atk * (atk_bonus + 64)
//   defence_roll    = (defender_level + 9) * (defender_style_bonus + 64)
//   hit_chance      = attack_roll > defence_roll
//                       ? 1 - (defence_roll + 2) / (2 * (attack_roll + 1))
//                       : attack_roll / (2 * (defence_roll + 1))
//   dps             = hit_chance * (max_hit + 1) / 2 / (weapon_speed * 0.6)
//
// Levels: supplied by the caller. When none are, the engine falls back to a
// maxed account and says so — see MAXED_STATS below. No salve / slayer helm
// bonus unless detected.

import { bossHasAttribute, type Boss } from "./bosses";
import type { CombatStyle, GearItem } from "./gear";
import { isRangedAmmo } from "./gear";

// Single-slot fill for a setup. weapon may include the shield slot.
export interface Setup {
  weapon?: GearItem;
  head?: GearItem;
  cape?: GearItem;
  neck?: GearItem;
  ammo?: GearItem;
  body?: GearItem;
  shield?: GearItem;
  legs?: GearItem;
  hands?: GearItem;
  feet?: GearItem;
  ring?: GearItem;
}

/**
 * The account the numbers are for.
 *
 * This used to be a module constant of 99s with no way to pass anything else,
 * so every kill time on /dps was computed for a maxed account and handed to
 * whoever was reading — including the 85-Attack player the page exists to
 * advise. Prayer is in here because it decides which offensive prayer the
 * player actually has, which the old code assumed unconditionally.
 */
export interface CombatStats {
  attack: number;
  strength: number;
  defence: number;
  ranged: number;
  magic: number;
  prayer: number;
}

/**
 * The documented fallback when the caller has no levels.
 *
 * Kept rather than refusing to compute, because /dps has to work before an
 * account is attached — the catalogue standing on its own is the whole reason
 * the boss roster exists. The obligation that comes with it is that the UI says
 * whose numbers these are; a maxed figure presented as the player's own is the
 * failure this type exists to end.
 */
export const MAXED_STATS: CombatStats = {
  attack: 99,
  strength: 99,
  defence: 99,
  ranged: 99,
  magic: 99,
  prayer: 99
};

/** Extracts what the engine needs from a Hiscores/plugin skill list. */
export function combatStatsFromSkills(
  skills: ReadonlyArray<{ name: string; level: number }> | null | undefined
): CombatStats | null {
  if (!skills?.length) return null;
  const level = (name: string): number | null => {
    const match = skills.find((skill) => skill.name.toLowerCase() === name);
    return match && match.level > 0 ? match.level : null;
  };
  const attack = level("attack");
  const strength = level("strength");
  const ranged = level("ranged");
  const magic = level("magic");
  // Partial rows are worse than none: filling the gaps with 99s would put the
  // exact fiction we are removing back in, one stat at a time.
  if (attack === null || strength === null || ranged === null || magic === null) return null;
  return {
    attack,
    strength,
    ranged,
    magic,
    defence: level("defence") ?? 1,
    prayer: level("prayer") ?? 1
  };
}

interface PrayerBoost {
  meleeAtk: number;
  meleeStr: number;
  rangedAtk: number;
  rangedStr: number;
  magicAtk: number;
  /** Additive share, e.g. 0.04 for Augury's +4%. */
  magicDmg: number;
}

/**
 * The best offensive prayer the account can actually use, per style.
 *
 * Levels and percentages read off oldschool.runescape.wiki/w/Prayer. The old
 * code hardcoded Piety, Rigour and Augury for everyone, which inflates a
 * sub-70-Prayer account's damage by up to 23% on top of the maxed levels it was
 * already assuming.
 *
 * Two honest caveats, both in the permissive direction. Rigour and Augury also
 * need their Chambers of Xeric scroll, and Piety and Chivalry need Knight
 * Waves; none of that is visible to us, so the Prayer level is treated as
 * sufficient. And we assume the prayer is on for the whole fight, which is the
 * standard convention for a DPS figure.
 */
function prayerBoost(stats: CombatStats): PrayerBoost {
  const p = stats.prayer;

  let meleeAtk = 1;
  let meleeStr = 1;
  if (p >= 70 && stats.defence >= 70) {
    meleeAtk = 1.20; meleeStr = 1.23;            // Piety
  } else if (p >= 60 && stats.defence >= 65) {
    meleeAtk = 1.15; meleeStr = 1.18;            // Chivalry
  } else {
    // Separate attack and strength prayers, which stack with each other.
    if (p >= 34) meleeAtk = 1.15;                // Incredible Reflexes
    else if (p >= 16) meleeAtk = 1.10;           // Improved Reflexes
    else if (p >= 7) meleeAtk = 1.05;            // Clarity of Thought
    if (p >= 31) meleeStr = 1.15;                // Ultimate Strength
    else if (p >= 13) meleeStr = 1.10;           // Superhuman Strength
    else if (p >= 4) meleeStr = 1.05;            // Burst of Strength
  }

  let rangedAtk = 1;
  let rangedStr = 1;
  if (p >= 74) { rangedAtk = 1.20; rangedStr = 1.23; }      // Rigour
  else if (p >= 44) { rangedAtk = 1.15; rangedStr = 1.15; } // Eagle Eye
  else if (p >= 26) { rangedAtk = 1.10; rangedStr = 1.10; } // Hawk Eye
  else if (p >= 8) { rangedAtk = 1.05; rangedStr = 1.05; }  // Sharp Eye

  let magicAtk = 1;
  let magicDmg = 0;
  if (p >= 77) { magicAtk = 1.25; magicDmg = 0.04; }        // Augury
  else if (p >= 45) { magicAtk = 1.15; magicDmg = 0.02; }   // Mystic Might
  else if (p >= 27) { magicAtk = 1.10; magicDmg = 0.01; }   // Mystic Lore
  else if (p >= 9) { magicAtk = 1.05; }                     // Mystic Will

  return { meleeAtk, meleeStr, rangedAtk, rangedStr, magicAtk, magicDmg };
}

// Style stance bonuses (we assume controlled/aggressive maxes for each style).
const STYLE_BONUS = {
  attack: 3,
  strength: 3,
  defence: 3,
  ranged: 3,
  magic: 0
};

export interface DpsBreakdown {
  style: CombatStyle;
  weapon: GearItem;
  maxHit: number;
  hitChance: number;     // 0-1
  dps: number;           // damage per second
  ttk: number;           // time to kill in seconds
  setup: Setup;
  gearScore: number;     // sum of effective bonuses, for ranking
  /** Whose account these numbers describe. Carried so the UI can say so. */
  stats: CombatStats;
}

// Sum the gear bonuses across a setup, restricted to a style.
function sumBonuses(setup: Setup, style: CombatStyle): {
  atk: number;        // attack roll bonus for this style
  str: number;        // strength bonus (melee str OR ranged str)
  magicDamage: number;
  prayer: number;
} {
  let atk = 0;
  let str = 0;
  let magicDamage = 0;
  let prayer = 0;
  const slots: (keyof Setup)[] = ["weapon","head","cape","neck","ammo","body","shield","legs","hands","feet","ring"];
  for (const k of slots) {
    const g = setup[k];
    if (!g) continue;
    if (style === "magic") {
      atk += g.attack.magic ?? 0;
      magicDamage += g.other?.magicDamage ?? 0;
    } else if (style === "ranged") {
      atk += g.attack.ranged ?? 0;
      str += g.other?.rangedStrength ?? 0;
    } else {
      // Melee style: pick the matching attack bonus
      atk += g.attack[style] ?? 0;
      str += g.other?.strength ?? 0;
    }
    prayer += g.other?.prayer ?? 0;
  }
  return { atk, str, magicDamage, prayer };
}

function maxHitMelee(setup: Setup, style: CombatStyle, stats: CombatStats, prayer: PrayerBoost): number {
  const { str } = sumBonuses(setup, style);
  const effectiveStr = Math.floor((stats.strength * prayer.meleeStr) + STYLE_BONUS.strength) + 8;
  return Math.floor((effectiveStr * (str + 64)) / 640);
}

function maxHitRanged(setup: Setup, stats: CombatStats, prayer: PrayerBoost): number {
  const { str } = sumBonuses(setup, "ranged");
  const effective = Math.floor((stats.ranged * prayer.rangedStr) + STYLE_BONUS.ranged) + 8;
  return Math.floor((effective * (str + 64)) / 640);
}

function maxHitMagic(setup: Setup, stats: CombatStats, prayer: PrayerBoost): number {
  // Base spell damage depends on the staff. For powered staves (sang, trident,
  // shadow) the base scales with magic level. We approximate with weapon-based
  // base hits.
  if (!setup.weapon) return 0;
  const magic = stats.magic;
  let base = 0;
  if (/tumeken's shadow/i.test(setup.weapon.name)) base = Math.floor((magic / 3) + 1);
  // The scaling formulas below are only defined at or above each staff's own
  // Magic requirement; under it they go negative and, before this clamp, a
  // low-Magic account reading a Sanguinesti staff produced a negative max hit
  // and a nonsense kill time rather than an obviously-unusable one.
  else if (/sanguinesti staff/i.test(setup.weapon.name)) base = Math.max(1, Math.floor((magic - 75) / 3) + 15);
  else if (/trident of the seas/i.test(setup.weapon.name)) base = Math.max(1, Math.floor((magic - 77) / 3) + 10);
  else if (/trident of the swamp/i.test(setup.weapon.name)) base = Math.max(1, Math.floor((magic - 77) / 3) + 13);
  else if (/harmonised nightmare staff/i.test(setup.weapon.name)) base = 33; // approx with Fire Surge
  else if (/kodai/i.test(setup.weapon.name)) base = 33; // assume Fire Surge
  else base = spellBaseForMagicLevel(magic);
  const { magicDamage } = sumBonuses(setup, "magic");
  return Math.floor(base * (1 + magicDamage + prayer.magicDmg));
}

/**
 * Best standard-spellbook combat spell the account can cast.
 *
 * This was a flat 28 — the Fire Surge base — for everyone, so a 40-Magic
 * account casting Fire Strike was credited with more than twice the damage it
 * can do. Levels and base hits from the standard spellbook.
 */
function spellBaseForMagicLevel(magic: number): number {
  if (magic >= 95) return 28; // Fire Surge
  if (magic >= 92) return 27; // Water Surge
  if (magic >= 89) return 26; // Earth Surge
  if (magic >= 86) return 25; // Air Surge
  if (magic >= 75) return 24; // Fire Wave
  if (magic >= 70) return 22; // Water Wave
  if (magic >= 65) return 21; // Earth Wave
  if (magic >= 62) return 20; // Air Wave
  if (magic >= 59) return 16; // Fire Blast
  if (magic >= 56) return 15; // Water Blast
  if (magic >= 53) return 14; // Earth Blast
  if (magic >= 41) return 13; // Air Blast
  if (magic >= 35) return 12; // Fire Bolt
  if (magic >= 31) return 11; // Water Bolt
  if (magic >= 29) return 10; // Earth Bolt
  if (magic >= 17) return 9;  // Air Bolt
  if (magic >= 13) return 8;  // Fire Strike
  if (magic >= 9) return 6;   // Water Strike
  if (magic >= 5) return 4;   // Earth Strike
  return 2;                   // Wind Strike
}

function maxHit(setup: Setup, style: CombatStyle, stats: CombatStats, prayer: PrayerBoost): number {
  if (style === "magic") return maxHitMagic(setup, stats, prayer);
  if (style === "ranged") return maxHitRanged(setup, stats, prayer);
  return maxHitMelee(setup, style, stats, prayer);
}

function attackRoll(setup: Setup, style: CombatStyle, stats: CombatStats, prayer: PrayerBoost): number {
  const { atk } = sumBonuses(setup, style);
  let effective: number;
  if (style === "magic") {
    effective = Math.floor((stats.magic * prayer.magicAtk) + STYLE_BONUS.magic) + 8;
  } else if (style === "ranged") {
    effective = Math.floor((stats.ranged * prayer.rangedAtk) + STYLE_BONUS.ranged) + 8;
  } else {
    effective = Math.floor((stats.attack * prayer.meleeAtk) + STYLE_BONUS.attack) + 8;
  }
  return effective * (atk + 64);
}

function defenceRoll(boss: Boss, style: CombatStyle): number {
  const def = style === "magic"
    ? boss.magicLevel ?? boss.defenceLevel
    : boss.defenceLevel;
  const bonus = boss.defenceBonuses[style];
  return (def + 9) * (bonus + 64);
}

function hitChance(atkRoll: number, defRoll: number): number {
  if (atkRoll > defRoll) {
    return 1 - (defRoll + 2) / (2 * (atkRoll + 1));
  }
  return atkRoll / (2 * (defRoll + 1));
}

// Some weapons have damage modifiers that aren't gear-stat-based.
function applyWeaponSpecial(setup: Setup, style: CombatStyle, max: number, hc: number, boss: Boss): { max: number; hc: number } {
  if (!setup.weapon) return { max, hc };
  const name = setup.weapon.name.toLowerCase();

  // Twisted bow vs high-magic targets — scales hit chance + max significantly
  if (name.includes("twisted bow") && boss.magicLevel) {
    const m = Math.min(250, boss.magicLevel);
    const accFactor = 1 + (m * 2 / 100) - (Math.pow(m - 140, 2) / 100);
    const dmgFactor = 1 + (m * 3 / 100) - (Math.pow(m - 140, 2) / 100);
    return {
      max: Math.floor(max * Math.max(1, Math.min(2.5, dmgFactor))),
      hc: Math.min(1, hc * Math.max(1, Math.min(1.4, accFactor)))
    };
  }

  // Tumeken's shadow — 3x magic accuracy + damage (1.5x at ToA — keep generic)
  if (name.includes("tumeken's shadow")) {
    return { max: Math.floor(max * 3), hc: Math.min(1, hc * 1.5) };
  }

  // Scythe of vitur — up to 3 hits per swing.
  //
  // The extra hits only land on targets at least 2x2. Against a 1x1 the scythe
  // hits once, and this used to hand out 1.75x regardless — a flat 75% damage
  // overstatement on every small target in the roster. Target size now comes
  // from the wiki (Boss.size), so the branch is a fact rather than a habit.
  if (name.includes("scythe of vitur")) {
    // Wiki: hit 1 full, hit 2 half, hit 3 quarter.
    const size = boss.size ?? 1;
    const multiplier = size >= 3 ? 1.75 : size === 2 ? 1.5 : 1;
    return { max: Math.floor(max * multiplier), hc };
  }

  // Salve (ei) vs undead.
  //
  // This used to read /vorkath|skotizo|barrows|zombi/i over the boss NAME,
  // which is a guess wearing a regex. It gave the bonus to Skotizo — a demon —
  // and withheld it from Vet'ion and Calvar'ion, which are undead. The wiki
  // publishes the attribute; Boss.attributes carries it.
  if (setup.neck?.name.toLowerCase().includes("salve amulet(ei)") && isUndead(boss)) {
    return { max: Math.floor(max * 1.20), hc: Math.min(1, hc * 1.20) };
  }

  return { max, hc };
}

function isUndead(boss: Boss): boolean {
  return bossHasAttribute(boss, "undead");
}

// Calculate DPS for a setup against a boss in a given style.
export function calcDps(
  setup: Setup,
  boss: Boss,
  style: CombatStyle,
  stats: CombatStats = MAXED_STATS
): DpsBreakdown {
  if (!setup.weapon) {
    return { style, weapon: setup.weapon!, maxHit: 0, hitChance: 0, dps: 0, ttk: Infinity, setup, gearScore: 0, stats };
  }
  const prayer = prayerBoost(stats);
  let max = maxHit(setup, style, stats, prayer);
  const atkR = attackRoll(setup, style, stats, prayer);
  const defR = defenceRoll(boss, style);
  let hc = hitChance(atkR, defR);
  ({ max, hc } = applyWeaponSpecial(setup, style, max, hc, boss));
  const speedTicks = setup.weapon.speed ?? 4;
  const dps = (hc * (max + 1) / 2) / (speedTicks * 0.6);
  const ttk = dps > 0 ? boss.hp / dps : Infinity;
  const { atk, str, magicDamage } = sumBonuses(setup, style);
  return {
    style,
    weapon: setup.weapon,
    maxHit: max,
    hitChance: hc,
    dps,
    ttk,
    setup,
    gearScore: atk + str * 2 + Math.round(magicDamage * 100),
    stats
  };
}

// ── Auto-pick best setup ──────────────────────────────────────────────────

interface SlotPick {
  slot: keyof Setup;
  candidates: GearItem[];
}

// For each non-weapon slot, score the candidate's contribution to this style
// and pick the top.
function pickBestForSlot(candidates: GearItem[], style: CombatStyle): GearItem | undefined {
  if (candidates.length === 0) return undefined;
  return candidates.slice().sort((a, b) => {
    const scoreA = slotScore(a, style);
    const scoreB = slotScore(b, style);
    return scoreB - scoreA;
  })[0];
}

function slotScore(g: GearItem, style: CombatStyle): number {
  const prayerWeight = (g.other?.prayer ?? 0) * 0.5; // small tiebreaker for prayer
  if (style === "magic") {
    return (g.attack.magic ?? 0) * 1 + (g.other?.magicDamage ?? 0) * 100 + prayerWeight;
  }
  if (style === "ranged") {
    return (g.attack.ranged ?? 0) * 0.5 + (g.other?.rangedStrength ?? 0) * 2 + prayerWeight;
  }
  // Melee: weight strength higher than offence
  return (g.attack[style] ?? 0) * 0.5 + (g.other?.strength ?? 0) * 2 + prayerWeight;
}

// Auto-pick the best setup for a given style from the player's owned gear.
export function autoSetup(ownedItems: GearItem[], style: CombatStyle): Setup {
  // Group by slot, strictly. Items never appear in slots they don't belong to.
  const bySlot = new Map<string, GearItem[]>();
  for (const g of ownedItems) {
    if (!bySlot.has(g.slot)) bySlot.set(g.slot, []);
    bySlot.get(g.slot)!.push(g);
  }

  // Pick best weapon for this style.
  const weapons = (bySlot.get("weapon") || []).filter((w) => w.weaponStyle === style);
  const weapon = weapons.slice().sort((a, b) => slotScore(b, style) - slotScore(a, style))[0];

  const setup: Setup = { weapon };

  // Style-conditional ammo: only equip actual ammo (arrows/bolts/darts)
  // for ranged setups. For melee/magic, prefer non-ammo prayer-bonus items
  // (Rada's blessing) which also occupy the ammo slot.
  const ammoCandidates = (bySlot.get("ammo") || []).filter((g) => {
    if (style === "ranged") {
      // Ranged weapons typically need matching ammo type. Blowpipe needs darts,
      // bows need arrows, crossbows need bolts. For v1 we pick "best ranged
      // strength ammo" without enforcing weapon-ammo compatibility.
      return isRangedAmmo(g);
    }
    // Non-ranged styles: skip actual ranged ammo entirely.
    return !isRangedAmmo(g);
  });
  setup.ammo = pickBestForSlot(ammoCandidates, style);

  // Other slots (strict — never re-purpose a ring as boots etc.).
  const slots: Array<keyof Setup> = ["head","cape","neck","body","legs","hands","feet","ring"];
  for (const slot of slots) {
    setup[slot] = pickBestForSlot(bySlot.get(slot) || [], style);
  }

  // Shield only if weapon is not 2H
  if (weapon && !weapon.twoHanded) {
    setup.shield = pickBestForSlot(bySlot.get("shield") || [], style);
  }

  return setup;
}

// Best style + setup for a given boss
export function bestStyleAndSetup(
  ownedItems: GearItem[],
  boss: Boss,
  stats: CombatStats = MAXED_STATS
): DpsBreakdown {
  const candidates = allStyleBreakdowns(ownedItems, boss, stats);
  candidates.sort((a, b) => b.dps - a.dps);
  return candidates[0] ?? {
    style: "slash",
    weapon: { id: 0, name: "(no weapon found)", slot: "weapon", attack: { stab: 0, slash: 0, crush: 0, magic: 0, ranged: 0 } },
    maxHit: 0, hitChance: 0, dps: 0, ttk: Infinity,
    setup: {}, gearScore: 0, stats
  };
}

// All style breakdowns for a boss — used by the DPS UI to show melee/range/magic
// side by side. Returns only styles where the player has a usable weapon.
// Melee is summarised by its highest of stab/slash/crush so the user sees one
// "Melee" entry instead of three.
export function allStyleBreakdowns(
  ownedItems: GearItem[],
  boss: Boss,
  stats: CombatStats = MAXED_STATS
): DpsBreakdown[] {
  const meleeStyles: CombatStyle[] = ["stab", "slash", "crush"];
  const out: DpsBreakdown[] = [];

  let bestMelee: DpsBreakdown | null = null;
  for (const style of meleeStyles) {
    const setup = autoSetup(ownedItems, style);
    if (!setup.weapon) continue;
    const d = calcDps(setup, boss, style, stats);
    if (!bestMelee || d.dps > bestMelee.dps) bestMelee = d;
  }
  if (bestMelee) out.push(bestMelee);

  for (const style of ["ranged", "magic"] as CombatStyle[]) {
    const setup = autoSetup(ownedItems, style);
    if (!setup.weapon) continue;
    out.push(calcDps(setup, boss, style, stats));
  }
  return out;
}
