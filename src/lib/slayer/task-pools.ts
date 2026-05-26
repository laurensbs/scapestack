// Slayer task-pool gewichten per master.
//
// Voor elke master: { monster.id → weight }. Weight ratio bepaalt
// hoe vaak een master die monster geeft, relatief binnen zijn pool.
// Voorbeeld: als pool {ankou: 8, dust_devil: 12} en je voldoet aan
// beide vereisten, krijg je 12/20 = 60% kans op dust_devil.
//
// Bron: OSRS Wiki master-pagina's, "Tasks" sectie (kolom 'Weight').
// Niet 100% precies tegen elke recente patch — wij gebruiken
// representatieve waardes; precieze sim-uitkomsten zijn later
// kalibreerbaar via plugin-data (echte task-frequenties).
//
// Filtering — een master geeft alleen monsters waaraan de speler
// voldoet:
//   - slayerLevel >= monster.slayerLevel
//   - Quest-eisen van het monster zijn voldaan (uitbreiden later)
//   - Niet geblokt door speler's block-list (in simulator)
//   - Niet de current task (anti-repeat in OSRS)
//
// task-pools.ts levert alleen de raw weights; eligibility-check leeft
// in simulator.ts (volgende fase).

import type { MasterId } from "./types";

/** Weights voor monsters in Turael's pool. Turael is bottom-tier:
 *  alleen lage-level tasks, alle weights ~6-8. */
export const TURAEL_POOL: Record<string, number> = {
  banshee: 8,
  bird: 6,
  bear: 7,
  cave_bug: 8,
  cave_crawler: 8,
  cave_slime: 8,
  cockatrice: 8,
  crawling_hand: 8,
  dog: 7,
  dwarf: 7, // niet in monsters.ts maar standaard task; later toevoegen
  ghost: 7,
  goblin: 7,
  hill_giant: 8,
  ice_warrior: 7,
  kalphite: 6,
  lizardman: 6,
  minotaur: 7,
  monkey: 6, // idem
  rat: 7,
  rockslug: 7,
  scorpion: 7,
  spider: 6,
  wolf: 7,
  zombie: 7
};

/** Mazchna's pool — combat 20+. Iets gevarieerder dan Turael. */
export const MAZCHNA_POOL: Record<string, number> = {
  banshee: 8,
  bat: 7,
  bear: 7,
  catablepon: 8, // Stronghold of Security
  cave_bug: 8,
  cave_crawler: 8,
  cave_slime: 8,
  cockatrice: 8,
  crawling_hand: 8,
  dog: 7,
  earth_warrior: 7,
  flesh_crawler: 8, // SoS
  ghost: 7,
  ghoul: 7,
  hill_giant: 8,
  hobgoblin: 7,
  ice_warrior: 7,
  kalphite: 8,
  killerwatt: 6,
  pyrefiend: 8,
  rockslug: 8,
  scorpion: 7,
  shade: 7,
  vampyre: 6,
  wall_beast: 6,
  wolf: 7,
  zombie: 7
};

/** Vannaka's pool — combat 40+. Veel mid-game monsters; iconisch master
 *  voor mid-level slayers vóór Konar/Duradel. */
export const VANNAKA_POOL: Record<string, number> = {
  aberrant_spectre: 8,
  abyssal_demon: 5,
  ankou: 7,
  banshee: 7,
  basilisk: 7,
  bloodveld: 8,
  brine_rat: 7,
  cave_crawler: 7,
  cave_horror: 6,
  cave_kraken: 5,
  cockatrice: 7,
  crawling_hand: 7,
  dagannoth: 7,
  dust_devil: 6,
  earth_warrior: 7,
  fever_spider: 6,
  fire_giant: 8,
  gargoyle: 6,
  ghoul: 6,
  greater_demon: 7,
  harpie_bug_swarm: 5,
  hellhound: 7,
  hill_giant: 7,
  ice_warrior: 7,
  infernal_mage: 6,
  jelly: 7,
  jungle_horror: 7,
  kalphite: 7,
  kurask: 5,
  lesser_demon: 7,
  lizardman: 6,
  molanisk: 6,
  nechryael: 5,
  ogre: 7,
  otherworldly_being: 6,
  pyrefiend: 7,
  rockslug: 7,
  shade: 7,
  spiritual_creature: 7,
  trolls: 7,
  turoth: 7,
  vampyre: 6,
  wall_beast: 6,
  warped_creature: 5,
  zombie: 7
};

/** Chaeldar's pool — combat 70+, Lost City. Hogere variantie, meer
 *  high-tier tasks dan Vannaka. */
