import { describe, expect, it } from "vitest";
import { unlockedFromHiscores } from "@/lib/goals";
import { computeNextUp } from "@/lib/next-up";
import type { HiscoreSkill } from "@/lib/hiscores";

function skill(name: string, level: number): HiscoreSkill {
  return { id: 0, name, rank: -1, level, xp: level >= 99 ? 13_034_431 : 0 };
}

describe("next-up basis", () => {
  it("does not count earned Hiscore unlocks as a real bank context", async () => {
    const skills = [
      skill("Attack", 99),
      skill("Strength", 99),
      skill("Defence", 99),
      skill("Hitpoints", 99),
      skill("Ranged", 99),
      skill("Magic", 99),
      skill("Prayer", 99),
      skill("Woodcutting", 99)
    ];
    const result = await computeNextUp({
      skills,
      earnedItems: unlockedFromHiscores(skills)
    });

    expect(result.summary.basis).toBe("hiscores-only");
    expect(result.summary.goalPercent).toBeGreaterThan(0);
  });

  it("keeps real bank context when both bank and Hiscores are present", async () => {
    const result = await computeNextUp({
      skills: [skill("Attack", 75), skill("Strength", 75), skill("Hitpoints", 75)],
      bank: [{ id: 4151, name: "Abyssal whip" }],
      earnedItems: [{ id: 9807, name: "Woodcutting cape" }]
    });

    expect(result.summary.basis).toBe("full");
  });
});
