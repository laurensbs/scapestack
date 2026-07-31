import { beforeEach, describe, expect, it, vi } from "vitest";

class MemoryStorage {
  private values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
  removeItem(key: string) { this.values.delete(key); }
}

const globals = globalThis as Record<string, unknown>;

beforeEach(() => {
  const localStorage = new MemoryStorage();
  globals.localStorage = localStorage;
  globals.window = { localStorage, dispatchEvent: () => true };
  globals.CustomEvent = class CustomEventPolyfill<T = unknown> extends Event {
    detail: T | undefined;
    constructor(type: string, init?: CustomEventInit<T>) {
      super(type);
      this.detail = init?.detail;
    }
  };
  vi.resetModules();
});

describe("player-chosen goals", () => {
  it("survives a reload and reports progress as a fraction", async () => {
    const firstLoad = await import("@/lib/pinned-goals");
    const levelGoal = firstLoad.createPinnedGoal({
      kind: "level",
      skill: "Slayer",
      targetLevel: 99,
      pinnedAt: "2026-07-31T10:00:00.000Z"
    });
    const itemGoal = firstLoad.createPinnedGoal({
      kind: "item",
      goalId: "fire-cape",
      pinnedAt: "2026-07-31T10:01:00.000Z"
    });
    const unlockGoal = firstLoad.createPinnedGoal({
      kind: "unlock",
      unlockId: "fairy-rings",
      pinnedAt: "2026-07-31T10:02:00.000Z"
    });
    expect([levelGoal, itemGoal, unlockGoal]).not.toContain(null);
    firstLoad.pinGoalLocally("Lynx Titan", levelGoal!);
    firstLoad.pinGoalLocally("Lynx Titan", itemGoal!);
    firstLoad.pinGoalLocally("Lynx Titan", unlockGoal!);

    vi.resetModules();
    const afterReload = await import("@/lib/pinned-goals");
    const saved = afterReload.loadPinnedGoals("Lynx Titan");
    const evidence = {
      skills: [{ name: "Slayer", level: 94 }],
      ownedItemGoalIds: ["fire-cape"],
      unlocks: { "fairy-rings": { completed: 3, total: 4, note: null } }
    };

    expect(saved).toEqual([levelGoal, itemGoal, unlockGoal]);
    expect(saved.map((goal) => afterReload.pinnedGoalProgress(goal, evidence).fraction))
      .toEqual(["94/99", "1/1", "3/4"]);
  });

  it("starts empty instead of choosing a goal for the player", async () => {
    const { loadPinnedGoals } = await import("@/lib/pinned-goals");
    expect(loadPinnedGoals("Lynx Titan")).toEqual([]);
  });
});
