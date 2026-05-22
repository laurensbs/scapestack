// Hand-curated PvM gear database. Maps OSRS item IDs to gear metadata that
// drives the PvM Gear tab layout (slot, combat style, tier, role). Entries
// cover the ~280 items that matter visually in a PvM bank: BIS, near-BIS,
// every spec weapon, slayer utility, all mid-tier alternatives, and the
// full Barrows / Mystic / d'hide / Dragon families.
//
// All IDs verified against data/items.json (OSRS Wiki dump).
//
// Tier convention (lower = better in its slot):
//   0  best-in-slot (Torva, Masori, Ancestral, Tbow, Scythe, Shadow, …)
//   1  near-BIS (Bandos, Karil, Virtus, Ghrazi, ZCB, Sang, …)
//   2  upper-mid (Inquisitor, Crystal, Mystic, Bowfa primary, Trident, …)
//   3  mid (Barrows non-set, Obsidian, Black d'hide, Mystic, Rune CB, …)
//   4  low / training (Dragon scim, Rune armour, Magic shortbow, mystic staves, …)
//   5  starter (Mithril / Adamant / cheaper rune)
//
// Role distinguishes how an item participates in the gear tab:
//   "primary"  — main weapon for its style (sorted to weapon-row head)
//   "spec"     — carried for special attack, clusters at weapon-row tail
//   "armour"   — passive gear (body/legs/helm/etc.)
//   "ammo"     — arrows/bolts/darts (separate row)
//   "utility"  — slayer-task gear, salve amulet, lightbearer
//   "food"     — bottom row of the gear tab

export type GearStyle = "melee" | "ranged" | "magic" | "neutral";
export type GearRole = "primary" | "spec" | "armour" | "ammo" | "utility" | "food";

export type GearSlot =
  | "head" | "cape" | "neck" | "ammo" | "weapon" | "shield"
  | "body" | "legs" | "hands" | "feet" | "ring";

export interface GearEntry {
  slot: GearSlot;
  style: GearStyle;
  tier: number;
  role: GearRole;
  /** Optional ordering nudge within a (slot, style, tier, role) bucket. */
  order?: number;
  /**
   * Set membership — armour pieces that belong together (Bandos chest +
   * tassets + boots) share the same setId. The PvM Gear layout groups
   * same-setId items into a single visual column so a set never appears
   * spread across rows. Weapons and standalone items leave this undefined.
   */
  setId?: string;
}

