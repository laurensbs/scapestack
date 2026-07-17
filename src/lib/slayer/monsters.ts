// Slayer-task monsters — gegroepeerd per slayer-level-tier.
//
// Bron: OSRS Wiki monster pagina's, slayer-task lijsten per master,
// gecheckt 2026-05-26. Velden:
//   hp:           hitpoints van het standaard variant (Konar/Catacombs
//                 variants negeren we — gebruik bijbehorende monster
//                 die je daadwerkelijk killt voor XP-rekenen).
//   slayerLevel:  minimum om aangevallen te mogen worden
//   combatLevel:  monster's combat level (info, geen gating)
//   weakness:     dominante stijl voor method-recommendations
//   locations:    ruwe locaties, gebruikt door UI om route-suggesties
//                 te bouwen (Konar gebruikt deze om "alleen-hier"
//                 constraints toe te passen)
//   cannonable:   true wanneer cannon legaal + ROI-positief is
//   isBoss:       true voor boss-task variants (geen quantity-modifier)
//   hint:         één-regel trainer-tip; lange uitleg hoort op wiki
//
// We includeren monsters die *minstens één master* in zijn pool heeft.
// Wilderness-only monsters (Krystilia) komen later. Master-pool
// mapping leeft in task-pools.ts.

import type { SlayerMonster } from "./types";

