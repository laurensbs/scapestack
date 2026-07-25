// Small helpers shared by the /next recommendation sources.
//
// Deliberately tiny: anything that grows a policy decision belongs in a
// source module or in next-up-scoring.ts, not here.

import type { HiscoreSkill } from "./hiscores";

/** Current level for a skill, defaulting to 1 when Hiscores has no row. */
export const lvl = (skills: HiscoreSkill[], name: string): number =>
  skills.find((s) => s.name === name)?.level ?? 1;

/** True when any of the given quest names is in the completed set. */
export function completedQuest(
  completedQuestNames: Set<string> | undefined,
  names: string[]
): boolean {
  if (!completedQuestNames) return false;
  return names.some((name) => completedQuestNames.has(name.toLowerCase()));
}
