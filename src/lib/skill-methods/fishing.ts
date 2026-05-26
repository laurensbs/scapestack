// Fishing training-methodes.
//
// Bron: OSRS Wiki "Fishing training" + community-XP-rate tabellen,
// gecheckt 2026-05-26. XP-rates zijn gemiddelde ervaren players,
// niet tick-perfect speedrun. GP-rates zijn ruwe schattingen op
// huidige GE-prijzen — kleine afwijkingen tov realtime markt.
//
// Tags-filosofie:
//   afk        — nul tot 1 click per minuut
//   intensive  — vereist actief aandacht (3-tick, drift net etc.)
//   profit     — net positief in GP
//   loss       — net negatief (consumables of waardeloze catch)
//   tick-manip — 1.5-tick / 2-tick / 3-tick technieken

import type { SkillMethod } from "./types";

export const FISHING_METHODS: SkillMethod[] = [
  {
    id: "shrimp_anchovy",
    name: "Shrimp / Anchovies",
    levelReq: 1,
    xpPerHour: 10_000,
    gpPerHour: 0,
    trains: ["Fishing"],
    locations: ["Lumbridge Swamp", "Al Kharid", "Draynor Village"],
    requires: ["Small fishing net"],
    questRequirements: [],
    tags: ["afk", "loss"],
    hint: "Volume-1 method. Skip indien mogelijk; sardine is identiek qua XP."
  },
  {
    id: "trout_salmon",
    name: "Trout / Salmon (Barbarian Village)",
    levelReq: 20,
    xpPerHour: 35_000,
    gpPerHour: 0,
    trains: ["Fishing"],
    locations: ["Barbarian Village", "Shilo Village"],
    requires: ["Fly fishing rod", "Feathers"],
    questRequirements: [],
    tags: ["afk", "loss"],
    hint: "Klassieke 20-58 grind. Drop alles voor speed."
  },
  {
    id: "fly_fishing_3tick",
    name: "Trout / Salmon (3-tick)",
    levelReq: 30,
    xpPerHour: 90_000,
    gpPerHour: 0,
    trains: ["Fishing", "Cooking"],
    locations: ["Barbarian Village"],
    requires: ["Fly fishing rod", "Feathers", "Knife", "Logs/herbs"],
    questRequirements: [],
    tags: ["intensive", "tick-manip", "loss"],
    hint: "3-tick teak-knife — 2-3x snellere XP. Vereist constante focus."
  },
  {
    id: "lobster",
    name: "Lobsters",
    levelReq: 40,
    xpPerHour: 35_000,
    gpPerHour: 90_000,
    trains: ["Fishing"],
    locations: ["Catherby", "Karamja"],
    requires: ["Lobster pot"],
    questRequirements: [],
    tags: ["afk", "profit"],
    hint: "Catherby = bank op 5 stappen. Best low-level GP/u."
  },
  {
    id: "tuna_swordfish",
    name: "Tuna / Swordfish",
    levelReq: 50,
    xpPerHour: 40_000,
    gpPerHour: 75_000,
    trains: ["Fishing"],
    locations: ["Catherby", "Karamja"],
    requires: ["Harpoon"],
    questRequirements: [],
    tags: ["afk", "profit"],
    hint: "Iconisch GP-grind voor mid-game. Switch op 76 naar Karambwan."
  },
  {
    id: "barb_fishing",
    name: "Barbarian fishing",
    levelReq: 48,
    xpPerHour: 55_000,
    gpPerHour: -5_000,
    trains: ["Fishing", "Strength", "Agility"],
    locations: ["Otto's Grotto"],
    requires: ["Barbarian rod", "Feathers", "Roe bait"],
    questRequirements: ["barbarian_training"],
    tags: ["afk", "loss"],
    hint: "Sluit Strength/Agility XP mee. Niet snelste XP/u maar bonus-skills + lvl-99 totaal lager."
  },
  {
    id: "monkfish",
    name: "Monkfish",
    levelReq: 62,
    xpPerHour: 42_000,
    gpPerHour: 110_000,
    trains: ["Fishing"],
    locations: ["Piscatoris Fishing Colony"],
    requires: ["Small fishing net"],
    questRequirements: ["swan_song"],
    tags: ["afk", "profit"],
    hint: "Beste low-effort GP tot 76. Vereist Swan Song quest."
  },
  {
    id: "karambwan",
    name: "Karambwan (3-tick)",
    levelReq: 65,
    xpPerHour: 50_000,
    gpPerHour: 280_000,
    trains: ["Fishing"],
    locations: ["Karamja"],
    requires: ["Karambwan vessel", "Raw karambwanji bait"],
    questRequirements: ["tai_bwo_wannai_trio"],
    tags: ["intensive", "tick-manip", "profit"],
    hint: "Beste GP/u tot 99. 3-tick = 2x rate. Hoge wpm vereist."
  },
  {
    id: "shark",
    name: "Sharks",
    levelReq: 76,
    xpPerHour: 32_000,
    gpPerHour: 100_000,
    trains: ["Fishing"],
    locations: ["Catherby", "Fishing Guild"],
    requires: ["Harpoon"],
    questRequirements: [],
    tags: ["afk", "profit"],
    hint: "AFK alternative voor Karambwan. Dragon harpoon spec = +5 XP per kill."
  },
  {
    id: "anglerfish",
    name: "Anglerfish",
    levelReq: 82,
    xpPerHour: 34_000,
    gpPerHour: 165_000,
    trains: ["Fishing"],
    locations: ["Port Piscarilius"],
    requires: ["Fishing rod", "Sandworms"],
    questRequirements: [],
    tags: ["afk", "profit"],
    hint: "Beste AFK GP. Vereist Piscarilius favor + sandworms supply."
  },
  {
    id: "drift_net",
    name: "Drift net fishing",
    levelReq: 47,
    xpPerHour: 65_000,
    gpPerHour: 20_000,
    trains: ["Fishing", "Hunter"],
    locations: ["Fossil Island Underwater"],
    requires: ["Diving apparatus", "Drift net"],
    questRequirements: ["bone_voyage"],
    tags: ["intensive", "profit"],
    hint: "Hunter + Fishing tegelijk. Goede multi-skill als je beide laag hebt."
  },
  {
    id: "minnow",
    name: "Minnow (Tempoross alt)",
    levelReq: 82,
    xpPerHour: 60_000,
    gpPerHour: 220_000,
    trains: ["Fishing"],
    locations: ["Kylie Minnow"],
    requires: ["Small fishing net", "Angler's outfit", "85 Fishing recommended"],
    questRequirements: ["fishing_contest"],
    tags: ["intensive", "profit"],
    hint: "Hop tussen 4 spots. Met angler's outfit = ~60k XP/u + 220k GP. Vereist 35 Hunter via Fairy ring."
  }
];
