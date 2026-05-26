// Method-engine types — gedeelde shape voor non-combat training plans.
//
// Eerste skill = Fishing (zie ./fishing.ts). Pattern is bewust generiek
// gehouden zodat Woodcutting, Mining, Cooking etc. dezelfde shape
// kunnen vullen.
//
// Hou de schema lean. We tonen primair 3 nummers per methode:
//   xpPerHour   — wat verdien je per uur in skill-XP
//   gpPerHour   — netto cash-effect (positief = inkomen, negatief = burn)
//   levelReq    — minimum level voor de methode
// Plus genoeg metadata om locatie + setup-advies te tonen.

export interface SkillMethod {
  id: string;                   // canonical lower-snake bv. "barb_fishing"
  name: string;                 // display "Barbarian fishing"
  /** Skill-level min voor toegang. */
  levelReq: number;
  /** XP per uur — gemiddelde ervaren rate. We pakken expliciet niet
   *  "absoluut max" want dat is tick-perfect speedrun-tempo. */
  xpPerHour: number;
  /** GP per uur, netto. Negatief = consumables/burn. */
  gpPerHour: number;
  /** Welke OSRS skill traint deze methode (kan multi-skill zijn). */
  trains: string[];
  /** Locatie-keys; UI kan dit later mappen naar map-pin. */
  locations: string[];
  /** Items/gear/tools nodig. */
  requires: string[];
  /** Quest-eisen, lower-snake. */
  questRequirements: string[];
  /** Eén-regel "wanneer pak je dit boven alternatieven." */
  hint?: string;
  /** Tags voor sorteer-filters: "afk", "intensive", "profit", "loss". */
  tags: Array<"afk" | "intensive" | "profit" | "loss" | "tick-manip">;
}

/** Resultaat van plan(): hoeveel uur kost het van 'currentLevel' tot
 *  'targetLevel' met deze methode. */
export interface MethodPlan {
  method: SkillMethod;
  /** XP nog te verdienen tot target. */
  xpRemaining: number;
  /** Uren bij de methode's xpPerHour rate. */
  hours: number;
  /** Totale GP-effect over die uren (positief = je wordt rijker). */
  netGp: number;
}

/** XP per skill-level — OSRS standaard XP-tabel. Cumulative-XP[level]. */
export const XP_TABLE: number[] = (() => {
  // Cumulative XP from level 1 to 99. Klassieke OSRS-formule.
  const table = [0, 0]; // index 0 = unused, index 1 = level 1 (0 XP)
  let total = 0;
  for (let lvl = 1; lvl < 99; lvl++) {
    total += Math.floor(lvl + 300 * Math.pow(2, lvl / 7));
    table.push(Math.floor(total / 4));
  }
  return table;
})();

/** Returns XP-required tot je 'target' bereikt vanaf 'current' level. */
export function xpToLevel(current: number, target: number): number {
  if (target <= current) return 0;
  const t = Math.min(99, Math.max(1, Math.floor(target)));
  const c = Math.min(99, Math.max(1, Math.floor(current)));
  return Math.max(0, XP_TABLE[t] - XP_TABLE[c]);
}

/** Voor één method: bereken hours + netGp om van current → target te
 *  komen. Negeert level-gating mid-route — gebruiker is verantwoordelijk
 *  om te switchen wanneer een betere methode unlockt. */
export function plan(method: SkillMethod, currentXp: number, targetLevel: number): MethodPlan {
  const targetXp = XP_TABLE[Math.min(99, Math.max(1, targetLevel))];
  const xpRemaining = Math.max(0, targetXp - currentXp);
  const hours = method.xpPerHour > 0 ? xpRemaining / method.xpPerHour : 0;
  const netGp = Math.round(hours * method.gpPerHour);
  return { method, xpRemaining, hours, netGp };
}
