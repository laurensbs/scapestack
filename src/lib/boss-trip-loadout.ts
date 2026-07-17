import type { Boss } from "./bosses";
import type { DpsBreakdown } from "./dps";
import type { GearItem, CombatStyle } from "./gear";
import type { BankHandoffItem } from "./next-bank-handoff";
import type { Preset } from "./presets";
import { bossKnowledge, bossKnowledgeSupportsSingleDps, type BossKnowledge } from "./boss-knowledge";

export interface InventorySlotPick {
  label: string;
  item: BankHandoffItem | null;
  note?: string;
}

export interface InventoryRowPick {
  label: string;
  slots: InventorySlotPick[];
}

export interface BossInventoryPlan {
  rows: InventoryRowPick[];
  leaveWith: string;
  missingLine: string | null;
  firstTrip: string;
  ownedCount: number;
  missingCount: number;
}

interface SlotSpec {
  label: string;
  patterns: readonly RegExp[];
  note?: string;
}

interface BossLoadoutSpec {
  leaveWith: string;
  firstTrip: string;
  slots: SlotSpec[];
}

const FOOD_PATTERNS = [
  /^anglerfish$/i,
  /^manta ray$/i,
  /^dark crab$/i,
  /^shark$/i,
  /^cooked karambwan$/i,
  /^karambwan$/i,
  /^monkfish$/i
] as const;

const PRAYER_PATTERNS = [
  /^super restore\(4\)$/i,
  /^prayer potion\(4\)$/i,
  /^sanfew serum\(4\)$/i
] as const;

const TELEPORT_PATTERNS = [
  /^royal seed pod$/i,
  /^teleport to house$/i,
  /^house teleport$/i,
  /^varrock teleport$/i,
  /^falador teleport$/i,
  /^camelot teleport$/i,
  /^ardougne teleport$/i,
  /^ring of dueling/i,
  /^games necklace/i,
  /^amulet of glory/i,
  /^burning amulet/i,
  /^xeric's talisman/i,
  /^ectophial$/i,
  /^drakan's medallion$/i
] as const;

const STYLE_BOOSTS: Record<CombatStyle, SlotSpec> = {
  stab: {
    label: "Super combat",
    patterns: [/^super combat potion\(4\)$/i, /^super attack\(4\)$/i],
    note: "Melee pot"
  },
  slash: {
    label: "Super combat",
    patterns: [/^super combat potion\(4\)$/i, /^super strength\(4\)$/i, /^super attack\(4\)$/i],
    note: "Melee pot"
  },
  crush: {
    label: "Super combat",
    patterns: [/^super combat potion\(4\)$/i, /^super strength\(4\)$/i, /^super attack\(4\)$/i],
    note: "Melee pot"
  },
  ranged: {
    label: "Ranging potion",
    patterns: [/^ranging potion\(4\)$/i, /^bastion potion\(4\)$/i],
    note: "Range pot"
  },
  magic: {
    label: "Magic boost",
    patterns: [/^magic potion\(4\)$/i, /^forgotten brew\(4\)$/i, /^imbued heart$/i],
    note: "Mage boost"
  }
};

