import { describe, expect, it } from "vitest";
import {
  buildCollectionLogRoute,
  buildMaxRoute,
  buildPinnedGoalRoute
} from "@/lib/companion-routes";
import { createPinnedGoal } from "@/lib/pinned-goals";
import { buildRfdRouteNodes } from "@/lib/unlock-route-path";

describe("companion routes", () => {
  it("builds all three route kinds from evidence without hours or rarity-first ranking", () => {
    const pinnedGoal = createPinnedGoal({ kind: "unlock", unlockId: "barrows-gloves" });
    expect(pinnedGoal).not.toBeNull();
    const pinned = buildPinnedGoalRoute(pinnedGoal!, [{
      id: "barrows-gloves",
      title: "Barrows gloves",
      payoff: "Recipe for Disaster is the account spine.",
      iconItemId: 7462,
      pathNodes: buildRfdRouteNodes(null)
    }]);
    expect(pinned).toMatchObject({ kind: "pinned-goal", title: "Route to Barrows gloves" });
    expect(pinned?.nodes).toHaveLength(10);
    expect(pinned?.nodes.every((node) => node.state === "unknown")).toBe(true);
    expect(pinned?.nodes.map((node) => node.iconItemId)).toEqual([
      7497,
      7509,
      7511,
      7530,
      7477,
      7479,
      7230,
      7476,
      7579,
      7462
    ]);
    expect(new Set(pinned?.nodes.map((node) => node.iconItemId)).size).toBe(10);

    const max = buildMaxRoute([
      { skill: "Mining", currentLevel: 95, targetLevel: 99, xpRemaining: 2_000_000 },
      { skill: "Fishing", currentLevel: 98, targetLevel: 99, xpRemaining: 80_000 },
      { skill: "Slayer", currentLevel: 97, targetLevel: 99, xpRemaining: 900_000 },
      { skill: "Agility", currentLevel: 96, targetLevel: 99, xpRemaining: 1_300_000 }
    ]);
    expect(max.kind).toBe("max");
    expect(max.nodes.map((node) => node.title)).toEqual(["Fishing", "Slayer", "Agility", "Mining"]);
    expect(max.nodes.map((node) => node.state)).toEqual(["current", "future", "future", "future"]);
    expect(max.nodes.every((node) => typeof node.iconItemId === "number")).toBe(true);
    expect(JSON.stringify(max)).not.toMatch(/hours?/i);

    const items = new Map<number, string>([
      [10, "Rarest single"],
      [20, "First Zulrah slot"],
      [21, "Second Zulrah slot"],
      [22, "Owned Zulrah slot"]
    ]);
    const dropRates = new Map([
      ["Vorkath", {
        hiscoresName: "Vorkath",
        drops: [{ name: "Rarest single", num: 1, denom: 1_000_000, rarity: "1/1000000" }]
      }],
      ["Zulrah", {
        hiscoresName: "Zulrah",
        drops: [
          { name: "First Zulrah slot", num: 1, denom: 200, rarity: "1/200" },
          { name: "Second Zulrah slot", num: 1, denom: 100, rarity: "1/100" },
          { name: "Owned Zulrah slot", num: 1, denom: 2_000_000, rarity: "1/2000000" }
        ]
      }]
    ]);
    const bosses = [
      { slug: "vorkath", name: "Vorkath", iconItemId: 21907 },
      { slug: "zulrah", name: "Zulrah", iconItemId: 12921 }
    ];
    const collection = buildCollectionLogRoute({ dropRates, items, bosses, ownedItemIds: new Set([22]) });
    expect(collection.kind).toBe("collection-log");
    expect(collection.nodes.map((node) => node.title)).toEqual(["Zulrah", "Vorkath"]);
    expect(collection.nodes[0]).toMatchObject({ metric: "2 slots missing", state: "current" });
    expect(collection.nodes[0]?.detail).toContain("Rarest missing: First Zulrah slot · 1/200");
    expect(collection.nodes.every((node) => typeof node.iconItemId === "number")).toBe(true);

    const unknown = buildCollectionLogRoute({ dropRates, items, bosses, ownedItemIds: null });
    expect(unknown.nodes.every((node) => node.state === "unknown")).toBe(true);
    // Unverified rows carry a fact each, not three copies of the same caveat.
    // The "RuneLite is needed" sentence belongs to the route summary and is
    // stated exactly once — it used to be repeated on every row, so the page
    // said it four times and the rows told the player nothing.
    expect(unknown.summary).toContain("RuneLite is needed");
    expect(unknown.nodes.every((node) => node.metric.match(/^\d+ tracked$/))).toBe(true);
    expect(unknown.nodes.every((node) => node.detail.startsWith("Rarest tracked:"))).toBe(true);
    expect(unknown.nodes.some((node) => node.detail.includes("Needs RuneLite"))).toBe(false);
  });
});
