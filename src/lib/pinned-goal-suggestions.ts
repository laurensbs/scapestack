import { GOAL_SETS } from "./goals";
import { LEVEL_GOAL_SKILLS, pinnedGoalChoiceFromInput, type NewPinnedGoal } from "./pinned-goals";
import type { NextUpResult } from "./next-up";

function suggestionKey(goal: NewPinnedGoal): string {
  if (goal.kind === "item") return `item:${goal.goalId}`;
  if (goal.kind === "unlock") return `unlock:${goal.unlockId}`;
  return `level:${goal.skill.toLowerCase()}:${goal.targetLevel}`;
}

/**
 * Converts the recommendation engine's existing proximity order into six
 * pickable goal inputs. It does not rank, score or pin anything itself.
 */
export function pinnedGoalSuggestionsFromPlan(plan: NextUpResult | null): NewPinnedGoal[] {
  if (!plan) return [];
  const suggestions = new Map<string, NewPinnedGoal>();
  const add = (goal: NewPinnedGoal | null) => {
    if (!goal || suggestions.size >= 6 || !pinnedGoalChoiceFromInput(goal)) return;
    suggestions.set(suggestionKey(goal), goal);
  };

  for (const completion of plan.readiness) {
    const set = GOAL_SETS.find((candidate) => candidate.id === completion.setId);
    for (const goal of set?.goals ?? []) {
      if (!completion.perGoal[goal.id]?.satisfied) add({ kind: "item", goalId: goal.id });
    }
  }

  const skillPath = plan.pathProgress.paths.find((path) => path.kind === "skills");
  for (const step of skillPath?.nextSteps ?? []) {
    const match = step.title.match(/^(.+?)\s+\d+\s+→\s+(\d+)$/);
    const skill = match
      ? LEVEL_GOAL_SKILLS.find((candidate) => candidate.toLowerCase() === match[1]?.toLowerCase())
      : null;
    const targetLevel = match ? Number(match[2]) : 0;
    add(skill && targetLevel >= 2 && targetLevel <= 99
      ? { kind: "level", skill, targetLevel }
      : null);
  }

  for (const route of plan.pathProgress.unlockRoutes) {
    if (route.id !== "diary-unlocks" && route.progressPercent < 100) {
      add({ kind: "unlock", unlockId: route.id });
    }
  }

  return [...suggestions.values()].slice(0, 6);
}