const BOSS_LOADOUTS: Record<string, BossLoadoutSpec> = {
  vorkath: {
    leaveWith: "Salve, antifire, anti-venom, crumble undead and a tele.",
    firstTrip: "Start with one Vorkath kill. If freeze or acid phase feels messy, stop and fix the tab.",
    slots: [
      { label: "Salve amulet(ei)", patterns: [/salve amulet\(ei\)/i], note: "Big undead boost" },
      { label: "Super antifire", patterns: [/super antifire\(4\)|extended super antifire\(4\)/i], note: "Required" },
      { label: "Anti-venom", patterns: [/^anti-venom\+\(4\)$/i, /^anti-venom\(4\)$/i], note: "Venom cover" },
      { label: "Crumble undead", patterns: [/^chaos rune$/i, /^earth rune$/i, /^dust rune$/i, /^law rune$/i], note: "Spawn" },
      { label: "Teleport", patterns: TELEPORT_PATTERNS, note: "Reset fast" }
    ]
  },
  zulrah: {
    leaveWith: "Mage/range switch, anti-venom, food and a quick teleport.",
    firstTrip: "Do one rotation attempt. Stop if switches feel slow, not after burning the whole tab.",
    slots: [
      { label: "Magic weapon", patterns: [/trident|sanguinesti|tumeken|shadow|staff/i], note: "Mage phase" },
      { label: "Range weapon", patterns: [/toxic blowpipe|bow of faerdhinen|twisted bow|crossbow/i], note: "Range phase" },
      { label: "Anti-venom", patterns: [/^anti-venom\+\(4\)$/i, /^anti-venom\(4\)$/i], note: "Venom cover" },
      { label: "Prayer restore", patterns: PRAYER_PATTERNS, note: "Safety" },
      { label: "Teleport", patterns: [/zul-andra teleport/i, ...TELEPORT_PATTERNS], note: "Reset" }
    ]
  },
  barrows: {
    leaveWith: "Spade, prayer, food, mage weapon and a way back out.",
    firstTrip: "Run one chest. If tunnels feel slow, upgrade teleport and prayer restore first.",
    slots: [
      { label: "Spade", patterns: [/^spade$/i], note: "Required" },
      { label: "Magic weapon", patterns: [/trident|sanguinesti|staff|wand/i], note: "Brothers" },
      { label: "Prayer restore", patterns: PRAYER_PATTERNS, note: "Ahrim/Karil safety" },
      { label: "Food", patterns: FOOD_PATTERNS, note: "Tunnel" },
      { label: "Teleport", patterns: [/barrows teleport/i, /^minigame teleport$/i, ...TELEPORT_PATTERNS], note: "Reset" }
    ]
  },
  hespori: {
    leaveWith: "Slash weapon, secateurs, spade, seed dibber and a little food.",
    firstTrip: "Do one Hespori kill. If you forgot tools, fix the farming tab before another seed.",
    slots: [
      { label: "Slash weapon", patterns: [/scythe|saeldor|whip|tentacle|scimitar|slash/i], note: "Main hit" },
      { label: "Secateurs", patterns: [/secateurs|magic secateurs/i], note: "Farm tool" },
      { label: "Spade", patterns: [/^spade$/i], note: "Farm tool" },
      { label: "Seed dibber", patterns: [/seed dibber/i], note: "Farm tool" },
      { label: "Food", patterns: FOOD_PATTERNS, note: "Safety" }
    ]
  },
  kraken: {
    leaveWith: "Powered staff, magic boost, prayer restore and tele out.",
    firstTrip: "Do one Kraken inventory. If charges or restores are low, restock before camping.",
    slots: [
      { label: "Powered staff", patterns: [/trident|sanguinesti|tumeken|shadow/i], note: "Main hit" },
      { label: "Occult", patterns: [/occult necklace/i], note: "Mage damage" },
      { label: "Magic boost", patterns: STYLE_BOOSTS.magic.patterns, note: "Optional" },
      { label: "Prayer restore", patterns: PRAYER_PATTERNS, note: "Trip length" },
      { label: "Teleport", patterns: TELEPORT_PATTERNS, note: "Reset" }
    ]
  },
  "phantom-muspah": {
    leaveWith: "Range/mage gear, prayer, stamina, sapphire bolts and tele out.",
    firstTrip: "Try one Muspah kill. Stop if shield phase or prayer drain feels scuffed.",
    slots: [
      { label: "Range weapon", patterns: [/bow of faerdhinen|twisted bow|crossbow|blowpipe/i], note: "Main phase" },
      { label: "Mage weapon", patterns: [/trident|sanguinesti|tumeken|shadow|staff/i], note: "Switch" },
      { label: "Sapphire bolts", patterns: [/sapphire .*bolts|sapphire bolts/i], note: "Shield" },
      { label: "Prayer restore", patterns: PRAYER_PATTERNS, note: "Drain" },
      { label: "Stamina", patterns: [/^stamina potion\(4\)$/i], note: "Movement" }
    ]
  },
  vardorvis: {
    leaveWith: "Slash weapon, combo food, prayer restore and a clean tele out.",
    firstTrip: "Do one Vardorvis kill. If axe dodges feel bad, stop instead of forcing a streak.",
    slots: [
      { label: "Slash weapon", patterns: [/scythe|saeldor|tentacle|whip|soulreaper|slash/i], note: "Main hit" },
      { label: "Spec weapon", patterns: [/voidwaker|dragon claws|burning claws|godsword/i], note: "Optional" },
      { label: "Prayer restore", patterns: PRAYER_PATTERNS, note: "Piety" },
      { label: "Food", patterns: FOOD_PATTERNS, note: "Mistakes" },
      { label: "Teleport", patterns: TELEPORT_PATTERNS, note: "Reset" }
    ]
  },
  "king-black-dragon": {
    leaveWith: "Antifire, ranged weapon, anti-poison, food and cheap risk.",
    firstTrip: "Try one KBD trip. Bank if antifire or food drops below comfort.",
    slots: [
      { label: "Antifire", patterns: [/antifire\(4\)|extended antifire\(4\)|super antifire\(4\)/i], note: "Required" },
      { label: "Anti-poison", patterns: [/anti-venom|antipoison|antidote/i], note: "Poison" },
      { label: "Range weapon", patterns: [/crossbow|bow|blowpipe/i], note: "Main hit" },
      { label: "Food", patterns: FOOD_PATTERNS, note: "Safety" },
      { label: "Teleport", patterns: [/burning amulet/i, /^games necklace/i, ...TELEPORT_PATTERNS], note: "Lair" }
    ]
  },
  kbd: {
    leaveWith: "Antifire, ranged weapon, anti-poison, food and cheap risk.",
    firstTrip: "Try one KBD trip. Bank if antifire or food drops below comfort.",
    slots: [
      { label: "Antifire", patterns: [/antifire\(4\)|extended antifire\(4\)|super antifire\(4\)/i], note: "Required" },
      { label: "Anti-poison", patterns: [/anti-venom|antipoison|antidote/i], note: "Poison" },
      { label: "Range weapon", patterns: [/crossbow|bow|blowpipe/i], note: "Main hit" },
      { label: "Food", patterns: FOOD_PATTERNS, note: "Safety" },
      { label: "Teleport", patterns: [/burning amulet/i, /^games necklace/i, ...TELEPORT_PATTERNS], note: "Lair" }
    ]
  }
};

