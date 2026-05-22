// Given the user's bank, figure out which items contribute to one or more
// goal sets. Used by bank-result to outline goal-relevant items in mint so
// the player sees their "untradeable progress" without leaving the bank tool.

import { GOAL_SETS, type Goal, type GoalSet } from "./goals";
import type { OrganizedItem } from "./organizer";

export interface GoalMatch {
  goalId: string;
  goalName: string;
  setId: string;
  setName: string;
}

// Returns a map: item id → list of goals that item satisfies.
export function matchGoals(items: OrganizedItem[]): Map<number, GoalMatch[]> {
  const out = new Map<number, GoalMatch[]>();
  for (const set of GOAL_SETS) {
    for (const goal of set.goals) {
      for (const it of items) {
        if (itemSatisfiesGoal(it, goal)) {
          const list = out.get(it.id) || [];
          list.push({
            goalId: goal.id,
            goalName: goal.name,
            setId: set.id,
            setName: set.name
          });
          out.set(it.id, list);
        }
      }
    }
  }
  return out;
}

function itemSatisfiesGoal(item: OrganizedItem, goal: Goal): boolean {
  if (goal.itemIds && goal.itemIds.includes(item.id)) return true;
  if (goal.namePattern && goal.namePattern.test(item.name)) return true;
  return false;
}

export interface GoalProgress {
  set: GoalSet;
  owned: number;
  total: number;
}

// Per-set progress for a banner — how many goals in each set are satisfied.
export function summarizeGoalProgress(items: OrganizedItem[]): GoalProgress[] {
  const out: GoalProgress[] = [];
  for (const set of GOAL_SETS) {
    let owned = 0;
    for (const goal of set.goals) {
      if (items.some((it) => itemSatisfiesGoal(it, goal))) owned++;
    }
    if (owned > 0) out.push({ set, owned, total: set.goals.length });
  }
  // Most-complete first, but skip sets where the user has 100% — they're done.
  return out
    .filter((p) => p.owned < p.total || p.total === 1)
    .sort((a, b) => (b.owned / b.total) - (a.owned / a.total));
}
