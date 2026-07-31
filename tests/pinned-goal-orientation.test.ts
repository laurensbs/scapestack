import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { Recommendation } from "@/lib/next-up";
import {
  activePinnedGoal,
  buildPinnedGoalBankFacts,
  buildPinnedGoalBossSources,
  claimPinnedGoalCompletionNotice,
  goalTripWhy,
  orderAffordableSetsForGoal,
  orderBossesForGoal
} from "@/lib/pinned-goal-orientation";
import { createPinnedGoal } from "@/lib/pinned-goals";
import type { WikiLatestPrice } from "@/lib/wiki";

const price = (high: number): WikiLatestPrice =>
  ({ high, low: high - 1, highTime: 0, lowTime: 0 } as WikiLatestPrice);

describe("the player-chosen goal is the subject", () => {
  it("names the exact quest block that moves an unlock and is plain when no trip moves it", () => {
    const goal = createPinnedGoal({ kind: "unlock", unlockId: "barrows-gloves" })!;
    const quest = {
      id: "quest:recipe-for-disaster",
      kind: "quest",
      title: "Do Monkey Madness I",
      why: "One quest block.",
      score: 80,
      completionTarget: { kind: "quest_completed", quest: "Monkey Madness I" },
      questRoute: {
        targetQuestName: "Recipe for Disaster",
        activeQuestName: "Monkey Madness I"
      }
    } as Recommendation;
    const unrelated = {
      id: "skill:Slayer:99",
      kind: "skill",
      title: "Push Slayer to 99",
      why: "Five levels remain.",
      score: 90,
      completionTarget: { kind: "skill_level_at_least", skill: "Slayer", target: 99 }
    } as Recommendation;

    expect(goalTripWhy(quest, goal, [])).toBe("Monkey Madness I — the next gate to Barrows gloves.");
    expect(goalTripWhy(unrelated, goal, [])).toBe(
      "Nothing in this 60-minute list moves Barrows gloves. Here is something else worth doing."
    );
  });

  it("prices the pinned item first while retaining every other started set", () => {
    const goal = createPinnedGoal({ kind: "item", goalId: "ahrim-skirt" })!;
    const bank = [
      { id: 995, name: "Coins", quantity: 2_000_000 },
      { id: 4708, name: "Ahrim's hood", quantity: 1 },
      { id: 4712, name: "Ahrim's robetop", quantity: 1 },
      { id: 4710, name: "Ahrim's staff", quantity: 1 }
    ];
    const prices = new Map([[4714, price(1_572_490)]]);
    const mapping = new Map([[4714, { id: 4714, name: "Ahrim's robeskirt" }]]);
    const fact = buildPinnedGoalBankFacts(bank, prices, mapping)[goal.key];
    expect(fact?.line).toBe("Ahrim's robeskirt — 1,572,490 gp. That finishes Ahrim's set.");
    const ironFact = buildPinnedGoalBankFacts(bank, prices, mapping, true)[goal.key];
    expect(ironFact).toMatchObject({ line: "Ahrim's robeskirt has to come from its source.", verdict: "Source it" });
    expect(ironFact?.line).not.toContain("gp");

    const rows = [
      { setId: "karil", setName: "Karil's set" },
      { setId: "ahrim", setName: "Ahrim's set" }
    ];
    expect(orderAffordableSetsForGoal(rows, goal).map((row) => row.setId))
      .toEqual(["ahrim", "karil"]);
  });

  it("puts an exact Wiki drop source first without removing the rest of the boss list", () => {
    const goal = createPinnedGoal({ kind: "item", goalId: "bandos-helm" })!;
    const sources = buildPinnedGoalBossSources(new Map([
      ["Vorkath", { hiscoresName: "Vorkath", drops: [{ name: "Draconic visage", num: 1, denom: 5_000, rarity: "1/5000" }] }],
      ["General Graardor", { hiscoresName: "General Graardor", drops: [{ name: "Bandos chestplate", num: 1, denom: 381, rarity: "1/381" }] }]
    ]));
    const bosses = [
      { boss: { name: "Vorkath" } },
      { boss: { name: "General Graardor" } }
    ];
    const ordered = orderBossesForGoal(bosses, goal, sources);

    expect(ordered.map((row) => row.boss.name)).toEqual(["General Graardor", "Vorkath"]);
    expect(ordered).toHaveLength(2);
    expect(sources.find((source) => source.goalKey === goal.key)).toMatchObject({
      bossName: "General Graardor",
      dropName: "Bandos chestplate",
      rarity: "1/381"
    });
  });

  it("announces a completed goal once and then makes the next unfinished pin active", () => {
    const completed = createPinnedGoal({ kind: "level", skill: "Slayer", targetLevel: 94, pinnedAt: "2026-07-31T10:00:00.000Z" })!;
    const next = createPinnedGoal({ kind: "unlock", unlockId: "fairy-rings", pinnedAt: "2026-07-31T10:01:00.000Z" })!;
    const evidence = {
      skills: [{ name: "Slayer", level: 94 }],
      unlocks: { "fairy-rings": { completed: 2, total: 3, note: null } }
    };
    const writes = new Map<string, string>();
    const storage = {
      getItem: (key: string) => writes.get(key) ?? null,
      setItem: (key: string, value: string) => writes.set(key, value)
    };

    expect(activePinnedGoal([completed, next], evidence)).toEqual(next);
    expect(claimPinnedGoalCompletionNotice(storage, "Lynx Titan", [completed, next], evidence)).toEqual(completed);
    expect(claimPinnedGoalCompletionNotice(storage, "Lynx Titan", [completed, next], evidence)).toBeNull();
  });

  it("wires the same active goal into the trip, bank and boss answers", () => {
    const plan = readFileSync("src/components/player-plan-panel.tsx", "utf8");
    const tools = readFileSync("src/components/player-tools-sections.tsx", "utf8");
    const sets = readFileSync("src/components/player-sets-section.tsx", "utf8");
    const bosses = readFileSync("src/components/player-bosses-section.tsx", "utf8");

    expect(plan).toContain("goalTripWhy(");
    expect(plan).toContain("activePinnedGoal(");
    expect(tools).toContain("activePinnedGoal(");
    expect(sets).toContain("orderAffordableSetsForGoal(");
    expect(bosses).toContain("orderBossesForGoal(");
    expect(sets).toContain('className="scape-verdict" data-gate=');
    expect(bosses).toContain('className="scape-verdict" data-gate=');
  });
});