export function buildBossInventoryPlan({
  boss,
  preset,
  bankItems,
  owned,
  dps
}: {
  boss: Boss;
  preset?: Preset;
  bankItems: BankHandoffItem[];
  owned: GearItem[];
  dps: DpsBreakdown;
}): BossInventoryPlan {
  const spec = BOSS_LOADOUTS[boss.slug];
  const knowledge = bossKnowledge(boss);
  const rows = spec
    ? [{ label: "Leave the bank with", slots: spec.slots.map((slot) => resolveSlot(slot, bankItems, owned)) }]
    : !bossKnowledgeSupportsSingleDps(knowledge) && knowledge.dpsModel !== "not-applicable"
      ? buildEncounterRows({ knowledge, bankItems, owned })
    : buildGenericRows({ preset, bankItems, owned, dps });
  const allSlots = rows.flatMap((row) => row.slots);
  const missing = allSlots.filter((slot) => !slot.item);
  const leaveWith = spec?.leaveWith ?? knowledge.inventoryArchetype;
  const firstTrip = spec?.firstTrip ?? knowledge.stopPoint;

  return {
    rows,
    leaveWith,
    missingLine: missing.length > 0 ? missing.slice(0, 3).map((slot) => slot.label).join(", ") : null,
    firstTrip,
    ownedCount: allSlots.length - missing.length,
    missingCount: missing.length
  };
}

function buildEncounterRows({
  knowledge,
  bankItems,
  owned
}: {
  knowledge: BossKnowledge;
  bankItems: BankHandoffItem[];
  owned: GearItem[];
}): InventoryRowPick[] {
  const styleWeapons = [...new Set(knowledge.combatStyles)].map((style) => {
    const weapon = bestOwnedWeaponForStyle(owned, style);
    return {
      label: `${styleLabel(style)} weapon`,
      item: weapon ? bankItemFromGear(weapon, bankItems) : null,
      note: knowledge.dpsModel === "multi-role" ? "Your role" : "Switch"
    };
  });
  const supplies = [
    resolveSlot({ label: "Prayer restore", patterns: PRAYER_PATTERNS, note: "Full run" }, bankItems, owned),
    resolveSlot({ label: "Food", patterns: FOOD_PATTERNS, note: "Mistakes" }, bankItems, owned),
    resolveSlot({ label: "Teleport", patterns: TELEPORT_PATTERNS, note: "Reset" }, bankItems, owned)
  ];
  return [
    { label: knowledge.dpsModel === "multi-role" ? "Choose your role" : "Required switches", slots: styleWeapons },
    { label: "Run supplies", slots: supplies }
  ];
}

function bestOwnedWeaponForStyle(owned: GearItem[], style: CombatStyle): GearItem | null {
  return owned
    .filter((item) => item.slot === "weapon" && item.weaponStyle === style)
    .sort((a, b) => (b.attack[style] ?? 0) - (a.attack[style] ?? 0))[0] ?? null;
}

function styleLabel(style: CombatStyle): string {
  if (style === "ranged") return "Range";
  return style.charAt(0).toUpperCase() + style.slice(1);
}

