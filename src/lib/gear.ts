// Gear database — items with their combat bonuses, indexed by id.
// Curated focus: top-20 most-relevant items per slot for melee/range/mage.
// Source: oldschool.runescape.wiki equipment articles. Not exhaustive — v1
// pragmatic.
//
// Style: "stab", "slash", "crush", "ranged", "magic" — used for weapons,
// and the matching defence on bosses.

import type { OrganizedItem } from "./organizer";

export type CombatStyle = "stab" | "slash" | "crush" | "ranged" | "magic";
export type EquipSlot = "head" | "cape" | "neck" | "ammo" | "weapon" | "body" | "shield" | "legs" | "hands" | "feet" | "ring";

export interface AttackBonuses {
  stab: number;
  slash: number;
  crush: number;
  magic: number;
  ranged: number;
}

export interface OtherBonuses {
  strength: number;        // melee strength bonus
  rangedStrength: number;
  magicDamage: number;     // percentage, 0.10 = +10%
  prayer: number;
}

export interface GearItem {
  id: number;
  name: string;
  slot: EquipSlot;
  // For weapons, which style this item targets in our auto-picker.
  weaponStyle?: CombatStyle;
  speed?: number;          // attack interval in ticks (4 = standard)
  twoHanded?: boolean;     // weapon takes both weapon + shield slot
  attack: Partial<AttackBonuses>;
  other?: Partial<OtherBonuses>;
}

// Compact helpers
const a = (atk: Partial<AttackBonuses>): AttackBonuses => ({
  stab: 0, slash: 0, crush: 0, magic: 0, ranged: 0, ...atk
});

// Default zero bonuses
const zero: AttackBonuses = { stab: 0, slash: 0, crush: 0, magic: 0, ranged: 0 };

