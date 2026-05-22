// Playstyle-aware organisation: per-archetype within-tab ordering, junk
// thresholds, and the deterministic shuffle. Guards src/lib/playstyle.ts.
import { describe, it, expect } from "vitest";
import { organize } from "@/lib/organizer";

// A bank mixing combat gear, skilling resources and cheap clutter.
const MIXED = [
  4151, 11802, 11832, 11834,
  995, 560, 565,
  207, 209, 211,
  1515, 1517, 1519,
  314, 1755, 1735,
  ...Array.from({ length: 30 }, (_, i) => 1600 + i)
];

describe("playstyle-aware organize", () => {
  it("skiller surfaces skilling subtabs first in the Skilling tab", async () => {
    const r = await organize({ itemIds: MIXED, includePrices: false, archetype: "skiller", shuffleSeed: 1 });
    const skilling = r.tabs.find((t) => t.name === "Skilling");
    expect(skilling).toBeDefined();
    const topSubtab = skilling!.items[0]?.subtab;
    expect(["Herbs", "Herblore", "Farming", "Logs", "Ore"]).toContain(topSubtab);
  });

  it("ironman keeps everything — junk filter relegates nothing", async () => {
    const withFilter = await organize({ itemIds: MIXED, includePrices: true, archetype: "ironman", junkFilter: true, shuffleSeed: 1 });
    const noFilter = await organize({ itemIds: MIXED, includePrices: true, archetype: "ironman", junkFilter: false, shuffleSeed: 1 });
    const miscWith = withFilter.tabs.find((t) => t.name === "Misc")?.items.length ?? 0;
    const miscNo = noFilter.tabs.find((t) => t.name === "Misc")?.items.length ?? 0;
    expect(miscWith).toBe(miscNo);
  });

  it("same shuffle seed reproduces an identical layout", async () => {
    const a = await organize({ itemIds: MIXED, includePrices: false, shuffleSeed: 42 });
    const b = await organize({ itemIds: MIXED, includePrices: false, shuffleSeed: 42 });
    const ids = (res: typeof a) => res.tabs.flatMap((t) => t.items.map((i) => i.id)).join(",");
    expect(ids(a)).toBe(ids(b));
  });
});
