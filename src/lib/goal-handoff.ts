import { unlockedFromHiscores } from "./goals";
import type { HiscoreSkill } from "./hiscores";

export interface GoalHandoffItem {
  id: number;
  name: string;
}

export function goalItemsWithHiscoreUnlocks(
  baseItems: GoalHandoffItem[],
  skills: HiscoreSkill[] | null | undefined
): GoalHandoffItem[] {
  if (!skills) return baseItems;
  const merged = [...baseItems];
  const seen = new Set(merged.map((item) => item.id));
  for (const item of unlockedFromHiscores(skills)) {
    if (!seen.has(item.id)) {
      merged.push(item);
      seen.add(item.id);
    }
  }
  return merged;
}
