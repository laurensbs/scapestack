import type { Boss } from "./bosses";
import type { DpsBreakdown, Setup } from "./dps";
import { GEAR, type GearItem, type CombatStyle } from "./gear";
import type { BankHandoffItem } from "./next-bank-handoff";
import type { Preset } from "./presets";
import { bossKnowledge, bossKnowledgeSupportsSingleDps, type BossKnowledge } from "./boss-knowledge";

export interface InventorySlotPick {
  label: string;
  item: BankHandoffItem | null;
  note?: string;
  kind: InventorySlotKind;
  targetQuantity: number;
  mandatory: boolean;
  alternatives: BankHandoffItem[];
  hasEnough: boolean;
  inventorySlots: number;
}

export type InventorySlotKind =
  | "gear"
  | "ammo"
  | "runes"
  | "boost"
  | "restore"
  | "food"
  | "utility"
  | "teleport";

export interface InventoryGridSlot {
  label: string;
  item: BankHandoffItem | null;
  kind: InventorySlotKind;
  quantity: number;
  missing: boolean;
  mandatory: boolean;
}

export interface InventoryRowPick {
  label: string;
  slots: InventorySlotPick[];
}

export interface BossInventoryPlan {
  rows: InventoryRowPick[];
  inventory: InventoryGridSlot[];
  wornSetup: Setup;
  leaveWith: string;
  missingLine: string | null;
  firstTrip: string;
  firstTripRange: string;
  ownedCount: number;
  missingCount: number;
  mandatoryMissing: string[];
  canStart: boolean;
  usedSlots: number;
  slotPressure: string | null;
}

interface SlotSpec {
  label: string;
  patterns: readonly RegExp[];
  note?: string;
  kind?: InventorySlotKind;
  targetQuantity?: number;
  mandatory?: boolean;
  inventorySlots?: number;
}

