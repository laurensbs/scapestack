import { describe, expect, it } from "vitest";
import { decideSlayerTask, type SlayerTaskDecisionInput } from "@/lib/slayer-task-decision";
import { MONSTERS_BY_ID } from "@/lib/slayer/monsters";

function input(taskId: string, overrides: Partial<SlayerTaskDecisionInput> = {}): SlayerTaskDecisionInput {
  const task = MONSTERS_BY_ID.get(taskId);
  if (!task) throw new Error(`Missing Slayer fixture: ${taskId}`);
  return {
    task,
    state: {
      points: 120,
      streak: 48,
      taskRemaining: 80,
      currentTaskId: 19,
      blocks: []
    },
    bank: [],
    accountType: "regular",
    combatLevel: 110,
    slayerLevel: 95,
    mood: "smart",
    syncHealth: "live",
    ...overrides
  };
}

describe("Slayer task decision", () => {
  it("never presents a stale task as live fact", () => {
    const decision = decideSlayerTask(input("dust_devil", { syncHealth: "stale" }));

    expect(decision.verdict).toBe("refresh");
    expect(decision.firstStep).toContain("press Sync now");
    expect(decision.avoid).toContain("stale task data");
  });

  it("keeps Chill and AFK routes away from boss variants", () => {
    const bank = [
      { id: 24225, name: "Elder maul", quantity: 1 },
      { id: 11865, name: "Slayer helmet (i)", quantity: 1 },
      { id: 139, name: "Prayer potion(3)", quantity: 20 },
      { id: 385, name: "Shark", quantity: 100 }
    ];

    for (const mood of ["chill", "afk"] as const) {
      const decision = decideSlayerTask(input("hellhound", { mood, bank }));
      expect(decision.verdict).toBe("do");
      expect(decision.method).not.toBe("boss");
      expect(decision.bossVariant).toBeNull();
    }
  });

  it("only promotes a boss variant for Bossing with a viable owned setup", () => {
    const weak = decideSlayerTask(input("hellhound", {
      mood: "bossing",
      bank: [{ id: 1333, name: "Rune scimitar", quantity: 1 }]
    }));
    const viable = decideSlayerTask(input("hellhound", {
      mood: "bossing",
      bank: [
        { id: 24225, name: "Elder maul", quantity: 1 },
        { id: 11865, name: "Slayer helmet (i)", quantity: 1 },
        { id: 139, name: "Prayer potion(3)", quantity: 20 },
        { id: 385, name: "Shark", quantity: 100 }
      ]
    }));

    expect(weak.bossVariant).toBeNull();
    expect(weak.verdict).toBe("do");
    expect(viable.verdict).toBe("boss-variant");
    expect(viable.bossVariant?.name).toBe("Cerberus");
    expect(viable.bossVariant?.viability.weaponName).toBe("Elder maul");
  });

  it("protects a streak milestone instead of spending points on a weak task", () => {
    const decision = decideSlayerTask(input("spiritual_creature", {
      state: {
        points: 200,
        streak: 49,
        taskRemaining: 80,
        currentTaskId: 50,
        blocks: []
      }
    }));

    expect(decision.verdict).toBe("do");
    expect(decision.pointsConsequence).toContain("50-task streak milestone");
  });

  it("uses a 30-point skip only when the account can afford it", () => {
    const skip = decideSlayerTask(input("spiritual_creature", {
      state: { points: 90, streak: 42, taskRemaining: 100, currentTaskId: 50, blocks: [] }
    }));
    const conserve = decideSlayerTask(input("spiritual_creature", {
      state: { points: 20, streak: 42, taskRemaining: 100, currentTaskId: 50, blocks: [] }
    }));

    expect(skip.verdict).toBe("skip");
    expect(skip.pointsConsequence).toContain("costs 30 points");
    expect(conserve.verdict).toBe("do");
  });

  it("keeps self-sourced tasks on iron accounts instead of assuming a skip", () => {
    const decision = decideSlayerTask(input("waterfiend", {
      accountType: "ironman",
      state: { points: 200, streak: 42, taskRemaining: 80, currentTaskId: 86, blocks: [] }
    }));

    expect(decision.verdict).toBe("do");
  });

  it("builds task-specific inventory checks from the actual bank", () => {
    const decision = decideSlayerTask(input("dust_devil", {
      bank: [
        { id: 11865, name: "Slayer helmet (i)", quantity: 1 },
        { id: 22323, name: "Ancient sceptre", quantity: 1 },
        { id: 27281, name: "Divine rune pouch", quantity: 1 },
        { id: 139, name: "Prayer potion(3)", quantity: 20 },
        { id: 385, name: "Shark", quantity: 100 }
      ]
    }));

    expect(decision.method).toBe("burst");
    expect(decision.inventory).toEqual(expect.arrayContaining([
      expect.objectContaining({ label: "Ancient burst weapon", owned: true, itemName: "Ancient sceptre" }),
      expect.objectContaining({ label: "Rune pouch", owned: true, itemName: "Divine rune pouch" })
    ]));
    expect(decision.avoid).toContain("Do not bring a cannon to the Catacombs");
  });
});
