// Boss / monster definitions for the DPS calculator and boss-tag generator.
// Stats sourced from oldschool.runescape.wiki monster articles.
//
// Coverage: every boss that appears on the OSRS Hiscores boss leaderboards,
// plus a handful of high-traffic slayer bosses. Defence bonuses define what
// a player needs to roll above to hit; weaknesses guide the DPS picker.

import type { CombatStyle } from "./gear";

export interface Boss {
  slug: string;
  name: string;
  emoji?: string;
  // Canonical sprite — the boss's signature drop or trophy item. Matches what
  // OSRS hiscores uses next to the boss name.
  iconItemId?: number;
  // Wiki page name for the NPC sprite (chathead/portrait). Falls back to
  // `name` if omitted. Used by NPC_SPRITE_URL.
  npcName?: string;
  hp: number;
  defenceLevel: number;
  defenceBonuses: {
    stab: number;
    slash: number;
    crush: number;
    magic: number;
    ranged: number;
  };
  magicLevel?: number;
  notes?: string;
  weaknesses: CombatStyle[];
  avgLootGp?: number;
  killsPerHourCap?: number;
  // Loose grouping for the searchable UI: "raid", "gwd", "wildy", "slayer",
  // "skilling", "quest", "minigame", "dt2", "df", "world", "misc".
  category?: BossCategory;
  // For multi-room encounters (raids), sub-rooms are listed here so we can
  // show one Boss tile in the UI but still calculate per-room setups in DPS.
  rooms?: BossRoom[];
}

export interface BossRoom {
  slug: string;
  name: string;
  hp: number;
  defenceLevel: number;
  defenceBonuses: {
    stab: number;
    slash: number;
    crush: number;
    magic: number;
    ranged: number;
  };
  magicLevel?: number;
  weaknesses: CombatStyle[];
  notes?: string;
  /** OSRS item-id whose sprite represents this room (signature drop /
   *  characteristic item). Lets BossSprite show the room with a real OSRS
   *  icon instead of the generic fallback dot. */
  iconItemId?: number;
}

export type BossCategory =
  | "raid" | "gwd" | "wildy" | "slayer" | "skilling"
  | "quest" | "minigame" | "dt2" | "world" | "misc";

