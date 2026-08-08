import { describe, expect, it } from "vitest";
import { buildPinnedGoalTrip } from "@/lib/pinned-goal-trip";
import { createPinnedGoal, searchPinnedGoalChoices } from "@/lib/pinned-goals";
import { recommendationMovesPinnedGoal, goalTripWhy } from "@/lib/pinned-goal-orientation";
import type { HiscoreSkill } from "@/lib/hiscores";

/**
 * A pinned goal always gets an answer about that goal.
 *
 * Measured in Chrome on 2026-08-08: "95 Fletching" pinned at 94/95 produced
 * "Nothing in this 60-minute list moves 95 Fletching. Here is something else
 * worth doing." next-up.ts's SKILL_MILESTONES covers eight skills at fifteen
 * levels; the goal picker offers seven levels across all twenty-four. The app
 * was inviting goals it could not serve.
 */

const SKILLS: HiscoreSkill[] = [
  { name: "Fletching", level: 94, xp: 7_500_000, rank: 1 },
  { name: "Attack", level: 99, xp: 13_000_000, rank: 1 },
  { name: "Slayer", level: 95, xp: 9_000_000, rank: 1 }
] as HiscoreSkill[];

function levelGoal(skill: string, targetLevel: number) {
  const goal = createPinnedGoal({ kind: "level", skill, targetLevel });
  if (!goal) throw new Error(`could not pin ${targetLevel} ${skill}`);
  return goal;
}

describe("a pinned level goal is answerable", () => {
  it("builds a trip for the exact skill and level the player pinned", () => {
    const goal = levelGoal("Fletching", 95);
    const trip = buildPinnedGoalTrip({ goal, skills: SKILLS, sessionMinutes: 60 });

    expect(trip, "no trip was built for the pinned goal").not.toBeNull();
    expect(trip!.completionTarget).toEqual({
      kind: "skill_level_at_least",
      skill: "Fletching",
      target: 95
    });
    // The why line counts in the player's units, not in "hours saved".
    expect(trip!.why).toMatch(/[\d,]+ XP to 95/);
    expect(trip!.needs?.length ?? 0).toBeGreaterThan(0);
  });

  it("satisfies the matcher, so the plan never says nothing moves the goal", () => {
    const goal = levelGoal("Fletching", 95);
    const trip = buildPinnedGoalTrip({ goal, skills: SKILLS, sessionMinutes: 60 })!;

    expect(recommendationMovesPinnedGoal(trip, goal, [])).toBe(true);
    // The exact sentence the live page showed, which must now be unreachable
    // for this goal.
    expect(goalTripWhy(trip, goal, [])).not.toContain("Nothing in this");
  });

  it("serves every level the goal picker is willing to offer", () => {
    // The picker and the engine used to disagree about which goals exist. Walk
    // the picker's own catalogue: whatever it lets a player pin, the engine
    // must answer. This is the assertion that would have caught the defect.
    const offered = ["fletching", "agility", "runecraft", "construction", "hunter", "slayer"]
      .flatMap((term) => searchPinnedGoalChoices(term))
      .filter((choice) => choice.input.kind === "level");
    expect(offered.length, "the picker offered no level goals to check").toBeGreaterThan(5);

    const unanswered: string[] = [];
    for (const choice of offered) {
      const input = choice.input as { kind: "level"; skill: string; targetLevel: number };
      const skills: HiscoreSkill[] = [
        { name: input.skill, level: Math.max(1, input.targetLevel - 1), xp: 1000, rank: 1 } as HiscoreSkill
      ];
      const goal = createPinnedGoal(input);
      if (!goal) continue;
      const trip = buildPinnedGoalTrip({ goal, skills, sessionMinutes: 60 });
      if (!trip || !recommendationMovesPinnedGoal(trip, goal, [])) unanswered.push(choice.target);
    }
    expect(unanswered, `the picker offers goals the engine cannot serve: ${unanswered.join(", ")}`).toEqual([]);
  });

  it("declines when the goal is already met, rather than inventing work", () => {
    const goal = levelGoal("Slayer", 95);
    expect(buildPinnedGoalTrip({ goal, skills: SKILLS, sessionMinutes: 60 })).toBeNull();
  });

  it("respects the panel's session budget instead of the 45-minute default", () => {
    const goal = levelGoal("Fletching", 99);
    const short = buildPinnedGoalTrip({ goal, skills: SKILLS, sessionMinutes: 30 })!;
    const long = buildPinnedGoalTrip({ goal, skills: SKILLS, sessionMinutes: 120 })!;
    expect(short.planSeed?.skillRoute?.shortSession.minutes).toBe(30);
    expect(long.planSeed?.skillRoute?.shortSession.minutes).toBe(120);
  });
});
