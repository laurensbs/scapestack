// Slayer masters — de 6 standaard masters voor task-toewijzing.
//
// Bronnen: OSRS Wiki Slayer Master pagina's, gecheckt op 2026-05-26.
// Niet-standaard masters bewust weggelaten:
//   - Krystilia (Wilderness slayer) — andere task-pool dynamics, fase 2
//   - Aya (PvP slayer) — random task wijzigingen, fase 2
//   - Spria — alleen onder DT2 quest, niche
//
// `pointsPerTask` waardes zijn de base voor de master; werkelijke punten
// schalen met streak-bonussen die in `streakBonus` staan. Een task
// voltooid als 50e in een streak geeft bv. pointsPerTask × every50.

import type { SlayerMaster, MasterId } from "./types";

export const MASTERS: Record<MasterId, SlayerMaster> = {
  turael: {
    id: "turael",
    name: "Turael",
    location: "Burthorpe",
    combatRequirement: 0,
    slayerRequirement: 0,
    questRequirements: [],
    // Turael geeft kleine tasks aan beginners; range matched aan wiki.
    taskQuantity: { min: 15, max: 50 },
    // Turael geeft géén punten als je hem als reset-master gebruikt
    // (skip current task) — wiki doc: "first task with Turael resets
    // streak en geeft 0 punten."
    pointsPerTask: 0,
    streakBonus: { every10: 5, every50: 15, every100: 25, every250: 50, every1000: 100 }
  },
  mazchna: {
    id: "mazchna",
    name: "Mazchna",
    location: "Canifis",
    combatRequirement: 20,
    slayerRequirement: 0,
    questRequirements: ["priest_in_peril"],
    taskQuantity: { min: 30, max: 70 },
    pointsPerTask: 2,
    streakBonus: { every10: 5, every50: 15, every100: 25, every250: 50, every1000: 100 }
  },
  vannaka: {
    id: "vannaka",
    name: "Vannaka",
    location: "Edgeville Dungeon",
    combatRequirement: 40,
    slayerRequirement: 0,
    questRequirements: [],
    taskQuantity: { min: 40, max: 90 },
    pointsPerTask: 4,
    streakBonus: { every10: 12, every50: 30, every100: 50, every250: 100, every1000: 250 }
  },
  chaeldar: {
    id: "chaeldar",
    name: "Chaeldar",
    location: "Zanaris",
    combatRequirement: 70,
    slayerRequirement: 0,
    questRequirements: ["lost_city"],
    taskQuantity: { min: 70, max: 140 },
    pointsPerTask: 10,
    streakBonus: { every10: 25, every50: 75, every100: 125, every250: 250, every1000: 500 }
  },
  konar: {
    id: "konar",
    name: "Konar quo Maten",
    location: "Mount Karuulm",
    combatRequirement: 75,
    slayerRequirement: 75,
    // Konar onthoudt een specifieke 'kill-location' — task is alleen
    // geldig daar; in ruil voor de constraint krijg je drops uit de
    // Brimstone-key tabel.
    questRequirements: [],
    taskQuantity: { min: 80, max: 175 },
    pointsPerTask: 18,
    streakBonus: { every10: 36, every50: 90, every100: 144, every250: 270, every1000: 540 }
  },
  nieve: {
    id: "nieve",
    name: "Nieve (Steve)",
    location: "Tree Gnome Stronghold",
    // "Steve" als post-Monkey-Madness-2 reskin van Nieve. Gameplay is
    // identiek; we behandelen ze als één master.
    combatRequirement: 85,
    slayerRequirement: 0,
    questRequirements: [],
    taskQuantity: { min: 80, max: 160 },
    pointsPerTask: 12,
    streakBonus: { every10: 30, every50: 90, every100: 150, every250: 300, every1000: 600 }
  },
  duradel: {
    id: "duradel",
    name: "Duradel",
    location: "Shilo Village",
    combatRequirement: 100,
    slayerRequirement: 50,
    questRequirements: ["shilo_village"],
    // Duradel geeft de zwaarste tasks van de hoofd-masters.
    taskQuantity: { min: 100, max: 200 },
    pointsPerTask: 15,
    streakBonus: { every10: 45, every50: 112, every100: 225, every250: 450, every1000: 900 }
  }
};

/** Lijst-vorm van masters, sorteerbaar op tier (turael=easiest first). */
export const MASTER_ORDER: MasterId[] = [
  "turael", "mazchna", "vannaka", "chaeldar", "konar", "nieve", "duradel"
];

/** Bepaalt welke masters een speler überhaupt kan gebruiken gegeven
 *  hun combat + slayer levels + voltooide quests. */
export function eligibleMasters(opts: {
  combatLevel: number;
  slayerLevel: number;
  completedQuests: Set<string>;
}): SlayerMaster[] {
  return MASTER_ORDER
    .map((id) => MASTERS[id])
    .filter((m) => opts.combatLevel >= m.combatRequirement)
    .filter((m) => opts.slayerLevel >= m.slayerRequirement)
    .filter((m) => m.questRequirements.every((q) => opts.completedQuests.has(q)));
}
