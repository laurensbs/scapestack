// Geschatte uren tot 99 per skill. Aggregeert per skill een "redelijke
// efficient" XP/u (niet tick-perfect, niet AFK-traag) en deelt door de
// XP die nog te halen valt vanaf de speler's huidige level.
//
// Bron voor de tarieven: OSRS Wiki "Skill training" + community
// "efficient hours" pagina's, gecheckt 2026-05-26. Ze representeren wat
// een gemiddelde betrokken speler haalt — niet HCIM-tactics, niet
// nightmare-zone-AFK. Doel: realistische tijdsverwachting, niet
// optimaliseren.
//
// Later (zodra we per-skill method-engines hebben) kunnen we hier per
// skill een geforce'd-keuze-methode prikken zoals fishing.ts al doet.
// Voor nu is dit één getal per skill — genoeg voor "wow tot max nog 700u."

import { XP_TABLE } from "./skill-methods/types";

/** Gemiddelde XP/u op het zwaarste deel van de grind (80-99). Best-of
 *  effort-rates uit OSRS Wiki. */
const AVG_XP_PER_HOUR: Record<string, number> = {
  Attack:        80_000,
  Strength:      80_000,
  Defence:       80_000,
  Hitpoints:     65_000,  // afgeleid; trains automatisch met andere combat
  Ranged:        90_000,  // chinning / cannoning
  Magic:         85_000,  // bursting / high-alch parallel
  Prayer:        300_000, // wrath altar bones
  Slayer:        40_000,
  Mining:        55_000,
  Smithing:      90_000,  // blast furnace gold/runite
  Fishing:       50_000,  // karambwan 3-tick gemiddeld
  Cooking:       400_000, // 1-tick karambwan / wines
  Firemaking:    160_000, // wintertodt + 99 cape
  Woodcutting:   60_000,  // redwoods / 2-tick teaks
  Crafting:      300_000, // birdhouse + d'hide bodies
  Fletching:     250_000, // broad arrows / darts
  Herblore:      300_000, // potion-prep
  Agility:       55_000,  // ardy rooftop / sepulchre
  Thieving:      200_000, // pyramid plunder / blackjacking
  Farming:       400_000, // tree runs (effectieve XP, low gameplay-tijd)
  Hunter:        80_000,  // chinchompas
  Construction:  600_000, // mahogany homes / butler trick
  Runecraft:     30_000,  // bloods / ZMI
  Mining_alt:    55_000   // placeholder, ongebruikt
};

/** Eén skill — actueel level, doel-level, uren benodigd. */
export interface SkillHoursEstimate {
  skill: string;
  currentLevel: number;
  currentXp: number;
  targetLevel: number;
  xpRemaining: number;
  xpPerHour: number;
  hours: number;
}

/** Berekent voor één skill: hoeveel uur tot het doel-level bij de
 *  default rate. */
export function estimateSkillHours(
  skill: string,
  currentLevel: number,
  currentXp: number,
  targetLevel: number = 99
): SkillHoursEstimate {
  const target = Math.min(99, Math.max(1, Math.floor(targetLevel)));
  const xpAtTarget = XP_TABLE[target];
  const xpRemaining = Math.max(0, xpAtTarget - currentXp);
  const rate = AVG_XP_PER_HOUR[skill] ?? 50_000;
  const hours = rate > 0 ? xpRemaining / rate : 0;
  return {
    skill,
    currentLevel,
    currentXp,
    targetLevel: target,
    xpRemaining,
    xpPerHour: rate,
    hours
  };
}

/** Totaaloverzicht: voor alle skills met current < target, bereken
 *  uren en sommeer. Plus de top-3 langste skills (waar de speler de
 *  meeste tijd in zal moeten steken). */
export interface HoursToMaxSummary {
  /** Totale uren tot 99 op elke skill die nu < 99 is. */
  totalHours: number;
  /** Lijst per skill, alleen voor skills < target. Gesorteerd op hours
   *  desc (waar zit je grootste pijn). */
  perSkill: SkillHoursEstimate[];
}

export function hoursToMax(
  skills: Array<{ name: string; level: number; xp: number }>,
  targetLevel: number = 99
): HoursToMaxSummary {
  const perSkill = skills
    .filter((s) => s.level < targetLevel && s.name !== "Overall")
    .map((s) => estimateSkillHours(s.name, s.level, s.xp, targetLevel))
    .filter((e) => e.hours > 0)
    .sort((a, b) => b.hours - a.hours);
  const totalHours = perSkill.reduce((sum, e) => sum + e.hours, 0);
  return { totalHours, perSkill };
}