export const PVM_ITEMS: Record<number, GearEntry> = {
  // ─── Melee primaries ───────────────────────────────────────────────────────
  22325: { slot: "weapon", style: "melee", tier: 0, role: "primary", order: 0 },  // Scythe of vitur
  25484: { slot: "weapon", style: "melee", tier: 0, role: "primary", order: 1 },  // Soulreaper axe
  28997: { slot: "weapon", style: "melee", tier: 0, role: "primary", order: 1 },  // Dual macuahuitl
  21003: { slot: "weapon", style: "melee", tier: 0, role: "primary", order: 2 },  // Elder maul
  26219: { slot: "weapon", style: "melee", tier: 1, role: "primary", order: 3 },  // Osmumten's fang
  22324: { slot: "weapon", style: "melee", tier: 1, role: "primary", order: 4 },  // Ghrazi rapier
  23995: { slot: "weapon", style: "melee", tier: 1, role: "primary", order: 5 },  // Blade of saeldor (c)
  24417: { slot: "weapon", style: "melee", tier: 2, role: "primary", order: 6 },  // Inquisitor's mace (canonical)
  4151:  { slot: "weapon", style: "melee", tier: 3, role: "primary", order: 7 },  // Abyssal whip
  12006: { slot: "weapon", style: "melee", tier: 2, role: "primary", order: 8 },  // Abyssal tentacle
  4587:  { slot: "weapon", style: "melee", tier: 4, role: "primary", order: 9 },  // Dragon scimitar
  1333:  { slot: "weapon", style: "melee", tier: 5, role: "primary", order: 10 }, // Rune scimitar
  1305:  { slot: "weapon", style: "melee", tier: 4, role: "primary", order: 11 }, // Dragon longsword
  1434:  { slot: "weapon", style: "melee", tier: 4, role: "primary", order: 12 }, // Dragon mace
  1377:  { slot: "weapon", style: "melee", tier: 4, role: "primary", order: 13 }, // Dragon battleaxe
  7158:  { slot: "weapon", style: "melee", tier: 4, role: "primary", order: 14 }, // Dragon 2h sword

  // ─── Melee spec weapons (canonical order DDS→claws→voidwaker→godswords→GMaul→DWH) ───
  1215:  { slot: "weapon", style: "melee", tier: 2, role: "spec", order: 0 },  // Dragon dagger
  5680:  { slot: "weapon", style: "melee", tier: 2, role: "spec", order: 0 },  // Dragon dagger(p+)
  5698:  { slot: "weapon", style: "melee", tier: 2, role: "spec", order: 0 },  // Dragon dagger(p++)
  13652: { slot: "weapon", style: "melee", tier: 1, role: "spec", order: 1 },  // Dragon claws
  27690: { slot: "weapon", style: "melee", tier: 1, role: "spec", order: 2 },  // Voidwaker
  11838: { slot: "weapon", style: "melee", tier: 2, role: "spec", order: 3 },  // Saradomin sword (kept for legacy)
  11802: { slot: "weapon", style: "melee", tier: 2, role: "spec", order: 4 },  // Armadyl godsword
  11804: { slot: "weapon", style: "melee", tier: 2, role: "spec", order: 5 },  // Bandos godsword
  11806: { slot: "weapon", style: "melee", tier: 2, role: "spec", order: 6 },  // Saradomin godsword
  4153:  { slot: "weapon", style: "melee", tier: 3, role: "spec", order: 7 },  // Granite maul
  13576: { slot: "weapon", style: "melee", tier: 1, role: "spec", order: 8 },  // Dragon warhammer
  3204:  { slot: "weapon", style: "melee", tier: 3, role: "spec", order: 9 },  // Dragon halberd

  // ─── Ranged primaries ──────────────────────────────────────────────────────
  20997: { slot: "weapon", style: "ranged", tier: 0, role: "primary", order: 0 }, // Twisted bow
  26374: { slot: "weapon", style: "ranged", tier: 0, role: "primary", order: 1 }, // Zaryte crossbow
  25865: { slot: "weapon", style: "ranged", tier: 1, role: "primary", order: 2 }, // Bow of faerdhinen (inactive)
  25884: { slot: "weapon", style: "ranged", tier: 1, role: "primary", order: 2 }, // Bow of faerdhinen (c)
  12926: { slot: "weapon", style: "ranged", tier: 1, role: "primary", order: 3 }, // Toxic blowpipe
  11785: { slot: "weapon", style: "ranged", tier: 2, role: "primary", order: 4 }, // Armadyl crossbow
  21012: { slot: "weapon", style: "ranged", tier: 2, role: "primary", order: 5 }, // Dragon hunter crossbow
  22550: { slot: "weapon", style: "ranged", tier: 2, role: "primary", order: 6 }, // Craw's bow
  27652: { slot: "weapon", style: "ranged", tier: 3, role: "primary", order: 6 }, // Webweaver bow (u)
  27655: { slot: "weapon", style: "ranged", tier: 2, role: "primary", order: 6 }, // Webweaver bow
  4734:  { slot: "weapon", style: "ranged", tier: 3, role: "primary", order: 7 }, // Karil's crossbow
  9185:  { slot: "weapon", style: "ranged", tier: 3, role: "primary", order: 8 }, // Rune crossbow
  861:   { slot: "weapon", style: "ranged", tier: 4, role: "primary", order: 9 }, // Magic shortbow
  12788: { slot: "weapon", style: "ranged", tier: 4, role: "primary", order: 9 }, // Magic shortbow (i)
  10284: { slot: "weapon", style: "ranged", tier: 4, role: "primary", order: 9 }, // Magic comp bow
  859:   { slot: "weapon", style: "ranged", tier: 4, role: "primary", order: 10 },// Magic longbow
  21902: { slot: "weapon", style: "ranged", tier: 4, role: "primary", order: 11 },// Dragon crossbow

  // ─── Ranged specs ──────────────────────────────────────────────────────────
  11235: { slot: "weapon", style: "ranged", tier: 3, role: "spec", order: 0 },  // Dark bow

  // ─── Magic primaries ───────────────────────────────────────────────────────
  27275: { slot: "weapon", style: "magic", tier: 0, role: "primary", order: 0 }, // Tumeken's shadow
  22323: { slot: "weapon", style: "magic", tier: 1, role: "primary", order: 1 }, // Sanguinesti staff
  24423: { slot: "weapon", style: "magic", tier: 1, role: "primary", order: 2 }, // Harmonised nightmare staff
  12899: { slot: "weapon", style: "magic", tier: 2, role: "primary", order: 3 }, // Trident of the swamp
  11905: { slot: "weapon", style: "magic", tier: 2, role: "primary", order: 4 }, // Trident of the seas
  22296: { slot: "weapon", style: "magic", tier: 2, role: "primary", order: 5 }, // Staff of light
  11791: { slot: "weapon", style: "magic", tier: 2, role: "primary", order: 5 }, // Staff of the dead
  24144: { slot: "weapon", style: "magic", tier: 2, role: "primary", order: 5 }, // Staff of balance
  21006: { slot: "weapon", style: "magic", tier: 2, role: "primary", order: 6 }, // Kodai wand
  6914:  { slot: "weapon", style: "magic", tier: 3, role: "primary", order: 7 }, // Master wand
  4675:  { slot: "weapon", style: "magic", tier: 4, role: "primary", order: 8 }, // Ancient staff
  1409:  { slot: "weapon", style: "magic", tier: 4, role: "primary", order: 9 }, // Iban's staff
  1401:  { slot: "weapon", style: "magic", tier: 4, role: "primary", order: 10 },// Mystic fire staff
  1403:  { slot: "weapon", style: "magic", tier: 4, role: "primary", order: 10 },// Mystic water staff
  1407:  { slot: "weapon", style: "magic", tier: 4, role: "primary", order: 10 },// Mystic earth staff
  1405:  { slot: "weapon", style: "magic", tier: 4, role: "primary", order: 10 },// Mystic air staff
  4710:  { slot: "weapon", style: "magic", tier: 3, role: "primary", order: 11 },// Ahrim's staff
  2415:  { slot: "weapon", style: "magic", tier: 4, role: "primary", order: 12 },// Saradomin staff
  2417:  { slot: "weapon", style: "magic", tier: 4, role: "primary", order: 12 },// Zamorak staff
  2416:  { slot: "weapon", style: "magic", tier: 4, role: "primary", order: 12 },// Guthix staff
  4170:  { slot: "weapon", style: "magic", tier: 4, role: "primary", order: 13 },// Slayer's staff
  21255: { slot: "weapon", style: "magic", tier: 4, role: "primary", order: 13 },// Slayer's staff (e)
  12902: { slot: "weapon", style: "magic", tier: 3, role: "primary", order: 14 },// Toxic staff (uncharged)
  12904: { slot: "weapon", style: "magic", tier: 2, role: "primary", order: 6 }, // Toxic staff of the dead

  // ─── Magic specs ───────────────────────────────────────────────────────────
  24424: { slot: "weapon", style: "magic", tier: 1, role: "spec", order: 0 },  // Volatile nightmare staff
  24425: { slot: "weapon", style: "magic", tier: 1, role: "spec", order: 1 },  // Eldritch nightmare staff

  // ─── Barrows weapons (one per brother) ─────────────────────────────────────
  4755:  { slot: "weapon", style: "melee", tier: 3, role: "primary", order: 15 },// Verac's flail
  4747:  { slot: "weapon", style: "melee", tier: 3, role: "primary", order: 15 },// Torag's hammers (off-hand pair, but kept as weapon row)
  4726:  { slot: "weapon", style: "melee", tier: 3, role: "primary", order: 15 },// Guthan's warspear
  4718:  { slot: "weapon", style: "melee", tier: 3, role: "primary", order: 15 },// Dharok's greataxe

  // ─── Wildy off-hand & magic books ──────────────────────────────────────────
  6889:  { slot: "shield", style: "magic",  tier: 1, role: "armour" },          // Mage's book
  11924: { slot: "shield", style: "melee",  tier: 1, role: "armour" },          // Malediction ward
  11926: { slot: "shield", style: "ranged", tier: 1, role: "armour" },          // Odium ward

  // ─── Other useful gear ─────────────────────────────────────────────────────
  6523:  { slot: "weapon", style: "melee", tier: 4, role: "primary", order: 16 },// Toktz-xil-ak (obsidian sword)
  6525:  { slot: "weapon", style: "melee", tier: 4, role: "primary", order: 16 },// Toktz-xil-ek (obsidian dagger)
  6527:  { slot: "weapon", style: "melee", tier: 4, role: "primary", order: 16 },// Tzhaar-ket-em (obsidian mace)
  6528:  { slot: "weapon", style: "melee", tier: 4, role: "primary", order: 16 },// Tzhaar-ket-om (obsidian maul)
  6524:  { slot: "shield", style: "melee", tier: 3, role: "armour" },             // Toktz-ket-xil (obsidian shield)
  6526:  { slot: "weapon", style: "magic", tier: 4, role: "primary", order: 15 },// Toktz-mej-tal (obsidian staff)
  8880:  { slot: "weapon", style: "ranged", tier: 4, role: "primary", order: 12 },// Dorgeshuun crossbow
  10156: { slot: "weapon", style: "ranged", tier: 4, role: "primary", order: 12 },// Hunters' crossbow
  23987: { slot: "weapon", style: "melee", tier: 3, role: "primary", order: 16 },// Crystal halberd (charged form)
  21742: { slot: "weapon", style: "melee", tier: 2, role: "spec", order: 10 },   // Granite hammer (spec hammer)

  // Granite ring — combat ring, stays in PvM Gear.
  21739: { slot: "ring", style: "melee", tier: 2, role: "armour" },              // Granite ring
  // Phoenix necklace — survival utility, but more commonly worn in PvM as a
  // safety net; left out of DB so classifier puts it in Teleports/utility.
  // Bonecrusher necklace — pure utility (auto-buries), not gear.
  // Slayer ring (eternal) — teleport utility.

  // Spiked manacles — wildy ranged hands piece, stays.
  23389: { slot: "hands", style: "ranged", tier: 2, role: "armour" },            // Spiked manacles

  // Helm of neitiznot (or)
  28070: { slot: "head", style: "melee", tier: 2, role: "armour" },              // Helm of neitiznot (or)
  6131:  { slot: "head", style: "ranged", tier: 4, role: "armour" },             // Spined helm

  // ─── Initiate / Proselyte (prayer-bonus melee) ─────────────────────────────
  5574:  { slot: "head", style: "melee", tier: 4, role: "armour" }, // Initiate sallet
  5575:  { slot: "body", style: "melee", tier: 4, role: "armour" }, // Initiate hauberk
  5576:  { slot: "legs", style: "melee", tier: 4, role: "armour" }, // Initiate cuisse
  9672:  { slot: "head", style: "melee", tier: 3, role: "armour" }, // Proselyte sallet
  9674:  { slot: "body", style: "melee", tier: 3, role: "armour" }, // Proselyte hauberk
  9676:  { slot: "legs", style: "melee", tier: 3, role: "armour" }, // Proselyte cuisse
  9678:  { slot: "legs", style: "melee", tier: 3, role: "armour" }, // Proselyte tasset

  // ─── God d'hide sets (mid-tier ranged) ─────────────────────────────────────
  // Order: Bandos > Armadyl > Ancient > Saradomin / Guthix / Zamorak (no
  // gameplay diff between aligned gods, just cosmetic).
  12504: { slot: "head", style: "ranged", tier: 3, role: "armour" }, // Bandos coif
  12500: { slot: "body", style: "ranged", tier: 3, role: "armour" }, // Bandos d'hide body
  12502: { slot: "legs", style: "ranged", tier: 3, role: "armour" }, // Bandos chaps
  12512: { slot: "head", style: "ranged", tier: 3, role: "armour" }, // Armadyl coif
  12508: { slot: "body", style: "ranged", tier: 3, role: "armour" }, // Armadyl d'hide body
  12510: { slot: "legs", style: "ranged", tier: 3, role: "armour" }, // Armadyl chaps
  12496: { slot: "head", style: "ranged", tier: 3, role: "armour" }, // Ancient coif
  12492: { slot: "body", style: "ranged", tier: 3, role: "armour" }, // Ancient d'hide body
  12494: { slot: "legs", style: "ranged", tier: 3, role: "armour" }, // Ancient chaps
  10390: { slot: "head", style: "ranged", tier: 3, role: "armour" }, // Saradomin coif
  10386: { slot: "body", style: "ranged", tier: 3, role: "armour" }, // Saradomin d'hide body
  10388: { slot: "legs", style: "ranged", tier: 3, role: "armour" }, // Saradomin chaps
  10384: { slot: "hands", style: "ranged", tier: 3, role: "armour" },// Saradomin bracers
  10382: { slot: "head", style: "ranged", tier: 3, role: "armour" }, // Guthix coif
  10378: { slot: "body", style: "ranged", tier: 3, role: "armour" }, // Guthix d'hide body
  10380: { slot: "legs", style: "ranged", tier: 3, role: "armour" }, // Guthix chaps
  10376: { slot: "hands", style: "ranged", tier: 3, role: "armour" },// Guthix bracers
  10374: { slot: "head", style: "ranged", tier: 3, role: "armour" }, // Zamorak coif
  10370: { slot: "body", style: "ranged", tier: 3, role: "armour" }, // Zamorak d'hide body
  10372: { slot: "legs", style: "ranged", tier: 3, role: "armour" }, // Zamorak chaps
  10368: { slot: "hands", style: "ranged", tier: 3, role: "armour" },// Zamorak bracers

  // ─── Granite gear (mid-tier melee tank) ────────────────────────────────────
  10589: { slot: "head", style: "melee", tier: 3, role: "armour" },  // Granite helm
  10564: { slot: "body", style: "melee", tier: 3, role: "armour" },  // Granite body
  6809:  { slot: "legs", style: "melee", tier: 3, role: "armour" },  // Granite legs
  3122:  { slot: "shield", style: "melee", tier: 3, role: "armour" },// Granite shield
  21736: { slot: "hands", style: "melee", tier: 3, role: "armour" }, // Granite gloves

  // ─── Obsidian armour set ───────────────────────────────────────────────────
  21298: { slot: "head", style: "melee", tier: 3, role: "armour" },  // Obsidian helmet
  21301: { slot: "body", style: "melee", tier: 3, role: "armour" },  // Obsidian platebody
  21304: { slot: "legs", style: "melee", tier: 3, role: "armour" },  // Obsidian platelegs

  // ─── Wilderness PKer set (one-shot consumed on death) ──────────────────────
  22622: { slot: "weapon", style: "melee", tier: 1, role: "primary", order: 17 }, // Statius's warhammer
  22613: { slot: "weapon", style: "melee", tier: 1, role: "primary", order: 17 }, // Vesta's longsword
  22636: { slot: "ammo",   style: "ranged", tier: 1, role: "ammo" },               // Morrigan's javelin
  22647: { slot: "weapon", style: "magic", tier: 1, role: "primary", order: 16 },  // Zuriel's staff

  // ─── DT2 boss-key items (pre-assembled — Drops via bucket-override) ────────
  // Eye of the duke (28321) is a quest reward — leave for classifier to route.

  // ─── Dragonbone necklace ───────────────────────────────────────────────────
  22111: { slot: "neck", style: "neutral", tier: 3, role: "armour" }, // Dragonbone necklace

  // ─── Mage robes (mid-low tier) ─────────────────────────────────────────────
  // Bark sets (Splitbark < Swampbark < Bloodbark).
  3385:  { slot: "head", style: "magic", tier: 4, role: "armour" }, // Splitbark helm
  3387:  { slot: "body", style: "magic", tier: 4, role: "armour" }, // Splitbark body
  3389:  { slot: "legs", style: "magic", tier: 4, role: "armour" }, // Splitbark legs
  25398: { slot: "head", style: "magic", tier: 3, role: "armour" }, // Swampbark helm
  25389: { slot: "body", style: "magic", tier: 3, role: "armour" }, // Swampbark body
  25401: { slot: "legs", style: "magic", tier: 3, role: "armour" }, // Swampbark legs
  25413: { slot: "head", style: "magic", tier: 3, role: "armour" }, // Bloodbark helm
  25404: { slot: "body", style: "magic", tier: 3, role: "armour" }, // Bloodbark body
  25416: { slot: "legs", style: "magic", tier: 3, role: "armour" }, // Bloodbark legs
  // Infinity robes.
  6918:  { slot: "head",  style: "magic", tier: 2, role: "armour" }, // Infinity hat
  6916:  { slot: "body",  style: "magic", tier: 2, role: "armour" }, // Infinity top
  6924:  { slot: "legs",  style: "magic", tier: 2, role: "armour" }, // Infinity bottoms (legacy)
  6920:  { slot: "feet",  style: "magic", tier: 2, role: "armour" }, // Infinity boots (override existing)
  6922:  { slot: "hands", style: "magic", tier: 2, role: "armour" }, // Infinity gloves
  // Dagon'hai (Wilderness slayer mage).
  24288: { slot: "head", style: "magic", tier: 3, role: "armour" }, // Dagon'hai hat
  24291: { slot: "body", style: "magic", tier: 3, role: "armour" }, // Dagon'hai robe top
  24294: { slot: "legs", style: "magic", tier: 3, role: "armour" }, // Dagon'hai robe bottom
  // Wizard robes (starter).
  579:   { slot: "head", style: "magic", tier: 5, role: "armour" }, // Blue wizard hat
  577:   { slot: "body", style: "magic", tier: 5, role: "armour" }, // Blue wizard robe
  1011:  { slot: "legs", style: "magic", tier: 5, role: "armour" }, // Blue skirt
  1017:  { slot: "head", style: "magic", tier: 5, role: "armour" }, // Wizard hat
  1015:  { slot: "legs", style: "magic", tier: 5, role: "armour" }, // Black skirt

  // ─── Zealot's robes (prayer-bonus mage) ────────────────────────────────────
  25438: { slot: "head", style: "magic", tier: 3, role: "armour" }, // Zealot's helm
  25434: { slot: "body", style: "magic", tier: 3, role: "armour" }, // Zealot's robe top
  25436: { slot: "legs", style: "magic", tier: 3, role: "armour" }, // Zealot's robe bottom
  25440: { slot: "feet", style: "magic", tier: 3, role: "armour" }, // Zealot's boots

  // ─── 3rd age weapons (rare, mostly collection) ─────────────────────────────
  // These DO belong in PvM Gear when actually wielded — tier 1 because BIS-tier
  // for their style historically, even if outclassed today.
  12426: { slot: "weapon", style: "melee",  tier: 1, role: "primary", order: 18 }, // 3rd age longsword
  12422: { slot: "weapon", style: "magic",  tier: 3, role: "primary", order: 12 }, // 3rd age wand
  12424: { slot: "weapon", style: "ranged", tier: 2, role: "primary", order: 12 }, // 3rd age bow

  // ─── Lunar / Dramen / spellbook tools ──────────────────────────────────────
  9084:  { slot: "weapon", style: "magic", tier: 4, role: "primary", order: 16 }, // Lunar staff
  // Dramen staff is a teleport tool — NOT in DB so it lands in Teleports via classifier.

  // ─── Studded leather (low-tier ranged) ─────────────────────────────────────
  1133:  { slot: "body", style: "ranged", tier: 5, role: "armour" }, // Studded body
  1097:  { slot: "legs", style: "ranged", tier: 5, role: "armour" }, // Studded chaps
  1131:  { slot: "body", style: "ranged", tier: 5, role: "armour" }, // Hardleather body

  // ─── Helmets: slayer / utility (top of tab) ───────────────────────────────
  11864: { slot: "head", style: "neutral", tier: 1, role: "utility" }, // Slayer helmet
  11865: { slot: "head", style: "neutral", tier: 0, role: "utility" }, // Slayer helmet (i)
  19639: { slot: "head", style: "neutral", tier: 0, role: "utility" }, // Black slayer helmet
  19641: { slot: "head", style: "neutral", tier: 0, role: "utility" }, // Black slayer helmet (i)
  19643: { slot: "head", style: "neutral", tier: 0, role: "utility" }, // Green slayer helmet
  19645: { slot: "head", style: "neutral", tier: 0, role: "utility" }, // Green slayer helmet (i)
  19647: { slot: "head", style: "neutral", tier: 0, role: "utility" }, // Red slayer helmet
  19649: { slot: "head", style: "neutral", tier: 0, role: "utility" }, // Red slayer helmet (i)
  21264: { slot: "head", style: "neutral", tier: 0, role: "utility" }, // Purple slayer helmet
  21266: { slot: "head", style: "neutral", tier: 0, role: "utility" }, // Purple slayer helmet (i)
  23073: { slot: "head", style: "neutral", tier: 0, role: "utility" }, // Hydra slayer helmet
  23075: { slot: "head", style: "neutral", tier: 0, role: "utility" }, // Hydra slayer helmet (i)
  24370: { slot: "head", style: "neutral", tier: 0, role: "utility" }, // Twisted slayer helmet
  24444: { slot: "head", style: "neutral", tier: 0, role: "utility" }, // Twisted slayer helmet (i)
  25898: { slot: "head", style: "neutral", tier: 0, role: "utility" }, // Tztok slayer helmet
  25900: { slot: "head", style: "neutral", tier: 0, role: "utility" }, // Tztok slayer helmet (i)
  25910: { slot: "head", style: "neutral", tier: 0, role: "utility" }, // Tzkal slayer helmet
  25912: { slot: "head", style: "neutral", tier: 0, role: "utility" }, // Tzkal slayer helmet (i)
  25904: { slot: "head", style: "neutral", tier: 0, role: "utility" }, // Vampyric slayer helmet
  25906: { slot: "head", style: "neutral", tier: 0, role: "utility" }, // Vampyric slayer helmet (i)
  21888: { slot: "head", style: "neutral", tier: 0, role: "utility" }, // Turquoise slayer helmet
  21890: { slot: "head", style: "neutral", tier: 0, role: "utility" }, // Turquoise slayer helmet (i)
  8921:  { slot: "head", style: "neutral", tier: 2, role: "utility" }, // Black mask (basic, uncharged)
  8901:  { slot: "head", style: "neutral", tier: 2, role: "utility" }, // Black mask (10)

  // ─── Helmets: melee ───────────────────────────────────────────────────────
  26382: { slot: "head", style: "melee", tier: 0, role: "armour", setId: "torva" },        // Torva full helm
  22326: { slot: "head", style: "melee", tier: 1, role: "armour", setId: "justiciar" },    // Justiciar faceguard
  24271: { slot: "head", style: "melee", tier: 1, role: "armour" },                        // Neitiznot faceguard (standalone)
  24419: { slot: "head", style: "melee", tier: 1, role: "armour", setId: "inquisitor" },   // Inquisitor's great helm
  10828: { slot: "head", style: "melee", tier: 2, role: "armour" },                        // Helm of neitiznot (standalone)
  4716:  { slot: "head", style: "melee", tier: 2, role: "armour", setId: "dharok" },       // Dharok's helm
  4753:  { slot: "head", style: "melee", tier: 2, role: "armour", setId: "verac" },        // Verac's helm
  4745:  { slot: "head", style: "melee", tier: 2, role: "armour", setId: "torag" },        // Torag's helm
  4724:  { slot: "head", style: "melee", tier: 2, role: "armour", setId: "guthan" },       // Guthan's helm
  3751:  { slot: "head", style: "melee", tier: 3, role: "armour" }, // Berserker helm
  3753:  { slot: "head", style: "melee", tier: 3, role: "armour" }, // Warrior helm
  1149:  { slot: "head", style: "melee", tier: 4, role: "armour" }, // Dragon med helm
  11335: { slot: "head", style: "melee", tier: 3, role: "armour" }, // Dragon full helm
  1163:  { slot: "head", style: "melee", tier: 5, role: "armour" }, // Rune full helm
  1147:  { slot: "head", style: "melee", tier: 5, role: "armour" }, // Rune med helm

  // ─── Helmets: ranged ──────────────────────────────────────────────────────
  27235: { slot: "head", style: "ranged", tier: 0, role: "armour", setId: "masori-f" },  // Masori mask (f)
  27226: { slot: "head", style: "ranged", tier: 1, role: "armour", setId: "masori" },    // Masori mask
  11826: { slot: "head", style: "ranged", tier: 1, role: "armour", setId: "armadyl" },   // Armadyl helmet
  4732:  { slot: "head", style: "ranged", tier: 2, role: "armour", setId: "karil" },     // Karil's coif
  23971: { slot: "head", style: "ranged", tier: 2, role: "armour", setId: "crystal" },   // Crystal helm
  1169:  { slot: "head", style: "ranged", tier: 4, role: "armour" }, // Coif
  3749:  { slot: "head", style: "ranged", tier: 3, role: "armour" }, // Archer helm
  2581:  { slot: "head", style: "ranged", tier: 3, role: "armour" }, // Robin hood hat

  // ─── Helmets: magic ───────────────────────────────────────────────────────
  21018: { slot: "head", style: "magic", tier: 0, role: "armour", setId: "ancestral" }, // Ancestral hat
  26241: { slot: "head", style: "magic", tier: 1, role: "armour", setId: "virtus" },    // Virtus mask
  4708:  { slot: "head", style: "magic", tier: 2, role: "armour", setId: "ahrim" },     // Ahrim's hood
  4089:  { slot: "head", style: "magic", tier: 3, role: "armour", setId: "mystic" },    // Mystic hat
  10342: { slot: "head", style: "magic", tier: 1, role: "armour" }, // 3rd age mage hat
  3755:  { slot: "head", style: "magic", tier: 3, role: "armour" }, // Farseer helm

  // ─── Capes ────────────────────────────────────────────────────────────────
  21295: { slot: "cape", style: "neutral", tier: 0, role: "armour" }, // Infernal cape
  6570:  { slot: "cape", style: "neutral", tier: 1, role: "armour" }, // Fire cape
  22109: { slot: "cape", style: "ranged",  tier: 1, role: "armour" }, // Ava's assembler
  11628: { slot: "cape", style: "ranged",  tier: 1, role: "armour" }, // Ava's device
  10499: { slot: "cape", style: "ranged",  tier: 2, role: "armour" }, // Ava's accumulator
  10498: { slot: "cape", style: "ranged",  tier: 3, role: "armour" }, // Ava's attractor
  21913: { slot: "cape", style: "neutral", tier: 2, role: "armour" }, // Mythical cape
  13124: { slot: "cape", style: "neutral", tier: 2, role: "armour" }, // Ardougne cloak 4
  13123: { slot: "cape", style: "neutral", tier: 2, role: "armour" }, // Ardougne cloak 3
  13122: { slot: "cape", style: "neutral", tier: 3, role: "armour" }, // Ardougne cloak 2
  13121: { slot: "cape", style: "neutral", tier: 4, role: "armour" }, // Ardougne cloak 1
  2412:  { slot: "cape", style: "magic",   tier: 3, role: "armour" }, // Saradomin cape
  2414:  { slot: "cape", style: "magic",   tier: 3, role: "armour" }, // Zamorak cape
  2413:  { slot: "cape", style: "ranged",  tier: 3, role: "armour" }, // Guthix cape
  21791: { slot: "cape", style: "magic",   tier: 1, role: "armour" }, // Imbued saradomin cape
  21795: { slot: "cape", style: "melee",   tier: 1, role: "armour" }, // Imbued zamorak cape
  21793: { slot: "cape", style: "ranged",  tier: 1, role: "armour" }, // Imbued guthix cape

  // ─── Amulets ──────────────────────────────────────────────────────────────
  19553: { slot: "neck", style: "melee",   tier: 0, role: "armour" }, // Amulet of torture
  29801: { slot: "neck", style: "melee",   tier: 0, role: "armour" }, // Amulet of rancour
  29804: { slot: "neck", style: "melee",   tier: 0, role: "armour" }, // Amulet of rancour (s)
  6585:  { slot: "neck", style: "melee",   tier: 2, role: "armour" }, // Amulet of fury
  24780: { slot: "neck", style: "melee",   tier: 1, role: "armour" }, // Amulet of blood fury
  11128: { slot: "neck", style: "melee",   tier: 2, role: "armour" }, // Berserker necklace
  19547: { slot: "neck", style: "ranged",  tier: 0, role: "armour" }, // Necklace of anguish
  22249: { slot: "neck", style: "ranged",  tier: 0, role: "armour" }, // Necklace of anguish (or)
  12002: { slot: "neck", style: "magic",   tier: 0, role: "armour" }, // Occult necklace
  19720: { slot: "neck", style: "magic",   tier: 0, role: "armour" }, // Occult necklace (or)
  12018: { slot: "neck", style: "neutral", tier: 0, role: "utility" },// Salve amulet(ei)
  12017: { slot: "neck", style: "neutral", tier: 1, role: "utility" },// Salve amulet(i)
  10588: { slot: "neck", style: "neutral", tier: 2, role: "utility" },// Salve amulet (e)
  4081:  { slot: "neck", style: "neutral", tier: 3, role: "utility" },// Salve amulet
  // Amulet of glory(6) intentionally NOT in DB — it's a teleport amulet that
  // belongs in the Teleports tab via the classifier's Charged jewellery rule,
  // not in PvM Gear next to passive combat ammies.

  // ─── Ammo ─────────────────────────────────────────────────────────────────
  11212: { slot: "ammo", style: "ranged", tier: 0, role: "ammo" }, // Dragon arrow
  4769:  { slot: "ammo", style: "ranged", tier: 0, role: "ammo" }, // Amethyst arrow
  892:   { slot: "ammo", style: "ranged", tier: 2, role: "ammo" }, // Rune arrow
  890:   { slot: "ammo", style: "ranged", tier: 3, role: "ammo" }, // Adamant arrow
  888:   { slot: "ammo", style: "ranged", tier: 4, role: "ammo" }, // Mithril arrow
  8771:  { slot: "ammo", style: "ranged", tier: 1, role: "ammo" }, // Ruby dragon bolts (e)
  1687:  { slot: "ammo", style: "ranged", tier: 1, role: "ammo" }, // Diamond dragon bolts (e)
  1668:  { slot: "ammo", style: "ranged", tier: 0, role: "ammo" }, // Dragonstone dragon bolts (e)
  1669:  { slot: "ammo", style: "ranged", tier: 0, role: "ammo" }, // Onyx dragon bolts (e)
  9244:  { slot: "ammo", style: "ranged", tier: 1, role: "ammo" }, // Dragonstone bolts (e)
  9245:  { slot: "ammo", style: "ranged", tier: 1, role: "ammo" }, // Onyx bolts (e)
  11230: { slot: "ammo", style: "ranged", tier: 2, role: "ammo" }, // Dragon dart
  811:   { slot: "ammo", style: "ranged", tier: 3, role: "ammo" }, // Rune dart

  // ─── Bodies: melee ────────────────────────────────────────────────────────
  26384: { slot: "body", style: "melee", tier: 0, role: "armour", setId: "torva" },        // Torva platebody
  11832: { slot: "body", style: "melee", tier: 1, role: "armour", setId: "bandos" },       // Bandos chestplate
  22327: { slot: "body", style: "melee", tier: 1, role: "armour", setId: "justiciar" },    // Justiciar chestguard
  24420: { slot: "body", style: "melee", tier: 1, role: "armour", setId: "inquisitor" },   // Inquisitor's hauberk
  10551: { slot: "body", style: "melee", tier: 2, role: "armour" },                        // Fighter torso (standalone)
  4720:  { slot: "body", style: "melee", tier: 2, role: "armour", setId: "dharok" },       // Dharok's platebody
  4757:  { slot: "body", style: "melee", tier: 2, role: "armour", setId: "verac" },        // Verac's brassard
  4749:  { slot: "body", style: "melee", tier: 2, role: "armour", setId: "torag" },        // Torag's platebody
  4728:  { slot: "body", style: "melee", tier: 2, role: "armour", setId: "guthan" },       // Guthan's platebody
  2513:  { slot: "body", style: "melee", tier: 4, role: "armour" }, // Dragon chainbody
  21892: { slot: "body", style: "melee", tier: 4, role: "armour" }, // Dragon platebody
  1127:  { slot: "body", style: "melee", tier: 5, role: "armour" }, // Rune platebody
  1113:  { slot: "body", style: "melee", tier: 5, role: "armour" }, // Rune chainbody

  // ─── Bodies: ranged ───────────────────────────────────────────────────────
  27238: { slot: "body", style: "ranged", tier: 0, role: "armour", setId: "masori-f" },  // Masori body (f)
  27229: { slot: "body", style: "ranged", tier: 1, role: "armour", setId: "masori" },    // Masori body
  11828: { slot: "body", style: "ranged", tier: 1, role: "armour", setId: "armadyl" },   // Armadyl chestplate
  4736:  { slot: "body", style: "ranged", tier: 2, role: "armour", setId: "karil" },     // Karil's leathertop
  23975: { slot: "body", style: "ranged", tier: 2, role: "armour", setId: "crystal" },   // Crystal body
  2503:  { slot: "body", style: "ranged", tier: 3, role: "armour" }, // Black d'hide body
  2501:  { slot: "body", style: "ranged", tier: 4, role: "armour" }, // Red d'hide body
  2499:  { slot: "body", style: "ranged", tier: 4, role: "armour" }, // Blue d'hide body
  1135:  { slot: "body", style: "ranged", tier: 4, role: "armour" }, // Green d'hide body

  // ─── Bodies: magic ────────────────────────────────────────────────────────
  21021: { slot: "body", style: "magic", tier: 0, role: "armour", setId: "ancestral" }, // Ancestral robe top
  26243: { slot: "body", style: "magic", tier: 1, role: "armour", setId: "virtus" },    // Virtus robe top
  4712:  { slot: "body", style: "magic", tier: 2, role: "armour", setId: "ahrim" },     // Ahrim's robetop
  4091:  { slot: "body", style: "magic", tier: 3, role: "armour", setId: "mystic" },    // Mystic robe top

  // ─── Legs: melee ──────────────────────────────────────────────────────────
  26386: { slot: "legs", style: "melee", tier: 0, role: "armour", setId: "torva" },        // Torva platelegs
  11834: { slot: "legs", style: "melee", tier: 1, role: "armour", setId: "bandos" },       // Bandos tassets
  22328: { slot: "legs", style: "melee", tier: 1, role: "armour", setId: "justiciar" },    // Justiciar legguards
  24421: { slot: "legs", style: "melee", tier: 1, role: "armour", setId: "inquisitor" },   // Inquisitor's plateskirt
  4722:  { slot: "legs", style: "melee", tier: 2, role: "armour", setId: "dharok" },       // Dharok's platelegs
  4759:  { slot: "legs", style: "melee", tier: 2, role: "armour", setId: "verac" },        // Verac's plateskirt
  4751:  { slot: "legs", style: "melee", tier: 2, role: "armour", setId: "torag" },        // Torag's platelegs
  4730:  { slot: "legs", style: "melee", tier: 2, role: "armour", setId: "guthan" },       // Guthan's chainskirt
  4087:  { slot: "legs", style: "melee", tier: 4, role: "armour" }, // Dragon platelegs
  4585:  { slot: "legs", style: "melee", tier: 4, role: "armour" }, // Dragon plateskirt
  1079:  { slot: "legs", style: "melee", tier: 5, role: "armour" }, // Rune platelegs
  1093:  { slot: "legs", style: "melee", tier: 5, role: "armour" }, // Rune plateskirt

  // ─── Legs: ranged ─────────────────────────────────────────────────────────
  27241: { slot: "legs", style: "ranged", tier: 0, role: "armour", setId: "masori-f" },  // Masori chaps (f)
  27232: { slot: "legs", style: "ranged", tier: 1, role: "armour", setId: "masori" },    // Masori chaps
  11830: { slot: "legs", style: "ranged", tier: 1, role: "armour", setId: "armadyl" },   // Armadyl chainskirt
  4738:  { slot: "legs", style: "ranged", tier: 2, role: "armour", setId: "karil" },     // Karil's leatherskirt
  23979: { slot: "legs", style: "ranged", tier: 2, role: "armour", setId: "crystal" },   // Crystal legs
  2497:  { slot: "legs", style: "ranged", tier: 3, role: "armour" }, // Black d'hide chaps
  2495:  { slot: "legs", style: "ranged", tier: 4, role: "armour" }, // Red d'hide chaps
  2493:  { slot: "legs", style: "ranged", tier: 4, role: "armour" }, // Blue d'hide chaps
  1099:  { slot: "legs", style: "ranged", tier: 4, role: "armour" }, // Green d'hide chaps

  // ─── Legs: magic ──────────────────────────────────────────────────────────
  21024: { slot: "legs", style: "magic", tier: 0, role: "armour", setId: "ancestral" }, // Ancestral robe bottom
  26245: { slot: "legs", style: "magic", tier: 1, role: "armour", setId: "virtus" },    // Virtus robe bottom
  4714:  { slot: "legs", style: "magic", tier: 2, role: "armour", setId: "ahrim" },     // Ahrim's robeskirt
  4093:  { slot: "legs", style: "magic", tier: 3, role: "armour", setId: "mystic" },    // Mystic robe bottom

  // ─── Gloves ───────────────────────────────────────────────────────────────
  22981: { slot: "hands", style: "melee",   tier: 0, role: "armour" }, // Ferocious gloves
  7462:  { slot: "hands", style: "neutral", tier: 1, role: "armour" }, // Barrows gloves
  26235: { slot: "hands", style: "ranged",  tier: 0, role: "armour" }, // Zaryte vambraces
  2491:  { slot: "hands", style: "ranged",  tier: 2, role: "armour" }, // Black d'hide vambraces
  2489:  { slot: "hands", style: "ranged",  tier: 3, role: "armour" }, // Red d'hide vambraces
  2487:  { slot: "hands", style: "ranged",  tier: 4, role: "armour" }, // Blue d'hide vambraces
  1065:  { slot: "hands", style: "ranged",  tier: 4, role: "armour" }, // Green d'hide vambraces
  19544: { slot: "hands", style: "magic",   tier: 0, role: "armour" }, // Tormented bracelet
  4095:  { slot: "hands", style: "magic",   tier: 3, role: "armour" }, // Mystic gloves
  // Combat bracelet intentionally NOT in DB — it's a teleport bracelet
  // (Warriors' / Champions' / Edgeville / Monastery) and belongs in Teleports.

  // ─── Boots ────────────────────────────────────────────────────────────────
  // Boots don't follow a strict "set" rule in OSRS (Primordial isn't part of
  // Torva), but visually we group the canonical pairings so a Bandos column
  // ends with Bandos boots, a Masori column with Pegasian, etc. The setIds
  // below are visual hints — they match the body/legs setId of the same
  // style tier so the PvM Gear layout closes the column cleanly.
  13239: { slot: "feet", style: "melee",   tier: 0, role: "armour", setId: "torva" },      // Primordial boots → Torva column
  11836: { slot: "feet", style: "melee",   tier: 1, role: "armour", setId: "bandos" },     // Bandos boots → Bandos column
  19925: { slot: "feet", style: "ranged",  tier: 2, role: "armour" },                      // Bandos d'hide boots
  21733: { slot: "feet", style: "melee",   tier: 1, role: "armour", setId: "justiciar" }, // Guardian boots → Justiciar column
  11840: { slot: "feet", style: "melee",   tier: 3, role: "armour" },                      // Dragon boots
  6328:  { slot: "feet", style: "ranged",  tier: 4, role: "armour" },                      // Snakeskin boots
  4131:  { slot: "feet", style: "melee",   tier: 5, role: "armour" },                      // Rune boots
  13237: { slot: "feet", style: "ranged",  tier: 0, role: "armour", setId: "masori-f" }, // Pegasian boots → Masori column
  2577:  { slot: "feet", style: "ranged",  tier: 2, role: "armour", setId: "karil" },     // Ranger boots → Karil column
  13235: { slot: "feet", style: "magic",   tier: 0, role: "armour", setId: "ancestral" }, // Eternal boots → Ancestral column
  4097:  { slot: "feet", style: "magic",   tier: 3, role: "armour", setId: "mystic" },     // Mystic boots
  22951: { slot: "feet", style: "neutral", tier: 2, role: "armour" }, // Boots of brimstone
  23037: { slot: "feet", style: "neutral", tier: 3, role: "armour" }, // Boots of stone
  3105:  { slot: "feet", style: "neutral", tier: 5, role: "armour" }, // Climbing boots

  // ─── Rings ────────────────────────────────────────────────────────────────
  25485: { slot: "ring", style: "melee",   tier: 0, role: "armour" }, // Ultor ring
  25486: { slot: "ring", style: "magic",   tier: 0, role: "armour" }, // Magus ring
  25487: { slot: "ring", style: "ranged",  tier: 0, role: "armour" }, // Venator ring
  25488: { slot: "ring", style: "melee",   tier: 0, role: "armour" }, // Bellator ring
  25975: { slot: "ring", style: "neutral", tier: 0, role: "utility" },// Lightbearer
  11773: { slot: "ring", style: "melee",   tier: 1, role: "armour" }, // Berserker ring (i)
  6737:  { slot: "ring", style: "melee",   tier: 2, role: "armour" }, // Berserker ring
  11771: { slot: "ring", style: "ranged",  tier: 1, role: "armour" }, // Archers ring (i)
  6733:  { slot: "ring", style: "ranged",  tier: 2, role: "armour" }, // Archers ring
  11770: { slot: "ring", style: "magic",   tier: 1, role: "armour" }, // Seers ring (i)
  6731:  { slot: "ring", style: "magic",   tier: 2, role: "armour" }, // Seers ring
  11772: { slot: "ring", style: "melee",   tier: 1, role: "armour" }, // Warrior ring (i)
  6735:  { slot: "ring", style: "melee",   tier: 2, role: "armour" }, // Warrior ring
  12692: { slot: "ring", style: "ranged",  tier: 1, role: "armour" }, // Treasonous ring (i)
  12605: { slot: "ring", style: "ranged",  tier: 2, role: "armour" }, // Treasonous ring
  12691: { slot: "ring", style: "melee",   tier: 1, role: "armour" }, // Tyrannical ring (i)
  12603: { slot: "ring", style: "melee",   tier: 2, role: "armour" }, // Tyrannical ring
  22975: { slot: "ring", style: "neutral", tier: 1, role: "armour" }, // Brimstone ring
  19550: { slot: "ring", style: "neutral", tier: 2, role: "armour" }, // Ring of suffering
  19710: { slot: "ring", style: "neutral", tier: 1, role: "armour" }, // Ring of suffering (i)
  20655: { slot: "ring", style: "neutral", tier: 1, role: "armour" }, // Ring of suffering (r)

  // ─── Shields / off-hand ───────────────────────────────────────────────────
  22322: { slot: "shield", style: "melee",   tier: 0, role: "armour" }, // Avernic defender
  12954: { slot: "shield", style: "melee",   tier: 1, role: "armour" }, // Dragon defender
  8850:  { slot: "shield", style: "melee",   tier: 2, role: "armour" }, // Rune defender
  8849:  { slot: "shield", style: "melee",   tier: 3, role: "armour" }, // Adamant defender
  20714: { slot: "shield", style: "magic",   tier: 1, role: "armour" }, // Tome of fire
  25574: { slot: "shield", style: "magic",   tier: 1, role: "armour" }, // Tome of water
  30064: { slot: "shield", style: "magic",   tier: 1, role: "armour" }, // Tome of earth
  3842:  { slot: "shield", style: "melee",   tier: 2, role: "armour" }, // Unholy book
  3840:  { slot: "shield", style: "ranged",  tier: 2, role: "armour" }, // Holy book
  12612: { slot: "shield", style: "magic",   tier: 2, role: "armour" }, // Book of darkness
  12610: { slot: "shield", style: "ranged",  tier: 2, role: "armour" }, // Book of law
  12608: { slot: "shield", style: "melee",   tier: 2, role: "armour" }, // Book of war
  3844:  { slot: "shield", style: "magic",   tier: 2, role: "armour" }, // Book of balance
  21000: { slot: "shield", style: "ranged",  tier: 0, role: "armour" }, // Twisted buckler
  12817: { slot: "shield", style: "melee",   tier: 0, role: "armour" }, // Elysian spirit shield
  12825: { slot: "shield", style: "magic",   tier: 0, role: "armour" }, // Arcane spirit shield
  12821: { slot: "shield", style: "magic",   tier: 1, role: "armour" }, // Spectral spirit shield
  11283: { slot: "shield", style: "melee",   tier: 2, role: "armour" }, // Dragonfire shield
  22002: { slot: "shield", style: "magic",   tier: 1, role: "armour" }, // Dragonfire ward
  21633: { slot: "shield", style: "magic",   tier: 2, role: "armour" }, // Ancient wyvern shield
  27251: { slot: "shield", style: "magic",   tier: 0, role: "armour" }, // Elidinis' ward (f)
  25985: { slot: "shield", style: "magic",   tier: 1, role: "armour" }, // Elidinis' ward
  23991: { slot: "shield", style: "ranged",  tier: 2, role: "armour" }, // Crystal shield (charged)
  4224:  { slot: "shield", style: "ranged",  tier: 3, role: "armour" }, // New crystal shield (uncharged variant)
  1201:  { slot: "shield", style: "melee",   tier: 5, role: "armour" }, // Rune kiteshield
  21895: { slot: "shield", style: "melee",   tier: 4, role: "armour" }, // Dragon kiteshield

  // ─── Food (bottom row of PvM Gear tab) ────────────────────────────────────
  13441: { slot: "weapon", style: "neutral", tier: 0, role: "food", order: 0 }, // Anglerfish
  391:   { slot: "weapon", style: "neutral", tier: 1, role: "food", order: 1 }, // Manta ray
  11936: { slot: "weapon", style: "neutral", tier: 1, role: "food", order: 1 }, // Dark crab
  7060:  { slot: "weapon", style: "neutral", tier: 0, role: "food", order: 0 }, // Tuna potato
  385:   { slot: "weapon", style: "neutral", tier: 2, role: "food", order: 2 }, // Shark
  7946:  { slot: "weapon", style: "neutral", tier: 2, role: "food", order: 2 }, // Monkfish
  3144:  { slot: "weapon", style: "neutral", tier: 3, role: "food", order: 3 }, // Cooked karambwan
  6685:  { slot: "weapon", style: "neutral", tier: 0, role: "food", order: 4 }, // Saradomin brew(4)
};