export const GEAR: GearItem[] = [
  // ── Weapons (melee) ──────────────────────────────────────────────────────
  { id: 4151,  name: "Abyssal whip",        slot: "weapon", weaponStyle: "slash", speed: 4, attack: a({ slash: 82 }),                    other: { strength: 82, prayer: 0, magicDamage: 0, rangedStrength: 0 } },
  { id: 12006, name: "Abyssal tentacle",    slot: "weapon", weaponStyle: "slash", speed: 4, attack: a({ slash: 90 }),                    other: { strength: 86, prayer: 0, magicDamage: 0, rangedStrength: 0 } },
  { id: 23987, name: "Blade of Saeldor",    slot: "weapon", weaponStyle: "slash", speed: 4, attack: a({ slash: 94 }),                    other: { strength: 89, prayer: 0, magicDamage: 0, rangedStrength: 0 } },
  { id: 22324, name: "Ghrazi rapier",       slot: "weapon", weaponStyle: "stab",  speed: 4, attack: a({ stab: 94, slash: 55 }),          other: { strength: 89, prayer: 0, magicDamage: 0, rangedStrength: 0 } },
  { id: 26219, name: "Osmumten's fang",     slot: "weapon", weaponStyle: "stab",  speed: 4, attack: a({ stab: 103, slash: 50 }),         other: { strength: 102, prayer: 0, magicDamage: 0, rangedStrength: 0 } },
  { id: 22325, name: "Scythe of vitur",     slot: "weapon", weaponStyle: "slash", speed: 5, twoHanded: true, attack: a({ stab: 70, slash: 75, crush: 30 }), other: { strength: 75, prayer: 0, magicDamage: 0, rangedStrength: 0 } },
  { id: 11804, name: "Bandos godsword",     slot: "weapon", weaponStyle: "slash", speed: 6, twoHanded: true, attack: a({ slash: 132 }),  other: { strength: 132, prayer: 0, magicDamage: 0, rangedStrength: 0 } },
  { id: 11802, name: "Armadyl godsword",    slot: "weapon", weaponStyle: "slash", speed: 6, twoHanded: true, attack: a({ slash: 132 }),  other: { strength: 132, prayer: 0, magicDamage: 0, rangedStrength: 0 } },
  { id: 13652, name: "Dragon claws",        slot: "weapon", weaponStyle: "slash", speed: 4, attack: a({ stab: 41, slash: 57 }),          other: { strength: 56, prayer: 1, magicDamage: 0, rangedStrength: 0 } },
  { id: 28688, name: "Voidwaker",           slot: "weapon", weaponStyle: "stab",  speed: 4, attack: a({ stab: 82, slash: 60 }),          other: { strength: 75, prayer: 0, magicDamage: 0, rangedStrength: 0 } },
  { id: 4587,  name: "Dragon scimitar",     slot: "weapon", weaponStyle: "slash", speed: 4, attack: a({ slash: 67 }),                    other: { strength: 66, prayer: 0, magicDamage: 0, rangedStrength: 0 } },
  { id: 1333,  name: "Rune scimitar",       slot: "weapon", weaponStyle: "slash", speed: 4, attack: a({ slash: 45 }),                    other: { strength: 44, prayer: 0, magicDamage: 0, rangedStrength: 0 } },
  { id: 24225, name: "Elder maul",          slot: "weapon", weaponStyle: "crush", speed: 6, twoHanded: true, attack: a({ crush: 135 }),  other: { strength: 147, prayer: 0, magicDamage: 0, rangedStrength: 0 } },

  // ── Weapons (range) ──────────────────────────────────────────────────────
  { id: 20997, name: "Twisted bow",         slot: "weapon", weaponStyle: "ranged", speed: 5, twoHanded: true, attack: a({ ranged: 70 }), other: { strength: 20, prayer: 0, magicDamage: 0, rangedStrength: 0 } },
  { id: 25865, name: "Bow of Faerdhinen",   slot: "weapon", weaponStyle: "ranged", speed: 4, twoHanded: true, attack: a({ ranged: 128 }), other: { strength: 0, prayer: 0, magicDamage: 0, rangedStrength: 0 } },
  { id: 22547, name: "Zaryte crossbow",     slot: "weapon", weaponStyle: "ranged", speed: 5, attack: a({ ranged: 95 }),                  other: { strength: 0, prayer: 0, magicDamage: 0, rangedStrength: 0 } },
  { id: 12926, name: "Toxic blowpipe",      slot: "weapon", weaponStyle: "ranged", speed: 3, twoHanded: true, attack: a({ ranged: 60 }), other: { strength: 0, prayer: 0, magicDamage: 0, rangedStrength: 40 } },
  { id: 28688, name: "Blazing blowpipe",    slot: "weapon", weaponStyle: "ranged", speed: 3, twoHanded: true, attack: a({ ranged: 70 }), other: { strength: 0, prayer: 0, magicDamage: 0, rangedStrength: 45 } }, // upgrade from Tox blowpipe
  { id: 9185,  name: "Rune crossbow",       slot: "weapon", weaponStyle: "ranged", speed: 6, attack: a({ ranged: 90 }),                  other: { strength: 0, prayer: 0, magicDamage: 0, rangedStrength: 0 } },
  { id: 4827,  name: "Karil's crossbow",    slot: "weapon", weaponStyle: "ranged", speed: 4, twoHanded: true, attack: a({ ranged: 65 }), other: { strength: 8, prayer: 0, magicDamage: 0, rangedStrength: 0 } },
  { id: 11235, name: "Dark bow",            slot: "weapon", weaponStyle: "ranged", speed: 9, twoHanded: true, attack: a({ ranged: 95 }), other: { strength: 0, prayer: 0, magicDamage: 0, rangedStrength: 0 } },
  { id: 28919, name: "Tonalztics of ralos", slot: "weapon", weaponStyle: "ranged", speed: 5, twoHanded: true, attack: a({ ranged: 75 }), other: { strength: 0, prayer: 0, magicDamage: 0, rangedStrength: 30 } },
  { id: 29577, name: "Burning claws",       slot: "weapon", weaponStyle: "slash",  speed: 4, attack: a({ slash: 70, stab: 50 }),         other: { strength: 70, prayer: 0, magicDamage: 0, rangedStrength: 0 } },
  { id: 28338, name: "Soulreaper axe",      slot: "weapon", weaponStyle: "slash",  speed: 5, twoHanded: true, attack: a({ slash: 90 }),  other: { strength: 92, prayer: 0, magicDamage: 0, rangedStrength: 0 } },
  { id: 30627, name: "Twinflame staff",     slot: "weapon", weaponStyle: "magic",  speed: 4, twoHanded: true, attack: a({ magic: 25 }),  other: { strength: 0, prayer: 0, magicDamage: 0.10, rangedStrength: 0 } },

  // ── Weapons (magic) ──────────────────────────────────────────────────────
  { id: 24424, name: "Tumeken's shadow",    slot: "weapon", weaponStyle: "magic", speed: 5, twoHanded: true, attack: a({ magic: 35, crush: 30 }), other: { strength: 0, prayer: 0, magicDamage: 0.20, rangedStrength: 0 } }, // 3x multiplier handled separately
  { id: 24417, name: "Sanguinesti staff",   slot: "weapon", weaponStyle: "magic", speed: 4, twoHanded: true, attack: a({ magic: 25, crush: 25 }), other: { strength: 0, prayer: 0, magicDamage: 0.15, rangedStrength: 0 } },
  { id: 25731, name: "Harmonised nightmare staff", slot: "weapon", weaponStyle: "magic", speed: 4, twoHanded: true, attack: a({ magic: 22 }),    other: { strength: 0, prayer: 0, magicDamage: 0.18, rangedStrength: 0 } },
  { id: 11907, name: "Trident of the seas", slot: "weapon", weaponStyle: "magic", speed: 4, twoHanded: true, attack: a({ magic: 25 }),          other: { strength: 0, prayer: 0, magicDamage: 0, rangedStrength: 0 } },
  { id: 12899, name: "Trident of the swamp",slot: "weapon", weaponStyle: "magic", speed: 4, twoHanded: true, attack: a({ magic: 25 }),          other: { strength: 0, prayer: 0, magicDamage: 0, rangedStrength: 0 } },
  { id: 21006, name: "Kodai wand",          slot: "weapon", weaponStyle: "magic", speed: 4, attack: a({ magic: 28, crush: 28 }),                 other: { strength: 0, prayer: 0, magicDamage: 0.15, rangedStrength: 0 } },
  { id: 22323, name: "Ancient sceptre",     slot: "weapon", weaponStyle: "magic", speed: 4, attack: a({ magic: 20 }),                            other: { strength: 0, prayer: 0, magicDamage: 0.10, rangedStrength: 0 } },

  // ── Helms ────────────────────────────────────────────────────────────────
  { id: 11865, name: "Slayer helmet (i)",   slot: "head", attack: zero,                                 other: { strength: 0, prayer: 0, magicDamage: 0, rangedStrength: 0 } },
  { id: 11862, name: "Slayer helmet",       slot: "head", attack: zero,                                 other: { strength: 0, prayer: 0, magicDamage: 0, rangedStrength: 0 } },
  { id: 21018, name: "Helm of neitiznot",   slot: "head", attack: zero,                                 other: { strength: 3, prayer: 3, magicDamage: 0, rangedStrength: 0 } },
  { id: 24271, name: "Neitiznot faceguard", slot: "head", attack: zero,                                 other: { strength: 6, prayer: 3, magicDamage: 0, rangedStrength: 0 } },
  { id: 11774, name: "Serpentine helm",     slot: "head", attack: zero,                                 other: { strength: 5, prayer: 0, magicDamage: 0, rangedStrength: 0 } },
  { id: 26382, name: "Torva full helm",     slot: "head", attack: zero,                                 other: { strength: 8, prayer: 1, magicDamage: 0, rangedStrength: 0 } },
  { id: 27226, name: "Masori mask (f)",     slot: "head", attack: zero,                                 other: { strength: 0, prayer: 1, magicDamage: 0, rangedStrength: 4 } },
  { id: 27235, name: "Masori mask",         slot: "head", attack: zero,                                 other: { strength: 0, prayer: 1, magicDamage: 0, rangedStrength: 4 } },
  { id: 21264, name: "Ancestral hat",       slot: "head", attack: a({ magic: 8 }),                      other: { strength: 0, prayer: 1, magicDamage: 0.02, rangedStrength: 0 } },
  { id: 27277, name: "Virtus mask",         slot: "head", attack: a({ magic: 7 }),                      other: { strength: 0, prayer: 1, magicDamage: 0.03, rangedStrength: 0 } },
  { id: 12931, name: "Void mage helm",      slot: "head", attack: zero,                                 other: { strength: 0, prayer: 0, magicDamage: 0, rangedStrength: 0 } },
  { id: 11663, name: "Void mage helm",      slot: "head", attack: zero,                                 other: { strength: 0, prayer: 0, magicDamage: 0, rangedStrength: 0 } },
  { id: 11664, name: "Void ranger helm",    slot: "head", attack: zero,                                 other: { strength: 0, prayer: 0, magicDamage: 0, rangedStrength: 0 } },
  { id: 11665, name: "Void melee helm",     slot: "head", attack: zero,                                 other: { strength: 0, prayer: 0, magicDamage: 0, rangedStrength: 0 } },

  // ── Capes ────────────────────────────────────────────────────────────────
  { id: 21295, name: "Infernal cape",       slot: "cape", attack: zero,                                 other: { strength: 4, prayer: 0, magicDamage: 0, rangedStrength: 0 } },
  { id: 6570,  name: "Fire cape",           slot: "cape", attack: zero,                                 other: { strength: 4, prayer: 0, magicDamage: 0, rangedStrength: 0 } },
  { id: 21791, name: "Imbued saradomin cape", slot: "cape", attack: a({ magic: 15 }),                   other: { strength: 0, prayer: 1, magicDamage: 0, rangedStrength: 0 } },
  { id: 21793, name: "Imbued guthix cape",  slot: "cape", attack: a({ magic: 15 }),                     other: { strength: 0, prayer: 1, magicDamage: 0, rangedStrength: 0 } },
  { id: 22109, name: "Ava's assembler",     slot: "cape", attack: zero,                                 other: { strength: 0, prayer: 1, magicDamage: 0, rangedStrength: 8 } },
  { id: 27374, name: "Masori assembler",    slot: "cape", attack: zero,                                 other: { strength: 0, prayer: 1, magicDamage: 0, rangedStrength: 8 } },
  { id: 13073, name: "Ardougne cloak 4",    slot: "cape", attack: zero,                                 other: { strength: 0, prayer: 1, magicDamage: 0, rangedStrength: 0 } },

  // ── Amulets ──────────────────────────────────────────────────────────────
  { id: 19553, name: "Amulet of torture",   slot: "neck", attack: zero,                                 other: { strength: 10, prayer: 0, magicDamage: 0, rangedStrength: 0 } },
  { id: 6585,  name: "Amulet of fury",      slot: "neck", attack: zero,                                 other: { strength: 8, prayer: 3, magicDamage: 0, rangedStrength: 0 } },
  { id: 12002, name: "Necklace of anguish", slot: "neck", attack: zero,                                 other: { strength: 0, prayer: 0, magicDamage: 0, rangedStrength: 5 } },
  { id: 12932, name: "Occult necklace",     slot: "neck", attack: a({ magic: 12 }),                     other: { strength: 0, prayer: 0, magicDamage: 0.10, rangedStrength: 0 } },
  { id: 20003, name: "Amulet of rancour",   slot: "neck", attack: zero,                                 other: { strength: 12, prayer: 2, magicDamage: 0, rangedStrength: 0 } },
  { id: 1704,  name: "Amulet of glory",     slot: "neck", attack: zero,                                 other: { strength: 6, prayer: 3, magicDamage: 0, rangedStrength: 0 } },
  { id: 19547, name: "Salve amulet(ei)",    slot: "neck", attack: zero,                                 other: { strength: 0, prayer: 0, magicDamage: 0.20, rangedStrength: 0 } }, // vs undead

  // ── Bodies ───────────────────────────────────────────────────────────────
  { id: 11832, name: "Bandos chestplate",   slot: "body", attack: zero,                                 other: { strength: 4, prayer: 1, magicDamage: 0, rangedStrength: 0 } },
  { id: 26384, name: "Torva platebody",     slot: "body", attack: zero,                                 other: { strength: 8, prayer: 1, magicDamage: 0, rangedStrength: 0 } },
  { id: 21042, name: "Ancestral robe top",  slot: "body", attack: a({ magic: 35 }),                     other: { strength: 0, prayer: 1, magicDamage: 0.02, rangedStrength: 0 } },
  { id: 27279, name: "Virtus robe top",     slot: "body", attack: a({ magic: 30 }),                     other: { strength: 0, prayer: 1, magicDamage: 0.03, rangedStrength: 0 } },
  { id: 27229, name: "Masori body (f)",     slot: "body", attack: zero,                                 other: { strength: 0, prayer: 1, magicDamage: 0, rangedStrength: 4 } },
  { id: 27238, name: "Masori body",         slot: "body", attack: zero,                                 other: { strength: 0, prayer: 1, magicDamage: 0, rangedStrength: 4 } },
  { id: 12625, name: "Armadyl chestplate",  slot: "body", attack: zero,                                 other: { strength: 0, prayer: 1, magicDamage: 0, rangedStrength: 0 } },
  { id: 10551, name: "Fighter torso",       slot: "body", attack: zero,                                 other: { strength: 4, prayer: 0, magicDamage: 0, rangedStrength: 0 } },
  { id: 13072, name: "Elite void top",      slot: "body", attack: zero,                                 other: { strength: 0, prayer: 0, magicDamage: 0, rangedStrength: 0 } },

  // ── Legs ─────────────────────────────────────────────────────────────────
  { id: 11834, name: "Bandos tassets",      slot: "legs", attack: zero,                                 other: { strength: 2, prayer: 1, magicDamage: 0, rangedStrength: 0 } },
  { id: 26386, name: "Torva platelegs",     slot: "legs", attack: zero,                                 other: { strength: 4, prayer: 1, magicDamage: 0, rangedStrength: 0 } },
  { id: 21046, name: "Ancestral robe bottom", slot: "legs", attack: a({ magic: 30 }),                   other: { strength: 0, prayer: 1, magicDamage: 0.02, rangedStrength: 0 } },
  { id: 27283, name: "Virtus robe legs",    slot: "legs", attack: a({ magic: 23 }),                     other: { strength: 0, prayer: 1, magicDamage: 0.03, rangedStrength: 0 } },
  { id: 27232, name: "Masori chaps (f)",    slot: "legs", attack: zero,                                 other: { strength: 0, prayer: 1, magicDamage: 0, rangedStrength: 3 } },
  { id: 27241, name: "Masori chaps",        slot: "legs", attack: zero,                                 other: { strength: 0, prayer: 1, magicDamage: 0, rangedStrength: 3 } },
  { id: 12695, name: "Armadyl chainskirt",  slot: "legs", attack: zero,                                 other: { strength: 0, prayer: 1, magicDamage: 0, rangedStrength: 0 } },
  { id: 13073, name: "Elite void robe",     slot: "legs", attack: zero,                                 other: { strength: 0, prayer: 0, magicDamage: 0, rangedStrength: 0 } },

  // ── Gloves ───────────────────────────────────────────────────────────────
  { id: 7462,  name: "Barrows gloves",      slot: "hands", attack: zero,                                other: { strength: 12, prayer: 0, magicDamage: 0, rangedStrength: 0 } },
  { id: 22981, name: "Ferocious gloves",    slot: "hands", attack: zero,                                other: { strength: 16, prayer: 0, magicDamage: 0, rangedStrength: 0 } },
  { id: 26235, name: "Zaryte vambraces",    slot: "hands", attack: zero,                                other: { strength: 0, prayer: 1, magicDamage: 0, rangedStrength: 2 } },
  { id: 2491,  name: "Black d'hide vambraces", slot: "hands", attack: zero,                             other: { strength: 0, prayer: 0, magicDamage: 0, rangedStrength: 2 } },
  { id: 8842,  name: "Void knight gloves",  slot: "hands", attack: zero,                                other: { strength: 0, prayer: 0, magicDamage: 0, rangedStrength: 0 } },
  { id: 7458,  name: "Mithril gloves",      slot: "hands", attack: zero,                                other: { strength: 4, prayer: 0, magicDamage: 0, rangedStrength: 0 } },

  // ── Boots ────────────────────────────────────────────────────────────────
  { id: 13239, name: "Primordial boots",    slot: "feet", attack: zero,                                 other: { strength: 5, prayer: 0, magicDamage: 0, rangedStrength: 0 } },
  { id: 13237, name: "Pegasian boots",      slot: "feet", attack: zero,                                 other: { strength: 0, prayer: 0, magicDamage: 0, rangedStrength: 2 } },
  { id: 13235, name: "Eternal boots",       slot: "feet", attack: a({ magic: 8 }),                      other: { strength: 0, prayer: 0, magicDamage: 0, rangedStrength: 0 } },
  { id: 11840, name: "Dragon boots",        slot: "feet", attack: zero,                                 other: { strength: 4, prayer: 0, magicDamage: 0, rangedStrength: 0 } },
  { id: 6328,  name: "Ranger boots",        slot: "feet", attack: zero,                                 other: { strength: 0, prayer: 0, magicDamage: 0, rangedStrength: 4 } },

  // ── Rings ────────────────────────────────────────────────────────────────
  // Verified item IDs from oldschool.runescape.wiki (Dec 2024).
  { id: 28307, name: "Ultor ring",            slot: "ring", attack: zero, other: { strength: 12, prayer: 0, magicDamage: 0, rangedStrength: 0 } },
  { id: 28310, name: "Magus ring",            slot: "ring", attack: zero, other: { strength: 0, prayer: 0, magicDamage: 0.04, rangedStrength: 0 } },
  { id: 28313, name: "Venator ring",          slot: "ring", attack: zero, other: { strength: 0, prayer: 0, magicDamage: 0, rangedStrength: 6 } },
  { id: 28316, name: "Bellator ring",         slot: "ring", attack: zero, other: { strength: 8, prayer: 0, magicDamage: 0, rangedStrength: 0 } },
  { id: 25975, name: "Lightbearer",           slot: "ring", attack: zero, other: { strength: 0, prayer: 0, magicDamage: 0, rangedStrength: 0 } },
  { id: 11773, name: "Berserker ring (i)",    slot: "ring", attack: zero, other: { strength: 8, prayer: 0, magicDamage: 0, rangedStrength: 0 } },
  { id: 6737,  name: "Berserker ring",        slot: "ring", attack: zero, other: { strength: 4, prayer: 0, magicDamage: 0, rangedStrength: 0 } },
  { id: 11770, name: "Archers ring (i)",      slot: "ring", attack: zero, other: { strength: 0, prayer: 0, magicDamage: 0, rangedStrength: 8 } },
  { id: 6733,  name: "Archers ring",          slot: "ring", attack: zero, other: { strength: 0, prayer: 0, magicDamage: 0, rangedStrength: 4 } },
  { id: 11772, name: "Seers ring (i)",        slot: "ring", attack: a({ magic: 8 }), other: { strength: 0, prayer: 0, magicDamage: 0, rangedStrength: 0 } },
  { id: 6731,  name: "Seers ring",            slot: "ring", attack: a({ magic: 4 }), other: { strength: 0, prayer: 0, magicDamage: 0, rangedStrength: 0 } },
  { id: 22975, name: "Brimstone ring",        slot: "ring", attack: a({ magic: 4 }), other: { strength: 4, prayer: 0, magicDamage: 0.02, rangedStrength: 1 } },
  { id: 11771, name: "Warrior ring (i)",      slot: "ring", attack: zero, other: { strength: 4, prayer: 0, magicDamage: 0, rangedStrength: 0 } },
  { id: 6735,  name: "Warrior ring",          slot: "ring", attack: zero, other: { strength: 0, prayer: 0, magicDamage: 0, rangedStrength: 0 } },

  // ── Shields ──────────────────────────────────────────────────────────────
  { id: 20657, name: "Avernic defender",    slot: "shield", attack: a({ stab: 30, slash: 29, crush: 28 }), other: { strength: 8, prayer: 0, magicDamage: 0, rangedStrength: 0 } },
  { id: 12954, name: "Dragon defender",     slot: "shield", attack: a({ stab: 25, slash: 24, crush: 23 }), other: { strength: 6, prayer: 0, magicDamage: 0, rangedStrength: 0 } },
  { id: 12817, name: "Elysian spirit shield", slot: "shield", attack: zero,                              other: { strength: 0, prayer: 3, magicDamage: 0, rangedStrength: 0 } },
  { id: 11283, name: "Dragonfire shield",   slot: "shield", attack: zero,                                other: { strength: 0, prayer: 0, magicDamage: 0, rangedStrength: 0 } },
  { id: 22002, name: "Dragonfire ward",     slot: "shield", attack: a({ magic: 5 }),                     other: { strength: 0, prayer: 0, magicDamage: 0.01, rangedStrength: 0 } },
  { id: 27251, name: "Elidinis' ward (f)",  slot: "shield", attack: a({ magic: 13 }),                    other: { strength: 0, prayer: 1, magicDamage: 0.03, rangedStrength: 0 } },

  // ── Ammo (ranged-only) ───────────────────────────────────────────────────
  { id: 11212, name: "Dragon arrow",        slot: "ammo", attack: zero,                                  other: { strength: 0, prayer: 0, magicDamage: 0, rangedStrength: 60 } },
  { id: 21944, name: "Ruby dragon bolts (e)", slot: "ammo", attack: zero,                                other: { strength: 0, prayer: 0, magicDamage: 0, rangedStrength: 117 } },
  { id: 21946, name: "Diamond dragon bolts (e)", slot: "ammo", attack: zero,                             other: { strength: 0, prayer: 0, magicDamage: 0, rangedStrength: 117 } },
  { id: 11230, name: "Dragon dart",         slot: "ammo", attack: zero,                                  other: { strength: 0, prayer: 0, magicDamage: 0, rangedStrength: 20 } },
  { id: 25849, name: "Amethyst dart",       slot: "ammo", attack: zero,                                  other: { strength: 0, prayer: 0, magicDamage: 0, rangedStrength: 16 } },
  // Rada's blessings — non-ammo prayer-bonus item that fills the ammo slot
  // (good for melee / magic setups where no actual ammo is needed).
  { id: 22947, name: "Rada's blessing 4",   slot: "ammo", attack: zero,                                  other: { strength: 0, prayer: 2, magicDamage: 0, rangedStrength: 0 } },
  { id: 22945, name: "Rada's blessing 3",   slot: "ammo", attack: zero,                                  other: { strength: 0, prayer: 1, magicDamage: 0, rangedStrength: 0 } },
  { id: 22943, name: "Rada's blessing 2",   slot: "ammo", attack: zero,                                  other: { strength: 0, prayer: 1, magicDamage: 0, rangedStrength: 0 } }
];