export const CHAELDAR_POOL: Record<string, number> = {
  aberrant_spectre: 8,
  abyssal_demon: 9,
  basilisk: 7,
  bloodveld: 8,
  cave_horror: 8,
  cave_kraken: 9,
  dagannoth: 8,
  dark_beast: 5,
  dust_devil: 9,
  elf: 7,
  fever_spider: 7,
  fire_giant: 7,
  gargoyle: 8,
  greater_demon: 9,
  hellhound: 9,
  infernal_mage: 8,
  jelly: 9,
  jungle_horror: 7,
  kalphite: 6,
  kurask: 9,
  lizardman: 7,
  lizardman_shaman: 4,
  mogre: 6,
  mutated_zygomite: 6,
  nechryael: 9,
  skeletal_wyvern: 7,
  spiritual_creature: 8,
  suqah: 7,
  trolls: 8,
  turoth: 8,
  tzhaar: 7,
  vampyre: 7,
  warped_creature: 6,
  waterfiend: 7,
  wyrm: 8
};

/** Konar's pool — combat + slayer 75. Geen Wilderness; alle tasks
 *  hebben een specifieke kill-location (Brimstone-key drops). */
export const KONAR_POOL: Record<string, number> = {
  ankylosaur: 8, // Drake (id-keuze in monsters.ts)
  abyssal_demon: 7,
  aberrant_spectre: 6,
  alchemical_hydra: 5, // boss task variant
  ankou: 6,
  basilisk_knight: 7,
  bloodveld: 8,
  brine_rat: 6,
  cave_horror: 7,
  cave_kraken: 7,
  cerberus: 4, // boss task
  dagannoth: 7,
  dark_beast: 7,
  dust_devil: 8,
  fire_giant: 8,
  gargoyle: 8,
  greater_demon: 8,
  hellhound: 8,
  hydra: 7,
  jelly: 7,
  kalphite: 7,
  kraken_boss: 4, // boss task
  kurask: 6,
  lizardman: 7,
  lizardman_shaman: 5,
  nechryael: 8,
  skeletal_wyvern: 7,
  smoke_devil: 7,
  spiritual_creature: 7,
  thermonuclear: 4, // boss task
  trolls: 7,
  turoth: 6,
  waterfiend: 7,
  wyrm: 8
};

/** Nieve (Steve)'s pool — combat 85+. Vergelijkbaar met Duradel maar
 *  iets ander palette. */
export const NIEVE_POOL: Record<string, number> = {
  aberrant_spectre: 7,
  abyssal_demon: 9,
  abyssal_sire: 5, // boss task
  alchemical_hydra: 5,
  ankylosaur: 8,
  ankou: 5,
  basilisk_knight: 7,
  bloodveld: 8,
  cave_horror: 6,
  cave_kraken: 8,
  cerberus: 5,
  dagannoth: 8,
  dark_beast: 9,
  dust_devil: 8,
  elf: 7,
  fire_giant: 7,
  gargoyle: 8,
  greater_demon: 9,
  grotesque_guardians: 5, // boss task
  hellhound: 9,
  hydra: 8,
  jelly: 8,
  kalphite: 7,
  kalphite_queen: 4, // boss task
  king_black_dragon: 4, // boss task
  kraken_boss: 5,
  kurask: 7,
  lizardman_shaman: 5,
  nechryael: 9,
  skeletal_wyvern: 7,
  smoke_devil: 8,
  spiritual_creature: 8,
  suqah: 6,
  thermonuclear: 5,
  trolls: 7,
  tzhaar: 7,
  vampyre: 6,
  waterfiend: 8,
  wyrm: 8
};

/** Duradel's pool — combat 100 + slayer 50. Toughest standard master:
 *  alle high-tier tasks + boss tasks ingebakken. */
export const DURADEL_POOL: Record<string, number> = {
  aberrant_spectre: 8,
  abyssal_demon: 12,
  abyssal_sire: 5,
  alchemical_hydra: 5,
  ankylosaur: 9, // Drake
  ankou: 5,
  basilisk_knight: 7,
  bloodveld: 8,
  cave_horror: 5,
  cave_kraken: 9,
  cerberus: 5,
  dagannoth: 9,
  dark_beast: 11,
  dust_devil: 9,
  elf: 7,
  fire_giant: 7,
  gargoyle: 8,
  greater_demon: 9,
  grotesque_guardians: 5,
  hellhound: 10,
  hydra: 9,
  iron_dragon: 7, // niet in monsters.ts; later
  jelly: 9,
  kalphite: 7,
  kalphite_queen: 5,
  king_black_dragon: 5,
  kraken_boss: 5,
  kurask: 6,
  lizardman_shaman: 6,
  nechryael: 12,
  skeletal_wyvern: 7,
  smoke_devil: 9,
  spiritual_creature: 8,
  steel_dragon: 7, // idem
  suqah: 5,
  thermonuclear: 5,
  trolls: 6,
  tzhaar: 7,
  waterfiend: 8,
  wyrm: 8
};

export const POOLS: Record<MasterId, Record<string, number>> = {
  turael: TURAEL_POOL,
  mazchna: MAZCHNA_POOL,
  vannaka: VANNAKA_POOL,
  chaeldar: CHAELDAR_POOL,
  konar: KONAR_POOL,
  nieve: NIEVE_POOL,
  duradel: DURADEL_POOL
};
