import { describe, expect, it } from "vitest";
import { goalItemsWithHiscoreUnlocks } from "@/lib/goal-handoff";
import type { HiscoreSkill } from "@/lib/hiscores";

function skill(name: string, level: number): HiscoreSkill {
  return { id: 0, name, rank: -1, level, xp: 0 };
}

describe("goal handoff", () => {
  it("creates goal items from Hiscores when no bank handoff exists", () => {
    const items = goalItemsWithHiscoreUnlocks([], [
      skill("Woodcutting", 99),
      skill("Attack", 60)
    ]);

    expect(items).toContainEqual({ id: 9807, name: "Woodcutting cape" });
    expect(items).not.toContainEqual({ id: 9747, name: "Attack cape" });
  });

  it("dedupes hiscore unlocks already present in the bank", () => {
    const items = goalItemsWithHiscoreUnlocks(
      [{ id: 9807, name: "Woodcutting cape" }],
      [skill("Woodcutting", 99)]
    );

    expect(items).toEqual([{ id: 9807, name: "Woodcutting cape" }]);
  });
});
