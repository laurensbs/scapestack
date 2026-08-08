// When you pin a goal, the answer is about that goal.
//
// Measured live in Chrome on 2026-08-08: with "95 Fletching" pinned at 94/95 —
// roughly one evening of darts — the plan said
//
//   "Nothing in this 60-minute list moves 95 Fletching. Here is something else
//    worth doing."
//
// and recommended a quest. That sentence is the product telling a player their
// stated intention is not on the menu, which is what a catalogue does, not a
// companion.
//
// The cause was structural, not a missing entry. Every generator in next-up.ts
// is driven by a hand-written constant, and the skill generator reads
// SKILL_MILESTONES — eight skills, fifteen levels, no Fletching, never 95.
// Meanwhile the goal PICKER offers [70, 80, 85, 90, 92, 95, 99] across all
// twenty-four skills. The app has been suggesting goals it cannot serve.
//
// Rather than grow the milestone table (which would only move the boundary),
// this builds the trip from the goal itself. buildSkillRoute already does the
// real work for any skill and any level — XP maths, a method, what to bring, a
// bounded session — so a pinned level goal can always be answered. It runs in
// the browser next to the pinned goals, so there is no second server round
// trip and no flash of the wrong answer.

import type { CompletionItem } from "@/lib/goals";
import type { HiscoreSkill } from "@/lib/hiscores";
import type { Recommendation } from "@/lib/next-up";
import type { PlannerAccountType } from "@/lib/account-type";
import type { PinnedGoal } from "@/lib/pinned-goals";
import { skillCapeId } from "@/lib/skill-capes";
import { buildSkillRoute, skillRouteNeeds, skillRoutePlanSeed } from "@/lib/skill-routes";

export function buildPinnedGoalTrip(input: {
  goal: PinnedGoal;
  skills: readonly HiscoreSkill[];
  bank?: CompletionItem[];
  accountType?: PlannerAccountType | null;
  sessionMinutes: number;
}): Recommendation | null {
  const { goal } = input;
  // Item and unlock goals already have generators that can serve them (drop
  // sources and quest chains); this covers the level goals the engine cannot.
  if (goal.kind !== "level") return null;

  const skill = input.skills.find(
    (candidate) => candidate.name.toLowerCase() === goal.skill.toLowerCase()
  );
  if (!skill) return null;
  if (skill.level >= goal.targetLevel) return null;

  const route = buildSkillRoute({
    skill,
    targetLevel: goal.targetLevel,
    bank: input.bank,
    accountType: input.accountType ?? null,
    skills: [...input.skills],
    // The panel's own budget, not skill-routes' 45-minute default — the copy
    // on the page says 60 minutes, so the stop point has to mean 60 minutes.
    sessionMinutes: input.sessionMinutes
  });
  if (!route) return null;

  const method = route.recommended;
  const levelsToGo = route.targetLevel - route.currentLevel;
  const title = method
    ? `${method.method.name} to ${goal.targetLevel} ${route.skill}`
    : `Train ${route.skill} to ${goal.targetLevel}`;

  return {
    // Distinct prefix so recommendation-feedback's suppression and the
    // alternatives de-duplication treat it as its own row.
    id: `pinned-goal:${goal.key}`,
    kind: "skill",
    title,
    // In the player's units: XP left and the block this session closes.
    why: `${route.xpRemaining.toLocaleString()} XP to ${goal.targetLevel}${
      levelsToGo > 1 ? ` (${levelsToGo} levels)` : ""
    }. ${route.shortSession.label}`,
    // Above every generated candidate: the player asked for this one.
    score: 1000,
    link: "/goals",
    iconItemId: skillCapeId(route.skill),
    needs: skillRouteNeeds(route),
    // The field that makes recommendationMovesPinnedGoal match, which is what
    // stops goalTripWhy emitting its "nothing moves your goal" line.
    completionTarget: { kind: "skill_level_at_least", skill: route.skill, target: route.targetLevel },
    routeTags: ["maxing"],
    quality: {
      accountFit: 1,
      actionability: 0.95,
      stopPoint: 0.95,
      gearConfidence: 0.9,
      unlockValue: 0.8,
      fun: 0.6,
      friction: 0.15
    },
    planSeed: skillRoutePlanSeed(route)
  };
}
