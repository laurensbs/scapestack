// Slayer task simulator + planner.
//
// Geeft antwoord op:
//   - Welke tasks kan ik krijgen van master X met mijn level + unlocks?
//   - Wat is mijn verwachte XP/uur bij die master?
//   - Welke tasks zou ik moeten blokken (lowest XP/u)?
//
// Bewust niet:
//   - Monte Carlo sims (te traag voor de UI; we werken met
//     verwachte waardes uit de weights-tabel)
//   - Konar-locations (kost een aparte data-tabel, fase 3)
//   - Streak-bonus modeling (assumeert >50 streak, max-rate baseline)
//
// Alle inputs zijn nullable-friendly: een player die nog geen data
// heeft uit de plugin krijgt een ruwe inschatting; eens plugin
// claims/unlocks/blocks levert wordt het scherper.

import { MASTERS } from "./masters";
import { MONSTERS_BY_ID } from "./monsters";
import { POOLS } from "./task-pools";
import type { MasterId, SlayerMaster, SlayerMonster } from "./types";

export interface PlayerState {
  combatLevel: number;
  slayerLevel: number;
  /** Voltooide quests, lower-snake (matches monsters/masters refs). */
  completedQuests: Set<string>;
  /** Monsters die de speler op zijn block-list heeft staan. */
  blockedMonsterIds: Set<string>;
  /** Optional: hoeveel tasks heeft de speler al gedaan? Modeleert
   *  streak-bonus payouts. 0 als onbekend. */
  taskStreak: number;
}

/** Voor één monster in een master's pool: na gating-filters wat is
 *  z'n effective weight en bijbehorende stats. */
export interface TaskOption {
  monster: SlayerMonster;
  /** Probability (0..1) dat je deze task krijgt bij deze master. */
  probability: number;
  /** Verwachte quantity (midpoint van master's range, niet variant-
   *  specifiek). */
  expectedQuantity: number;
  /** Verwachte slayer-XP over de hele task (HP × quantity, base 1.0×
   *  multiplier). */
  expectedXp: number;
  /** Schatting XP/uur bij rough average kill-rate. Slechts indicatief —
   *  echte rates schalen met gear + cannon + bursting. */
  estimatedXpPerHour: number;
}

/** Resultaat van simulateMaster() voor de hele pool. */
export interface MasterSimulation {
  master: SlayerMaster;
  tasks: TaskOption[];
  /** Weighted-gemiddelde XP/uur over alle eligible tasks. */
  averageXpPerHour: number;
  /** Aantal tasks dat de speler kan krijgen (na gating). */
  eligibleTaskCount: number;
}

/** Heel ruwe baseline kill-rate per HP-bucket. Niet wetenschappelijk;
 *  gebaseerd op "wat AFK whip+vorkath gear bij Catacombs haalt." Bedoeld
 *  om relatief te ranken, niet absoluut accurate. Toekomst: per-monster
 *  baseline_kph veld in monsters.ts. */
function baseKillsPerHour(monster: SlayerMonster): number {
  if (monster.isBoss) return 25;         // bosses zijn slow
  if (monster.hp <= 30) return 800;      // low-HP zooi
  if (monster.hp <= 80) return 450;      // mid
  if (monster.hp <= 150) return 280;     // high-HP grinds
  return 180;                            // >150 HP = wyverns/dark beasts
}

/** Filtert een master's pool tegen de speler's state en berekent
 *  per-task probabilities + XP-prognoses. */
export function simulateMaster(masterId: MasterId, state: PlayerState): MasterSimulation {
  const master = MASTERS[masterId];
  const pool = POOLS[masterId];

  // Gating per monster: slayer-level, blocks, en bestaan in monsters.ts
  // (pools mogen referenties naar nog-niet-toegevoegde monsters bevatten
  // — die slaan we hier stil over).
  const candidates: Array<{ monster: SlayerMonster; weight: number }> = [];
  for (const [monsterId, weight] of Object.entries(pool)) {
    if (state.blockedMonsterIds.has(monsterId)) continue;
    const monster = MONSTERS_BY_ID.get(monsterId);
    if (!monster) continue;
    if (state.slayerLevel < monster.slayerLevel) continue;
    candidates.push({ monster, weight });
  }
  const totalWeight = candidates.reduce((sum, c) => sum + c.weight, 0);
  if (totalWeight === 0) {
    return { master, tasks: [], averageXpPerHour: 0, eligibleTaskCount: 0 };
  }

  const midQuantity = (master.taskQuantity.min + master.taskQuantity.max) / 2;
  const tasks: TaskOption[] = candidates.map(({ monster, weight }) => {
    const probability = weight / totalWeight;
    const expectedXp = monster.hp * 4 * midQuantity; // base 4 XP/HP (slayer + combat = 4×HP/4)
    const kph = baseKillsPerHour(monster);
    const xpPerHour = monster.hp * 4 * kph;
    return {
      monster,
      probability,
      expectedQuantity: midQuantity,
      expectedXp,
      estimatedXpPerHour: xpPerHour
    };
  });

  // Sort op probability (most likely tasks first) — UI kan dit
  // overrulen met andere sort-keys.
  tasks.sort((a, b) => b.probability - a.probability);

  const weightedXpPerHour = tasks.reduce(
    (sum, t) => sum + t.probability * t.estimatedXpPerHour, 0
  );

  return {
    master,
    tasks,
    averageXpPerHour: Math.round(weightedXpPerHour),
    eligibleTaskCount: tasks.length
  };
}

/** Beveelt de 5 best-blokbare tasks aan voor de speler op deze master.
 *  "Best blokbaar" = laagste estimated XP/u, want die slepen je
 *  gemiddelde naar beneden. */
export function blockSuggestions(masterId: MasterId, state: PlayerState): TaskOption[] {
  const sim = simulateMaster(masterId, state);
  return [...sim.tasks]
    .sort((a, b) => a.estimatedXpPerHour - b.estimatedXpPerHour)
    .slice(0, 5);
}

/** Vergelijkt alle masters die de speler kan gebruiken; sorteert op
 *  averageXpPerHour zodat de UI 'beste master voor jou' kan tonen. */
export function rankMasters(state: PlayerState): MasterSimulation[] {
  const eligible: MasterId[] = (Object.keys(MASTERS) as MasterId[]).filter((id) => {
    const m = MASTERS[id];
    if (state.combatLevel < m.combatRequirement) return false;
    if (state.slayerLevel < m.slayerRequirement) return false;
    if (!m.questRequirements.every((q) => state.completedQuests.has(q))) return false;
    return true;
  });
  return eligible
    .map((id) => simulateMaster(id, state))
    .sort((a, b) => b.averageXpPerHour - a.averageXpPerHour);
}