interface BossLoadoutSpec {
  leaveWith: string;
  firstTrip: string;
  firstTripRange: string;
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
    leaveWith: "Anti-dragon protection, Salve, antifire, crumble undead, food and a tele.",
    firstTrip: "Start with one Vorkath kill. If freeze or acid phase feels messy, stop and fix the tab.",
    firstTripRange: "One kill · about 3-6 min",
    slots: [
      { label: "Anti-dragon shield", patterns: [/dragonfire ward/i, /dragonfire shield/i, /^anti-dragon shield$/i, /^dragonfire shield$/i], note: "Dragonfire protection", kind: "gear", mandatory: true },
      { label: "Salve amulet(ei)", patterns: [/salve amulet\(ei\)/i, /salve amulet\(e\)/i], note: "Best undead boost", kind: "gear" },
      { label: "Super antifire", patterns: [/super antifire\(4\)|extended super antifire\(4\)/i], note: "Dragonfire cover", kind: "boost", targetQuantity: 1, mandatory: true },
      { label: "Anti-venom", patterns: [/^anti-venom\+\(4\)$/i, /^anti-venom\(4\)$/i], note: "Venom cover", kind: "utility", targetQuantity: 1 },
      { label: "Chaos runes", patterns: [/^chaos rune$/i], note: "Crumble Undead", kind: "runes", targetQuantity: 2, mandatory: true },
      { label: "Earth runes", patterns: [/^earth rune$/i, /^dust rune$/i], note: "Crumble Undead", kind: "runes", targetQuantity: 2, mandatory: true },
      { label: "Air runes", patterns: [/^air rune$/i, /^dust rune$/i], note: "Crumble Undead", kind: "runes", targetQuantity: 2, mandatory: true },
      { label: "Prayer restore", patterns: PRAYER_PATTERNS, note: "Protect prayers", kind: "restore", targetQuantity: 2, inventorySlots: 2 },
      { label: "Food", patterns: FOOD_PATTERNS, note: "First kill", kind: "food", targetQuantity: 12, inventorySlots: 12 },
      { label: "Teleport", patterns: TELEPORT_PATTERNS, note: "Reset fast", kind: "teleport", targetQuantity: 1 }
    ]
  },
  zulrah: {
    leaveWith: "Mage/range switch, anti-venom, food and a quick teleport.",
    firstTrip: "Do one rotation attempt. Stop if switches feel slow, not after burning the whole tab.",
    firstTripRange: "One rotation · about 4-8 min",
    slots: [
      { label: "Magic weapon", patterns: [/trident|sanguinesti|tumeken|shadow|staff/i], note: "Mage phase", kind: "gear", mandatory: true },
      { label: "Range weapon", patterns: [/toxic blowpipe|bow of faerdhinen|twisted bow|crossbow|crystal bow/i], note: "Range phase", kind: "gear", mandatory: true },
      { label: "Anti-venom", patterns: [/^anti-venom\+\(4\)$/i, /^anti-venom\(4\)$/i, /^antidote\+\+\(4\)$/i], note: "Venom cover", kind: "utility", targetQuantity: 1, mandatory: true },
      { label: "Prayer restore", patterns: PRAYER_PATTERNS, note: "Safety", kind: "restore", targetQuantity: 2, inventorySlots: 2 },
      { label: "Food", patterns: FOOD_PATTERNS, note: "Learn the rotation", kind: "food", targetQuantity: 14, inventorySlots: 14 },
      { label: "Teleport", patterns: [/zul-andra teleport/i, ...TELEPORT_PATTERNS], note: "Reset", kind: "teleport", targetQuantity: 1 }
    ]
  },
  barrows: {
    leaveWith: "Spade, prayer, food, mage weapon and a way back out.",
    firstTrip: "Run one chest. If tunnels feel slow, upgrade teleport and prayer restore first.",
    firstTripRange: "One chest · about 8-12 min",
    slots: [
      { label: "Spade", patterns: [/^spade$/i], note: "Open crypts", kind: "utility", mandatory: true },
      { label: "Magic weapon", patterns: [/trident|sanguinesti|staff|wand/i], note: "Brothers", kind: "gear", mandatory: true },
      { label: "Prayer restore", patterns: PRAYER_PATTERNS, note: "Ahrim/Karil safety", kind: "restore", targetQuantity: 2, inventorySlots: 2 },
      { label: "Food", patterns: FOOD_PATTERNS, note: "Tunnel", kind: "food", targetQuantity: 8, inventorySlots: 8 },
      { label: "Teleport", patterns: [/barrows teleport/i, /^minigame teleport$/i, ...TELEPORT_PATTERNS], note: "Reset", kind: "teleport", targetQuantity: 1 }
    ]
  },
  hespori: {
    leaveWith: "Slash weapon, secateurs, spade, seed dibber and a little food.",
    firstTrip: "Do one Hespori kill. If you forgot tools, fix the farming tab before another seed.",
    firstTripRange: "One kill · about 3-5 min",
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
    firstTripRange: "One inventory · about 15-25 min",
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
    firstTripRange: "One kill · about 4-8 min",
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
    firstTripRange: "One kill · about 3-7 min",
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
    firstTripRange: "One short trip · about 10-15 min",
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
    firstTripRange: "One short trip · about 10-15 min",
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
  const missing = allSlots.filter((slot) => !slot.hasEnough);
  const wornSetupResult = buildWornSetup(allSlots, dps, owned);
  const mandatoryMissing = [
    ...missing.filter((slot) => slot.mandatory).map((slot) => slot.label),
    ...wornSetupResult.compatibilityMissing
  ];
  const leaveWith = spec?.leaveWith ?? knowledge.inventoryArchetype;
  const firstTrip = spec?.firstTrip ?? knowledge.stopPoint;
  const inventory = buildInventoryGrid(allSlots, wornSetupResult.setup);
  const usedSlots = requestedInventorySlots(allSlots, wornSetupResult.setup);

  return {
    rows,
    inventory,
    wornSetup: wornSetupResult.setup,
    leaveWith,
    missingLine: missing.length > 0 ? missing.slice(0, 3).map((slot) => slot.label).join(", ") : null,
    firstTrip,
    firstTripRange: spec?.firstTripRange ?? genericFirstTripRange(knowledge),
    ownedCount: allSlots.length - missing.length,
    missingCount: missing.length,
    mandatoryMissing,
    canStart: mandatoryMissing.length === 0 && (dps.dps > 0 || !bossKnowledgeSupportsSingleDps(knowledge)),
    usedSlots,
    slotPressure: usedSlots > 28 ? `${usedSlots} slots requested; trim switches or supplies before leaving.` : null
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
      note: knowledge.dpsModel === "multi-role" ? "Your role" : "Switch",
      kind: "gear" as const,
      targetQuantity: 1,
      mandatory: true,
      alternatives: [],
      hasEnough: Boolean(weapon),
      inventorySlots: 1
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
      note: "Main hit",
      kind: "gear" as const,
      targetQuantity: 1,
      mandatory: true,
      alternatives: [],
      hasEnough: dps.dps > 0,
      inventorySlots: 0
    },
    resolveSlot(styleBoost, bankItems, owned),
    resolveSlot({ label: "Prayer restore", patterns: PRAYER_PATTERNS, note: "Trip length" }, bankItems, owned),
    resolveSlot({ label: "Food", patterns: FOOD_PATTERNS, note: "Safety" }, bankItems, owned),
    resolveSlot({ label: "Teleport", patterns: TELEPORT_PATTERNS, note: "Reset" }, bankItems, owned)
  ].filter((slot) => slot.item || slot.label !== "Usable weapon" || owned.length === 0);
}

