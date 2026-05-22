// Hand-picked fixture banks used by layout regression tests. Each fixture is
// a list of OSRS item IDs that represents a plausible bank for that account
// type. The point is to lock the *shape* of the organize() output (which
// items end up in which tab, in which order) so layout edits can be verified.
//
// IDs come from data/items.json (the wiki dump shipped in this repo). When
// editing, prefer to add items at the END of an existing fixture so existing
// snapshots stay stable.

export const SMALL_MAIN_BANK: number[] = [
  617,    // Coins
  4151,   // Abyssal whip
  11804,  // Bandos godsword
  4587,   // Dragon scimitar
  861,    // Magic shortbow
  9185,   // Rune crossbow
  11836,  // Bandos boots
  7462,   // Barrows gloves
  6570,   // Fire cape
  11978,  // Amulet of glory(6)
  2552,   // Ring of dueling(8)
  11968,  // Skills necklace(6)
  8007,   // Varrock teleport
  4251,   // Ectophial
  556,    // Air rune
  565,    // Blood rune
  12695,  // Super combat potion(4)
  6685,   // Saradomin brew(4)
  2434,   // Prayer potion(4)
  3024,   // Super restore(4)
  13441,  // Anglerfish
  11920,  // Dragon pickaxe
  1515,   // Yew logs
  453,    // Coal
  5295,   // Ranarr seed
  9813,   // Quest point cape
  12073,  // Clue scroll (elite)
  20543,  // Reward casket (elite)
  13652,  // Dragon claws
  27690   // Voidwaker
];

export const MAX_MAIN_BANK: number[] = [
  ...SMALL_MAIN_BANK,
  20997,  // Twisted bow
  22325,  // Scythe of vitur
  27275,  // Tumeken's shadow
  25865,  // Bow of faerdhinen
  11832,  // Bandos chestplate
  11834,  // Bandos tassets
  13239,  // Primordial boots
  13237,  // Pegasian boots
  13235,  // Eternal boots
  19547,  // Necklace of anguish
  19553,  // Amulet of torture
  12002,  // Occult necklace
  22981,  // Ferocious gloves
  21018,  // Ancestral hat
  21021,  // Ancestral robe top
  21024,  // Ancestral robe bottom
  27235,  // Masori mask (f)
  27238,  // Masori body (f)
  27241,  // Masori chaps (f)
  11773,  // Berserker ring (i)
  25485,  // Ultor ring
  25486,  // Magus ring
  25487,  // Venator ring
  22322,  // Avernic defender
  12954,  // Dragon defender
  20714,  // Tome of fire
  21295,  // Infernal cape
  12018,  // Salve amulet(ei)
  11972,  // Combat bracelet(6)
  3853,   // Games necklace(8)
  21166,  // Burning amulet(5)
  13660,  // Chronicle
  19564,  // Royal seed pod
  12625,  // Stamina potion(4)
  2452,   // Antifire potion(4)
  2444,   // Ranging potion(4)
  451,    // Runite ore
  449,    // Adamantite ore
  2363,   // Runite bar
  2353,   // Steel bar
  1513,   // Magic logs
  7936,   // Pure essence
  5300,   // Snapdragon seed
  5123,   // Magic seed
  19836,  // Reward casket (master)
  20544   // Reward casket (hard)
];

export const SKILLER_BANK: number[] = [
  617,
  11920,  // Dragon pickaxe
  1515,   // Yew logs
  1513,   // Magic logs
  453,    // Coal
  451,    // Runite ore
  449,    // Adamantite ore
  2363,   // Runite bar
  2353,   // Steel bar
  2359,   // Mithril bar
  7936,   // Pure essence
  5295,   // Ranarr seed
  5300,   // Snapdragon seed
  5123,   // Magic seed
  4251,   // Ectophial
  19564,  // Royal seed pod
  11968,  // Skills necklace(6)
  11978,  // Amulet of glory(6)
  9813,   // Quest point cape
  556,    // Air rune
  565     // Blood rune
];

export const IRONMAN_BANK: number[] = [
  617,
  4151,
  4587,
  9185,
  6570,
  11920,
  1515,
  453,
  451,
  2363,
  5295,
  7936,
  556,
  565,
  6685,
  2434,
  3024,
  13441,
  11978,
  2552,
  4251,
  8007,
  20543,
  13652
];