// Helper: look up a gear entry by item id. Returns undefined for items not
// in the curated set — callers should fall back to regex/classifier hints.
export function gearEntry(id: number): GearEntry | undefined {
  return PVM_ITEMS[id];
}

// ── Set piece names, per setId + slot ───────────────────────────────────────
// The PvM Gear layout draws each owned set as a 5-row column (head → body →
// legs → hands → feet); slots the player is missing become bank-filler tiles.
// To label those fillers ("Dharok's platelegs") we need the canonical name of
// the missing piece — this table holds it. Derived directly from PVM_ITEMS
// above; kept as a flat table so the layout builder needs no item-DB lookup.
//
// Only slots a set genuinely has are listed. Barrows/Bandos/Armadyl have no
// canonical hand/feet piece, so a filler in those rows falls back to a
// generic "<Set> — feet" label (see use-case-tabs.ts).
export const SET_PIECE_NAMES: Record<string, Partial<Record<string, string>>> = {
  torva:      { head: "Torva full helm", body: "Torva platebody", legs: "Torva platelegs" },
  justiciar:  { head: "Justiciar faceguard", body: "Justiciar chestguard", legs: "Justiciar legguards" },
  inquisitor: { head: "Inquisitor's great helm", body: "Inquisitor's hauberk", legs: "Inquisitor's plateskirt" },
  bandos:     { body: "Bandos chestplate", legs: "Bandos tassets" },
  dharok:     { head: "Dharok's helm", body: "Dharok's platebody", legs: "Dharok's platelegs" },
  verac:      { head: "Verac's helm", body: "Verac's brassard", legs: "Verac's plateskirt" },
  torag:      { head: "Torag's helm", body: "Torag's platebody", legs: "Torag's platelegs" },
  guthan:     { head: "Guthan's helm", body: "Guthan's platebody", legs: "Guthan's chainskirt" },
  masori:     { head: "Masori mask", body: "Masori body", legs: "Masori chaps" },
  "masori-f": { head: "Masori mask (f)", body: "Masori body (f)", legs: "Masori chaps (f)" },
  armadyl:    { head: "Armadyl helmet", body: "Armadyl chestplate", legs: "Armadyl chainskirt" },
  karil:      { head: "Karil's coif", body: "Karil's leathertop", legs: "Karil's leatherskirt" },
  crystal:    { head: "Crystal helm", body: "Crystal body", legs: "Crystal legs" },
  ancestral:  { head: "Ancestral hat", body: "Ancestral robe top", legs: "Ancestral robe bottom" },
  virtus:     { head: "Virtus mask", body: "Virtus robe top", legs: "Virtus robe bottom" },
  ahrim:      { head: "Ahrim's hood", body: "Ahrim's robetop", legs: "Ahrim's robeskirt" },
  mystic:     { head: "Mystic hat", body: "Mystic robe top", legs: "Mystic robe bottom" }
};

// Human-readable set name for a setId, used in generic filler labels for
// slots not covered by SET_PIECE_NAMES (e.g. a missing feet slot).
export const SET_DISPLAY_NAMES: Record<string, string> = {
  torva: "Torva", justiciar: "Justiciar", inquisitor: "Inquisitor", bandos: "Bandos",
  dharok: "Dharok's", verac: "Verac's", torag: "Torag's", guthan: "Guthan's",
  masori: "Masori", "masori-f": "Masori (f)", armadyl: "Armadyl", karil: "Karil's",
  crystal: "Crystal", ancestral: "Ancestral", virtus: "Virtus", ahrim: "Ahrim's",
  mystic: "Mystic"
};

// The canonical name of the piece a set is missing in a given slot. Falls back
// to a generic "<Set> — <slot>" when the set has no specific piece for that
// slot (Barrows sets have no hands/feet pieces, etc.).
export function setPieceName(setId: string, slot: string): string {
  const specific = SET_PIECE_NAMES[setId]?.[slot];
  if (specific) return specific;
  const setName = SET_DISPLAY_NAMES[setId] ?? setId;
  return `${setName} — ${slot}`;
}