// ── Ammo classification helper ──────────────────────────────────────────────
// Some items live in the "ammo" slot but are non-ammo (e.g. Rada's blessing
// boosts prayer only). The auto-picker needs to know what's actually ranged
// ammo vs filler so it doesn't equip arrows on a melee setup.
const RANGED_AMMO_IDS = new Set([11212, 21944, 21946, 11230, 25849]);
export function isRangedAmmo(g: GearItem): boolean {
  return g.slot === "ammo" && RANGED_AMMO_IDS.has(g.id);
}

const GEAR_BY_ID = new Map(GEAR.map((g) => [g.id, g]));

export function lookupGear(id: number): GearItem | undefined {
  return GEAR_BY_ID.get(id);
}

// From the player's bank, what GearItems do they own?
export function ownedGear(items: OrganizedItem[]): GearItem[] {
  const seen = new Set<number>();
  const out: GearItem[] = [];
  for (const it of items) {
    const gear = GEAR_BY_ID.get(it.id);
    if (gear && !seen.has(gear.id)) {
      seen.add(gear.id);
      out.push(gear);
    }
  }
  return out;
}

export function ownedGearForSlot(items: OrganizedItem[], slot: EquipSlot): GearItem[] {
  return ownedGear(items).filter((g) => g.slot === slot);
}
