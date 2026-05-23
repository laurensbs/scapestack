// Use-case bank tabs: how experienced OSRS players actually organise their
// banks. Instead of "Combat / Range / Magic / Skilling / …" by item type,
// items are grouped by USE — Supplies for bossing, Combat for gear, etc.
//
// Conventions from RuneTags top-saved tags + osrsadvice inspiration thread:
//   Currency  = coins, plat tokens, charged jewellery, teleports, worn ammies/rings
//   Supplies  = food + all potions + herbs + secondaries + runes + vials
//   Combat    = all gear (melee/range/magic) + ammo + slayer items
//   Skilling  = ores/bars/logs/seeds/saplings/essence/pouches/gems/hides
//   Drops     = unique boss drops, trophies, pets, third-age, holiday rares
//   Personal  = quest items, fashion, clues, diary trinkets, capes

import type { Tab as TypeTab } from "./classifier";
import type { OrganizedTab, OrganizedItem } from "./organizer";
import { layoutForTab } from "./layouts";
import { spriteIdForItem } from "./utils";
import type { Archetype } from "./archetype";
import { gearEntry as pvmGearEntry, setPieceName, type GearSlot } from "./pvm-items";
import { bucketOverride } from "./bucket-overrides";
import { keeperCategory } from "./keeper-items";
import { BANK_FILLER_ID } from "./bank-filler";

// Tuck's canonical 9-tab pattern from r/BankTabs top posts:
//   1. Teleports & jewellery (utility bags + tabs + runes)
//   2. PvM / Slayer gear (all 3 styles in one tab)
//   3. PvM / Slayer drops
//   4. Potions & Herblore pipeline
//   5. Skilling supplies & outfits
//   6. Clue outfits & rewards
//   7. Quest & untradeables
//   8. Holiday & cosmetic
//   9. Junk / Misc
export type UseCaseTab =
  | "Teleports"      // tab 1
  | "PvM Gear"       // tab 2
  | "Drops"          // tab 3
  | "Potions"        // tab 4 (incl. Herblore inputs)
  | "Skilling"       // tab 5
  | "Clue"           // tab 6
  | "Quest"          // tab 7
  | "Cosmetic"       // tab 8
  | "Misc";          // tab 9

export const USE_CASE_ORDER: UseCaseTab[] = [
  "Teleports", "PvM Gear", "Drops", "Potions",
  "Skilling", "Clue", "Quest", "Cosmetic", "Misc"
];

// Archetype-specific use-case tab order. Pull what they care about to the
// front; the rest stays in default order.
const USE_CASE_ORDER_BY_ARCHETYPE: Record<Archetype, UseCaseTab[]> = {
  pvm:         ["PvM Gear", "Potions", "Teleports", "Drops", "Skilling", "Clue", "Quest", "Cosmetic", "Misc"],
  main:        ["Teleports", "PvM Gear", "Potions", "Drops", "Skilling", "Clue", "Quest", "Cosmetic", "Misc"],
  skiller:     ["Skilling", "Teleports", "Potions", "Clue", "Quest", "PvM Gear", "Drops", "Cosmetic", "Misc"],
  ironman:     ["PvM Gear", "Drops", "Skilling", "Teleports", "Potions", "Quest", "Clue", "Cosmetic", "Misc"],
  unspecified: ["Teleports", "PvM Gear", "Drops", "Potions", "Skilling", "Clue", "Quest", "Cosmetic", "Misc"]
};

// ── PvM Gear sort logic ──────────────────────────────────────────────────────
// Layout follows the worn-equipment interface order — this is the
// "Mimikyutie" / Tuck convention that wins on every r/2007scape rate-my-bank
// screenshot. Tab flow, top → bottom:
//
//   Row A  Slayer & utility   — slayer helm, salve amulet, black mask,
//                                imbued helms (most-used row, top-left)
//   Row B  Helms              — best-in-slot melee → ranged → magic
//   Row C  Capes              — fire/infernal → ava's → imbued god capes
//   Row D  Amulets            — torture/anguish/occult → fury → strength
//   Row E  Ammo               — arrows, bolts, darts, javelins, knives
//   Row F  Weapons            — primaries (melee→range→magic) then specs,
//                                tier descending within style
//   Row G  Shields / off-hand — DFS → defenders → books → bucklers
//   Row H  Bodies             — torva/bandos/masori/ancestral, melee→r→m
//   Row I  Legs               — same style order
//   Row J  Gloves             — ferocious/barrows/zaryte/tormented
//   Row K  Boots              — primordial/pegasian/eternal/devout
//   Row L  Rings              — ultor/magus/venator/bellator/lightbearer
//   Row M  Food               — anglerfish/manta/karambwan/brew(4)
//
// Items are placed dense (no padding between rows). Visual rhythm comes from
// the per-row equipment-slot grouping, not from empty cells. References:
// osrsadvice t1283/t4918, RuneLite Inventory Setups preset order, Worn
// Equipment wiki page.

type GearRow =
  | "slayer"   // utility (slayer helm/black mask/salve amulet) — top row
  | "head" | "cape" | "neck" | "ammo" | "weapon" | "shield"
  | "body" | "legs" | "hands" | "feet" | "ring"
  | "food"
  | "other";

const GEAR_ROW_ORDER: GearRow[] = [
  "slayer", "head", "cape", "neck", "ammo", "weapon", "shield",
  "body", "legs", "hands", "feet", "ring", "food", "other"
];

type GearStyle = "melee" | "ranged" | "magic" | "neutral";

// Spec weapons cluster at the END of the weapon row. Lower index = appears
// first within the spec cluster. Canonical order per osrsadvice + voidwaker
// wiki pairing notes: DDS → claws → voidwaker → SGS → BGS → AGS → ZGS →
// granite maul → DWH → elder maul.
const PVM_SPEC_ORDER = [
  /^dragon dagger/, /dragon claws/, /voidwaker/,
  /saradomin godsword/, /bandos godsword/, /armadyl godsword/, /zamorak godsword/,
  /^granite maul/, /dragon warhammer/, /^elder maul/,
  /^dark bow/, /^dragon thrownaxe/,
  /eldritch nightmare staff/, /volatile nightmare staff/
];

// Best-in-slot ranking, by style, lower = better. Used to sort gear within
// its slot row (helms row: slayer helm/torva left of justiciar left of
// neitiznot etc.). Anything not listed falls back to classifier `weight`.
const BIS_MELEE = [
  /torva/, /justiciar/, /inquisitor/, /bandos/, /^obsidian/, /verac/, /dharok/,
  /guthan/, /torag/, /fighter torso/, /^primordial/, /^ferocious/, /barrows gloves/,
  /amulet of (?:torture|rancour|fury|strength)/, /berserker necklace/,
  /^ultor/, /lightbearer/, /berserker ring/, /brimstone ring/,
  /infernal cape/, /^fire cape/, /imbued (?:zamorak|saradomin|guthix) cape/,
  /scythe of vitur/, /^scythe/, /soulreaper axe/, /^elder maul/,
  /osmumten's? fang/, /ghrazi rapier/, /blade of saeldor/, /inquisitor's? mace/,
  /noxious halberd/, /abyssal whip/, /^whip$/, /tentacle whip/, /dragon scimitar/,
  /dragon defender/, /avernic defender/, /^dragonfire shield|^dfs$/, /^crystal shield/
];

const BIS_RANGED = [
  /masori/, /armadyl chestplate/, /armadyl helm/, /armadyl chainskirt/,
  /karil/, /^crystal (?:helm|body|legs|armour)/, /^pegasian/, /^ranger boots/,
  /necklace of anguish/, /amulet of anguish/, /ava'?s? assembler/, /ava'?s? attractor/,
  /^archers? ring/, /^venator ring/, /zaryte vambraces/,
  /twisted bow/, /zaryte crossbow/, /toxic blowpipe/, /bow of faerdhinen/,
  /armadyl crossbow/, /dragon hunter crossbow/, /^rune crossbow/, /^crystal bow/,
  /^magic shortbow/, /webweaver bow/, /craws bow/, /^chinchompa/, /^dragon thrownaxe/,
  /^twisted buckler/, /^book of law/, /^odium ward/
];

const BIS_MAGIC = [
  /ancestral/, /virtus/, /^dagon'?hai/, /^infinity/, /ahrim/, /3rd age mage/,
  /elder chaos/, /^mystic/, /^splitbark/, /bloodbark/, /swampbark/,
  /occult necklace/, /amulet of fury/, /^magus ring/, /^seers ring/,
  /tormented bracelet/, /^eternal boots/, /^infinity boots/,
  /tumeken'?s? shadow/, /sanguinesti staff/, /^trident of/, /^toxic trident/,
  /harmonised nightmare staff/, /ancient sceptre/, /kodai/, /master wand/,
  /^volatile/, /^eldritch/, /^ancient staff/, /^iban'?s? staff/,
  /elysian (?:spirit )?shield/, /spectral (?:spirit )?shield/,
  /tome of fire/, /tome of water/, /^book of (?:darkness|the dead|spell)/, /arcane (?:spirit )?shield/
];

