// Slayer-planner type contracts.
//
// Goal: laat ons later in masters.ts, monsters.ts, task-pools.ts, en
// unlocks.ts werken zonder type-drift. Houdt het schema bewust nauw —
// we starten met "wat doet een speler concreet vanmiddag", niet "alle
// slayer-feiten." Velden uitbreiden kan later, schrappen is duurder.

import type { CombatStyle } from "../gear";

/** Een van de zes standaard slayer masters. */
export type MasterId =
  | "turael"      // Burthorpe — lowest-tier, geen requirements
  | "mazchna"    // Canifis — combat 20+
  | "vannaka"    // Edgeville Dungeon — combat 40+
  | "chaeldar"   // Zanaris — Lost City quest
  | "konar"      // Mount Karuulm — slayer 75+ combat 75+, location-specifieke drops
  | "nieve"      // Tree Gnome Stronghold — combat 85+ (post-MM2 = "Steve")
  | "duradel";   // Shilo Village — slayer 50+ combat 100+

/** Een Slayer master + waar/wanneer/wat-eisen. */
export interface SlayerMaster {
  id: MasterId;
  name: string;
  /** Korte fluff-locatie voor UI ("Burthorpe", "Mount Karuulm…"). */
  location: string;
  /** Minimum combat level om tasks te ontvangen. */
  combatRequirement: number;
  /** Minimum slayer level. 0 = geen eis. */
  slayerRequirement: number;
  /** Quest-eisen (bij naam, lower-snake — komt overeen met onze quest-db). */
  questRequirements: string[];
  /** Min/max kill-count per task — de werkelijke quantity is uniform-random
   *  in deze range zodra de monster gekozen is. */
  taskQuantity: { min: number; max: number };
  /** Slayer-points per voltooide task (zonder streak-bonus). */
  pointsPerTask: number;
  /** Streak-bonus multipliers: 10/50/100/250/1000 tasks. */
  streakBonus: { every10: number; every50: number; every100: number; every250: number; every1000: number };
}

/** Slayer-task-eligibel monster. Subset van OSRS-monsters: alleen
 *  diegene die masters daadwerkelijk kunnen toewijzen. */
export interface SlayerMonster {
  id: string;                      // canonical lower-snake bv. "bloodveld"
  name: string;                    // display naam
  /** Hitpoints van het zwakste-toewijsbare variant — gebruikt voor
   *  XP/uur berekeningen (XP = HP × 4 voor base slayer XP). */
  hp: number;
  /** Slayer level requirement. 1 = geen eis. */
  slayerLevel: number;
  /** Combat-level eis (Aviansies = 60, Black demons = 0, etc.). */
  combatLevel?: number;
  /** Combat style waar het monster zwak voor is. Drijft method-recs. */
  weakness?: CombatStyle;
  /** Locatie-codes voor UI (Konar-only locations meegerekend). */
  locations: string[];
  /** Cannonable? Drijft XP/u-berekening — een cannon op een task
   *  verdubbelt vaak de XP-rate. */
  cannonable: boolean;
  /** Boss? Boss-tasks krijgen andere quantity-ranges (zie master). */
  isBoss: boolean;
  /** Korte trainer-tip die in de UI verschijnt onder het monster.
   *  Houd op één regel, bewaar lange explainers voor wiki-links. */
  hint?: string;
}

/** Toewijzings-gewicht: hoe waarschijnlijk een master een specifieke
 *  task geeft (relatief binnen de pool). Wiki noemt dit de "weight"
 *  kolom — directe overname. */
export interface TaskAssignment {
  master: MasterId;
  monster: string;  // monster.id
  weight: number;   // ratio binnen master's pool; geen %
}

/** Een unlock, block, of extend — Slayer Reward Shop entries. */
export interface SlayerUnlock {
  id: string;                       // bv. "broader_fletching"
  name: string;
  cost: number;                     // slayer points
  category: "unlock" | "block" | "extend" | "ability";
  /** Wat doet het. Beknopt; ~12 woorden. */
  effect: string;
  /** Recommended? Volgorde van koopadvies (1 = eerst, hoger = later).
   *  null = situationeel; pluginsdata kan deze later overrulen. */
  recommendedOrder?: number;
}