export const MONSTERS: SlayerMonster[] = [
  // ---------- Tier 1: geen slayer-level eis ----------
  {
    id: "banshee", name: "Banshee", hp: 22, slayerLevel: 15,
    weakness: "crush", locations: ["Slayer Tower"],
    cannonable: false, isBoss: false,
    hint: "Earmuffs vereist. Ranged of melee zonder defensive XP."
  },
  {
    id: "bear", name: "Black bear", hp: 25, slayerLevel: 1,
    weakness: "slash", locations: ["Anywhere"],
    cannonable: true, isBoss: false
  },
  {
    id: "bird", name: "Bird", hp: 5, slayerLevel: 1,
    weakness: "ranged", locations: ["Anywhere"],
    cannonable: false, isBoss: false,
    hint: "Snel; uitstekend voor Turael-skip streaks."
  },
  {
    id: "cave_bug", name: "Cave bug", hp: 5, slayerLevel: 7,
    weakness: "crush", locations: ["Lumbridge Swamp Caves"],
    cannonable: false, isBoss: false
  },
  {
    id: "cave_crawler", name: "Cave crawler", hp: 22, slayerLevel: 10,
    weakness: "slash", locations: ["Fremennik Slayer Dungeon"],
    cannonable: true, isBoss: false
  },
  {
    id: "cave_horror", name: "Cave horror", hp: 55, slayerLevel: 58,
    weakness: "crush", locations: ["Mos Le'Harmless"],
    cannonable: false, isBoss: false,
    hint: "Witchwood icon nodig. Drops black mask."
  },
  {
    id: "cave_kraken", name: "Cave kraken", hp: 125, slayerLevel: 87,
    weakness: "magic", locations: ["Kraken Cove"],
    cannonable: false, isBoss: false,
    hint: "Low-attention Magic task; the Kraken boss is an optional task variant."
  },
  {
    id: "cave_slime", name: "Cave slime", hp: 25, slayerLevel: 17,
    weakness: "magic", locations: ["Lumbridge Swamp Caves"],
    cannonable: false, isBoss: false
  },
  {
    id: "chaos_druid", name: "Chaos druid", hp: 20, slayerLevel: 1,
    weakness: "stab", locations: ["Edgeville Dungeon", "Taverley Dungeon"],
    cannonable: true, isBoss: false,
    hint: "Niet typisch slayer-task; meestal vergeten."
  },
  {
    id: "cockatrice", name: "Cockatrice", hp: 37, slayerLevel: 25,
    weakness: "ranged", locations: ["Fremennik Slayer Dungeon"],
    cannonable: false, isBoss: false,
    hint: "Mirror shield vereist."
  },
  {
    id: "crawling_hand", name: "Crawling hand", hp: 15, slayerLevel: 5,
    weakness: "slash", locations: ["Slayer Tower"],
    cannonable: false, isBoss: false
  },
  {
    id: "dog", name: "Dog", hp: 25, slayerLevel: 1,
    weakness: "stab", locations: ["Anywhere"],
    cannonable: true, isBoss: false
  },
  {
    id: "dust_devil", name: "Dust devil", hp: 105, slayerLevel: 65,
    weakness: "crush", locations: ["Smoke Dungeon", "Catacombs of Kourend"],
    cannonable: true, isBoss: false,
    hint: "Use a facemask or Slayer helm. Burst in the Catacombs; cannon only where the location allows it."
  },
  {
    id: "earth_warrior", name: "Earth warrior", hp: 54, slayerLevel: 1,
    weakness: "crush", locations: ["Edgeville Dungeon Wilderness"],
    cannonable: true, isBoss: false
  },
  {
    id: "ghost", name: "Ghost", hp: 25, slayerLevel: 1,
    weakness: "magic", locations: ["Anywhere"],
    cannonable: true, isBoss: false
  },
  {
    id: "ghoul", name: "Ghoul", hp: 50, slayerLevel: 1,
    weakness: "slash", locations: ["Ghoul Camp"],
    cannonable: true, isBoss: false
  },
  {
    id: "goblin", name: "Goblin", hp: 5, slayerLevel: 1,
    weakness: "crush", locations: ["Anywhere"],
    cannonable: true, isBoss: false
  },
  {
    id: "hill_giant", name: "Hill giant", hp: 35, slayerLevel: 1,
    weakness: "stab", locations: ["Edgeville Dungeon", "Hill Giant Camp"],
    cannonable: true, isBoss: false
  },
  {
    id: "ice_warrior", name: "Ice warrior", hp: 59, slayerLevel: 1,
    weakness: "crush", locations: ["Asgarnian Ice Dungeon", "Wilderness"],
    cannonable: true, isBoss: false
  },
  {
    id: "kalphite", name: "Kalphite", hp: 16, slayerLevel: 1,
    weakness: "crush", locations: ["Kalphite Lair"],
    cannonable: true, isBoss: false
  },
  {
    id: "minotaur", name: "Minotaur", hp: 10, slayerLevel: 1,
    weakness: "crush", locations: ["Stronghold of Security"],
    cannonable: false, isBoss: false
  },
  {
    id: "rat", name: "Rat", hp: 2, slayerLevel: 1,
    weakness: "ranged", locations: ["Anywhere"],
    cannonable: false, isBoss: false
  },
  {
    id: "rockslug", name: "Rockslug", hp: 27, slayerLevel: 20,
    weakness: "crush", locations: ["Fremennik Slayer Dungeon"],
    cannonable: false, isBoss: false,
    hint: "Bag of salt nodig om te killen."
  },
  {
    id: "scorpion", name: "Scorpion", hp: 2, slayerLevel: 1,
    weakness: "crush", locations: ["Karamja", "Al Kharid"],
    cannonable: true, isBoss: false
  },
  {
    id: "spider", name: "Spider", hp: 2, slayerLevel: 1,
    weakness: "crush", locations: ["Anywhere"],
    cannonable: true, isBoss: false
  },
  {
    id: "wall_beast", name: "Wall beast", hp: 105, slayerLevel: 35,
    weakness: "stab", locations: ["Lumbridge Swamp Caves"],
    cannonable: false, isBoss: false,
    hint: "Spiny helmet vereist."
  },
  {
    id: "wolf", name: "Wolf", hp: 10, slayerLevel: 1,
    weakness: "stab", locations: ["White Wolf Mountain"],
    cannonable: true, isBoss: false
  },
  {
    id: "zombie", name: "Zombie", hp: 22, slayerLevel: 1,
    weakness: "crush", locations: ["Anywhere"],
    cannonable: true, isBoss: false
  },

  // ---------- Tier 2: low-mid slayer (~25-50) ----------
  {
    id: "abyssal_demon", name: "Abyssal demon", hp: 150, slayerLevel: 85,
    weakness: "slash", locations: ["Slayer Tower", "Catacombs of Kourend"],
    cannonable: true, isBoss: false,
    hint: "Drops Abyssal whip. AFK-skill bij Catacombs cannon."
  },
  {
    id: "aberrant_spectre", name: "Aberrant spectre", hp: 90, slayerLevel: 60,
    weakness: "stab", locations: ["Slayer Tower", "Catacombs of Kourend"],
    cannonable: true, isBoss: false,
    hint: "Nosepeg vereist anders stat-drain."
  },
  {
    id: "ankou", name: "Ankou", hp: 60, slayerLevel: 1,
    weakness: "stab", locations: ["Stronghold of Security", "Catacombs of Kourend"],
    cannonable: true, isBoss: false,
    hint: "Catacombs Ankou = solid GP voor low-mid combat."
  },
  {
    id: "basilisk", name: "Basilisk", hp: 75, slayerLevel: 40,
    weakness: "stab", locations: ["Fremennik Slayer Dungeon", "Jormungand's Prison"],
    cannonable: true, isBoss: false,
    hint: "Mirror shield. Jormungand variant = basilisk knights, betere XP."
  },
  {
    id: "basilisk_knight", name: "Basilisk knight", hp: 300, slayerLevel: 60,
    weakness: "stab", locations: ["Jormungand's Prison"],
    cannonable: false, isBoss: false,
    hint: "Dragon Slayer II vereist. Drops Basilisk jaw (Neitiznot faceguard)."
  },
  {
    id: "bloodveld", name: "Bloodveld", hp: 120, slayerLevel: 50,
    weakness: "stab", locations: ["Slayer Tower", "Catacombs of Kourend"],
    cannonable: true, isBoss: false,
    hint: "Iconisch melee strength/HP training. Catacombs = AFK XP."
  },
  {
    id: "brine_rat", name: "Brine rat", hp: 50, slayerLevel: 47,
    weakness: "slash", locations: ["Brine Rat Cavern"],
    cannonable: false, isBoss: false
  },
  {
    id: "dagannoth", name: "Dagannoth", hp: 70, slayerLevel: 1,
    weakness: "ranged", locations: ["Waterbirth Island", "Lighthouse"],
    cannonable: true, isBoss: false,
    hint: "Lighthouse safespot voor low-defence pures."
  },
  {
    id: "dark_beast", name: "Dark beast", hp: 220, slayerLevel: 90,
    weakness: "ranged", locations: ["Mourner Tunnels", "Catacombs of Kourend"],
    cannonable: true, isBoss: false,
    hint: "Mournings End II vereist. Drops Dark bow."
  },
  {
    id: "elf", name: "Elf", hp: 80, slayerLevel: 1,
    weakness: "slash", locations: ["Lletya", "Prifddinas"],
    cannonable: false, isBoss: false,
    hint: "Regicide vereist. Drops Crystal shards (Prifddinas)."
  },
  {
    id: "fever_spider", name: "Fever spider", hp: 40, slayerLevel: 42,
    weakness: "crush", locations: ["Mos Le'Harmless"],
    cannonable: false, isBoss: false,
    hint: "Slayer gloves vereist anders venom."
  },
  {
    id: "fire_giant", name: "Fire giant", hp: 111, slayerLevel: 1,
    weakness: "stab", locations: ["Waterfall Dungeon", "Catacombs of Kourend"],
    cannonable: true, isBoss: false,
    hint: "Waterfall = veilig + GP. Catacombs = AFK XP."
  },
  {
    id: "gargoyle", name: "Gargoyle", hp: 105, slayerLevel: 75,
    weakness: "crush", locations: ["Slayer Tower", "Catacombs of Kourend"],
    cannonable: true, isBoss: false,
    hint: "Rock hammer vereist voor finishing blow. Granite maul drops."
  },
  {
    id: "greater_demon", name: "Greater demon", hp: 87, slayerLevel: 1,
    weakness: "stab", locations: ["Catacombs of Kourend", "Forthos Dungeon"],
    cannonable: true, isBoss: false,
    hint: "AFK in the Catacombs, or use a cannon at a location that permits it."
  },
  {
    id: "harpie_bug_swarm", name: "Harpie bug swarm", hp: 25, slayerLevel: 33,
    weakness: "crush", locations: ["Karamja Volcano"],
    cannonable: false, isBoss: false,
    hint: "Bug lantern vereist."
  },
  {
    id: "hellhound", name: "Hellhound", hp: 116, slayerLevel: 1,
    weakness: "stab", locations: ["Taverley Dungeon", "Catacombs of Kourend"],
    cannonable: true, isBoss: false,
    hint: "Low-attention task in the Catacombs; use a cannon only at a location that permits it."
  },
  {
    id: "infernal_mage", name: "Infernal mage", hp: 60, slayerLevel: 45,
    weakness: "ranged", locations: ["Slayer Tower", "Catacombs of Kourend"],
    cannonable: true, isBoss: false
  },
  {
    id: "jelly", name: "Jelly", hp: 75, slayerLevel: 52,
    weakness: "stab", locations: ["Fremennik Slayer Dungeon", "Catacombs of Kourend"],
    cannonable: true, isBoss: false
  },
  {
    id: "jungle_horror", name: "Jungle horror", hp: 45, slayerLevel: 1,
    weakness: "crush", locations: ["Mos Le'Harmless"],
    cannonable: false, isBoss: false
  },
  {
    id: "killerwatt", name: "Killerwatt", hp: 51, slayerLevel: 37,
    weakness: "magic", locations: ["Killerwatt Plane"],
    cannonable: false, isBoss: false,
    hint: "Insulated boots vereist. Lunar Diplomacy unlock."
  },
  {
    id: "kurask", name: "Kurask", hp: 97, slayerLevel: 70,
    weakness: "ranged", locations: ["Fremennik Slayer Dungeon"],
    cannonable: false, isBoss: false,
    hint: "Leaf-bladed weapon vereist. Drops Mystic robes."
  },
  {
    id: "lesser_demon", name: "Lesser demon", hp: 79, slayerLevel: 1,
    weakness: "stab", locations: ["Karamja Volcano", "Wizard's Tower"],
    cannonable: true, isBoss: false
  },
  {
    id: "lizardman", name: "Lizardman", hp: 60, slayerLevel: 1,
    weakness: "ranged", locations: ["Kourend", "Molch Island"],
    cannonable: true, isBoss: false,
    hint: "Molch Island Shamans = lizardman shaman task. Dragon warhammer drops."
  },
  {
    id: "lizardman_shaman", name: "Lizardman shaman", hp: 150, slayerLevel: 1,
    weakness: "ranged", locations: ["Molch Island", "Lizardman Caves"],
    cannonable: false, isBoss: false,
    hint: "Dragon warhammer drop. Konar Lizardman task is vaak shaman."
  },
  {
    id: "mogre", name: "Mogre", hp: 48, slayerLevel: 32,
    weakness: "stab", locations: ["Mudskipper Point"],
    cannonable: false, isBoss: false,
    hint: "Fishing explosive vereist om te spawnen."
  },
  {
    id: "molanisk", name: "Molanisk", hp: 52, slayerLevel: 39,
    weakness: "stab", locations: ["Dorgesh-Kaan", "Lumbridge Swamp Caves"],
    cannonable: false, isBoss: false
  },
  {
    id: "mutated_zygomite", name: "Mutated zygomite", hp: 65, slayerLevel: 57,
    weakness: "ranged", locations: ["Zanaris", "Fossil Island"],
    cannonable: false, isBoss: false,
    hint: "Fungicide spray vereist (Lost City + Zogre flesh-eaters)."
  },
  {
    id: "nechryael", name: "Nechryael", hp: 105, slayerLevel: 80,
    weakness: "stab", locations: ["Slayer Tower", "Catacombs of Kourend"],
    cannonable: true, isBoss: false,
    hint: "Burst Greater Nechryael in the Catacombs, or use a simpler melee trip."
  },
  {
    id: "ogre", name: "Ogre", hp: 60, slayerLevel: 1,
    weakness: "crush", locations: ["Combat Training Camp", "Jiggig"],
    cannonable: true, isBoss: false
  },
  {
    id: "otherworldly_being", name: "Otherworldly being", hp: 66, slayerLevel: 1,
    weakness: "magic", locations: ["Zanaris"],
    cannonable: false, isBoss: false
  },
  {
    id: "pyrefiend", name: "Pyrefiend", hp: 45, slayerLevel: 30,
    weakness: "crush", locations: ["Fremennik Slayer Dungeon", "Catacombs of Kourend"],
    cannonable: true, isBoss: false
  },
  {
    id: "shade", name: "Shade", hp: 170, slayerLevel: 1,
    weakness: "magic", locations: ["Mort'ton catacombs"],
    cannonable: false, isBoss: false
  },
  {
    id: "skeletal_wyvern", name: "Skeletal wyvern", hp: 200, slayerLevel: 72,
    weakness: "magic", locations: ["Asgarnian Ice Dungeon"],
    cannonable: false, isBoss: false,
    hint: "Elemental shield vereist. Granite legs + Wyvern visage."
  },
  {
    id: "smoke_devil", name: "Smoke devil", hp: 185, slayerLevel: 93,
    weakness: "ranged", locations: ["Smoke Devil Dungeon"],
    cannonable: true, isBoss: false,
    hint: "Face mask vereist. Drops Occult necklace + Smoke battlestaff."
  },
  {
    id: "spiritual_creature", name: "Spiritual creature", hp: 85, slayerLevel: 63,
    weakness: "stab", locations: ["God Wars Dungeon"],
    cannonable: true, isBoss: false,
    hint: "Drops Dragon boots (mages) en Steel boots (warriors)."
  },
  {
    id: "suqah", name: "Suqah", hp: 105, slayerLevel: 1,
    weakness: "crush", locations: ["Lunar Isle"],
    cannonable: false, isBoss: false
  },
  {
    id: "tortured_soul", name: "Tortured soul", hp: 51, slayerLevel: 1,
    weakness: "stab", locations: ["Sins of the Father quest"],
    cannonable: false, isBoss: false
  },
  {
    id: "trolls", name: "Troll (general)", hp: 60, slayerLevel: 1,
    weakness: "magic", locations: ["Burthorpe", "Trollheim"],
    cannonable: true, isBoss: false
  },
  {
    id: "turoth", name: "Turoth", hp: 76, slayerLevel: 55,
    weakness: "stab", locations: ["Fremennik Slayer Dungeon"],
    cannonable: false, isBoss: false,
    hint: "Leaf-bladed weapon vereist."
  },
  {
    id: "tzhaar", name: "Tzhaar-Hur/Ket/Xil", hp: 70, slayerLevel: 1,
    weakness: "stab", locations: ["Mor Ul Rek"],
    cannonable: false, isBoss: false,
    hint: "Tokkul-grinden bonus tijdens task."
  },
  {
    id: "vampyre", name: "Vampyre", hp: 1, slayerLevel: 1,
    weakness: "stab", locations: ["Morytania"],
    cannonable: false, isBoss: false,
    hint: "Vyre type bepaalt vereist weapon (Tier 1 = stake, 2 = Ivandis, 3 = Blisterwood)."
  },
  {
    id: "warped_creature", name: "Warped creature", hp: 80, slayerLevel: 56,
    weakness: "ranged", locations: ["Poison Waste Slayer Dungeon"],
    cannonable: false, isBoss: false,
    hint: "Pre-MEP2; vaak geblokt door high-level slayers."
  },
  {
    id: "waterfiend", name: "Waterfiend", hp: 128, slayerLevel: 1,
    weakness: "crush", locations: ["Ancient Cavern", "Catacombs of Kourend"],
    cannonable: true, isBoss: false,
    hint: "Crush weapons are preferred; often skipped when points are available."
  },
  {
    id: "wyrm", name: "Wyrm", hp: 120, slayerLevel: 62,
    weakness: "magic", locations: ["Karuulm Slayer Dungeon"],
    cannonable: true, isBoss: false,
    hint: "Bring protection for the Karuulm dungeon floor."
  },

  // ---------- Tier 3: high slayer (drake/hydra family + 85+) ----------
  {
    id: "ankylosaur", name: "Drake", hp: 225, slayerLevel: 84,
    weakness: "magic", locations: ["Karuulm Slayer Dungeon"],
    cannonable: false, isBoss: false,
    hint: "Karuulm boots. Drops Boots of Stone, Brimstone."
  },
  {
    id: "alchemical_hydra", name: "Alchemical Hydra", hp: 1100, slayerLevel: 95,
    weakness: "magic", locations: ["Karuulm Slayer Dungeon"],
    cannonable: false, isBoss: true,
    hint: "Boss task. Drops Hydra leather, Dragon hunter crossbow."
  },
  {
    id: "hydra", name: "Hydra", hp: 300, slayerLevel: 95,
    weakness: "magic", locations: ["Karuulm Slayer Dungeon"],
    cannonable: false, isBoss: false,
    hint: "Non-Alchemical pre-cursor. Drops Hydra tail."
  },

  // ---------- Bosses (boss-task only) ----------
  {
    id: "abyssal_sire", name: "Abyssal Sire", hp: 425, slayerLevel: 85,
    weakness: "crush", locations: ["Abyssal Nexus"],
    cannonable: false, isBoss: true,
    hint: "Boss task. Drops Bludgeon pieces, Abyssal dagger."
  },
  {
    id: "cerberus", name: "Cerberus", hp: 600, slayerLevel: 91,
    weakness: "ranged", locations: ["Taverley Dungeon"],
    cannonable: false, isBoss: true,
    hint: "Boss task. Drops Primordial/Pegasian/Eternal crystals."
  },
  {
    id: "grotesque_guardians", name: "Grotesque Guardians", hp: 470, slayerLevel: 75,
    weakness: "ranged", locations: ["Slayer Tower roof"],
    cannonable: false, isBoss: true,
    hint: "Boss task. Drops Black tourmaline core."
  },
  {
    id: "kalphite_queen", name: "Kalphite Queen", hp: 255, slayerLevel: 1,
    weakness: "stab", locations: ["Kalphite Lair"],
    cannonable: false, isBoss: true,
    hint: "Dragon chainbody, KQ head drop."
  },
  {
    id: "king_black_dragon", name: "King Black Dragon", hp: 240, slayerLevel: 1,
    weakness: "stab", locations: ["KBD Lair"],
    cannonable: false, isBoss: true,
    hint: "Wilderness. Anti-dragon shield + antifire."
  },
  {
    id: "kraken_boss", name: "Kraken", hp: 255, slayerLevel: 87,
    weakness: "magic", locations: ["Kraken Cove"],
    cannonable: false, isBoss: true,
    hint: "Boss task. Drops Trident of the Seas, Kraken tentacle."
  },
  {
    id: "thermonuclear", name: "Thermonuclear Smoke Devil", hp: 240, slayerLevel: 93,
    weakness: "ranged", locations: ["Smoke Devil Dungeon"],
    cannonable: false, isBoss: true,
    hint: "Boss task. Drops Smoke battlestaff, Occult necklace."
  }
];

/** Lookup-table by id voor O(1) toegang in masters/task-pools logica. */
export const MONSTERS_BY_ID = new Map(MONSTERS.map((m) => [m.id, m]));