// Determine which combat style a piece belongs to. Order: magic > ranged >
// melee > neutral, because magic robes leak "robe" patterns into other
// categories otherwise.
const STYLE_PATTERNS: Array<[GearStyle, RegExp]> = [
  ["magic", /(?:^|[ ()])(?:magic|mage|mystic|infinity|enchanted|ahrim|virtus|ancestral|dagon'?hai|3rd age mage|elder chaos|ghostly|splitbark|wizard|farseer|bloodbark|swampbark|battle-mage|battlemage|kodai|master wand|book of (?:darkness|the dead|spell|balance)|tormented bracelet|occult|magus|seers'? ring|imbued (?:zamorak|saradomin|guthix) cape|sanguinesti|sang|^trident|toxic trident|nightmare staff|tumeken|ancient sceptre|harmonised|iban'?s? staff|volatile|eldritch|ancient staff|shadow|tome of (?:fire|water)|arcane (?:spirit )?shield|elysian (?:spirit )?shield|spectral (?:spirit )?shield|eternal boots|infinity boots|3rd age robe|3rd age druidic)/i],
  ["ranged", /(?:^|[ ()])(?:range[rd]?|ranging|black d'?hide|green d'?hide|blue d'?hide|red d'?hide|royal d'?hide|karil|armadyl chestplate|armadyl chainskirt|armadyl helm|armadyl helmet|masori|crystal (?:helm|body|legs|armour)|pegasian|ranger|archer|necklace of anguish|amulet of anguish|ava'?s? (?:assembler|attractor|accumulator|device)|3rd age range|twisted (?:bow|buckler)|venator (?:bow|ring)|book of law|odium ward|bowfa|tbow|zcb|blowpipe|chinchompa|toxic blowpipe|composite bow|crystal bow|magic shortbow|craws bow|webweaver|crossbow|^bolts?$|^arrows?$|^darts?$|^javelins?$|throwing knives|thrownaxe|dragon thrownaxe|^bow$|^dorgeshuun|zaryte vambraces|^twisted buckler)/i],
  ["melee", /(?:^|[ ()])(?:melee|berserker|warrior|fighter|^helm of|verac|dharok|guthan|torag|bandos (?:tassets|chestplate|cloak|boots)|torva|fighter torso|inquisitor|justiciar|amulet of (?:strength|torture|fury|rancour)|berserker necklace|barrows gloves|primordial|ferocious|3rd age melee|ultor (?:ring)?|^scythe|scimitar|whip|tentacle|godsword|fang|rapier|saeldor|elder maul|^mace|halberd|claws|warhammer|dagger|longsword|battleaxe|dragon defender|avernic|dinh|^obsidian|dragon scimitar|dragon longsword|dragon dagger|dragon battleaxe|dragonfire shield|^dfs$|crystal shield|^granite maul)/i]
];

function gearStyle(name: string): GearStyle {
  const n = name.toLowerCase();
  for (const [style, pat] of STYLE_PATTERNS) {
    if (pat.test(n)) return style;
  }
  return "neutral";
}

const STYLE_ORDER: Record<GearStyle, number> = { melee: 0, ranged: 1, magic: 2, neutral: 3 };

// ── DB-backed gear info ──────────────────────────────────────────────────────
// Resolved metadata for a PvM gear item. DB hits are exact; misses fall back
// to regex/classifier heuristics. This eliminates style/tier ambiguity for
// the ~300 items that actually matter visually in a bank.
interface ResolvedGear {
  row: GearRow;
  style: GearStyle;
  tier: number;
  role: "primary" | "spec" | "armour" | "ammo" | "utility" | "food" | "other";
  specOrder: number;       // -1 if not a spec
  primaryOrder: number;    // -1 if not a primary
}

function resolveGear(it: OrganizedItem): ResolvedGear {
  const db = pvmGearEntry(it.id);
  const n = it.name.toLowerCase();

  // Determine row first — DB entries carry an explicit role that maps cleanly.
  let row: GearRow = "other";
  if (db) {
    if (db.role === "utility") row = "slayer";
    else if (db.role === "food") row = "food";
    else if (db.role === "ammo") row = "ammo";
    else row = db.slot;
  } else {
    // Regex fallback for items not in the DB.
    if (/^(?:slayer helm|slayer helmet|black mask|salve amulet|imbued (?:black mask|slayer)|witchwood icon|nose peg|earmuffs|spiny helmet|reinforced goggles|insulated boots|bag of salt|fungicide|rock hammer)/i.test(n)) {
      row = "slayer";
    } else if (/\b(?:saradomin brew|anglerfish|tuna potato|dark crab|manta ray|monkfish|shark|karambwan|cake|stew|pie|pizza|sea turtle)\b/.test(n)) {
      row = "food";
    } else if (/(?:^|\s)(?:arrows?|bolts?|darts?|javelins?|throwing knives?|chinchompas?|throwing axes?|thrownaxe)$/.test(n)) {
      row = "ammo";
    } else if (it.slot) {
      row = it.slot as GearRow;
    }
  }

  // Style.
  const style: GearStyle = db ? db.style : gearStyle(it.name);

  // Tier — DB tier when known, otherwise infer from BIS regex (lower index = better).
  let tier = db ? db.tier : 999;
  if (!db) {
    const r = bisRankLegacy(n, style);
    if (r < 999) tier = r;
  }

  // Spec / primary detection.
  let specOrder = -1;
  let primaryOrder = -1;
  if (db) {
    if (db.role === "spec") specOrder = db.order ?? 0;
    if (db.role === "primary") primaryOrder = db.order ?? 0;
  } else if (row === "weapon") {
    const sr = specRankLegacy(n);
    if (sr >= 0) specOrder = sr;
    else primaryOrder = 0; // anonymous primary
  }

  const role: ResolvedGear["role"] = db?.role ?? (
    row === "slayer" ? "utility" :
    row === "food" ? "food" :
    row === "ammo" ? "ammo" :
    primaryOrder >= 0 ? "primary" :
    specOrder >= 0 ? "spec" :
    row === "other" ? "other" :
    "armour"
  );

  return { row, style, tier, role, specOrder, primaryOrder };
}

// Legacy regex-based BIS rank (renamed; only used as DB-miss fallback).
function bisRankLegacy(nameLower: string, style: GearStyle): number {
  const list = style === "melee" ? BIS_MELEE
             : style === "ranged" ? BIS_RANGED
             : style === "magic"  ? BIS_MAGIC
             : null;
  if (!list) return 999;
  for (let i = 0; i < list.length; i++) if (list[i].test(nameLower)) return i;
  return 999;
}

function specRankLegacy(nameLower: string): number {
  for (let i = 0; i < PVM_SPEC_ORDER.length; i++) if (PVM_SPEC_ORDER[i].test(nameLower)) return i;
  return -1;
}

function sortPvmGear(items: OrganizedItem[]): OrganizedItem[] {
  const resolved = new Map(items.map((it) => [it.id, resolveGear(it)] as const));
  const g = (it: OrganizedItem) => resolved.get(it.id)!;

  return [...items].sort((a, b) => {
    const ga = g(a);
    const gb = g(b);

    if (ga.row !== gb.row) return GEAR_ROW_ORDER.indexOf(ga.row) - GEAR_ROW_ORDER.indexOf(gb.row);

    // Weapon row: primaries first (melee → ranged → magic, then by primaryOrder),
    // then specs (in canonical spec order regardless of style).
    if (ga.row === "weapon") {
      const aIsSpec = ga.role === "spec";
      const bIsSpec = gb.role === "spec";
      if (aIsSpec !== bIsSpec) return aIsSpec ? 1 : -1;
      if (aIsSpec && bIsSpec) return ga.specOrder - gb.specOrder;
      // Both primaries.
      if (ga.style !== gb.style) return STYLE_ORDER[ga.style] - STYLE_ORDER[gb.style];
      if (ga.primaryOrder !== gb.primaryOrder) return ga.primaryOrder - gb.primaryOrder;
      if (ga.tier !== gb.tier) return ga.tier - gb.tier;
      return a.name.localeCompare(b.name);
    }

    // Food row: dedicated tier (anglerfish < manta < shark < karambwan < brew).
    if (ga.row === "food") {
      if (ga.tier !== gb.tier) return ga.tier - gb.tier;
      return a.name.localeCompare(b.name);
    }

    // Every other equipment row: melee block → ranged → magic → neutral; then
    // by tier (DB-backed when available); then classifier weight; then name.
    if (ga.style !== gb.style) return STYLE_ORDER[ga.style] - STYLE_ORDER[gb.style];
    if (ga.tier !== gb.tier) return ga.tier - gb.tier;
    if (a.weight !== b.weight) return a.weight - b.weight;
    if (a.quantity !== b.quantity) return b.quantity - a.quantity;
    return a.name.localeCompare(b.name);
  });
}

// ── Teleports sort logic ─────────────────────────────────────────────────────
// Canonical order from osrsadvice + Ornate Jewellery Box unlock order +
// gamingelephant guide. Tab flow:
//
//   Row A  Currency           — coins, plat tokens, looting bag, rune pouches,
//                                herb sack, gem bag (utility pouches)
//   Row B  Charged jewellery  — glory → dueling → games → skills → combat
//                                bracelet → wealth → slayer → digsite →
//                                passage → binding (Ornate Jewellery Box order)
//   Row C  Teleport tablets   — Varrock → Lumby → Fally → Camelot → Ardy →
//                                Watchtower → Kourend → Civitas → House
//   Row D  Teleport items     — ectophial, chronicle, royal seed pod, drakan's
//                                medallion, ardougne cloak, xeric's, crystal
//                                seed, fairy ring kit, spirit tree, lyre
//   Row E  Standard runes     — air → water → earth → fire → mind → body →
//                                cosmic → chaos → nature → law → death
//   Row F  Hightier runes     — astral → blood → soul → wrath
//   Row G  Combination runes  — mist → dust → smoke → steam → mud → lava
//   Row H  Worn amulets       — fury, torture, anguish, occult (passive ammies)
//   Row I  Worn rings         — passive rings not in PvM Gear

const CHARGED_JEWELLERY_ORDER = [
  /^amulet of glory/, /^ring of dueling/, /^games necklace/, /^skills necklace/,
  /^combat bracelet/, /^ring of wealth/, /^slayer ring/, /^digsite pendant/,
  /^necklace of passage/, /^necklace of binding/, /^burning amulet/,
  /^bracelet of slaughter/, /^expeditious bracelet/, /^amulet of chemistry/,
  /^amulet of bounty/, /^ring of returning/
];

const TELEPORT_TAB_ORDER = [
  /varrock teleport/, /lumbridge teleport/, /falador teleport/,
  /camelot teleport/, /ardougne teleport/, /watchtower teleport/,
  /^teleport to house|house teleport/, /kourend (?:castle )?teleport/,
  /civitas illa fortis teleport/, /scroll of redirection/
];

const TELEPORT_ITEM_ORDER = [
  /^ectophial/, /^chronicle/, /^royal seed pod/, /^drakan'?s? medallion/,
  /^ardougne cloak/, /^xeric'?s? talisman/, /^crystal teleport seed/,
  /^enchanted lyre/, /^pharaoh'?s? sceptre/, /^skull sceptre/,
  /^amulet of the eye/, /^holy symbol/, /^fairy ring/, /^spirit tree/,
  /^teleport crystal/, /\bteleport tablet$/, /\bteleport scroll$/, /\btablet$/
];

const RUNE_ELEMENTAL = ["air", "water", "earth", "fire", "mind", "body", "cosmic", "chaos", "nature", "law", "death"];
const RUNE_HIGHTIER  = ["astral", "blood", "soul", "wrath"];
const RUNE_COMBO     = ["mist", "dust", "smoke", "steam", "mud", "lava"];

function teleportSection(it: OrganizedItem): number {
  const n = it.name.toLowerCase();
  if (n === "coins" || n === "platinum token") return 0;
  if (/^(?:looting bag|rune pouch|divine rune pouch|moonclan rune pouch|herb sack|gem bag|coin pouch|seed box|fish barrel|log basket|essence pouch|blood money)$/.test(n)) return 0;
  if (matchAny(n, CHARGED_JEWELLERY_ORDER) >= 0) return 1;
  if (matchAny(n, TELEPORT_TAB_ORDER) >= 0) return 2;
  if (matchAny(n, TELEPORT_ITEM_ORDER) >= 0) return 3;
  if (RUNE_ELEMENTAL.some((r) => n === `${r} rune`)) return 4;
  if (RUNE_HIGHTIER.some((r) => n === `${r} rune`)) return 5;
  if (RUNE_COMBO.some((r) => n === `${r} rune`)) return 6;
  if (/\b(?:amulet|necklace)\b/.test(n) && /^(?:amulet of fury|amulet of torture|necklace of anguish|occult necklace|amulet of avarice|amulet of blood fury|amulet of rancour|amulet of strength|amulet of magic|amulet of defence|amulet of power|salve amulet|berserker necklace)/.test(n)) return 7;
  if (/^(?:berserker ring|archers ring|seers ring|warrior ring|ring of suffering|brimstone ring|tyrannical ring|treasonous ring|ring of (?:wealth|stone|3rd age|life))/.test(n)) return 8;
  return 9; // tail
}

function matchAny(name: string, patterns: RegExp[]): number {
  const n = name.toLowerCase();
  for (let i = 0; i < patterns.length; i++) if (patterns[i].test(n)) return i;
  return -1;
}

function sortTeleports(items: OrganizedItem[]): OrganizedItem[] {
  return [...items].sort((a, b) => {
    const sa = teleportSection(a);
    const sb = teleportSection(b);
    if (sa !== sb) return sa - sb;

    const n = a.name.toLowerCase();
    const m = b.name.toLowerCase();

    if (sa === 1) {
      const ra = matchAny(n, CHARGED_JEWELLERY_ORDER);
      const rb = matchAny(m, CHARGED_JEWELLERY_ORDER);
      if (ra !== rb) return ra - rb;
    }
    if (sa === 2) {
      const ra = matchAny(n, TELEPORT_TAB_ORDER);
      const rb = matchAny(m, TELEPORT_TAB_ORDER);
      if (ra !== rb) return ra - rb;
    }
    if (sa === 3) {
      const ra = matchAny(n, TELEPORT_ITEM_ORDER);
      const rb = matchAny(m, TELEPORT_ITEM_ORDER);
      if (ra !== rb) return ra - rb;
    }
    if (sa === 4) {
      const ra = RUNE_ELEMENTAL.findIndex((r) => n === `${r} rune`);
      const rb = RUNE_ELEMENTAL.findIndex((r) => m === `${r} rune`);
      if (ra !== rb) return ra - rb;
    }
    if (sa === 5) {
      const ra = RUNE_HIGHTIER.findIndex((r) => n === `${r} rune`);
      const rb = RUNE_HIGHTIER.findIndex((r) => m === `${r} rune`);
      if (ra !== rb) return ra - rb;
    }
    if (sa === 6) {
      const ra = RUNE_COMBO.findIndex((r) => n === `${r} rune`);
      const rb = RUNE_COMBO.findIndex((r) => m === `${r} rune`);
      if (ra !== rb) return ra - rb;
    }

    if (a.weight !== b.weight) return a.weight - b.weight;
    if (a.quantity !== b.quantity) return b.quantity - a.quantity;
    return a.name.localeCompare(b.name);
  });
}

// ── Potions sort logic ───────────────────────────────────────────────────────
// Two-pass layout: finished potions first (grouped by family, 4-dose first),
// then the herblore pipeline (vials → grimy → clean → unfinished → secondaries).
// Family order follows PvM usage frequency: combat → divine combat → ranging →
// magic → bastion → battlemage → brew → restore → prayer → stamina → antifire →
// anti-venom → sanfew → zamorak brew → super attack/strength/defence.
const POTION_FAMILY_ORDER = [
  /^super combat potion/, /^divine super combat/,
  /^ranging potion/, /^divine ranging/, /^bastion potion/, /^divine bastion/,
  /^magic potion/, /^battlemage potion/, /^divine magic/, /^divine battlemage/,
  /^saradomin brew/, /^super restore/, /^prayer potion/,
  /^stamina potion/, /^energy potion/, /^super energy/,
  /^extended super antifire/, /^super antifire/, /^extended antifire/, /^antifire potion/,
  /^anti-?venom\+\+/, /^anti-?venom\+?/, /^antidote\+\+/, /^antidote\+/, /^antipoison/,
  /^sanfew serum/, /^zamorak brew/, /^ancient brew/, /^forgotten brew/, /^menaphite remedy/,
  /^super attack/, /^super strength/, /^super defence/, /^divine super attack/,
  /^divine super strength/, /^divine super defence/, /^divine ranging/,
  /^attack potion/, /^strength potion/, /^defence potion/, /^combat potion/,
  /^guthix rest/, /^relicym'?s? balm/,
  /^prayer renewal/, /^aggression potion/, /^liquid adrenaline/,
  /^agility potion/, /^fishing potion/, /^hunter potion/, /^magic essence/,
  /^compost potion/, /^cunning potion/
];

function potionFamilyRank(name: string): number {
  const n = name.toLowerCase().replace(/\(\d\)$/, "").trim();
  for (let i = 0; i < POTION_FAMILY_ORDER.length; i++) {
    if (POTION_FAMILY_ORDER[i].test(n)) return i;
  }
  return POTION_FAMILY_ORDER.length;
}

function potionDose(name: string): number {
  const m = name.match(/\((\d+)\)$/);
  return m ? parseInt(m[1], 10) : 0;
}

const HERB_ORDER = [
  "guam", "marrentill", "tarromin", "harralander", "ranarr", "toadflax",
  "spirit weed", "irit", "wergali", "avantoe", "kwuarm", "huasca",
  "snapdragon", "cadantine", "lantadyme", "dwarf weed", "torstol"
];

function herbRank(name: string): number {
  const n = name.toLowerCase();
  for (let i = 0; i < HERB_ORDER.length; i++) {
    if (n.includes(HERB_ORDER[i])) return i;
  }
  return HERB_ORDER.length;
}

function potionStage(it: OrganizedItem): number {
  const n = it.name.toLowerCase();
  // Finished potion — anything ending in `…(N)` where N is the dose. Captures
  // "potion(4)", "brew(4)", "restore(4)", "serum(4)", etc. — every dose-bearing
  // finished pot the game ships.
  if (/\(\d\)$/.test(n) && !/\(unf\)$/.test(n)) return 0;
  if (/^vial( of (?:water|blood))?$/.test(n)) return 1;     // vials
  if (/^pestle and mortar$/.test(n)) return 1;
  if (/^grimy /.test(n)) return 2;                          // grimy herb
  if (/^clean /.test(n) || HERB_ORDER.some((h) => n === h)) return 3; // clean herb
  if (/\(unf\)$|unfinished potion/.test(n)) return 4;       // unfinished pot
  return 5;                                                  // secondaries / other
}

// Skiller-archetype family override: when the user is a skiller, push
// skilling-related potions (energy, stamina, agility, fishing, hunter,
// compost) ahead of combat potions. PvMers / mains keep the default order
// where combat potions go first.
const SKILLER_POTION_PRIORITY = [
  /^stamina potion/, /^super energy/, /^energy potion/,
  /^agility potion/, /^fishing potion/, /^hunter potion/,
  /^compost potion/, /^prayer renewal/, /^prayer potion/,
  /^super restore/, /^antifire/, /^anti-?venom/, /^antidote/, /^antipoison/,
  /^saradomin brew/, /^super combat potion/, /^divine super combat/,
  /^ranging potion/, /^magic potion/, /^bastion/, /^battlemage/
];

function skillerPotionRank(name: string): number {
  const n = name.toLowerCase().replace(/\(\d\)$/, "").trim();
  for (let i = 0; i < SKILLER_POTION_PRIORITY.length; i++) {
    if (SKILLER_POTION_PRIORITY[i].test(n)) return i;
  }
  return SKILLER_POTION_PRIORITY.length;
}

function sortPotions(items: OrganizedItem[], archetype: Archetype = "unspecified"): OrganizedItem[] {
  return [...items].sort((a, b) => {
    const sa = potionStage(a);
    const sb = potionStage(b);
    if (sa !== sb) return sa - sb;

    if (sa === 0) {
      // Family order — for skillers, prefer skilling/utility potions first.
      const fa = archetype === "skiller" ? skillerPotionRank(a.name) : potionFamilyRank(a.name);
      const fb = archetype === "skiller" ? skillerPotionRank(b.name) : potionFamilyRank(b.name);
      if (fa !== fb) return fa - fb;
      // Same family — doses 4 → 1 descending.
      const da = potionDose(a.name);
      const db = potionDose(b.name);
      if (da !== db) return db - da;
    }

    if (sa === 2 || sa === 3 || sa === 4) {
      const ha = herbRank(a.name);
      const hb = herbRank(b.name);
      if (ha !== hb) return ha - hb;
    }

    if (a.weight !== b.weight) return a.weight - b.weight;
    if (a.quantity !== b.quantity) return b.quantity - a.quantity;
    return a.name.localeCompare(b.name);
  });
}

// ── Skilling sort logic ──────────────────────────────────────────────────────
// Skill blocks in in-game stat-list order. Inside each skill block: tools
// first, then raw materials, then processed outputs. References: osrsadvice
// "i Kelly" layout, Tuck's tab 5.
type Skill =
  | "mining" | "smithing" | "fishing" | "cooking" | "woodcutting" | "fletching"
  | "firemaking" | "crafting" | "farming" | "herblore" | "runecraft"
  | "construction" | "hunter" | "agility" | "slayer" | "other";

// Default: in-game skill-stat-list order (Mining → Smithing → WC → ... ).
const SKILL_ORDER: Skill[] = [
  "mining", "smithing", "woodcutting", "fletching", "fishing", "cooking",
  "firemaking", "crafting", "farming", "runecraft", "construction", "hunter",
  "agility", "slayer", "other"
];

// Skiller archetype: pull the high-value money skills (Herblore, Farming,
// Runecraft) to the front. Slayer/Hunter sink to the back since skillers
// rarely touch them.
const SKILL_ORDER_SKILLER: Skill[] = [
  "herblore", "farming", "runecraft", "construction",
  "mining", "smithing", "woodcutting", "fletching",
  "fishing", "cooking", "firemaking", "crafting",
  "hunter", "agility", "slayer", "other"
];

// PvM / Ironman: skilling is supply-driven. Mining/Smithing/Fishing first
// (combat resources), then the rest in default order.
const SKILL_ORDER_PVM: Skill[] = [
  "mining", "fishing", "cooking", "smithing",
  "fletching", "woodcutting", "firemaking", "crafting",
  "farming", "herblore", "runecraft", "construction",
  "hunter", "agility", "slayer", "other"
];

function skillOrderFor(archetype: Archetype): Skill[] {
  if (archetype === "skiller") return SKILL_ORDER_SKILLER;
  if (archetype === "pvm" || archetype === "ironman") return SKILL_ORDER_PVM;
  return SKILL_ORDER;
}

const SKILL_PATTERNS: Array<[Skill, RegExp]> = [
  ["mining",       /^(?:(?:bronze|iron|steel|black|mithril|adamant|rune|dragon|crystal|3rd age|gilded|infernal|imcando) pickaxe$|copper ore|tin ore|iron ore|silver ore|coal$|gold ore|mithril ore|adamantite ore|adamant ore|runite ore|amethyst|lovakite ore|daeyalt|paydirt|golden nuggets?|unidentified minerals?|stardust|^volcanic ash$|^sulphur$|^saltpetre$|granite \(\d+kg\)|blurite ore|elemental ore|crushed gem|^uncut )/i],
  ["smithing",     /^(?:(?:bronze|iron|silver|steel|gold|mithril|adamant(?:ite)?|rune|runite|amethyst) bar$|^hammer$|imcando hammer|^anvil|smiths uniform|smithing cape|(?:bronze|iron|steel|mithril|adamant|rune|dragon|broad) (?:arrowtips|arrow shafts?|bolts \(unf\)|nails|dart tip|knife|claws))/i],
  ["woodcutting",  /^(?:(?:bronze|iron|steel|black|mithril|adamant|rune|dragon|crystal|3rd age|gilded|infernal) (?:hatchet|axe)$|(?:^|\s)(?:logs?|pyre logs?|achey tree logs|oak logs|willow logs|maple logs|yew logs|magic logs|redwood logs|teak logs|mahogany logs|arctic pine logs|elder logs)$|lumberjack |^juju woodcutting)/i],
  ["fletching",    /^(?:^(?:knife)$|arrow shafts?|^feathers?$|(?:headless arrow|^arrow|^bow string|bowstring|crossbow string|unstrung bow|(?:bronze|iron|steel|mithril|adamant|rune|dragon) arrows?|(?:opal|jade|red topaz|sapphire|emerald|ruby|diamond|dragonstone|onyx) (?:bolt tips|bolts? \(e\)|bolts?)|short ?bow \(u\)|long ?bow \(u\)|magic shortbow \(u\)|magic longbow \(u\)|^stock$|crossbow stock|^limb|(?:bronze|iron|steel|mithril|adamant|rune|dragon) (?:c'?bow|crossbow)))/i],
  ["fishing",      /^(?:^(?:fishing rod|fly fishing rod|fishing net|small fishing net|big fishing net|harpoon|barb-tail harpoon|dragon harpoon|crystal harpoon|infernal harpoon|lobster pot|karambwan vessel|loaded karambwan vessel)|^raw (?:shrimps?|anchovies|sardine|herring|trout|salmon|pike|tuna|lobster|bass|swordfish|monkfish|shark|sea turtle|manta ray|dark crab|cavefish|rocktail|karambwan|frog spawn|giant carp|lava eel|anglerfish|tetra fish)$|^fishbowl|frog spawn$|fish barrel)/i],
  ["cooking",      /^(?:(?:cooked|burnt) (?:shrimps?|anchovies|sardine|herring|trout|salmon|pike|tuna|lobster|bass|swordfish|monkfish|shark|sea turtle|manta ray|dark crab|cavefish|rocktail|karambwan|anglerfish)|^cake$|^chocolate cake|^bread$|^pie shell|^uncooked pie|^pizza base|^stew$|^wine$|jug of wine|pot of cream|pot of flour|^flour$|^grain$|^cooking apple$|^chocolate bar$|^chocolate dust|^pat of butter|^chef's delight|cooking gauntlets|cooking cape)/i],
  ["firemaking",   /^(?:tinderbox|bruma torch|bullseye lantern|oil lantern|^pyromancer |^bonfire|^firemaking cape)/i],
  ["crafting",     /^(?:^(?:needle|thread|ball of wool|bolt of cloth|chisel|glassblowing pipe|molten glass|soda ash|bucket of sand|giant seaweed|^uncut (?:opal|jade|red topaz|sapphire|emerald|ruby|diamond|dragonstone|onyx|zenyte|hydrix)$|^(?:opal|jade|red topaz|sapphire|emerald|ruby|diamond|dragonstone|onyx|zenyte|hydrix)$)|(?:cow|hardleather|leather|snakeskin|spider silk|yak[ -]?hide|bear fur|polar kebbit fur|wild pie|d'?hide|dragonhide)|crafting cape|^crafted )/i],
  ["farming",      /^(?:^(?:spade|rake|seed dibber|gardening trowel|secateurs|magic secateurs|watering can|empty plant pot|plant pot|filled plant pot|^compost$|supercompost|ultracompost|bottomless compost bucket|sapling|seedling|seed pack)|^.*seeds?$|^.*sapling$|^.*tree seed$|farmer'?s |farming cape)/i],
  ["herblore",     /^(?:^(?:pestle and mortar|vial|vial of water)$|herblore cape|^morchella mushroom|^bittercap mushroom|(?:goat horn dust|red spider's? eggs?|chocolate dust|white berries|wine of zamorak|snape grass|kebbit teeth(?:[ -]?dust)?|crushed nest|potato cactus|yew roots?|magic roots?|blue dragon scale|wolfbone arrowtips|amylase crystal|mort myre fungus|cactus spine|jangerberries|ashes|bat wings?|papaya fruit|coconut milk|lava scale shard|crushed superior dragon bones?|phoenix feather|stranger plant|araxyte venom sack))/i],
  ["runecraft",    /^(?:^(?:pure essence|rune essence|daeyalt essence|guardian essence|elemental essence|catalytic essence)|.*talisman$|.*tiara$|abyssal pearls?|(?:small|medium|large|giant|colossal) pouch|^binding necklace$|^massive pouch|runecraft(?:ing)? cape)/i],
  ["construction", /^(?:(?:wooden|oak|teak|mahogany) plank$|^soft clay$|^hard clay$|^limestone(?: brick)?$|^marble block$|^magic stone$|^gold leaf$|^bolt of cloth$|^saw$|^crystal saw$|construction cape|^steel nails$|^bronze nails$|^iron nails$)/i],
  ["hunter",       /^(?:^(?:butterfly jar|impling jar|kebbit fur|bird snare|box trap|noose wand|magic butterfly net|teasing stick|butterfly net)|^(?:swamp|spotted|spottier|graahk|kyatt|larupia|polar|jubbly|wild) (?:fur|kebbit fur)|hunter cape|^(?:chinchompa|red chinchompa|black chinchompa)$)/i],
  ["agility",      /^(?:^mark of grace$|agility cape|grace |graceful (?:hood|top|legs|gloves|boots|cape))/i],
  ["slayer",       /^(?:^(?:slayer ring|slayer gem|enchanted gem|earmuffs|spiny helmet|nose peg|reinforced goggles|insulated boots|rock hammer|bag of salt|fungicide|fungicide spray|facemask|gas mask|swamp paste|witchwood icon|silver bolts \(p\))|^salve amulet|slayer cape)/i]
];

function skillFor(it: OrganizedItem): Skill {
  const n = it.name.toLowerCase();
  for (const [skill, pat] of SKILL_PATTERNS) {
    if (pat.test(n)) return skill;
  }
  // Fallback: use subtab hint from classifier if present.
  const sub = it.subtab.toLowerCase();
  if (/herbs|herblore/.test(sub)) return "herblore";
  if (/farming/.test(sub)) return "farming";
  if (/logs|wood/.test(sub)) return "woodcutting";
  if (/ore|mining/.test(sub)) return "mining";
  if (/bar|smith/.test(sub)) return "smithing";
  if (/gems/.test(sub)) return "crafting";
  if (/raw fish|fish/.test(sub)) return "fishing";
  if (/construction/.test(sub)) return "construction";
  if (/runecraft|essence/.test(sub)) return "runecraft";
  if (/hunter/.test(sub)) return "hunter";
  return "other";
}

// Within a skill block: tools (priority 0) < raw materials (1) < processed outputs (2)
function skillStage(it: OrganizedItem, skill: Skill): number {
  const n = it.name.toLowerCase();
  // Tools — anything matching the tool patterns specific to the skill.
  if (skill === "mining" && /pickaxe$/.test(n)) return 0;
  if (skill === "smithing" && /^hammer$|imcando hammer/.test(n)) return 0;
  if (skill === "woodcutting" && /(?:hatchet|axe)$/.test(n)) return 0;
  if (skill === "fishing" && /(?:rod|net|harpoon|lobster pot|karambwan vessel|fish barrel)/.test(n)) return 0;
  if (skill === "firemaking" && /(?:tinderbox|bruma torch|bullseye lantern|oil lantern)/.test(n)) return 0;
  if (skill === "crafting" && /(?:needle|thread|ball of wool|chisel|glassblowing pipe)/.test(n)) return 0;
  if (skill === "farming" && /(?:spade|rake|seed dibber|gardening trowel|secateurs|watering can|plant pot|compost bucket)/.test(n)) return 0;
  if (skill === "herblore" && /(?:pestle and mortar|^vial)/.test(n)) return 0;
  if (skill === "runecraft" && /(?:pouch|talisman$|tiara$|abyssal pearls?)/.test(n)) return 0;
  if (skill === "construction" && /(?:^saw$|crystal saw)/.test(n)) return 0;
  if (skill === "hunter" && /(?:net|snare|box trap|noose wand|teasing stick)/.test(n)) return 0;
  // Processed outputs — bars, planks, finished arrows, cooked food.
  if (skill === "smithing" && /\bbar$/.test(n)) return 2;
  if (skill === "construction" && /plank$/.test(n)) return 2;
  if (skill === "fletching" && /(?:arrows?$|bolts?$|bow$|crossbow$)/.test(n) && !/\(u\)$|arrowtips|arrow shafts?/.test(n)) return 2;
  if (skill === "cooking" && /^cooked /.test(n)) return 2;
  // Raw / intermediate.
  return 1;
}

function sortSkilling(items: OrganizedItem[], archetype: Archetype = "unspecified"): OrganizedItem[] {
  const order = skillOrderFor(archetype);
  return [...items].sort((a, b) => {
    const sa = skillFor(a);
    const sb = skillFor(b);
    if (sa !== sb) return order.indexOf(sa) - order.indexOf(sb);

    const stA = skillStage(a, sa);
    const stB = skillStage(b, sb);
    if (stA !== stB) return stA - stB;

    if (a.weight !== b.weight) return a.weight - b.weight;
    if (a.quantity !== b.quantity) return b.quantity - a.quantity;
    return a.name.localeCompare(b.name);
  });
}

// ── Drops sort logic ─────────────────────────────────────────────────────────
// Pets first (their own visual row at the top), then jars, then unique boss
// drops grouped by tier, then trophies/holiday rares at the bottom.
type DropKind = "pet" | "jar" | "unique" | "trophy" | "holiday" | "other";

const DROP_PET = /^(?:pet |baby |chompy chick|abyssal protector|baby mole|prince black dragon|baby chinchompa|vorkath'?s? head|jal[- ]nib[- ]rek|olmlet|skotos|tzrek[- ]?jad|venenatis spiderling|callisto cub|chaos elemental jr|kraken (?:jr|cub)|cerberus jr|youngllef|tangleroot|rocky|beaver|herbi|rift guardian|rock golem|smolcano|baby muspah|moxi|sraracha|baby aragog|kalphite princess)/i;
const DROP_JAR = /^jar of /i;
const DROP_TROPHY = /(?:third[- ]age|3rd age|gilded (?:scimitar|med helm|full helm|platebody|platelegs|plateskirt|kiteshield|chainbody))/i;
const DROP_HOLIDAY = /(?:partyhat|santa hat|halloween|h'?ween mask|christmas cracker|easter egg|disk of returning|cabbage cape|chicken hat|jester cap|gnome scarf)/i;

function dropKind(it: OrganizedItem): DropKind {
  const n = it.name.toLowerCase();
  if (DROP_PET.test(n)) return "pet";
  if (DROP_JAR.test(n)) return "jar";
  if (DROP_HOLIDAY.test(n)) return "holiday";
  if (DROP_TROPHY.test(n)) return "trophy";
  return "unique";
}

const DROP_ORDER: DropKind[] = ["pet", "jar", "unique", "trophy", "holiday", "other"];

function sortDrops(items: OrganizedItem[]): OrganizedItem[] {
  return [...items].sort((a, b) => {
    const ka = dropKind(a);
    const kb = dropKind(b);
    if (ka !== kb) return DROP_ORDER.indexOf(ka) - DROP_ORDER.indexOf(kb);

    // Within unique drops: order by GE value descending (rarer/headline drops first).
    if (ka === "unique") {
      if (a.stackValue !== b.stackValue) return b.stackValue - a.stackValue;
    }
    if (a.weight !== b.weight) return a.weight - b.weight;
    return a.name.localeCompare(b.name);
  });
}

// Within each use-case tab, archetypes care about different subtab order.
// Lower index = earlier in the tab body.
function subtabPriority(archetype: Archetype, useCase: UseCaseTab, subtab: string): number {
  const s = subtab.toLowerCase();
  if (useCase === "PvM Gear") {
    if (archetype === "pvm" || archetype === "ironman") {
      // PvMers want melee/range/mage gear first, then food, then armour bits.
      if (/two-handed|weapon|primary/.test(s)) return 0;
      if (/special|spec/.test(s)) return 1;
      if (/range|bow|crossbow|chinchompa/.test(s)) return 2;
      if (/magic|staff|wand|trident/.test(s)) return 3;
      if (/food|cooked|fish|shark|brew|anglerfish/.test(s)) return 4;
      if (/armour|body|helm|legs|boots|gloves|cape/.test(s)) return 5;
      if (/utility|off-hand|shield/.test(s)) return 6;
    }
  }
  if (useCase === "Skilling") {
    if (archetype === "skiller") {
      // Skillers want core skilling resources first.
      if (/farming|seeds/.test(s)) return 0;
      if (/herbs|herblore/.test(s)) return 1;
      if (/runecraft|essence/.test(s)) return 2;
      if (/woodcut|logs/.test(s)) return 3;
      if (/mining|ores|bars/.test(s)) return 4;
      if (/fishing|raw fish/.test(s)) return 5;
      if (/hunter/.test(s)) return 6;
      if (/agility|grace/.test(s)) return 7;
    }
  }
  if (useCase === "Teleports") {
    // Charged jewellery + tablets at top — most-used by everyone.
    if (/charged jewellery/.test(s)) return 0;
    if (/teleport tablets|teleport items/.test(s)) return 1;
    if (/currency/.test(s)) return 2;
    if (/worn rings|worn amulets/.test(s)) return 3;
  }
  return 999;
}

// Content-aware classifier that routes any OSRS item to the most-used bucket
// for that item — inspired by Tuck's 9-tab and the top-rated /r/2007scape bank
// layouts. The rules below are name-pattern first, then typeTab as a hint, so
// items the upstream classifier dumped into Misc still land in the right tab.
//
// Each pattern was hand-picked by browsing the OSRS Wiki item categories and
// crosschecking with the most-saved Bank Tag exports from the community.

// Common herblore secondaries — these are the ingredients you keep next to
// your potions so you don't have to flip tabs while mixing.
const HERBLORE_SECONDARIES = new RegExp([
  "eye of newt", "limpwurt root", "red spider's? eggs?", "chocolate dust",
  "white berries", "wine of zamorak", "snape grass",
  "kebbit teeth(?:[ -]?dust)?", "crushed nest", "crushed bird's nest",
  "potato cactus", "yew roots?", "magic roots?", "blue dragon scale",
  "wolfbone arrowtips", "swamp tar", "amylase crystal",
  "mort myre fungus", "cactus spine", "jangerberries",
  "goat horn dust", "ashes", "bat wings?", "papaya fruit",
  "coconut", "coconut milk", "lava scale shard", "crushed superior dragon bones?",
  "torstol seeds?", "guam tar|marrentill tar|tarromin tar|harralander tar",
  "ground (?:guam|marrentill|tarromin|harralander|ranarr|irit|avantoe|kwuarm|cadantine|lantadyme|dwarf weed|torstol)",
  "phoenix feather", "stranger plant",
  "(?:harralander|ranarr|toadflax|guam|marrentill|tarromin|irit|avantoe|kwuarm|cadantine|lantadyme|dwarf weed|torstol|snapdragon) potion \\(unf\\)",
  "vial(?: of [a-z ]+)?", "pestle and mortar", "compost potion",
  "morchella mushroom", "bittercap mushroom", "araxyte venom sack"
].join("|"), "i");

// Skilling raw materials and processed outputs.
const SKILLING_PATTERNS = new RegExp([
  // Logs (every kind)
  "(?:^|\\s)(?:logs?|pyre logs?|achey tree logs|oak logs|willow logs|maple logs|yew logs|magic logs|redwood logs|teak logs|mahogany logs|arctic pine logs|elder logs)(?:$|\\s)",
  // Ores
  "\\b(?:copper|tin|iron|silver|coal|gold|mithril|adamantite|adamant|runite|amethyst|lovakite|daeyalt|blurite|elemental) ore\\b",
  "\\bgolden nuggets?\\b", "\\bpaydirt\\b", "\\bunidentified minerals?\\b",
  // Bars
  "\\b(?:bronze|iron|silver|steel|gold|mithril|adamant|adamantite|rune|runite|amethyst) bar\\b",
  // Gems
  "^(?:uncut |cut )?(?:opal|jade|red topaz|topaz|sapphire|emerald|ruby|diamond|dragonstone|onyx|zenyte|hydrix)$",
  "^(?:opal|jade|sapphire|emerald|ruby|diamond|dragonstone|onyx|zenyte) (?:bolt tips|machete)$",
  // Fish (raw + cooked)
  "^(?:raw |burnt |cooked )?(?:shrimps?|anchovies|sardine|herring|trout|salmon|pike|tuna|lobster|bass|swordfish|monkfish|shark|sea turtle|manta ray|dark crab|cavefish|rocktail|karambwan(?:i)?|jubbly|frog spawn|seaweed|edible seaweed|giant carp|lava eel|anglerfish|tetra fish)$",
  // Hides + leather + scales
  "\\b(?:cow|green|blue|red|black|royal) ?dragonhide\\b", "\\bdragonhide\\b",
  "\\bd'hide(?: body| chaps| vambraces| coif| boots)?\\b",
  "\\b(?:cow|hardleather|leather|snakeskin|spider silk|yak[ -]hide|bear fur|polar kebbit fur|wild pie)\\b",
  "\\bzulrah'?s? scales?\\b", "\\bdragon scale\\b",
  // Bones & ashes
  "^(?:bones?|big bones|wolf bones|burnt bones|jogre bones|zogre bones|fayrg bones|raurg bones|ourg bones|dagannoth bones|dragon bones|babydragon bones|wyvern bones|superior dragon bones|drake bones|hydra bones|dust battlestaff)$",
  "\\b(?:fiendish|malicious|abyssal|infernal|impious|accursed|vile|silver) ashes?\\b",
  "ensouled.*head", "demonic ashes",
  // Seeds + saplings (Farming)
  "\\b(?:potato|onion|cabbage|tomato|sweetcorn|strawberry|watermelon|snape grass|jangerberry|cadava|whiteberry|poison ivy|guam|marrentill|tarromin|harralander|ranarr|toadflax|spirit weed|irit|wergali|avantoe|kwuarm|snapdragon|huasca|cadantine|lantadyme|dwarf weed|torstol|asgarnian|jute|hammerstone|yanillian|krandorian|wildblood|barley|hops|acorn|willow|maple|yew|magic|redwood|teak|mahogany|spirit|magic) seeds?\\b",
  "\\b(?:apple|banana|orange|curry|pineapple|papaya|palm|coconut|dragonfruit|calquat|cactus|spirit|magic) (?:tree )?(?:seed|sapling)\\b",
  "\\bsapling\\b", "\\bseedling\\b", "\\bseed pack\\b", "\\bbird nest\\b", "\\bcrushed nest\\b",
  "\\bmushroom spore\\b", "\\bgrimy snape grass\\b",
  // Construction
  "(?:wooden plank|oak plank|teak plank|mahogany plank)",
  "\\bsoft clay\\b", "\\bhard clay\\b", "\\blimestone(?: brick)?\\b",
  "\\bmarble block\\b", "\\bmagic stone\\b", "\\bgold leaf\\b", "\\bbolt of cloth\\b",
  // Cooking inputs
  "\\b(?:cooking apple|chocolate bar|pat of butter|flour|pot of flour|grapes|pot of cream|raw potato|cooked chicken|raw meat|cooked meat|chocolate cake|chocolate dust|bucket of milk|pot of cornflour|coconut milk)\\b",
  "\\b(?:grain|wheat|hops|barley)\\b", "\\bjug of wine\\b",
  // Smithing / fletching inputs
  "(?:bronze|iron|steel|mith|adamant|rune|dragon|broad) (?:arrowtips|arrow shafts?|bolts \\(unf\\)|nails)",
  "\\barrow shafts?\\b", "\\bfeathers?\\b", "\\bbowstring\\b", "\\bcrossbow string\\b",
  // Hunter
  "\\b(?:chinchompa|red chinchompa|black chinchompa)\\b",
  "\\b(?:butterfly jar|impling jar|kebbit fur|bird snare|box trap|noose wand)\\b",
  "(?:swamp|spotted|spottier|graahk|kyatt|larupia|polar|jubbly|wild) (?:fur|kebbit fur)",
  // Misc skilling drops
  "\\bmark of grace\\b", "\\bvolcanic ash\\b", "\\bsulphur\\b", "\\bsaltpetre\\b",
  "\\bcharcoal\\b", "\\bherb tar\\b", "\\bstardust\\b", "\\bsoul fragment\\b",
  "\\bmolten glass\\b", "\\bgiant seaweed\\b", "\\bsoda ash\\b", "\\bbucket of sand\\b",
  "\\bglassblowing pipe\\b", "\\bglass blowpipe\\b",
  // Skilling tools
  "\\b(?:bronze|iron|steel|black|mithril|adamant|rune|dragon|infernal|crystal|imcando|3rd age) (?:pickaxe|hatchet|axe|knife)\\b",
  "\\b(?:fishing rod|fly fishing rod|fishing net|small fishing net|big fishing net|harpoon|barb-tail harpoon|dragon harpoon|crystal harpoon|infernal harpoon|lobster pot|karambwan vessel|loaded karambwan vessel)\\b",
  "\\b(?:butterfly net|bird snare|box trap|noose wand|magic butterfly net|teasing stick)\\b",
  "\\b(?:spade|rake|seed dibber|gardening trowel|secateurs|magic secateurs|watering can|empty plant pot|plant pot|filled plant pot)\\b",
  "\\b(?:hammer|imcando hammer|chisel|tinderbox|bruma torch|bullseye lantern|oil lantern|saw|crystal saw)\\b",
  "\\b(?:pestle and mortar|needle|thread|ball of wool)\\b",
  // Runecraft
  "(?:pure essence|rune essence|daeyalt essence|guardian essence|elemental essence|catalytic essence)",
  "talisman$", "tiara$", "abyssal pearls?", "(?:small|medium|large|giant|colossal) pouch",
  // Slayer-task helpers
  "\\b(?:slayer ring|slayer gem|enchanted gem|earmuffs|spiny helmet|nose peg|reinforced goggles|insulated boots|rock hammer|bag of salt|fungicide|fungicide spray)\\b",
  "\\b(?:facemask|gas mask|swamp paste|witchwood icon|holy symbol|unholy symbol|holy water|silver bolts \\(p\\))\\b"
].join("|"), "i");

// Teleport jewellery + tablets + runes — anything you'd grab to move around.
const TELEPORT_PATTERNS = new RegExp([
  // Charged jewellery
  "^(?:amulet of glory|skills necklace|combat bracelet|ring of dueling|games necklace|necklace of passage|burning amulet|digsite pendant|ring of wealth|bracelet of slaughter|expeditious bracelet|amulet of chemistry|amulet of bounty|ring of returning)(?:\\s?\\(\\d+\\))?$",
  // Teleport items
  "^(?:ectophial|chronicle|royal seed pod|drakan's medallion|xeric's talisman|crystal teleport seed|enchanted lyre|fairy ring|amulet of the eye|^holy symbol|skull sceptre(?: \\(i\\))?|enchanted lyre|teleport crystal)",
  // Tabs / tablets
  "teleport tablet", "teleport scroll", "scroll of redirection", "house teleport",
  "(?:varrock|lumbridge|falador|camelot|ardougne|watchtower|teleport to .+) tablet",
  // Runes
  "^(?:air|water|earth|fire|mind|body|cosmic|chaos|nature|law|death|blood|soul|astral|wrath|mist|dust|smoke|steam|mud|lava|sunfire|elder) rune$",
  "\\brune pack\\b",
  // Runecraft carriers (live next to the runes you craft)
  "rune pouch", "divine rune pouch", "moonclan rune pouch",
  // Ammulets people forget about
  "^(?:amulet|necklace|ring|bracelet) of "
].join("|"), "i");

// Quest / one-off untradeables you keep but rarely touch.
const QUEST_PATTERNS = new RegExp([
  "\\b(?:quest journal|quest book|book of (?:balance|war|law|darkness|the dead|spell)|ghostspeak amulet|lockpick|brimstone key|gilded key|crystal key|tooth half of (?:a |the )?key|loop half of (?:a |the )?key|stronghold notes?|hard hat|builder's hat|treasure chart|silver pendant|enchanted bar|crystal pendant|map fragment)\\b",
  "key \\(.*clue.*\\)",
  "\\b(?:music cape|champion'?s cape|mythical cape)\\b",
  "champion scroll"
].join("|"), "i");

// Cosmetic — skilling outfits + holiday rares + partyhats.
// 3rd age + Gilded armour USED to live here, but they're Clue Scroll rewards
// and players expect them in the Clue tab next to their caskets, not buried
// with skilling outfits. CLUE_PATTERNS below handles them now.
const COSMETIC_PATTERNS = new RegExp([
  "\\b(?:angler|pyromancer|lumberjack|prospector|golden prospector|rogue|farmer'?s|smiths|carpenter's|zealot's|raiments of the eye|piscarilius|hosidius|lovakengj|shayzien|arceuus|kourend) (?:hat|hood|top|jacket|robe|chestplate|legs|boots|gloves|garb|waders|trousers|strawhat|boro trousers|helmet)",
  "\\b(?:partyhat|santa hat|halloween mask|h'ween mask|christmas cracker|easter egg|disk of returning|cabbage cape|chicken hat|jester cap|gnome scarf)\\b"
].join("|"), "i");

// Drops & trophies — pets, jars, untradeable uniques (hilts, brimstone keys),
// quest/boss commemoratives. **Excludes equippable BIS gear**: items like
// twisted bow / scythe / shadow / masori / ancestral / ultor ring are gear
// you USE, not unsold drops. They live in PvM Gear instead.
const DROPS_PATTERNS = new RegExp([
  "\\b(?:hilt|jar of |skull of |head of |unsired|brimstone key|wilderness key|larran'?s key|dark key)\\b",
  "\\b(?:vorkath'?s head|kalphite princess|chompy chick|baby mole|prince black dragon|olmlet|skotos|tzrek-jad|venenatis spiderling|callisto cub|jal[- ]nib[- ]rek|youngllef|chaos elemental jr|kraken jr|cerberus jr|baby chinchompa|herbi|abyssal protector|tangleroot|beaver|rock golem|riftguardian|rocky|baby muspah|sraracha|moxi|baby aragog|nexling|^lil' creator)\\b",
  // Untradeable trophy items that aren't gear.
  "\\b(?:champion'?s scroll|champion scroll|broken (?:zamorakian|saradomin) hasta|abyssal pearls?)\\b"
].join("|"), "i");

// Potions — finished pots + the herblore pipeline + vials.
const POTIONS_PATTERNS = new RegExp([
  "potion\\(\\d\\)$", "brew\\(\\d\\)$",
  "^(?:saradomin brew|super combat|super attack|super strength|super defence|super ranging|super magic|stamina|prayer|super restore|sanfew serum|antifire|extended antifire|extended super antifire|antidote\\+\\+|antidote\\+|anti-venom\\+?|antipoison|combat potion|attack potion|strength potion|defence potion|ranging potion|magic potion|ancient brew|forgotten brew|zamorak brew|guthix rest|relicym's balm|hunter potion|fishing potion|agility potion|prayer renewal|energy potion|super energy|compost potion|magic essence|divine|bastion|battlemage|liquid adrenaline|aggression potion|menaphite remedy|cunning potion)",
  "(?:unfinished potion|.*\\(unf\\))$",
  "^(?:clean|grimy) (?:guam|marrentill|tarromin|harralander|ranarr|toadflax|spirit weed|irit|avantoe|kwuarm|snapdragon|cadantine|lantadyme|dwarf weed|torstol|huasca)$"
].join("|"), "i");

// Clue scroll tab — clue scrolls + caskets + every notable clue-reward item.
// Community convention: caskets, clue-unique gear (3rd age, Gilded, Ranger
// boots, Robin hood, Spiked manacles, blessings, …) and clue cosmetics
// (heraldic, masks, hats, gnome outfits) all live next to the caskets in
// one tab. That way the player sees "what came out of my clues" together.
const CLUE_PATTERNS = new RegExp([
  // Active clue lifecycle
  "clue scroll \\(", "clue bottle \\(", "reward casket", "sealed clue",
  "challenge scroll", "clue nest", "key \\(.*clue.*\\)", "master scroll book",
  "puzzle box", "scan clue", "tracking strip",
  // Top-tier rares (3rd age + Gilded full sets)
  "\\b(?:third[- ]age|3rd age) (?:robe|kiteshield|amulet|wand|range|mage|melee|druidic|cloak|axe|pickaxe|longsword|wand|bow)\\b",
  "\\bgilded (?:scimitar|med helm|full helm|platebody|platelegs|plateskirt|kiteshield|chainbody|2h sword|d'hide|spear|hasta|axe|pickaxe)\\b",
  // Ranger / Robin Hood / Holy sandals — quintessential clue uniques
  "^ranger (?:boots|gloves|tunic|hat)$",
  "^robin hood hat$",
  "^holy sandals$",
  // Musketeer outfit (Wizard hat/robe/skirt (g/t))
  "(?:^| )(?:wizard (?:hat|robe|skirt) ?\\((?:g|t)\\)|musketeer)",
  // Blessings (clue-reward holy items)
  "\\b(?:holy|unholy|peaceful|war|honourable|saradomin|zamorak|guthix|ancient|bandos|armadyl) blessing\\b",
  // Heraldic clue items (helm, kiteshield, banner, teleport scrolls)
  "\\b(?:heraldic (?:helm|kiteshield)|.* (?:teleport scroll|banner))\\b",
  "^(?:rune|adamant|mithril|steel) (?:full helm|kiteshield|platebody|platelegs|plateskirt|chainbody) \\(.*\\)$",
  // Trimmed / gold-trimmed clue armour variants
  "\\((?:g|t)\\)$",
  // Bucket helm, cavalier, beret, sombrero, top hat, mask of moon etc.
  "^(?:bucket helm \\(g\\)|black cavalier|red cavalier|white cavalier|navy cavalier|cavalier mask|highwayman mask|imp mask|leprechaun hat|katana|wide-brim ribboned hat|sleeping cap|tan cavalier|tan cavalier \\(.*\\))$",
  "^(?:beret|red beret|black beret|white beret|sombrero|top hat|monocle|amulet of defence \\(t\\))$",
  // Musketeer / pirate / gnome outfit pieces (clue-exclusive cosmetic sets)
  "^(?:gnome (?:hat|top|scarf|robe|goggles)|musketeer (?:hat|tabard|trousers)|pirate (?:hat|leggings|shirt|boots|bandana))$",
  // Crystal pyramid / lockpick / chequered shirt etc. (random clue rares)
  "^(?:crystal pyramid|lockpick|chequered shirt|katana)$",
  // Mask of moon, big-banner, scribbled book — Master clue rewards
  "^(?:mask of (?:granite|gloam|dusk|moon|maths)|big banner|scribbled book)$",
  // Half-keys + giant champion scrolls — clue-track adjacent
  "\\b(?:loop|tooth) half of (?:a|the) key\\b"
].join("|"), "i");

// Map item-type tab → use-case tab. Patterns are checked first (since the
// upstream classifier may have dumped real skilling items into "Misc"); only
// if no pattern matches do we fall back to the type-tab heuristic.
function bucketFor(it: OrganizedItem, typeTab: TypeTab): UseCaseTab {
  // ID-level override always wins. Used for items whose name patterns would
  // misroute them (e.g. "voidwaker" matching the "void" regex, DT2 rewards
  // with no regex anchor, etc.). See bucket-overrides.ts.
  const override = bucketOverride(it.id);
  if (override) return override;

  // If the curated PvM item DB knows this id, it's by definition gear —
  // EXCEPT for food-role entries (anglerfish/brew/karambwan): those are
  // brewed/cooked consumables that classifier handles via Food/Potions tabs.
  // The DB entry's "food" role is for the food *row* inside PvM Gear once an
  // item is already routed there, not for forced routing.
  const dbEntry = pvmGearEntry(it.id);
  if (dbEntry && dbEntry.role !== "food") return "PvM Gear";

  // Keeper-category routing. Items in the community-curated keeper list
  // (slayer gear, demonbane weapons, cannon parts, DT2 drops, pets, herbs,
  // outfit pieces, etc.) get a guaranteed tab based on their semantic type.
  // This is the layer that fixes "Arclight in Misc" / "Beaver in Misc" /
  // "ranarr weed in Misc" — see keeper-items.ts for the full canon.
  const keeper = keeperCategory(it);
  if (keeper) {
    switch (keeper) {
      case "pet":
      case "dt2-drop":
      case "recipe":
        return "Drops";
      case "slayer-gear":
      case "demonbane":
      case "cannon":
        return "PvM Gear";
      case "slayer-util":
        // Non-wearable slayer-task tools (Rock hammer, fungicide, swamp paste,
        // holy water, witchwood icon, salt bags). They're carried in your
        // inventory during a task, not worn as gear — so they belong in the
        // Misc / Skilling area, not next to your bandos chest.
        return "Misc";
      case "crystal":
        // Crystal items split three ways:
        //   - Crystal axe / pickaxe / harpoon → Skilling (they're tools,
        //     even though they double as wearable weapons).
        //   - Crystal seeds / keys / grail / saw / chime → Quest.
        //   - Everything else (Crystal bow, body, helm, legs, Blade of
        //     Saeldor, Bow of Faerdhinen) → PvM Gear.
        if (/^crystal (?:axe|hatchet|pickaxe|harpoon)/i.test(it.name)) return "Skilling";
        if (/seed|key|grail|saw|chime/i.test(it.name)) return "Quest";
        return "PvM Gear";
      case "quest-item":
        return "Quest";
      case "holiday":
        return "Cosmetic";
      case "outfit":
        return "Cosmetic";
      case "cape":
        // Combat capes → PvM Gear; collection capes → Quest.
        return /\b(fire|infernal|imbued .* cape|imbued .* max|guthix|saradomin|zamorak|ardougne|assembler|accumulator)\b/i.test(it.name) ? "PvM Gear" : "Quest";
      case "carrier":
        // Storage carriers split by purpose:
        //   - PvM-utility (Looting bag, Rune pouch family) → Teleports tab
        //     where they sit next to the cash/teleport jewellery row.
        //   - Skilling supply carriers (Gem bag, Coal bag, Log basket, Fish
        //     barrel, Herb sack, Seed box, Bottomless compost bucket,
        //     Essence pouches, Plank sack, Tackle box) → Skilling tab next
        //     to the resources they hold.
        if (/^(looting bag|rune pouch|divine rune pouch|moonclan rune pouch|eternal rune pouch)/i.test(it.name)) {
          return "Teleports";
        }
        return "Skilling";
      case "herb":
      case "secondary":
        return "Potions";
      case "essence":
        return "Skilling";
      case "diary":
        return "Teleports";
      case "other-keeper":
        return "Misc";
    }
  }

  const n = it.name.toLowerCase();

  // CLUE — clue items + casket pipeline.
  if (typeTab === "Clues") return "Clue";
  if (CLUE_PATTERNS.test(n)) return "Clue";

  // QUEST — quest-only items.
  if (typeTab === "Quest") return "Quest";
  if (QUEST_PATTERNS.test(n)) return "Quest";

  // COSMETIC — skilling outfits, holiday rares, third-age, partyhats, gilded.
  if (COSMETIC_PATTERNS.test(n)) return "Cosmetic";
  if (typeTab === "Trophy" && /partyhat|santa hat|halloween|christmas|3rd age|third-age|h'ween|disk of returning/i.test(n)) return "Cosmetic";

  // DROPS — boss uniques, pets, jars, trophies.
  if (typeTab === "Trophy") return "Drops";
  if (DROPS_PATTERNS.test(n)) return "Drops";

  // POTIONS + HERBLORE PIPELINE — finished pots, herbs, vials, secondaries.
  if (typeTab === "Potions") return "Potions";
  if (POTIONS_PATTERNS.test(n)) return "Potions";
  if (it.subtab === "Herbs" || it.subtab === "Herblore" || it.subtab === "Vials") return "Potions";
  if (HERBLORE_SECONDARIES.test(n)) return "Potions";

  // Combat jewellery — passive combat ammies + DT2 boss rings + imbued rings
  // belong in PvM Gear next to other gear pieces, not in Teleports. Anguish/
  // torture/occult/fury/rancour/blood fury are pure stat-stick ammies; salve(ei)
  // is the slayer-utility neck. Ultor/Magus/Venator/Bellator (DT2) and the
  // imbued PKer rings are gear too.
  if (/^(?:amulet of (?:fury|torture|anguish|rancour|blood fury|the damned)|necklace of anguish|occult necklace|berserker necklace|salve amulet)/.test(n)) {
    return "PvM Gear";
  }
  if (/^(?:ultor ring|magus ring|venator ring|bellator ring|berserker ring|archers ring|seers ring|warrior ring|treasonous ring|tyrannical ring|brimstone ring|lightbearer|ring of suffering)/.test(n)) {
    return "PvM Gear";
  }

  // TELEPORTS — jewellery, runes, tablets, pouches.
  if (typeTab === "Jewellery") return "Teleports";
  if (typeTab === "Runes") return "Teleports";
  if (TELEPORT_PATTERNS.test(n)) return "Teleports";

  // PVM GEAR — combat gear regardless of style, slayer items, food, ammo.
  if (typeTab === "Combat" || typeTab === "Range" || typeTab === "Magic") return "PvM Gear";
  if (typeTab === "Food") return "PvM Gear";

  // Untradeables split. Combat-relevant untradeables (Fire/Infernal cape,
  // Fighter torso, Barrows gloves, void, imbued god capes) → PvM Gear.
  // Collection/skill capes that aren't combat-relevant (QPC, Music cape,
  // Champion's cape, Mythical cape, skill capes) → Quest. Without this split
  // a maxed account's "Untradeables" type-tab dumps quest-only items next to
  // its slayer helm.
  if (typeTab === "Untradeables") {
    const isCombatUntradeable = /(?:fire cape|infernal cape|fighter torso|barrows gloves|void (?:knight|mage|melee|ranger|elite|seal)|elite void|defender|imbued (?:zamorak|saradomin|guthix) cape|imbued (?:zamorak|saradomin|guthix) max cape|ava'?s? (?:assembler|attractor|accumulator|device)|slayer helm|black mask|salve amulet|ardougne cloak|book of (?:darkness|law|the dead|war|balance|spell)|dragon defender|avernic defender)/i.test(n);
    return isCombatUntradeable ? "PvM Gear" : "Quest";
  }
  if (/(arrow|bolt|dart|javelin|throwing knives?|chinchompa)s?$/.test(n)) return "PvM Gear";

  // SKILLING — bones (Prayer), raws, processed materials, hides, seeds, ores,
  // bars, gems, logs, tools, hunter, runecrafting.
  if (typeTab === "Prayer") return "Skilling";
  if (typeTab === "Skilling") return "Skilling";
  if (typeTab === "Resources") return "Skilling";
  if (typeTab === "Tools") return "Skilling";
  if (SKILLING_PATTERNS.test(n)) return "Skilling";

  // Fallback for equippable items the classifier dumped to Misc (e.g.
  // Primordial boots, Eternal boots, Ferocious gloves, Tumeken's shadow,
  // Berserker ring (i) — high-tier items not in the classifier RULES). Any
  // item with a detected slot is wearable and belongs in PvM Gear.
  if (it.slot) return "PvM Gear";

  return "Misc";
}

// Diagnostic version of bucketFor() that returns *why* an item landed where
// it did. Used by the dev/layout debug page to surface routing decisions.
// Mirrors bucketFor's logic exactly — if you change one, change the other.
export interface BucketExplanation {
  bucket: UseCaseTab;
  reason: string;
}

export function explainBucket(it: OrganizedItem, typeTab: TypeTab): BucketExplanation {
  const override = bucketOverride(it.id);
  if (override) return { bucket: override, reason: `id-override (${it.id})` };

  const dbEntry = pvmGearEntry(it.id);
  if (dbEntry && dbEntry.role !== "food") {
    return { bucket: "PvM Gear", reason: `pvm-db (${dbEntry.style}/${dbEntry.slot} t${dbEntry.tier})` };
  }

  const n = it.name.toLowerCase();

  if (typeTab === "Clues") return { bucket: "Clue", reason: "typeTab=Clues" };
  if (CLUE_PATTERNS.test(n)) return { bucket: "Clue", reason: "clue-pattern" };

  if (typeTab === "Quest") return { bucket: "Quest", reason: "typeTab=Quest" };
  if (QUEST_PATTERNS.test(n)) return { bucket: "Quest", reason: "quest-pattern" };

  if (COSMETIC_PATTERNS.test(n)) return { bucket: "Cosmetic", reason: "cosmetic-pattern" };
  if (typeTab === "Trophy" && /partyhat|santa hat|halloween|christmas|3rd age|third-age|h'ween|disk of returning/i.test(n)) {
    return { bucket: "Cosmetic", reason: "Trophy + holiday/3rd-age name" };
  }

  if (typeTab === "Trophy") return { bucket: "Drops", reason: "typeTab=Trophy" };
  if (DROPS_PATTERNS.test(n)) return { bucket: "Drops", reason: "drops-pattern" };

  if (typeTab === "Potions") return { bucket: "Potions", reason: "typeTab=Potions" };
  if (POTIONS_PATTERNS.test(n)) return { bucket: "Potions", reason: "potions-pattern" };
  if (it.subtab === "Herbs" || it.subtab === "Herblore" || it.subtab === "Vials") {
    return { bucket: "Potions", reason: `subtab=${it.subtab}` };
  }
  if (HERBLORE_SECONDARIES.test(n)) return { bucket: "Potions", reason: "herblore-secondary" };

  if (/^(?:amulet of (?:fury|torture|anguish|rancour|blood fury|the damned)|necklace of anguish|occult necklace|berserker necklace|salve amulet)/.test(n)) {
    return { bucket: "PvM Gear", reason: "passive combat amulet" };
  }
  if (/^(?:ultor ring|magus ring|venator ring|bellator ring|berserker ring|archers ring|seers ring|warrior ring|treasonous ring|tyrannical ring|brimstone ring|lightbearer|ring of suffering)/.test(n)) {
    return { bucket: "PvM Gear", reason: "combat ring" };
  }

  if (typeTab === "Jewellery") return { bucket: "Teleports", reason: "typeTab=Jewellery" };
  if (typeTab === "Runes") return { bucket: "Teleports", reason: "typeTab=Runes" };
  if (TELEPORT_PATTERNS.test(n)) return { bucket: "Teleports", reason: "teleport-pattern" };

  if (typeTab === "Combat" || typeTab === "Range" || typeTab === "Magic") {
    return { bucket: "PvM Gear", reason: `typeTab=${typeTab}` };
  }
  if (typeTab === "Food") return { bucket: "PvM Gear", reason: "typeTab=Food" };

  if (typeTab === "Untradeables") {
    const isCombatUntradeable = /(?:fire cape|infernal cape|fighter torso|barrows gloves|void (?:knight|mage|melee|ranger|elite|seal)|elite void|defender|imbued (?:zamorak|saradomin|guthix) cape|imbued (?:zamorak|saradomin|guthix) max cape|ava'?s? (?:assembler|attractor|accumulator|device)|slayer helm|black mask|salve amulet|ardougne cloak|book of (?:darkness|law|the dead|war|balance|spell)|dragon defender|avernic defender)/i.test(n);
    return isCombatUntradeable
      ? { bucket: "PvM Gear", reason: "combat-untradeable" }
      : { bucket: "Quest", reason: "non-combat untradeable" };
  }
  if (/(arrow|bolt|dart|javelin|throwing knives?|chinchompa)s?$/.test(n)) {
    return { bucket: "PvM Gear", reason: "ammo-suffix" };
  }

  if (typeTab === "Prayer") return { bucket: "Skilling", reason: "typeTab=Prayer" };
  if (typeTab === "Skilling") return { bucket: "Skilling", reason: "typeTab=Skilling" };
  if (typeTab === "Resources") return { bucket: "Skilling", reason: "typeTab=Resources" };
  if (typeTab === "Tools") return { bucket: "Skilling", reason: "typeTab=Tools" };
  if (SKILLING_PATTERNS.test(n)) return { bucket: "Skilling", reason: "skilling-pattern" };

  if (it.slot) return { bucket: "PvM Gear", reason: `slot-fallback (${it.slot})` };

  return { bucket: "Misc", reason: "no rule matched" };
}

// Icon for each use-case tab (canonical item id, sprite via chisel CDN).
export const USE_CASE_ICONS: Record<UseCaseTab, number> = {
  Teleports: 995,             // Coins
  "PvM Gear": 4151,           // Abyssal whip
  Drops:    20997,            // Twisted bow
  Potions:  6685,             // Saradomin brew(4)
  Skilling: 1515,             // Yew logs
  Clue:     19730,            // Reward casket (hard)
  Quest:    9813,             // Quest point cape
  Cosmetic: 1042,             // Blue partyhat
  Misc:     1631              // Uncut dragonstone
};

// Below this item count, splitting into 9 use-case tabs produces lots of
// half-empty tabs that feel cluttered. Instead we fold the whole bank into
// one consolidated tab, ordered by the same bucket priority that drives the
// tab list (Teleports → PvM Gear → Drops → Potions → Skilling → Clue → Quest
// → Cosmetic → Misc). Pulled from r/2007scape feedback that new accounts
// "look broken" in tab-mode.
const SMALL_BANK_THRESHOLD = 50;

// Tool-tier dedup. For each tool family (pickaxe, hatchet), if the player
// owns multiple tiers we keep only the highest-tier copy in Skilling and
// demote the lower tiers to Drops so the player sees them as "spare /
// could be sold". Mirrors how experienced players treat their bank: one
// daily-use top-tier tool, the rest is loot.
//
// Tier order (highest first): 3rd age > Crystal > Dragon > Rune > Adamant
// > Mithril > Black > Steel > Iron > Bronze. The Infernal pickaxe/hatchet
// counts as Dragon-tier (same level requirement) but burns its own stack —
// players typically own both at endgame, so we treat them as siblings.

// Optional suffix that any tool name may carry — `(or)` for ornament-kit
// recolours, `(inactive)` for crystal tools that lost their charge,
// `(uncharged)` for Infernal, `(nz)` for Nightmare Zone variants. The
// suffix never changes the tier so we accept any `(\w+)` blob after the
// tool name.
const TOOL_SUFFIX = `(?:\\s*\\(\\w+\\))?`;

// Build the per-tier matcher list. Every tier accepts the optional suffix
// so dyed / charged / uncharged / NMZ variants don't slip past dedup.
function tierMatcher(prefix: string, type: string): RegExp {
  return new RegExp(`^${prefix} ${type}${TOOL_SUFFIX}$`, "i");
}

const PICKAXE_TIERS = ["3rd age", "crystal", "echo", "trailblazer", "infernal", "dragon", "gilded", "rune", "adamant", "mithril", "black", "steel", "iron", "bronze"];
const HATCHET_TIERS = ["3rd age", "crystal", "echo", "trailblazer", "infernal", "dragon", "gilded", "rune", "adamant", "mithril", "black", "steel", "iron", "bronze"];

const TOOL_FAMILIES: Array<{ keyword: string; tierMatchers: RegExp[] }> = [
  {
    keyword: "pickaxe",
    tierMatchers: PICKAXE_TIERS.map((t) => tierMatcher(t, "pickaxe"))
  },
  {
    keyword: "hatchet",
    // OSRS uses both "axe" and "hatchet" in item names depending on tier
    // (Iron axe / Dragon axe / Crystal axe — never "hatchet" in the actual
    // item id). We accept both for safety.
    tierMatchers: HATCHET_TIERS.flatMap((t) => [
      tierMatcher(t, "axe"),
      tierMatcher(t, "hatchet")
    ])
  }
];

function dedupSkillingTools(grouped: Map<UseCaseTab, OrganizedItem[]>): void {
  const skilling = grouped.get("Skilling");
  if (!skilling || skilling.length === 0) return;

  for (const family of TOOL_FAMILIES) {
    // Find every item in Skilling that belongs to this family, paired with
    // its tier rank (lower = higher tier). Items not in any matcher are
    // skipped — they're not tool-family items.
    const familyItems: Array<{ item: OrganizedItem; tier: number }> = [];
    for (const item of skilling) {
      for (let i = 0; i < family.tierMatchers.length; i++) {
        if (family.tierMatchers[i].test(item.name)) {
          familyItems.push({ item, tier: i });
          break;
        }
      }
    }
    if (familyItems.length < 2) continue;

    // Highest tier (smallest rank) wins; everything else demotes to Drops.
    familyItems.sort((a, b) => a.tier - b.tier);
    const keep = familyItems[0];
    const demote = familyItems.slice(1).map((f) => f.item);

    // Remove demoted items from Skilling, add them to Drops. We do this in a
    // single pass to keep the array references stable for the rest of the
    // buildUseCaseTabs flow.
    const demoteIds = new Set(demote.map((it) => it.id));
    grouped.set("Skilling", skilling.filter((it) => !demoteIds.has(it.id)));
    const drops = grouped.get("Drops") ?? [];
    grouped.set("Drops", [...drops, ...demote]);
    // Keep "keep" in Skilling — it's already there, no action needed.
    void keep;
  }
}

// Build use-case tabs from existing item-type tabs.
// We preserve original sort orders and rebuild layouts per use-case tab.
export function buildUseCaseTabs(
  typeTabs: OrganizedTab[],
  archetype: Archetype = "unspecified",
  /**
   * Optional runtime override map. When the user drag-drops an item onto a
   * different use-case tab, the UI records `itemId → bucket` here, and we
   * honour it on top of the static bucket-overrides table. This is how
   * drag-to-reroute works in use-case mode.
   */
  userOverrides?: Map<number, UseCaseTab>
): OrganizedTab[] {
  const grouped = new Map<UseCaseTab, OrganizedItem[]>();
  let totalItems = 0;
  for (const tab of typeTabs) {
    for (const item of tab.items) {
      const userBucket = userOverrides?.get(item.id);
      const bucket = userBucket ?? bucketFor(item, tab.name);
      if (!grouped.has(bucket)) grouped.set(bucket, []);
      grouped.get(bucket)!.push(item);
      totalItems++;
    }
  }

  // Small-bank fallback: one consolidated tab, sorted by the same bucket
  // order + per-bucket sort the multi-tab view uses. Skips the tab UI
  // entirely so a 25-item bank doesn't render five three-item tabs.
  if (totalItems > 0 && totalItems < SMALL_BANK_THRESHOLD) {
    return [buildConsolidatedTab(grouped, archetype)];
  }

  // Tool-tier dedup: if the player owns a higher-tier pickaxe or hatchet,
  // demote the lower-tier copies to Drops so they're flagged as "spare to
  // sell" rather than cluttering Skilling. Runs once, in-place on `grouped`.
  dedupSkillingTools(grouped);

  const out: OrganizedTab[] = [];
  const order = USE_CASE_ORDER_BY_ARCHETYPE[archetype] || USE_CASE_ORDER;
  for (const name of order) {
    let items = grouped.get(name) || [];
    if (items.length === 0) continue;

    items = sortBucket(name, items, archetype);
    // Layout strategy per use-case tab:
    //   - PvM Gear: 2D set-grouped layout with bank-filler placeholders for
    //     missing set pieces (each filler labelled with the missing piece).
    //   - Potions: herb-family rows (grimy → clean → secondary → unf →
    //     (4)(3)(2)(1)) with labelled bank-filler in any gap.
    //   - Skilling: themed rows (pouches / essence / core tools) with
    //     labelled bank-filler in gaps, then dense overflow for the rest.
    //   - Drops: kind-banded layout (pets / jars / uniques / trophies /
    //     holiday) with an empty row between bands as a visual separator.
    //   - Teleports / Clue / Quest / Cosmetic: kind-banded via the shared
    //     bandedLayout helper — items of the same kind cluster, one empty
    //     row between bands as a visual separator.
    //   - Misc: dense left-to-right pack (this IS the dump-tab; banding
    //     here just hides the items further).
    const built: LayoutResult =
      name === "PvM Gear" ? buildPvmGearLayout(items)
      : name === "Potions" ? buildPotionsLayout(items)
      : name === "Skilling" ? buildSkillingLayout(items)
      : name === "Drops" ? buildDropsLayout(items)
      : name === "Teleports" ? buildTeleportsLayout(items)
      : name === "Clue" ? buildClueLayout(items)
      : name === "Quest" ? buildQuestLayout(items)
      : name === "Cosmetic" ? buildCosmeticLayout(items)
      : { layout: buildUseCaseLayout(items), fillerLabels: {} };
    out.push({
      // TypeTab union is wider than UseCaseTab; cast is safe — render layer
      // doesn't care about the literal type, only the name string.
      name: name as unknown as TypeTab,
      iconItemId: pickUseCaseIcon(name, items),
      items,
      layout: built.layout,
      fillerLabels: built.fillerLabels,
      quantity: items.reduce((s, x) => s + x.quantity, 0),
      value: items.reduce((s, x) => s + x.stackValue, 0)
    });
  }
  return out;
}

function sortBucket(name: UseCaseTab, items: OrganizedItem[], archetype: Archetype): OrganizedItem[] {
  if (name === "PvM Gear") return sortPvmGear(items);
  if (name === "Teleports") return sortTeleports(items);
  if (name === "Potions") return sortPotions(items, archetype);
  if (name === "Skilling") return sortSkilling(items, archetype);
  if (name === "Drops") return sortDrops(items);
  // Generic bucket sort: by archetype-specific subtab priority, then subtab
  // name, then weight, then quantity desc.
  return [...items].sort((a, b) => {
    const pa = subtabPriority(archetype, name, a.subtab);
    const pb = subtabPriority(archetype, name, b.subtab);
    if (pa !== pb) return pa - pb;
    if (a.subtab !== b.subtab) return a.subtab.localeCompare(b.subtab);
    if (a.weight !== b.weight) return a.weight - b.weight;
    if (a.quantity !== b.quantity) return b.quantity - a.quantity;
    return a.name.localeCompare(b.name);
  });
}

// Consolidated single-tab view for small banks. Items appear in bucket
// priority order (Teleports first, Misc last), with each bucket internally
// sorted by its dedicated sort. This gives a low-level player a single,
// logically-ordered tab instead of nine tiny ones.
function buildConsolidatedTab(grouped: Map<UseCaseTab, OrganizedItem[]>, archetype: Archetype): OrganizedTab {
  const order = USE_CASE_ORDER_BY_ARCHETYPE[archetype] || USE_CASE_ORDER;
  const allItems: OrganizedItem[] = [];
  for (const name of order) {
    const items = grouped.get(name) || [];
    if (!items.length) continue;
    allItems.push(...sortBucket(name, items, archetype));
  }
  return {
    name: "Bank" as unknown as TypeTab,
    iconItemId: pickConsolidatedIcon(allItems),
    items: allItems,
    layout: buildUseCaseLayout(allItems),
    quantity: allItems.reduce((s, x) => s + x.quantity, 0),
    value: allItems.reduce((s, x) => s + x.stackValue, 0)
  };
}

function pickConsolidatedIcon(items: OrganizedItem[]): number {
  if (items.length === 0) return USE_CASE_ICONS.Teleports;
  // Use first item — typically coins or top jewellery — as the tab icon.
  const first = items[0];
  if (first.id === 995) return spriteIdForItem(995, first.quantity);
  return first.id;
}

function pickUseCaseIcon(name: UseCaseTab, items: OrganizedItem[]): number {
  // Tab icon = the first item in the (already-sorted) bucket. That way the
  // tab strip icon always matches what the user sees in the top-left of the
  // tab body, instead of a different "most valuable" or canonical sprite.
  // If that first item is coins, swap to the correct stack-size variant so we
  // don't show a 1-coin pixel on a multi-million stack.
  if (items.length > 0) {
    const first = items[0];
    if (first.id === 995) return spriteIdForItem(995, first.quantity);
    return first.id;
  }
  return USE_CASE_ICONS[name];
}

function buildUseCaseLayout(items: OrganizedItem[]): Record<number, number> {
  // Dense packing — items flow left-to-right in their pre-sorted order, no
  // empty cells or padding rows. The sort step before this function preserves
  // logical groupings (style blocks, equipment-slot order, dose order…) so the
  // visual rhythm is encoded in the item order, not in whitespace.
  const layout: Record<number, number> = {};
  for (let i = 0; i < items.length; i++) layout[i] = items[i].id;
  return layout;
}

// Generic kind-banded layout. Caller provides a band-classifier; items
// that share the same band sit together in consecutive rows, with one
// empty row between bands as a visual separator. Used by the Drops tab
// and the Teleports / Clue / Quest / Cosmetic tabs — anywhere "group
// these similar items, leave breathing room between groups" is the
// principle from BANK-ORGANIZER-PRINCIPLES.md.
//
// `bandOf` MUST return the same string for items that should sit next to
// each other; the order of bands in the output follows the encounter order
// in `items`, so the caller is responsible for pre-sorting items so the
// desired bands appear in the desired order.
function bandedLayout<T extends OrganizedItem>(
  items: T[],
  bandOf: (it: T) => string
): Record<number, number> {
  const layout: Record<number, number> = {};
  if (items.length === 0) return layout;

  // Group consecutively. We intentionally do NOT re-group across items of
  // the same band that are separated by another band in the input — the
  // caller's ordering decides band placement.
  const bands: T[][] = [];
  let cur: T[] | null = null;
  let curKey = "";
  for (const it of items) {
    const k = bandOf(it);
    if (!cur || k !== curKey) {
      cur = [];
      curKey = k;
      bands.push(cur);
    }
    cur.push(it);
  }

  // Pack each band into its own row block; skip one row between bands.
  let slot = 0;
  for (let b = 0; b < bands.length; b++) {
    for (const it of bands[b]) layout[slot++] = it.id;
    const rem = slot % GRID_COLS;
    if (rem !== 0) slot += GRID_COLS - rem;
    if (b < bands.length - 1) slot += GRID_COLS;
  }
  return layout;
}

// Drops tab — kind-banded layout. Pets / jars / uniques / trophies /
// holiday rares each get their own row block with a separator row between.
// Input is pre-sorted by sortDrops so the band order is correct.
function buildDropsLayout(items: OrganizedItem[]): LayoutResult {
  return { layout: bandedLayout(items, dropKind), fillerLabels: {} };
}

// ── Teleports tab — banded by kind ─────────────────────────────────────────
// Tuck's 9-tab pattern groups Teleports as: charged jewellery first (daily
// taps), then teleport tablets, then teleport scrolls / items, then runes
// and pouches, then worn amulets / rings without charges, diary rewards
// last. Items are already sorted by sortTeleports upstream.
type TeleportBand = "charged" | "tablet" | "item" | "rune" | "worn" | "diary" | "other";
const TP_CHARGED = /(?:\((?:\d+|empty)\))$|^(?:dueling|games|skills|combat|burning|necklace of passage|amulet of glory)/i;
const TP_TABLET = /tablet$|teleport scroll|scroll of redirection/i;
const TP_ITEM = /^(ectophial|chronicle|royal seed pod|drakan's medallion|xeric's talisman|enchanted lyre|crystal teleport seed|book of the dead|rada's blessing)/i;
const TP_RUNE = /\brune$|^small pouch|^medium pouch|^large pouch|^giant pouch|^colossal pouch|^divine rune pouch|^rune pouch/i;
const TP_DIARY = /(?:ardougne cloak|explorer's ring|karamja gloves|fremennik sea boots|wilderness sword|morytania legs|desert amulet|kandarin headgear|falador shield|varrock armour|western banner|rada's blessing) ?\d?/i;
const TP_WORN = /amulet|necklace|ring$|ring \(|talisman$/i;

function teleportBand(it: OrganizedItem): TeleportBand {
  const n = it.name.toLowerCase();
  if (TP_DIARY.test(n)) return "diary";
  if (TP_CHARGED.test(n)) return "charged";
  if (TP_TABLET.test(n)) return "tablet";
  if (TP_ITEM.test(n)) return "item";
  if (TP_RUNE.test(n)) return "rune";
  if (TP_WORN.test(n)) return "worn";
  return "other";
}
const TP_BAND_ORDER: TeleportBand[] = ["charged", "tablet", "item", "rune", "worn", "diary", "other"];

function buildTeleportsLayout(items: OrganizedItem[]): LayoutResult {
  // Re-sort by band order — sortTeleports upstream cares about *within*
  // groupings; we just need the bands themselves in our preferred order.
  const sorted = [...items].sort((a, b) => {
    const ra = TP_BAND_ORDER.indexOf(teleportBand(a));
    const rb = TP_BAND_ORDER.indexOf(teleportBand(b));
    if (ra !== rb) return ra - rb;
    return 0; // stable
  });
  return { layout: bandedLayout(sorted, teleportBand), fillerLabels: {} };
}

// ── Clue tab — banded by clue tier + kind ──────────────────────────────────
// Scrolls/caskets/keys first (active progress), then rewards by tier
// (beginner → master). Within rewards, the value-sort from sortBucket is
// preserved.
type ClueBand = "scrolls" | "caskets" | "beginner" | "easy" | "medium" | "hard" | "elite" | "master" | "other";
const CL_SCROLL = /^(?:clue scroll|reward casket|challenge scroll|sealed clue|clue nest|key \(.*clue)/i;
const CL_CASKET = /(?:reward casket|clue nest|sealed clue)/i;

function clueBand(it: OrganizedItem): ClueBand {
  const n = it.name.toLowerCase();
  if (CL_CASKET.test(n)) return "caskets";
  if (CL_SCROLL.test(n)) return "scrolls";
  // Tier-coded names: 3rd age = master / elite, gilded = hard, robin = medium…
  // Light heuristic: leave un-tiered as "other" so it sits at the bottom.
  if (/3rd age|third-age|ranger boots|robin hood|holy sandals|gilded/i.test(n)) return "master";
  if (/(?:^|\W)elite(?:\W|$)/i.test(n)) return "elite";
  if (/(?:^|\W)hard(?:\W|$)/i.test(n)) return "hard";
  if (/(?:^|\W)medium(?:\W|$)/i.test(n)) return "medium";
  if (/(?:^|\W)easy(?:\W|$)/i.test(n)) return "easy";
  if (/(?:^|\W)beginner(?:\W|$)/i.test(n)) return "beginner";
  return "other";
}
const CL_BAND_ORDER: ClueBand[] = ["scrolls", "caskets", "master", "elite", "hard", "medium", "easy", "beginner", "other"];

function buildClueLayout(items: OrganizedItem[]): LayoutResult {
  const sorted = [...items].sort((a, b) => {
    const ra = CL_BAND_ORDER.indexOf(clueBand(a));
    const rb = CL_BAND_ORDER.indexOf(clueBand(b));
    if (ra !== rb) return ra - rb;
    return 0;
  });
  return { layout: bandedLayout(sorted, clueBand), fillerLabels: {} };
}

// ── Quest tab — banded ─────────────────────────────────────────────────────
// Quest items naturally split into: quest weapons / wearables (Excalibur,
// Silverlight, Barrelchest anchor), keys (essential progression), then
// quest-only cosmetic / books, then the rest.
type QuestBand = "weapon" | "wearable" | "key" | "book" | "other";
const Q_WEAPON = /(?:excalibur|silverlight|darklight|arclight|emerald lantern|barrelchest|keris|crystal grail)/i;
const Q_KEY = /\bkey\b|grimy.*key|tooth half of key|loop half of key|crystal key|brimstone key|larran's key|grubby key|sinister key/i;
const Q_BOOK = /book of|tome of|holy book|book of balance|book of war|book of darkness|book of law/i;
const Q_WEARABLE = /helm|hood|cape|cloak|amulet|ring|boots|gloves|legs|robe|hat|crown/i;

function questBand(it: OrganizedItem): QuestBand {
  const n = it.name.toLowerCase();
  if (Q_KEY.test(n)) return "key";
  if (Q_WEAPON.test(n)) return "weapon";
  if (Q_BOOK.test(n)) return "book";
  if (Q_WEARABLE.test(n)) return "wearable";
  return "other";
}
const Q_BAND_ORDER: QuestBand[] = ["weapon", "wearable", "book", "key", "other"];

function buildQuestLayout(items: OrganizedItem[]): LayoutResult {
  const sorted = [...items].sort((a, b) => {
    const ra = Q_BAND_ORDER.indexOf(questBand(a));
    const rb = Q_BAND_ORDER.indexOf(questBand(b));
    if (ra !== rb) return ra - rb;
    return 0;
  });
  return { layout: bandedLayout(sorted, questBand), fillerLabels: {} };
}

// ── Cosmetic tab — banded by category ──────────────────────────────────────
// Holiday rares (partyhat, santa, halloween masks) first — these are the
// real flexes. Then 3rd age / gilded (high-rarity clue), then graceful
// (utility cosmetic), then fashion gear (low-stat costumes).
type CosmeticBand = "holiday" | "thirdage" | "graceful" | "fashion" | "other";
const C_HOLIDAY = /partyhat|santa hat|halloween|h'ween mask|christmas cracker|easter egg|disk of returning|cabbage cape|chicken hat|jester|gnome scarf/i;
const C_THIRDAGE = /3rd age|third-age|gilded/i;
const C_GRACEFUL = /^graceful /i;

function cosmeticBand(it: OrganizedItem): CosmeticBand {
  const n = it.name.toLowerCase();
  if (C_HOLIDAY.test(n)) return "holiday";
  if (C_THIRDAGE.test(n)) return "thirdage";
  if (C_GRACEFUL.test(n)) return "graceful";
  return "fashion";
}
const C_BAND_ORDER: CosmeticBand[] = ["holiday", "thirdage", "graceful", "fashion", "other"];

function buildCosmeticLayout(items: OrganizedItem[]): LayoutResult {
  const sorted = [...items].sort((a, b) => {
    const ra = C_BAND_ORDER.indexOf(cosmeticBand(a));
    const rb = C_BAND_ORDER.indexOf(cosmeticBand(b));
    if (ra !== rb) return ra - rb;
    return 0;
  });
  return { layout: bandedLayout(sorted, cosmeticBand), fillerLabels: {} };
}

// PvM Gear 2D layout — groups armour pieces of the same setId into a single
// visual column so a player sees Bandos chest → Bandos tassets → Bandos
// boots stacked together instead of spread across three slot-rows. Items
// without a setId (weapons, food, ammo, capes, neutral rings) flow above the
// set-grid in a dense top region.
//
// Layout regions, top to bottom:
//
//   Top strip  — non-set items (weapons, ammo, food, neutral rings, slayer
//                helm, capes, amulets without setId). Dense pack, left to
//                right.
//   Set grid   — one column per setId, columns ordered melee → ranged →
//                magic. Each column has items stacked top-to-bottom in
//                head → body → legs → hands → feet slot order, so the
//                Bandos column reads vertically as helm/chest/tassets/
//                gloves/boots if all pieces are present.
//
// The 8-column bank grid means we can fit up to 8 set columns per row strip.
// When more sets exist the layout wraps to a second strip below the first.

const GRID_COLS = 8;
// Fixed 5-slot template each set column expects: head → body → legs → hands
// → feet. Sets that own only a subset get bank-filler tiles for the missing
// slots so the column always reads as a complete column. This is how
// experienced OSRS players lay out their gear tab: every set slot present
// or visibly reserved.
const SET_SLOT_ORDER: GearSlot[] = ["head", "body", "legs", "hands", "feet"];

// Layout builders return the slot→id map plus, for any bank-filler tiles,
// a slot→label map naming what's missing ("Dharok's platelegs").
interface LayoutResult {
  layout: Record<number, number>;
  fillerLabels: Record<number, string>;
}

function buildPvmGearLayout(items: OrganizedItem[]): LayoutResult {
  const layout: Record<number, number> = {};
  const fillerLabels: Record<number, string> = {};
  // Partition items into (non-set top strip) vs (set grid).
  const nonSet: OrganizedItem[] = [];
  const setMembers = new Map<string, OrganizedItem[]>();
  for (const it of items) {
    const entry = pvmGearEntry(it.id);
    if (entry?.setId) {
      if (!setMembers.has(entry.setId)) setMembers.set(entry.setId, []);
      setMembers.get(entry.setId)!.push(it);
    } else {
      nonSet.push(it);
    }
  }
  // Sets with only 1 piece are visual noise — promote them back into the
  // non-set strip so we don't show a single-item column with 4 fillers
  // around it. The minimum-2 rule keeps the grid coherent.
  for (const [setId, members] of Array.from(setMembers.entries())) {
    if (members.length < 2) {
      nonSet.push(...members);
      setMembers.delete(setId);
    }
  }

  // Top strip: dense-pack the non-set items in their pre-sorted order.
  let cursor = 0;
  for (const it of nonSet) layout[cursor++] = it.id;
  // Round the cursor up to the next row so the set grid starts cleanly.
  if (cursor % GRID_COLS !== 0) cursor += GRID_COLS - (cursor % GRID_COLS);

  // Set grid: one column per setId, melee → ranged → magic ordered. We use
  // the style of the first member's DB entry as the column's style band.
  const setEntries = Array.from(setMembers.entries()).map(([setId, members]) => {
    const firstEntry = pvmGearEntry(members[0].id);
    const style = firstEntry?.style ?? "neutral";
    return { setId, style, members };
  });
  const styleRank: Record<string, number> = { melee: 0, ranged: 1, magic: 2, neutral: 3 };
  setEntries.sort((a, b) => {
    const ra = styleRank[a.style] ?? 3;
    const rb = styleRank[b.style] ?? 3;
    if (ra !== rb) return ra - rb;
    return a.setId.localeCompare(b.setId);
  });

  // Build a slot→itemId map for each set so we can fill missing slots with
  // the bank-filler sentinel. The result is always a complete 5-row column.
  const setColumns = setEntries.map((set) => {
    const bySlot = new Map<GearSlot, number>();
    for (const it of set.members) {
      const e = pvmGearEntry(it.id);
      if (!e) continue;
      // First-write-wins: keep the highest-tier piece if the user owns
      // multiple (e.g. both Bandos chestplate and another body slot piece
      // tagged the same set). pvmGearEntry sort upstream already preferred
      // the highest tier first, so a redundant write here is a no-op.
      if (!bySlot.has(e.slot as GearSlot)) bySlot.set(e.slot as GearSlot, it.id);
    }
    return { setId: set.setId, bySlot };
  });

  // Place sets as columns. Each column has exactly SET_SLOT_ORDER.length
  // rows (5). Missing slots become bank-filler tiles so the column is
  // visually complete — the player sees at a glance what's still to get.
  let stripStartRow = cursor / GRID_COLS;
  for (let i = 0; i < setColumns.length; i += GRID_COLS) {
    const strip = setColumns.slice(i, i + GRID_COLS);
    const stripHeight = SET_SLOT_ORDER.length;
    strip.forEach((set, colIdx) => {
      for (let rowIdx = 0; rowIdx < stripHeight; rowIdx++) {
        const slot = (stripStartRow + rowIdx) * GRID_COLS + colIdx;
        const expectedSlot = SET_SLOT_ORDER[rowIdx];
        const ownedId = set.bySlot.get(expectedSlot);
        if (ownedId) {
          layout[slot] = ownedId;
        } else {
          // Missing set piece — place a filler and name it so the player
          // sees exactly what's left to get (e.g. "Dharok's platelegs").
          layout[slot] = BANK_FILLER_ID;
          fillerLabels[slot] = setPieceName(set.setId, expectedSlot);
        }
      }
    });
    stripStartRow += stripHeight;
  }

  return { layout, fillerLabels };
}

// ─── Potions tab — herb-pipeline rows with bank-filler placeholders ─────────
// Each potion family gets one 8-column row laid out as:
//   [grimy herb] [clean herb] [unfinished pot] [secondary] [(4)] [(3)] [(2)] [(1)]
// Slots the player doesn't own fall back to the Bank filler sprite so each
// row stays whole — the visual reads like a row of complete Herblore pipes.
//
// The family pipeline (herb → potion-name → secondary item) is fixed by the
// game; this table maps each herb to its canonical pipeline. Herbs without a
// known finished potion in the table get a fallback row.

interface PotionFamilyDef {
  /** Canonical clean-herb item name as it appears in items.json. */
  clean: string;
  /** Canonical grimy-herb item name. */
  grimy: string;
  /** Canonical unfinished-pot name. */
  unfinished: string;
  /** Canonical finished-pot family root (without the `(N)` dose suffix). */
  finished: string;
  /** Canonical secondary item name (optional). */
  secondary?: string;
}

// IMPORTANT: every name here must match exactly what's in items.json. OSRS
// herbs use inconsistent suffixes — "Ranarr weed" / "Guam leaf" / "Irit leaf"
// have a noun, the others are bare ("Torstol", "Snapdragon", "Avantoe"). The
// matcher does a case-insensitive exact compare, so a typo means the row
// silently falls back to bank fillers across the board.
//
// Order is by PvM usage frequency (most-grabbed potions first), not by
// Herblore level. A maxed PvMer reaches for Prayer / Super combat / Sara
// brew / Super restore before they touch Attack potion or Antipoison, so
// those rows are what they see first when they open the Potions tab. The
// "finished" column is the most common PvM use of each herb — Toadflax →
// Saradomin brew (not Agility potion), Kwuarm → Super strength, etc.
const POTION_FAMILIES: PotionFamilyDef[] = [
  // Top tier — daily PvM essentials
  { clean: "Ranarr weed",   grimy: "Grimy ranarr weed",   unfinished: "Ranarr potion (unf)",      finished: "Prayer potion",       secondary: "Snape grass" },
  { clean: "Torstol",       grimy: "Grimy torstol",       unfinished: "Torstol potion (unf)",     finished: "Super combat potion", secondary: "Torstol" },
  { clean: "Toadflax",      grimy: "Grimy toadflax",      unfinished: "Toadflax potion (unf)",    finished: "Saradomin brew",      secondary: "Crushed nest" },
  { clean: "Snapdragon",    grimy: "Grimy snapdragon",    unfinished: "Snapdragon potion (unf)",  finished: "Super restore",       secondary: "Red spiders' eggs" },
  // Tier 2 — boss-specific staples
  { clean: "Lantadyme",     grimy: "Grimy lantadyme",     unfinished: "Lantadyme potion (unf)",   finished: "Antifire potion",     secondary: "Dragon scale dust" },
  { clean: "Dwarf weed",    grimy: "Grimy dwarf weed",    unfinished: "Dwarf weed potion (unf)",  finished: "Ranging potion",      secondary: "Wine of zamorak" },
  { clean: "Avantoe",       grimy: "Grimy avantoe",       unfinished: "Avantoe potion (unf)",     finished: "Super energy",        secondary: "Mort myre fungus" },
  { clean: "Cadantine",     grimy: "Grimy cadantine",     unfinished: "Cadantine potion (unf)",   finished: "Super defence",       secondary: "White berries" },
  { clean: "Kwuarm",        grimy: "Grimy kwuarm",        unfinished: "Kwuarm potion (unf)",      finished: "Super strength",      secondary: "Limpwurt root" },
  { clean: "Irit leaf",     grimy: "Grimy irit leaf",     unfinished: "Irit potion (unf)",        finished: "Super attack",        secondary: "Eye of newt" },
  { clean: "Huasca",        grimy: "Grimy huasca",        unfinished: "Huasca potion (unf)",      finished: "Sanfew serum",        secondary: "Mort myre fungus" },
  // Tier 3 — utility / lower tier
  { clean: "Harralander",   grimy: "Grimy harralander",   unfinished: "Harralander potion (unf)", finished: "Combat potion",       secondary: "Goat horn dust" },
  { clean: "Tarromin",      grimy: "Grimy tarromin",      unfinished: "Tarromin potion (unf)",    finished: "Strength potion",     secondary: "Limpwurt root" },
  { clean: "Guam leaf",     grimy: "Grimy guam leaf",     unfinished: "Guam potion (unf)",        finished: "Attack potion",       secondary: "Eye of newt" },
  { clean: "Marrentill",    grimy: "Grimy marrentill",    unfinished: "Marrentill potion (unf)",  finished: "Antipoison",          secondary: "Unicorn horn dust" }
];

// 8-column herb-family row template:
//   [grimy] [clean] [secondary] [unfinished] [(4)] [(3)] [(2)] [(1)]
// Secondary sits between clean herb and unfinished pot so the row reads as
// the actual brewing workflow: grimy → clean → add secondary → brew unf →
// finished doses. All comparisons are case-insensitive exact matches;
// missing items become bank fillers in their cell so the row reads as a
// complete pipeline.
type PotionCellMatcher = (name: string) => boolean;
function rowTemplate(fam: PotionFamilyDef): PotionCellMatcher[] {
  const grimyLow = fam.grimy.toLowerCase();
  const cleanLow = fam.clean.toLowerCase();
  const unfLow   = fam.unfinished.toLowerCase();
  const finLow   = fam.finished.toLowerCase();
  const secLow   = fam.secondary?.toLowerCase();
  return [
    (n) => n.toLowerCase() === grimyLow,
    (n) => n.toLowerCase() === cleanLow,
    (n) => secLow ? n.toLowerCase() === secLow : false,
    (n) => n.toLowerCase() === unfLow,
    (n) => n.toLowerCase() === `${finLow}(4)`,
    (n) => n.toLowerCase() === `${finLow}(3)`,
    (n) => n.toLowerCase() === `${finLow}(2)`,
    (n) => n.toLowerCase() === `${finLow}(1)`
  ];
}

// The canonical name of each of the 8 cells in a potion-family row, so a
// filler in any cell can label what's missing ("Prayer potion(3)").
function rowCellNames(fam: PotionFamilyDef): string[] {
  return [
    fam.grimy,
    fam.clean,
    fam.secondary ?? "",
    fam.unfinished,
    `${fam.finished}(4)`,
    `${fam.finished}(3)`,
    `${fam.finished}(2)`,
    `${fam.finished}(1)`
  ];
}

function buildPotionsLayout(items: OrganizedItem[]): LayoutResult {
  const layout: Record<number, number> = {};
  const fillerLabels: Record<number, string> = {};
  const used = new Set<number>();
  let cursor = 0;

  // For each herb family, build its row from the user's items.
  for (const fam of POTION_FAMILIES) {
    const matchers = rowTemplate(fam);
    const cellNames = rowCellNames(fam);
    const rowIds = matchers.map((match) => {
      const hit = items.find((it) => !used.has(it.id) && match(it.name));
      if (hit) {
        used.add(hit.id);
        return hit.id;
      }
      return BANK_FILLER_ID;
    });
    // Skip families where the entire row would be fillers — that family is
    // not represented at all in the bank. Keeps the tab focused on what the
    // player actually has, with fillers only inside families they own.
    const ownedInRow = rowIds.filter((id) => id !== BANK_FILLER_ID).length;
    if (ownedInRow === 0) continue;

    for (let i = 0; i < GRID_COLS; i++) {
      layout[cursor + i] = rowIds[i];
      // Name the filler cell so the player sees the missing pipeline step.
      if (rowIds[i] === BANK_FILLER_ID && cellNames[i]) {
        fillerLabels[cursor + i] = cellNames[i];
      }
    }
    cursor += GRID_COLS;
  }

  // Anything we didn't place (overflow potions like brews, divine pots,
  // vials, herblore tools) gets a dense top/bottom strip after the family
  // rows. This keeps the family rows pristine and dumps leftovers below.
  const leftover = items.filter((it) => !used.has(it.id));
  for (const it of leftover) {
    layout[cursor++] = it.id;
  }

  return { layout, fillerLabels };
}

// ─── Skilling layout — themed rows + dense overflow ─────────────────────────
// Three opinionated rows at the top of the Skilling tab, then a dense
// strip of everything else. Each themed row is 8 cells wide and falls back
// to bank-filler tiles for missing pieces so the row stays visually whole
// (matches how a serious player's skilling tab actually looks). Order is
// pouches → essence → tools because that's how often each row is touched:
// pouches first (runecraft daily), essence next (same trip), tools last
// (replaced only when upgraded).

// A row cell is either a matcher (find the user's matching item) or null
// (always render a filler in that position). Splitting these out makes the
// "always filler" trailing cells in short rows explicit.
type SkillingRowMatcher = ((name: string) => boolean) | null;

// Each row also carries `cellNames`: the canonical name of the item that
// belongs in each cell, used to label a bank-filler when that cell is empty.
// "" means the cell is a permanent pad with no nameable item.
const SKILLING_ROWS: Array<{ label: string; cells: SkillingRowMatcher[]; cellNames: string[] }> = [
  {
    label: "Rune pouches",
    // 5 canonical pouches (Massive doesn't exist in OSRS); 3 trailing
    // null-cells render as permanent fillers to keep the row 8-wide.
    cells: [
      (n) => /^small pouch$/i.test(n),
      (n) => /^medium pouch$/i.test(n),
      (n) => /^large pouch$/i.test(n),
      (n) => /^giant pouch$/i.test(n),
      (n) => /^colossal pouch$/i.test(n),
      null, null, null
    ],
    cellNames: ["Small pouch", "Medium pouch", "Large pouch", "Giant pouch", "Colossal pouch", "", "", ""]
  },
  {
    label: "Essence + RC supplies",
    cells: [
      (n) => /^pure essence$/i.test(n),
      (n) => /^daeyalt essence$/i.test(n),
      (n) => /^guardian essence$/i.test(n),
      (n) => /^elemental essence$/i.test(n),
      (n) => /^catalytic essence$/i.test(n),
      (n) => /^abyssal pearls$/i.test(n),
      (n) => /^binding necklace$/i.test(n),
      (n) => /^rune pouch$/i.test(n) || /^divine rune pouch$/i.test(n)
    ],
    cellNames: ["Pure essence", "Daeyalt essence", "Guardian essence", "Elemental essence", "Catalytic essence", "Abyssal pearls", "Binding necklace", "Rune pouch"]
  },
  {
    label: "Core skilling tools",
    // Best-of-each: prefer the highest-tier tool the player owns. Each
    // matcher tries Crystal/Infernal/Dragon first, falling back to rune
    // and lower. dedupSkillingTools above already culled the lower-tier
    // pickaxe/hatchet copies, so we'll usually only have one of each here.
    cells: [
      // Pickaxe — best owned
      (n) => /^(3rd age|crystal|infernal|dragon|gilded|rune|adamant|mithril|black|steel|iron|bronze) pickaxe(?:\s*\(\w+\))?$/i.test(n),
      // Hatchet — best owned
      (n) => /^(3rd age|crystal|infernal|dragon|gilded|rune|adamant|mithril|black|steel|iron|bronze) (?:axe|hatchet)(?:\s*\(\w+\))?$/i.test(n),
      // Knife
      (n) => /^knife$/i.test(n),
      // Hammer (regular, not Imcando)
      (n) => /^hammer$/i.test(n) || /^imcando hammer$/i.test(n),
      // Chisel (regular, then crystal saw)
      (n) => /^chisel$/i.test(n),
      // Tinderbox / lit lantern
      (n) => /^(tinderbox|bruma torch|bullseye lantern|oil lantern|mining lantern|lit (?:bug )?lantern)$/i.test(n),
      // Fishing — best tool the player has (Crystal/Infernal/Dragon harpoon,
      // then rod, then any net)
      (n) => /^(crystal harpoon|infernal harpoon|dragon harpoon|barb-tail harpoon|harpoon)$/i.test(n)
        || /^(fly fishing rod|fishing rod)$/i.test(n)
        || /^(small fishing net|big fishing net)$/i.test(n),
      // Saw (Crystal saw or normal Saw — Construction tool)
      (n) => /^(crystal saw|saw)$/i.test(n)
    ],
    // Generic tool names — a missing tool cell shows the tool type, since
    // any tier counts (the player just needs *a* pickaxe, etc.).
    cellNames: ["Pickaxe", "Hatchet", "Knife", "Hammer", "Chisel", "Tinderbox", "Harpoon", "Saw"]
  }
];

// Render the Skilling tab. For each themed row, slot in the matching items
// the player owns; empty cells get bank-filler tiles. Rows that would be
// 100% fillers are skipped (player owns nothing from that group). After all
// themed rows, dense-pack everything left over so the player still sees
// their ores/bars/logs/seeds/etc.
function buildSkillingLayout(items: OrganizedItem[]): LayoutResult {
  const layout: Record<number, number> = {};
  const fillerLabels: Record<number, string> = {};
  const used = new Set<number>();
  let cursor = 0;

  for (const row of SKILLING_ROWS) {
    const rowIds = row.cells.map((match) => {
      // null matcher = always-filler slot (trailing pad on short rows).
      if (match === null) return BANK_FILLER_ID;
      const hit = items.find((it) => !used.has(it.id) && match(it.name));
      if (hit) {
        used.add(hit.id);
        return hit.id;
      }
      return BANK_FILLER_ID;
    });
    // Drop rows where the player owns nothing — no point showing 8 fillers
    // for a category they haven't started yet.
    const ownedInRow = rowIds.filter((id) => id !== BANK_FILLER_ID).length;
    if (ownedInRow === 0) continue;
    for (let i = 0; i < GRID_COLS; i++) {
      layout[cursor + i] = rowIds[i];
      // Name the filler cell (skip the "" pad cells with no nameable item).
      if (rowIds[i] === BANK_FILLER_ID && row.cellNames[i]) {
        fillerLabels[cursor + i] = row.cellNames[i];
      }
    }
    cursor += GRID_COLS;
  }

  // Dense overflow — every other Skilling item (ores, bars, logs, seeds,
  // hides, gems, raw fish, planks, …) packs left-to-right after the themed
  // rows. We preserve sortSkilling's order so skill-blocks stay grouped.
  const leftover = items.filter((it) => !used.has(it.id));
  for (const it of leftover) {
    layout[cursor++] = it.id;
  }

  return { layout, fillerLabels };
}

// Silence unused import warning — `layoutForTab` not used here yet but exported
// from the same family of functions in case future tabs delegate to it.
export { layoutForTab };