export const BOSSES: Boss[] = [
  // ── God Wars Dungeon ─────────────────────────────────────────────────────
  { slug: "graardor", name: "General Graardor", emoji: "👺", iconItemId: 11812, category: "gwd",
    hp: 255, defenceLevel: 250, defenceBonuses: { stab: 60, slash: 50, crush: 60, magic: 198, ranged: 100 },
    weaknesses: ["crush", "slash"], avgLootGp: 30_000, killsPerHourCap: 30 },
  { slug: "kree", name: "Kree'arra", emoji: "🦅", iconItemId: 11810, category: "gwd",
    hp: 255, defenceLevel: 260, defenceBonuses: { stab: 200, slash: 200, crush: 200, magic: 150, ranged: 0 },
    weaknesses: ["ranged"], avgLootGp: 30_000, killsPerHourCap: 25,
    notes: "Range-only effectively — melee can't reach." },
  { slug: "zilyana", name: "Commander Zilyana", emoji: "👑", iconItemId: 11814, category: "gwd",
    hp: 255, defenceLevel: 200, defenceBonuses: { stab: 60, slash: 70, crush: 60, magic: 165, ranged: 70 },
    weaknesses: ["slash"], avgLootGp: 35_000, killsPerHourCap: 35 },
  { slug: "kril", name: "K'ril Tsutsaroth", emoji: "👹", iconItemId: 11816, category: "gwd",
    hp: 255, defenceLevel: 270, defenceBonuses: { stab: 70, slash: 50, crush: 70, magic: 100, ranged: 60 },
    weaknesses: ["slash"], avgLootGp: 25_000, killsPerHourCap: 30 },
  { slug: "nex", name: "Nex", emoji: "🦇", iconItemId: 26372, category: "gwd",
    hp: 3400, defenceLevel: 260, defenceBonuses: { stab: 250, slash: 250, crush: 250, magic: 250, ranged: 250 },
    weaknesses: ["ranged", "magic"], avgLootGp: 500_000, killsPerHourCap: 8,
    notes: "Endgame group boss. Solo possible but inefficient." },

  // ── Wilderness bosses ────────────────────────────────────────────────────
  { slug: "callisto", name: "Callisto", emoji: "🐻", iconItemId: 13265, category: "wildy",
    hp: 470, defenceLevel: 240, defenceBonuses: { stab: 65, slash: 55, crush: 35, magic: 75, ranged: 110 },
    weaknesses: ["crush", "slash"], avgLootGp: 60_000, killsPerHourCap: 22 },
  { slug: "venenatis", name: "Venenatis", emoji: "🕷️", iconItemId: 13269, category: "wildy",
    hp: 490, defenceLevel: 250, defenceBonuses: { stab: 70, slash: 70, crush: 60, magic: 195, ranged: 195 },
    weaknesses: ["crush"], avgLootGp: 80_000, killsPerHourCap: 25 },
  { slug: "vetion", name: "Vet'ion", emoji: "💀", iconItemId: 13271, category: "wildy",
    hp: 255, defenceLevel: 235, defenceBonuses: { stab: 200, slash: 200, crush: 200, magic: 50, ranged: 25 },
    weaknesses: ["ranged", "magic"], avgLootGp: 70_000, killsPerHourCap: 18 },
  { slug: "calvarion", name: "Calvar'ion", emoji: "🦴", iconItemId: 27660, category: "wildy",
    hp: 220, defenceLevel: 215, defenceBonuses: { stab: 200, slash: 200, crush: 200, magic: 25, ranged: 0 },
    weaknesses: ["ranged"], avgLootGp: 90_000, killsPerHourCap: 30,
    notes: "Vet'ion Jr. — faster, less HP, drops same uniques." },
  { slug: "spindel", name: "Spindel", emoji: "🕸️", iconItemId: 27637, category: "wildy",
    hp: 250, defenceLevel: 220, defenceBonuses: { stab: 70, slash: 70, crush: 60, magic: 195, ranged: 195 },
    weaknesses: ["crush"], avgLootGp: 110_000, killsPerHourCap: 30 },
  { slug: "artio", name: "Artio", emoji: "🐻‍❄️", iconItemId: 27634, category: "wildy",
    hp: 225, defenceLevel: 200, defenceBonuses: { stab: 65, slash: 55, crush: 35, magic: 75, ranged: 110 },
    weaknesses: ["crush"], avgLootGp: 85_000, killsPerHourCap: 28 },
  { slug: "scorpia", name: "Scorpia", emoji: "🦂", iconItemId: 12796, category: "wildy",
    hp: 200, defenceLevel: 90, defenceBonuses: { stab: 80, slash: 80, crush: 80, magic: 20, ranged: 20 },
    weaknesses: ["magic", "ranged"], avgLootGp: 50_000, killsPerHourCap: 25 },
  { slug: "chaos-elemental", name: "Chaos Elemental", emoji: "🌀", iconItemId: 11286, category: "wildy",
    hp: 305, defenceLevel: 220, defenceBonuses: { stab: 100, slash: 100, crush: 100, magic: 0, ranged: 100 },
    weaknesses: ["magic"], avgLootGp: 40_000, killsPerHourCap: 25 },
  { slug: "chaos-fanatic", name: "Chaos Fanatic", emoji: "🧙", iconItemId: 13251, category: "wildy",
    hp: 200, defenceLevel: 70, defenceBonuses: { stab: 30, slash: 30, crush: 30, magic: 5, ranged: 50 },
    weaknesses: ["ranged", "magic"], avgLootGp: 20_000, killsPerHourCap: 35 },
  { slug: "crazy-archaeologist", name: "Crazy Archaeologist", emoji: "🏛️", iconItemId: 13251, category: "wildy",
    hp: 220, defenceLevel: 100, defenceBonuses: { stab: 50, slash: 50, crush: 50, magic: 25, ranged: 5 },
    weaknesses: ["magic"], avgLootGp: 20_000, killsPerHourCap: 35 },
  { slug: "king-black-dragon", name: "King Black Dragon", emoji: "🐉", iconItemId: 12655, category: "wildy",
    hp: 240, defenceLevel: 240, defenceBonuses: { stab: 65, slash: 55, crush: 35, magic: 60, ranged: 50 },
    weaknesses: ["ranged"], avgLootGp: 30_000, killsPerHourCap: 30 },

  // ── Slayer bosses ────────────────────────────────────────────────────────
  { slug: "vorkath", name: "Vorkath", emoji: "🐲", iconItemId: 21907, category: "slayer",
    hp: 750, defenceLevel: 214, defenceBonuses: { stab: 26, slash: 108, crush: 108, magic: 240, ranged: 26 },
    magicLevel: 150, weaknesses: ["ranged", "stab"], avgLootGp: 150_000, killsPerHourCap: 35,
    notes: "Ironman GP staple. Super antifire required." },
  { slug: "zulrah", name: "Zulrah", emoji: "🐍", iconItemId: 12921, category: "slayer",
    hp: 500, defenceLevel: 300, defenceBonuses: { stab: 50, slash: 50, crush: 50, magic: 100, ranged: 100 },
    magicLevel: 250, weaknesses: ["magic", "ranged"], avgLootGp: 90_000, killsPerHourCap: 40,
    notes: "Phase rotations — needs mage AND range setups." },
  { slug: "hydra", name: "Alchemical Hydra", emoji: "🐉", iconItemId: 22746, category: "slayer",
    hp: 1100, defenceLevel: 80, defenceBonuses: { stab: 70, slash: 60, crush: 60, magic: 30, ranged: 30 },
    weaknesses: ["ranged"], avgLootGp: 200_000, killsPerHourCap: 28,
    notes: "Slayer-only. 4 phases with style swaps." },
  { slug: "sire", name: "Abyssal Sire", emoji: "👁️", iconItemId: 13262, category: "slayer",
    hp: 400, defenceLevel: 250, defenceBonuses: { stab: 40, slash: 40, crush: 40, magic: 60, ranged: 70 },
    weaknesses: ["crush", "stab"], avgLootGp: 40_000, killsPerHourCap: 30 },
  { slug: "kraken", name: "Kraken", emoji: "🐙", iconItemId: 12004, category: "slayer",
    hp: 255, defenceLevel: 90, defenceBonuses: { stab: 0, slash: 0, crush: 0, magic: 100, ranged: 0 },
    weaknesses: ["magic"], avgLootGp: 70_000, killsPerHourCap: 40 },
  { slug: "cerberus", name: "Cerberus", emoji: "🐕", iconItemId: 13247, category: "slayer",
    hp: 600, defenceLevel: 100, defenceBonuses: { stab: 0, slash: 25, crush: 0, magic: 10, ranged: 75 },
    weaknesses: ["crush"], avgLootGp: 80_000, killsPerHourCap: 32 },
  { slug: "thermonuclear", name: "Thermonuclear Smoke Devil", emoji: "💨", iconItemId: 12002, category: "slayer",
    hp: 240, defenceLevel: 100, defenceBonuses: { stab: 0, slash: 0, crush: 0, magic: 50, ranged: 200 },
    weaknesses: ["magic"], avgLootGp: 25_000, killsPerHourCap: 30 },
  { slug: "grotesque-guardians", name: "Grotesque Guardians", emoji: "🗿", iconItemId: 21730, category: "slayer",
    hp: 305, defenceLevel: 85, defenceBonuses: { stab: 0, slash: 0, crush: 0, magic: 25, ranged: 0 },
    weaknesses: ["crush", "ranged"], avgLootGp: 50_000, killsPerHourCap: 22 },
  { slug: "skotizo", name: "Skotizo", emoji: "💀", iconItemId: 19921, category: "slayer",
    hp: 320, defenceLevel: 200, defenceBonuses: { stab: 60, slash: 60, crush: 60, magic: 200, ranged: 200 },
    weaknesses: ["slash"], avgLootGp: 120_000, killsPerHourCap: 12,
    notes: "Salve (ei) doubles damage — undead boss." },
  { slug: "demonic-gorillas", name: "Demonic Gorillas", emoji: "🦍", iconItemId: 21015, category: "slayer",
    hp: 350, defenceLevel: 80, defenceBonuses: { stab: 10, slash: 10, crush: 10, magic: 0, ranged: 0 },
    weaknesses: ["stab", "slash", "ranged", "magic"], avgLootGp: 75_000, killsPerHourCap: 35,
    notes: "Style switches every 3 attacks." },
  { slug: "mimic", name: "The Mimic", emoji: "🎁", iconItemId: 22473, category: "slayer",
    hp: 750, defenceLevel: 200, defenceBonuses: { stab: 90, slash: 90, crush: 90, magic: 25, ranged: 25 },
    weaknesses: ["ranged"], avgLootGp: 80_000, killsPerHourCap: 8 },
  { slug: "hespori", name: "Hespori", emoji: "🌸", iconItemId: 22183, category: "slayer",
    hp: 320, defenceLevel: 110, defenceBonuses: { stab: 0, slash: 0, crush: 0, magic: 60, ranged: 0 },
    weaknesses: ["slash"], avgLootGp: 250_000, killsPerHourCap: 30 },

  // ── DT2 bosses ───────────────────────────────────────────────────────────
  { slug: "vardorvis", name: "Vardorvis", emoji: "🗡️", iconItemId: 28307, category: "dt2",
    hp: 700, defenceLevel: 215, defenceBonuses: { stab: 70, slash: 70, crush: 70, magic: 200, ranged: 70 },
    weaknesses: ["slash"], avgLootGp: 350_000, killsPerHourCap: 30,
    notes: "DT2 boss. Spec weapons shine — voidwaker / SGS." },
  { slug: "leviathan", name: "The Leviathan", emoji: "🐲", iconItemId: 28324, category: "dt2",
    hp: 800, defenceLevel: 250, defenceBonuses: { stab: 30, slash: 60, crush: 30, magic: 200, ranged: 30 },
    weaknesses: ["ranged", "stab"], avgLootGp: 320_000, killsPerHourCap: 25 },
  { slug: "duke-sucellus", name: "Duke Sucellus", emoji: "🧪", iconItemId: 28316, category: "dt2",
    hp: 660, defenceLevel: 270, defenceBonuses: { stab: 90, slash: 70, crush: 90, magic: 200, ranged: 200 },
    weaknesses: ["slash", "magic"], avgLootGp: 280_000, killsPerHourCap: 25 },
  { slug: "whisperer", name: "The Whisperer", emoji: "👻", iconItemId: 28321, category: "dt2",
    hp: 750, defenceLevel: 250, defenceBonuses: { stab: 70, slash: 70, crush: 70, magic: 0, ranged: 200 },
    weaknesses: ["magic"], avgLootGp: 300_000, killsPerHourCap: 22 },

  // ── DT1 bosses + quest bosses ────────────────────────────────────────────
  { slug: "phantom-muspah", name: "Phantom Muspah", emoji: "🌀", iconItemId: 28254, category: "quest",
    hp: 380, defenceLevel: 100, defenceBonuses: { stab: 50, slash: 50, crush: 50, magic: 0, ranged: 0 },
    weaknesses: ["ranged", "magic"], avgLootGp: 200_000, killsPerHourCap: 22,
    notes: "Phases. Style switching required." },
  { slug: "galvek", name: "Galvek", emoji: "🐲", iconItemId: 11286, category: "quest",
    hp: 250, defenceLevel: 250, defenceBonuses: { stab: 100, slash: 100, crush: 100, magic: 60, ranged: 100 },
    weaknesses: ["magic"], killsPerHourCap: 5 },
  { slug: "corp", name: "Corporeal Beast", emoji: "🦄", iconItemId: 12819, category: "world",
    hp: 2000, defenceLevel: 250, defenceBonuses: { stab: 25, slash: 200, crush: 0, magic: 350, ranged: 60 },
    weaknesses: ["stab", "crush"], avgLootGp: 250_000, killsPerHourCap: 10,
    notes: "Massive HP, immune to non-spear stab. Team boss." },
  { slug: "dks-rex", name: "Dagannoth Rex", emoji: "🦖", iconItemId: 6739, category: "world",
    hp: 255, defenceLevel: 255, defenceBonuses: { stab: 255, slash: 255, crush: 255, magic: 0, ranged: 0 },
    weaknesses: ["magic", "ranged"], avgLootGp: 20_000, killsPerHourCap: 30 },
  { slug: "dks-supreme", name: "Dagannoth Supreme", emoji: "🐲", iconItemId: 6731, category: "world",
    hp: 255, defenceLevel: 128, defenceBonuses: { stab: 255, slash: 255, crush: 255, magic: 255, ranged: 0 },
    weaknesses: ["ranged"], avgLootGp: 20_000, killsPerHourCap: 30 },
  { slug: "dks-prime", name: "Dagannoth Prime", emoji: "🐉", iconItemId: 6737, category: "world",
    hp: 255, defenceLevel: 128, defenceBonuses: { stab: 255, slash: 255, crush: 255, magic: 0, ranged: 255 },
    weaknesses: ["magic"], avgLootGp: 20_000, killsPerHourCap: 30 },
  { slug: "kbd", name: "King Black Dragon", emoji: "👑", iconItemId: 12655, category: "world",
    hp: 240, defenceLevel: 240, defenceBonuses: { stab: 65, slash: 55, crush: 35, magic: 60, ranged: 50 },
    weaknesses: ["ranged"], avgLootGp: 30_000, killsPerHourCap: 30 },
  { slug: "barrows", name: "Barrows", emoji: "⚰️", iconItemId: 4708, category: "minigame",
    hp: 1100, defenceLevel: 100, defenceBonuses: { stab: 80, slash: 80, crush: 80, magic: 5, ranged: 5 },
    weaknesses: ["magic", "ranged"], avgLootGp: 130_000, killsPerHourCap: 16,
    notes: "Combined HP of all 6 brothers. Vary style per brother in tunnels." },
  { slug: "obor", name: "Obor", emoji: "🪓", iconItemId: 11920, category: "quest",
    hp: 122, defenceLevel: 10, defenceBonuses: { stab: 5, slash: 5, crush: 5, magic: 50, ranged: 50 },
    weaknesses: ["slash", "crush"], avgLootGp: 8_000, killsPerHourCap: 35 },
  { slug: "bryophyta", name: "Bryophyta", emoji: "🌿", iconItemId: 22372, category: "quest",
    hp: 145, defenceLevel: 50, defenceBonuses: { stab: 10, slash: 10, crush: 10, magic: 80, ranged: 60 },
    weaknesses: ["slash"], avgLootGp: 12_000, killsPerHourCap: 30 },

  // ── Raids 1 — Chambers of Xeric (single tile, rooms inside) ──────────────
  { slug: "cox", name: "Chambers of Xeric", emoji: "🦂", iconItemId: 20997, category: "raid",
    hp: 800, defenceLevel: 175, defenceBonuses: { stab: 50, slash: 50, crush: 50, magic: 90, ranged: 50 },
    weaknesses: ["ranged", "magic"], avgLootGp: 1_000_000, killsPerHourCap: 4,
    notes: "5 boss rooms + Olm. Tbow + crush spec are the standard.",
    rooms: [
      { slug: "tekton",    name: "Tekton",        hp: 300,  defenceLevel: 240, defenceBonuses: { stab: 35, slash: 25, crush: 35, magic: 110, ranged: 75 },
        weaknesses: ["crush"], notes: "Crush + DWH spec drops his defence.", iconItemId: 13652 /* Dragon claws — CoX unique table */ },
      { slug: "vasa",      name: "Vasa Nistirio", hp: 1100, defenceLevel: 110, defenceBonuses: { stab: 40, slash: 30, crush: 40, magic: 175, ranged: 50 },
        weaknesses: ["ranged"], iconItemId: 21000 /* Twisted buckler */ },
      { slug: "vespula",   name: "Vespula",       hp: 280,  defenceLevel: 130, defenceBonuses: { stab: 30, slash: 30, crush: 30, magic: 50, ranged: 50 },
        weaknesses: ["stab", "slash"], iconItemId: 21003 /* Elder maul */ },
      { slug: "muttadile", name: "Muttadile",     hp: 270,  defenceLevel: 200, defenceBonuses: { stab: 40, slash: 40, crush: 40, magic: 110, ranged: 80 },
        weaknesses: ["ranged", "magic"], iconItemId: 20849 /* Dragon thrownaxe */ },
      { slug: "olm",       name: "Great Olm",     hp: 800,  defenceLevel: 175, defenceBonuses: { stab: 50, slash: 50, crush: 50, magic: 90, ranged: 50 },
        weaknesses: ["ranged", "magic"], notes: "Final boss — range + magic phases.", iconItemId: 20997 /* Twisted bow */ }
    ]
  },

  // ── Raids 2 — Theatre of Blood ───────────────────────────────────────────
  { slug: "tob", name: "Theatre of Blood", emoji: "🦇", iconItemId: 22325, category: "raid",
    hp: 4500, defenceLevel: 200, defenceBonuses: { stab: 0, slash: 0, crush: 0, magic: 0, ranged: 250 },
    weaknesses: ["stab", "slash", "magic"], avgLootGp: 2_000_000, killsPerHourCap: 4,
    notes: "6 rooms ending at Verzik. Scythe + range gear is the meta.",
    rooms: [
      { slug: "maiden",   name: "The Maiden",      hp: 2625, defenceLevel: 200, defenceBonuses: { stab: 0, slash: 0, crush: 0, magic: 200, ranged: 70 },
        weaknesses: ["stab", "slash", "crush"], notes: "HP scales with party size.", iconItemId: 22322 /* Avernic defender */ },
      { slug: "bloat",    name: "Pestilent Bloat", hp: 1500, defenceLevel: 200, defenceBonuses: { stab: 0, slash: 0, crush: 0, magic: 250, ranged: 100 },
        weaknesses: ["slash", "crush"], iconItemId: 22327 /* Justiciar chestguard */ },
      { slug: "nylo",     name: "Nylocas",         hp: 1200, defenceLevel: 200, defenceBonuses: { stab: 0, slash: 0, crush: 0, magic: 250, ranged: 250 },
        weaknesses: ["stab", "slash", "crush"], notes: "Style swap waves.", iconItemId: 22481 /* Sanguinesti staff */ },
      { slug: "sotetseg", name: "Sotetseg",        hp: 1800, defenceLevel: 200, defenceBonuses: { stab: 0, slash: 0, crush: 0, magic: 200, ranged: 200 },
        weaknesses: ["ranged", "magic"], iconItemId: 22328 /* Justiciar legguards */ },
      { slug: "xarpus",   name: "Xarpus",          hp: 1500, defenceLevel: 200, defenceBonuses: { stab: 0, slash: 0, crush: 0, magic: 200, ranged: 250 },
        weaknesses: ["stab", "slash", "crush"], iconItemId: 22326 /* Justiciar faceguard */ },
      { slug: "verzik",   name: "Verzik Vitur",    hp: 4500, defenceLevel: 200, defenceBonuses: { stab: 0, slash: 0, crush: 0, magic: 0, ranged: 250 },
        weaknesses: ["stab", "slash", "magic"], notes: "Three phases — mage, range, melee.", iconItemId: 22325 /* Scythe of vitur */ }
    ]
  },

  // ── Raids 3 — Tombs of Amascut ───────────────────────────────────────────
  { slug: "toa", name: "Tombs of Amascut", emoji: "🏺", iconItemId: 26219, category: "raid",
    hp: 1500, defenceLevel: 80, defenceBonuses: { stab: 80, slash: 80, crush: 80, magic: 60, ranged: 60 },
    weaknesses: ["ranged", "magic"], avgLootGp: 1_500_000, killsPerHourCap: 3,
    notes: "4 path rooms + Warden. Tbow / Shadow / Fang carry hard.",
    rooms: [
      { slug: "akkha",   name: "Akkha",     hp: 700,  defenceLevel: 80, defenceBonuses: { stab: 80, slash: 80, crush: 80, magic: 80, ranged: 80 },
        weaknesses: ["ranged", "magic"], notes: "Style cycles every 5 attacks.", iconItemId: 27285 /* Akkha's remnant */ },
      { slug: "ba-ba",   name: "Ba-Ba",     hp: 800,  defenceLevel: 80, defenceBonuses: { stab: 80, slash: 80, crush: 80, magic: 80, ranged: 80 },
        weaknesses: ["crush"], iconItemId: 27283 /* Ba-Ba's remnant */ },
      { slug: "kephri",  name: "Kephri",    hp: 700,  defenceLevel: 80, defenceBonuses: { stab: 80, slash: 80, crush: 80, magic: 80, ranged: 80 },
        weaknesses: ["ranged"], iconItemId: 27279 /* Thread of Elidinis */ },
      { slug: "zebak",   name: "Zebak",     hp: 800,  defenceLevel: 80, defenceBonuses: { stab: 80, slash: 80, crush: 80, magic: 80, ranged: 80 },
        weaknesses: ["magic"], iconItemId: 25975 /* Lightbearer */ },
      { slug: "warden",  name: "Tumeken's Warden", hp: 1500, defenceLevel: 80, defenceBonuses: { stab: 80, slash: 80, crush: 80, magic: 60, ranged: 60 },
        weaknesses: ["ranged", "magic"], notes: "Final boss — Tbow shines.", iconItemId: 27277 /* Tumeken's shadow */ }
    ]
  },

  // ── Inferno + Fight Caves ────────────────────────────────────────────────
  { slug: "tzkal-zuk", name: "TzKal-Zuk", emoji: "🔥", iconItemId: 21295, category: "minigame",
    hp: 1200, defenceLevel: 240, defenceBonuses: { stab: 100, slash: 100, crush: 100, magic: 350, ranged: 65 },
    weaknesses: ["ranged"], killsPerHourCap: 1,
    notes: "Inferno final boss. Heaviest endgame solo." },
  { slug: "tztok-jad", name: "TzTok-Jad", emoji: "🦟", iconItemId: 6570, category: "minigame",
    hp: 250, defenceLevel: 157, defenceBonuses: { stab: 130, slash: 130, crush: 130, magic: 240, ranged: 480 },
    weaknesses: ["ranged", "magic"], killsPerHourCap: 4,
    notes: "Fight Caves boss. Prayer flicking required." },

  // ── Misc world bosses ───────────────────────────────────────────────────
  { slug: "giant-mole", name: "Giant Mole", emoji: "🐹", iconItemId: 7416, category: "world",
    hp: 255, defenceLevel: 230, defenceBonuses: { stab: 30, slash: 30, crush: 0, magic: 30, ranged: 50 },
    weaknesses: ["crush", "slash"], avgLootGp: 25_000, killsPerHourCap: 30 },
  { slug: "deranged-archaeologist", name: "Deranged Archaeologist", emoji: "📚", iconItemId: 13283, category: "world",
    hp: 230, defenceLevel: 110, defenceBonuses: { stab: 5, slash: 5, crush: 5, magic: 30, ranged: 80 },
    weaknesses: ["ranged"], avgLootGp: 30_000, killsPerHourCap: 30,
    notes: "Salt-of-the-earth slayer drop." },
  { slug: "sarachnis", name: "Sarachnis", emoji: "🕷️", iconItemId: 23528, category: "world",
    hp: 450, defenceLevel: 230, defenceBonuses: { stab: 30, slash: 30, crush: 30, magic: 30, ranged: 0 },
    weaknesses: ["ranged"], avgLootGp: 65_000, killsPerHourCap: 35 },
  { slug: "zalcano", name: "Zalcano", emoji: "🌋", iconItemId: 23673, category: "skilling",
    hp: 1500, defenceLevel: 200, defenceBonuses: { stab: 50, slash: 50, crush: 50, magic: 0, ranged: 0 },
    weaknesses: ["magic"], avgLootGp: 120_000, killsPerHourCap: 18,
    notes: "Skilling boss — mining + smithing focus." },
  { slug: "wintertodt", name: "Wintertodt", emoji: "❄️", iconItemId: 20708, category: "skilling",
    hp: 0, defenceLevel: 0, defenceBonuses: { stab: 0, slash: 0, crush: 0, magic: 0, ranged: 0 },
    weaknesses: [], avgLootGp: 40_000, killsPerHourCap: 10,
    notes: "Skilling boss — firemaking. No combat stats." },
  { slug: "tempoross", name: "Tempoross", emoji: "🌊", iconItemId: 25477, category: "skilling",
    hp: 0, defenceLevel: 0, defenceBonuses: { stab: 0, slash: 0, crush: 0, magic: 0, ranged: 0 },
    weaknesses: [], avgLootGp: 90_000, killsPerHourCap: 10,
    notes: "Skilling boss — fishing. No combat stats." },
  { slug: "guardians-of-the-rift", name: "Guardians of the Rift", emoji: "🌀", iconItemId: 26822, category: "skilling",
    hp: 0, defenceLevel: 0, defenceBonuses: { stab: 0, slash: 0, crush: 0, magic: 0, ranged: 0 },
    weaknesses: [], avgLootGp: 70_000, killsPerHourCap: 8,
    notes: "Skilling minigame — runecraft. No combat stats." },

  // ── Other slayer-relevant bosses ─────────────────────────────────────────
  { slug: "araxxor", name: "Araxxor", emoji: "🕷️", iconItemId: 29545, category: "slayer",
    hp: 460, defenceLevel: 180, defenceBonuses: { stab: 25, slash: 25, crush: 25, magic: 65, ranged: 130 },
    weaknesses: ["slash", "crush"], avgLootGp: 200_000, killsPerHourCap: 22,
    notes: "Slayer-locked Araxyte hive boss." },
  { slug: "amoxliatl", name: "Amoxliatl", emoji: "❄️", iconItemId: 30319, category: "slayer",
    hp: 300, defenceLevel: 100, defenceBonuses: { stab: 30, slash: 30, crush: 30, magic: 0, ranged: 50 },
    weaknesses: ["magic"], avgLootGp: 80_000, killsPerHourCap: 35,
    notes: "Varlamore slayer boss." },
  { slug: "hueycoatl", name: "The Hueycoatl", emoji: "🐍", iconItemId: 30032, category: "slayer",
    hp: 700, defenceLevel: 180, defenceBonuses: { stab: 50, slash: 50, crush: 50, magic: 50, ranged: 50 },
    weaknesses: ["crush", "ranged"], avgLootGp: 250_000, killsPerHourCap: 15,
    notes: "Varlamore mid-game boss." },
  { slug: "fortis-colosseum", name: "Sol Heredit", emoji: "⚔️", iconItemId: 30053, category: "minigame",
    hp: 1500, defenceLevel: 200, defenceBonuses: { stab: 80, slash: 80, crush: 80, magic: 100, ranged: 100 },
    weaknesses: ["stab"], avgLootGp: 1_200_000, killsPerHourCap: 4,
    notes: "Fortis Colosseum boss — Varlamore endgame solo." },
  { slug: "moons-of-peril", name: "Moons of Peril", emoji: "🌑", iconItemId: 29006, category: "minigame",
    hp: 600, defenceLevel: 120, defenceBonuses: { stab: 30, slash: 30, crush: 30, magic: 30, ranged: 30 },
    weaknesses: ["slash", "stab", "magic", "ranged"], avgLootGp: 350_000, killsPerHourCap: 12,
    notes: "Three moons — style swap per moon." }
];

export const BOSS_BY_SLUG = new Map(BOSSES.map((b) => [b.slug, b]));

export const BOSS_CATEGORIES: Record<BossCategory, string> = {
  raid: "Raids",
  gwd: "God Wars",
  wildy: "Wilderness",
  slayer: "Slayer",
  skilling: "Skilling",
  quest: "Quest",
  minigame: "Minigame",
  dt2: "DT2",
  world: "World",
  misc: "Other"
};