function resolveSlot(
  slot: SlotSpec,
  bankItems: BankHandoffItem[],
  owned: GearItem[]
): InventorySlotPick {
  const matches = findBankItemsByPatterns(slot.patterns, bankItems, owned);
  const item = matches[0] ?? null;
  const targetQuantity = Math.max(1, slot.targetQuantity ?? 1);
  return {
    label: slot.label,
    note: slot.note,
    item,
    kind: slot.kind ?? inferSlotKind(slot.label),
    targetQuantity,
    mandatory: slot.mandatory ?? false,
    alternatives: matches.slice(1, 4),
    hasEnough: Boolean(item && item.quantity >= targetQuantity),
    inventorySlots: slot.inventorySlots ?? defaultInventorySlots(slot.kind ?? inferSlotKind(slot.label), targetQuantity)
  };
}

function inferSlotKind(label: string): InventorySlotKind {
  const value = label.toLowerCase();
  if (value.includes("food")) return "food";
  if (value.includes("prayer") || value.includes("restore")) return "restore";
  if (value.includes("rune")) return "runes";
  if (value.includes("bolt") || value.includes("arrow") || value.includes("dart")) return "ammo";
  if (value.includes("tele")) return "teleport";
  if (value.includes("potion") || value.includes("boost") || value.includes("antifire")) return "boost";
  if (value.includes("weapon") || value.includes("shield") || value.includes("amulet")) return "gear";
  return "utility";
}

function defaultInventorySlots(kind: InventorySlotKind, targetQuantity: number): number {
  if (kind === "gear") return 1;
  if (kind === "food" || kind === "restore") return targetQuantity;
  return 1;
}

function requestedInventorySlots(slots: InventorySlotPick[], setup: Setup): number {
  const wornIds = wornSetupIds(setup);
  return slots.reduce((total, slot) => {
    if (slot.kind === "gear" && slot.item && wornIds.has(slot.item.id)) return total;
    return total + slot.inventorySlots;
  }, 0);
}

