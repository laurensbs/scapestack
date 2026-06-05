import { beforeEach, describe, expect, it } from "vitest";
import type { BankSnapshot } from "@/lib/diff";
import type { OrganizedTab } from "@/lib/organizer";
import {
  appendLocalSnapshot,
  appendSnapshot,
  deleteSnapshot,
  loadLocalSnapshots,
  loadSnapshots,
  restoreDeletedSnapshot,
  summarizeTabsForSnapshot
} from "@/lib/snapshot-history";

class MemoryStorage {
  private map = new Map<string, string>();
  getItem(key: string) { return this.map.get(key) ?? null; }
  setItem(key: string, value: string) { this.map.set(key, value); }
  removeItem(key: string) { this.map.delete(key); }
  clear() { this.map.clear(); }
}

beforeEach(() => {
  const storage = new MemoryStorage();
  Object.assign(globalThis, {
    localStorage: storage,
    window: { localStorage: storage }
  });
});

function snap(ts: number, id = ts): BankSnapshot {
  return {
    ts,
    items: [{ id, name: `Item ${id}`, quantity: id, stackValue: id * 100 }]
  };
}

describe("snapshot history", () => {
  it("stores local snapshots without an RSN", () => {
    appendLocalSnapshot(snap(1000, 1));
    appendLocalSnapshot(snap(1_000_000, 2));

    expect(loadLocalSnapshots().map((entry) => entry.items[0].id)).toEqual([1, 2]);
  });

  it("stores snapshots per RSN when a scope is provided", () => {
    appendSnapshot("Lynx Titan", snap(1000, 1));
    appendSnapshot("Other", snap(1000, 2));

    expect(loadSnapshots("lynx titan").map((entry) => entry.items[0].id)).toEqual([1]);
    expect(loadSnapshots("lynx_titan").map((entry) => entry.items[0].id)).toEqual([1]);
    expect(loadSnapshots("other").map((entry) => entry.items[0].id)).toEqual([2]);
  });

  it("loads legacy underscore snapshot keys from profile URLs", () => {
    localStorage.setItem("scapestack-bank:rsn-snapshots", JSON.stringify({
      lynx_titan: [snap(1000, 1)]
    }));

    expect(loadSnapshots("Lynx Titan").map((entry) => entry.items[0].id)).toEqual([1]);
    expect(loadSnapshots("lynx_titan").map((entry) => entry.items[0].id)).toEqual([1]);
  });

  it("dedupes saves within five minutes", () => {
    appendLocalSnapshot(snap(1000, 1));
    appendLocalSnapshot(snap(1000 + 60_000, 2));

    expect(loadLocalSnapshots()).toHaveLength(1);
    expect(loadLocalSnapshots()[0].items[0].id).toBe(2);
  });

  it("keeps manual snapshots as separate compare points", () => {
    appendLocalSnapshot(snap(1000, 1));
    appendSnapshot(null, snap(1000 + 60_000, 2), { forceNew: true });

    expect(loadLocalSnapshots().map((entry) => entry.items[0].id)).toEqual([1, 2]);
  });

  it("deletes one snapshot from the requested scope", () => {
    appendLocalSnapshot(snap(1000, 1));
    appendLocalSnapshot(snap(1_000_000, 2));

    const remaining = deleteSnapshot(null, 1000);

    expect(remaining.map((entry) => entry.items[0].id)).toEqual([2]);
  });

  it("restores a deleted snapshot at its original timestamp position", () => {
    appendSnapshot("Lynx Titan", snap(1000, 1));
    appendSnapshot("Lynx Titan", snap(1_000_000, 2));
    appendSnapshot("Lynx Titan", snap(2_000_000, 3));

    const deleted = snap(1_000_000, 2);
    deleteSnapshot("lynx titan", deleted.ts);
    const restored = restoreDeletedSnapshot("lynx titan", deleted);

    expect(restored.map((entry) => entry.items[0].id)).toEqual([1, 2, 3]);
  });

  it("summarizes current tabs for the UI", () => {
    const tabs: OrganizedTab[] = [{
      name: "Combat",
      iconItemId: 4151,
      layout: { 0: 4151 },
      quantity: 2,
      value: 5000,
      items: [{
        id: 4151,
        name: "Abyssal whip",
        quantity: 2,
        unitPrice: 2500,
        stackValue: 5000,
        subtab: "Melee",
        slot: "weapon",
        weight: 0
      }]
    }];

    const summary = summarizeTabsForSnapshot(tabs);

    expect(summary.itemCount).toBe(1);
    expect(summary.totalQuantity).toBe(2);
    expect(summary.totalValue).toBe(5000);
    expect(summary.stackScore).toBeGreaterThanOrEqual(0);
    expect(summary.topItems[0].name).toBe("Abyssal whip");
  });
});
