import { describe, expect, it } from "vitest";
import { buildDiaryTierProgress } from "@/lib/diary-task-progress";
import { inferredCompletedDiaryTierKeys } from "@/lib/diary-rewards";
import { evaluateDiaryTier } from "@/lib/diary-requirements";
import type { DiaryRecord, DiaryTaskDefinition } from "@/lib/diary-db";

const diary: DiaryRecord = {
  name: "Karamja Diary",
  tiers: {
    Easy: { skills: [], tasks: [] },
    Medium: { skills: [], tasks: [] },
    Hard: { skills: [], tasks: [] },
    Elite: { skills: [], tasks: [] }
  }
};

const tasks: DiaryTaskDefinition[] = [
  { id: "karamja:hard:1", label: "Enter the Kharazi Jungle.", requirements: ["Legends' Quest"] },
  { id: "karamja:hard:2", label: "Kill a deathwing.", requirements: ["Combat gear"] },
  { id: "karamja:hard:3", label: "Mine red topaz.", requirements: ["Mining 40"] },
  { id: "karamja:hard:4", label: "Claim the next task.", requirements: [] }
];

describe("diary task progress", () => {
  it("treats exact Wiki tasks as checkable unknowns, not confirmed blockers", () => {
    const evaluation = evaluateDiaryTier("Karamja", "Hard", diary, {
      completedDiaryTiers: ["Karamja:Easy", "Karamja:Medium"]
    });
    const progress = buildDiaryTierProgress({ evaluation, tasks });

    expect(progress.rewardName).toBe("Karamja gloves 3");
    expect(progress.remainingTasks).toBe(4);
    expect(progress.nextSweepTaskIds).toEqual(tasks.slice(0, 3).map((task) => task.id));
    expect(progress.tasks.every((task) => task.status === "to-confirm" && task.evidence === "unknown")).toBe(true);
  });

  it("turns earlier diary rewards into player actions instead of generic sourcing copy", () => {
    const evaluation = evaluateDiaryTier("Karamja", "Hard", diary, {
      bankItems: [],
      completedDiaryTiers: []
    });
    const progress = buildDiaryTierProgress({ evaluation, tasks });

    expect(progress.blockers).toContain("Finish Karamja Easy first");
    expect(progress.blockers).toContain("Finish Karamja Medium first");
    expect(progress.blockers).toContain("Claim Karamja gloves 2 first");
    expect(progress.blockers.join(" ")).not.toContain("self-source route");
  });

  it("merges manual checks while keeping the next sweep compact", () => {
    const evaluation = evaluateDiaryTier("Karamja", "Hard", diary);
    const progress = buildDiaryTierProgress({
      evaluation,
      tasks,
      manualCompletedTaskIds: ["karamja:hard:1"]
    });

    expect(progress.completedTasks).toBe(1);
    expect(progress.nextTask).toBe("Kill a deathwing.");
    expect(progress.tasks[0]).toMatchObject({ status: "done", evidence: "manual" });
  });

  it("uses RuneLite tier completion as exact evidence", () => {
    const evaluation = evaluateDiaryTier("Karamja", "Hard", diary, {
      completedDiaryTiers: ["Karamja:Hard"]
    });
    const progress = buildDiaryTierProgress({
      evaluation,
      tasks,
      exactCompleted: ["Karamja:Hard"]
    });

    expect(progress.completionEvidence).toBe("runelite");
    expect(progress.remainingTasks).toBe(0);
    expect(progress.tasks.every((task) => task.evidence === "runelite")).toBe(true);
  });

  it("uses elite reward ownership to close every lower tier", () => {
    const inferred = inferredCompletedDiaryTierKeys([], [
      { id: 13103, name: "Karamja gloves 4" }
    ]);
    expect([...inferred]).toEqual([
      "Karamja:Easy",
      "Karamja:Medium",
      "Karamja:Hard",
      "Karamja:Elite"
    ]);

    const hard = evaluateDiaryTier("Karamja", "Hard", diary, {
      completedDiaryTiers: [],
      bankItems: [{ id: 13103, name: "Karamja gloves 4", quantity: 1 }]
    });
    expect(hard.readinessStatus).toBe("completed");
    expect(hard.tierDependencies.every((dependency) => dependency.met)).toBe(true);
  });
});