function buildInventoryGrid(slots: InventorySlotPick[], setup: Setup): InventoryGridSlot[] {
  const wornIds = wornSetupIds(setup);
  const inventory: InventoryGridSlot[] = [];

  for (const slot of slots) {
    if (slot.kind === "gear" && slot.item && wornIds.has(slot.item.id)) continue;
    const count = Math.max(0, slot.inventorySlots);
    const stacked = slot.kind === "runes" || slot.kind === "ammo";
    for (let index = 0; index < count; index += 1) {
      const available = slot.item?.quantity ?? 0;
      const missing = stacked ? !slot.hasEnough : available <= index;
      inventory.push({
        label: slot.label,
        item: missing ? null : slot.item,
        kind: slot.kind,
        quantity: stacked ? slot.targetQuantity : 1,
        missing,
        mandatory: slot.mandatory
      });
    }
  }

  const visible = inventory.slice(0, 28);
  while (visible.length < 28) {
    visible.push({
      label: "Empty",
      item: null,
      kind: "utility",
      quantity: 0,
      missing: false,
      mandatory: false
    });
  }
  return visible;
}

function wornSetupIds(setup: Setup): Set<number> {
  return new Set(
    Object.values(setup)
      .map((item) => item?.id)
      .filter((id): id is number => typeof id === "number")
  );
}

function buildWornSetup(
  slots: InventorySlotPick[],
  dps: DpsBreakdown,
  owned: GearItem[]
): { setup: Setup; compatibilityMissing: string[] } {
  const setup: Setup = { ...dps.setup };
  const gearSlots = slots.filter((slot) => slot.kind === "gear" && slot.item);

  for (const slot of gearSlots) {
    const gear = gearFromBankItem(slot.item!);
    if (!gear || gear.slot === "weapon") continue;
    setup[gear.slot] = gear;
  }

  const requiredShield = gearSlots
    .filter((slot) => slot.mandatory)
    .map((slot) => gearFromBankItem(slot.item!))
    .find((gear) => gear?.slot === "shield");
  const compatibilityMissing: string[] = [];
  if (requiredShield && setup.weapon?.twoHanded) {
    const replacement = owned
      .filter((item) => item.slot === "weapon" && !item.twoHanded && item.weaponStyle === dps.style)
      .sort((a, b) => (b.attack[dps.style] ?? 0) - (a.attack[dps.style] ?? 0))[0];
    if (replacement) setup.weapon = replacement;
    else compatibilityMissing.push(`One-handed ${styleLabel(dps.style)} weapon for ${requiredShield.name}`);
  }

  return { setup, compatibilityMissing };
}

function gearFromBankItem(item: BankHandoffItem): GearItem | null {
  return GEAR.find((gear) => gear.id === item.id || gear.name.toLowerCase() === item.name.toLowerCase()) ?? null;
}

function genericFirstTripRange(knowledge: BossKnowledge): string {
  if (knowledge.encounterType === "raid") return "One learner run · 25-45 min";
  if (knowledge.encounterType === "wave") return "One full attempt · 45-90 min";
  if (knowledge.encounterType === "group") return "One team trip · 15-25 min";
  if (knowledge.supplyPressure === "high") return "One test kill · 5-10 min";
  return "One short trip · 10-15 min";
}

function inventoryRowsContain(rows: InventoryRowPick[], slot: InventorySlotPick): boolean {
  const needle = (slot.item?.name ?? slot.label).toLowerCase();
  return rows.some((row) =>
    row.slots.some((existing) => (existing.item?.name ?? existing.label).toLowerCase() === needle)
  );
}

function findBankItemsByPatterns(
  patterns: readonly RegExp[],
  bankItems: BankHandoffItem[],
  owned: GearItem[]
): BankHandoffItem[] {
  const matches: BankHandoffItem[] = [];
  for (const pattern of patterns) {
    for (const bankMatch of bankItems.filter((item) => patternMatches(pattern, item.name))) {
      if (!matches.some((item) => item.id === bankMatch.id)) matches.push(bankMatch);
    }
    for (const gearMatch of owned.filter((item) => patternMatches(pattern, item.name))) {
      const item = bankItemFromGear(gearMatch, bankItems);
      if (!matches.some((candidate) => candidate.id === item.id)) matches.push(item);
    }
  }
  return matches.sort((a, b) => b.quantity - a.quantity);
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
