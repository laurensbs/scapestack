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
// Defaults: level 99 in every combat stat, full active offensive prayer
// (Piety / Rigour / Augury), no salve / slayer helm bonus unless detected.

import type { Boss } from "./bosses";
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

const STATS = {
  attack: 99,
  strength: 99,
  ranged: 99,
  magic: 99
};

// Prayers: Piety (+20% atk, +23% str), Rigour (+20% atk, +23% str range),
// Augury (+25% magic). We assume best offensive prayer in use.
const PRAYER = {
  meleeAtk: 1.20,
  meleeStr: 1.23,
  rangedAtk: 1.20,
  rangedStr: 1.23,
  magicAtk: 1.25,
  magicDmg: 1.04 // approx for magic damage bonus from prayer
};

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

function maxHitMelee(setup: Setup, style: CombatStyle): number {
  const { str } = sumBonuses(setup, style);
  const effectiveStr = Math.floor((STATS.strength * PRAYER.meleeStr) + STYLE_BONUS.strength) + 8;
  return Math.floor((effectiveStr * (str + 64)) / 640);
}

function maxHitRanged(setup: Setup): number {
  const { str } = sumBonuses(setup, "ranged");
  const effective = Math.floor((STATS.ranged * PRAYER.rangedStr) + STYLE_BONUS.ranged) + 8;
  return Math.floor((effective * (str + 64)) / 640);
}

function maxHitMagic(setup: Setup): number {
  // Base spell damage depends on the staff. For powered staves (sang, trident,
  // shadow) the base scales with magic level. We approximate with weapon-based
  // base hits.
  if (!setup.weapon) return 0;
  let base = 0;
  if (/tumeken's shadow/i.test(setup.weapon.name)) base = Math.floor((STATS.magic / 3) + 1);    // ≈ 34
  else if (/sanguinesti staff/i.test(setup.weapon.name)) base = Math.floor((STATS.magic - 75) / 3) + 15;
  else if (/trident of the seas/i.test(setup.weapon.name)) base = Math.floor((STATS.magic - 77) / 3) + 10;
  else if (/trident of the swamp/i.test(setup.weapon.name)) base = Math.floor((STATS.magic - 77) / 3) + 13;
  else if (/harmonised nightmare staff/i.test(setup.weapon.name)) base = 33; // approx with Fire Surge
  else if (/kodai/i.test(setup.weapon.name)) base = 33; // assume Fire Surge
  else base = 28; // generic surge spell
  const { magicDamage } = sumBonuses(setup, "magic");
  return Math.floor(base * (1 + magicDamage));
}

function maxHit(setup: Setup, style: CombatStyle): number {
  if (style === "magic") return maxHitMagic(setup);
  if (style === "ranged") return maxHitRanged(setup);
  return maxHitMelee(setup, style);
}

function attackRoll(setup: Setup, style: CombatStyle): number {
  const { atk } = sumBonuses(setup, style);
  let effective: number;
  if (style === "magic") {
    effective = Math.floor((STATS.magic * PRAYER.magicAtk) + STYLE_BONUS.magic) + 8;
  } else if (style === "ranged") {
    effective = Math.floor((STATS.ranged * PRAYER.rangedAtk) + STYLE_BONUS.ranged) + 8;
  } else {
    effective = Math.floor((STATS.attack * PRAYER.meleeAtk) + STYLE_BONUS.attack) + 8;
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

  // Scythe of vitur — 3 hits per swing
  if (name.includes("scythe of vitur")) {
    // Wiki: hit 1 full, hit 2 half, hit 3 quarter. Total ~1.75x max effective.
    return { max: Math.floor(max * 1.75), hc };
  }

  // Salve (ei) vs undead — doubles damage and accuracy
  if (setup.neck?.name.toLowerCase().includes("salve amulet(ei)") && isUndead(boss)) {
    return { max: Math.floor(max * 1.20), hc: Math.min(1, hc * 1.20) };
  }

  return { max, hc };
}

function isUndead(boss: Boss): boolean {
  return /vorkath|skotizo|barrows|zombi/i.test(boss.name);
}

// Calculate DPS for a setup against a boss in a given style.
export function calcDps(setup: Setup, boss: Boss, style: CombatStyle): DpsBreakdown {
  if (!setup.weapon) {
    return { style, weapon: setup.weapon!, maxHit: 0, hitChance: 0, dps: 0, ttk: Infinity, setup, gearScore: 0 };
  }
  let max = maxHit(setup, style);
  const atkR = attackRoll(setup, style);
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
    gearScore: atk + str * 2 + Math.round(magicDamage * 100)
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
export function bestStyleAndSetup(ownedItems: GearItem[], boss: Boss): DpsBreakdown {
  const candidates = allStyleBreakdowns(ownedItems, boss);
  candidates.sort((a, b) => b.dps - a.dps);
  return candidates[0] ?? {
    style: "slash",
    weapon: { id: 0, name: "(no weapon found)", slot: "weapon", attack: { stab: 0, slash: 0, crush: 0, magic: 0, ranged: 0 } },
    maxHit: 0, hitChance: 0, dps: 0, ttk: Infinity,
    setup: {}, gearScore: 0
  };
}

// All style breakdowns for a boss — used by the DPS UI to show melee/range/magic
// side by side. Returns only styles where the player has a usable weapon.
// Melee is summarised by its highest of stab/slash/crush so the user sees one
// "Melee" entry instead of three.
export function allStyleBreakdowns(ownedItems: GearItem[], boss: Boss): DpsBreakdown[] {
  const meleeStyles: CombatStyle[] = ["stab", "slash", "crush"];
  const out: DpsBreakdown[] = [];

  let bestMelee: DpsBreakdown | null = null;
  for (const style of meleeStyles) {
    const setup = autoSetup(ownedItems, style);
    if (!setup.weapon) continue;
    const d = calcDps(setup, boss, style);
    if (!bestMelee || d.dps > bestMelee.dps) bestMelee = d;
  }
  if (bestMelee) out.push(bestMelee);

  for (const style of ["ranged", "magic"] as CombatStyle[]) {
    const setup = autoSetup(ownedItems, style);
    if (!setup.weapon) continue;
    out.push(calcDps(setup, boss, style));
  }
  return out;
}