function buildGenericRows({
  preset,
  bankItems,
  owned,
  dps
}: {
  preset?: Preset;
  bankItems: BankHandoffItem[];
  owned: GearItem[];
  dps: DpsBreakdown;
}): InventoryRowPick[] {
  if (preset) {
    const rows = preset.rows.map((row) => ({
      label: row.label,
      slots: row.patterns.map((pattern) => resolveSlot({
        label: describePattern(pattern),
        patterns: [pattern]
      }, bankItems, owned))
    }));
    const extras = fallbackInventorySlots(bankItems, owned, dps)
      .filter((slot) => slot.label === "Food" || slot.label === "Teleport")
      .filter((slot) => !inventoryRowsContain(rows, slot));
    return extras.length > 0 ? [...rows, { label: "Extra supplies", slots: extras }] : rows;
  }

  return [{ label: "Leave the bank with", slots: fallbackInventorySlots(bankItems, owned, dps) }];
}

function fallbackInventorySlots(
  bankItems: BankHandoffItem[],
  owned: GearItem[],
  dps: DpsBreakdown
): InventorySlotPick[] {
  const styleBoost = STYLE_BOOSTS[dps.style];
  return [
    {
      label: dps.dps > 0 ? dps.weapon.name : "Usable weapon",
      item: dps.dps > 0 ? bankItemFromGear(dps.weapon, bankItems) : null,
      note: "Main hit"
    },
    resolveSlot(styleBoost, bankItems, owned),
    resolveSlot({ label: "Prayer restore", patterns: PRAYER_PATTERNS, note: "Trip length" }, bankItems, owned),
    resolveSlot({ label: "Food", patterns: FOOD_PATTERNS, note: "Safety" }, bankItems, owned),
    resolveSlot({ label: "Teleport", patterns: TELEPORT_PATTERNS, note: "Reset" }, bankItems, owned)
  ].filter((slot) => slot.item || slot.label !== "Usable weapon" || owned.length === 0);
}

function genericLeaveWith(dps: DpsBreakdown): string {
  if (dps.dps <= 0) return "A real weapon, food, prayer and a teleport.";
  return `${dps.weapon.name}, ${dps.style.toUpperCase()} boost, food and a teleport.`;
}

function genericFirstTrip(boss: Boss, dps: DpsBreakdown): string {
  if (boss.category === "raid") return "Scout one learner run. Do not judge the whole raid from one room.";
  if (boss.category === "wildy") return "Try one low-risk kill. Leave as soon as the trip feels exposed.";
  if (boss.category === "gwd") return "Do one inventory. Bank when minions or supplies start getting messy.";
  if (dps.hitChance < 0.55) return "Try one test kill, then upgrade accuracy before camping.";
  return "Do one short trip, then decide if it is worth camping.";
}

function resolveSlot(
  slot: SlotSpec,
  bankItems: BankHandoffItem[],
  owned: GearItem[]
): InventorySlotPick {
  return {
    label: slot.label,
    note: slot.note,
    item: findBankItemByPatterns(slot.patterns, bankItems, owned)
  };
}

function inventoryRowsContain(rows: InventoryRowPick[], slot: InventorySlotPick): boolean {
  const needle = (slot.item?.name ?? slot.label).toLowerCase();
  return rows.some((row) =>
    row.slots.some((existing) => (existing.item?.name ?? existing.label).toLowerCase() === needle)
  );
}

function findBankItemByPatterns(
  patterns: readonly RegExp[],
  bankItems: BankHandoffItem[],
  owned: GearItem[]
): BankHandoffItem | null {
  for (const pattern of patterns) {
    const bankMatch = bankItems.find((item) => patternMatches(pattern, item.name));
    if (bankMatch) return bankMatch;
    const gearMatch = owned.find((item) => patternMatches(pattern, item.name));
    if (gearMatch) return bankItemFromGear(gearMatch, bankItems);
  }
  return null;
}

function patternMatches(pattern: RegExp, value: string): boolean {
  pattern.lastIndex = 0;
  return pattern.test(value);
}

function bankItemFromGear(gear: GearItem, bankItems: BankHandoffItem[]): BankHandoffItem {
  return bankItems.find((item) => item.id === gear.id || item.name.toLowerCase() === gear.name.toLowerCase()) ?? {
    id: gear.id,
    name: gear.name,
    quantity: 1,
    unitPrice: 0,
    stackValue: 0,
    subtab: "Gear",
    slot: gear.slot,
    weight: 0
  };
}

function describePattern(re: RegExp): string {
  const src = re.source;
  const first = src.replace(/^\^|\$$/g, "").split("|")[0]
    .replace(/\\\^|\\\$/g, "")
    .replace(/[()]/g, "")
    .trim();
  return first.replace(/\b\w/g, (c) => c.toUpperCase());
}
