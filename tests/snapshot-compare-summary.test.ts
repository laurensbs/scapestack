import { describe, expect, it } from "vitest";
import type { BankDiff } from "@/lib/diff";
import {
  buildSnapshotCompareShareText,
  recommendSnapshotCompareActions,
  summarizeSnapshotCompare
} from "@/lib/snapshot-compare-summary";

function diff(overrides: Partial<BankDiff>): BankDiff {
  return {
    added: [],
    removed: [],
    changedQuantity: [],
    totalValueBefore: 0,
    totalValueAfter: 0,
    daysSince: 0,
    ...overrides
  };
}

describe("snapshot compare summary", () => {
  it("highlights the biggest added item", () => {
    const summary = summarizeSnapshotCompare(diff({
      totalValueBefore: 1_000_000,
      totalValueAfter: 3_500_000,
      added: [
        { id: 995, name: "Coins", quantity: 1_000_000, stackValue: 1_000_000 },
        { id: 4151, name: "Abyssal whip", quantity: 1, stackValue: 1_500_000 }
      ]
    }));

    expect(summary.tone).toBe("good");
    expect(summary.headline).toContain("Abyssal whip entered");
    expect(summary.detail).toContain("+1 Abyssal whip");
  });

  it("flags the biggest removed item as dangerous", () => {
    const summary = summarizeSnapshotCompare(diff({
      totalValueBefore: 10_000_000,
      totalValueAfter: 2_000_000,
      removed: [
        { id: 11802, name: "Armadyl godsword", quantity: 1, stackValue: 8_000_000 }
      ]
    }));

    expect(summary.tone).toBe("danger");
    expect(summary.headline).toContain("Armadyl godsword left");
    expect(summary.detail).toContain("-1 Armadyl godsword");
  });

  it("does not show negative zero for old quantity-less snapshots", () => {
    const summary = summarizeSnapshotCompare(diff({
      totalValueBefore: 10_000_000,
      totalValueAfter: 2_000_000,
      removed: [
        { id: 11806, name: "Saradomin godsword", quantity: 0, stackValue: 8_000_000 }
      ]
    }));

    expect(summary.detail).not.toContain("-0");
    expect(summary.detail).toContain("Saradomin godsword worth 8.00M gp");
  });

  it("summarizes the largest quantity movement", () => {
    const summary = summarizeSnapshotCompare(diff({
      totalValueBefore: 1_000_000,
      totalValueAfter: 1_600_000,
      changedQuantity: [{
        id: 3024,
        name: "Super restore(4)",
        before: 10,
        after: 40,
        delta: 30,
        deltaValue: 600_000
      }]
    }));

    expect(summary.tone).toBe("good");
    expect(summary.headline).toContain("Super restore(4) moved most");
    expect(summary.detail).toContain("+30");
  });

  it("handles price-only movement", () => {
    const summary = summarizeSnapshotCompare(diff({
      totalValueBefore: 1_000_000,
      totalValueAfter: 900_000
    }));

    expect(summary.tone).toBe("danger");
    expect(summary.headline).toContain("down 100K");
    expect(summary.detail).toContain("price movement");
  });

  it("builds a copyable compare summary for sharing", () => {
    const text = buildSnapshotCompareShareText(diff({
      totalValueBefore: 1_000_000,
      totalValueAfter: 3_500_000,
      added: [{ id: 4151, name: "Abyssal whip", quantity: 1, stackValue: 1_500_000 }],
      changedQuantity: [{
        id: 3024,
        name: "Super restore(4)",
        before: 10,
        after: 40,
        delta: 30,
        deltaValue: 600_000
      }]
    }));

    expect(text).toContain("Scapestack bank compare");
    expect(text).toContain("Abyssal whip entered the bank");
    expect(text).toContain("Added 1 · Removed 0 · Qty changed 1 · Value +2.50M");
    expect(text).toContain("Next actions:");
    expect(text).toContain("Re-plan upgrades");
    expect(text).toContain("Inspect new item");
  });

  it("recommends searchable actions for the strongest item move", () => {
    const actions = recommendSnapshotCompareActions(diff({
      totalValueBefore: 10_000_000,
      totalValueAfter: 2_000_000,
      removed: [
        { id: 11802, name: "Armadyl godsword", quantity: 1, stackValue: 8_000_000 }
      ]
    }));

    expect(actions[0]).toMatchObject({
      label: "Audit the spend"
    });
    expect(actions[1]).toMatchObject({
      label: "Verify missing item",
      searchQuery: "#11802"
    });
    expect(actions[1].body).toContain("Armadyl godsword left the bank");
  });

  it("handles price-only movement with a refresh action", () => {
    const actions = recommendSnapshotCompareActions(diff({
      totalValueBefore: 1_000_000,
      totalValueAfter: 1_000_000
    }));

    expect(actions).toEqual([
      {
        label: "Check item churn",
        body: "Value is flat, so the useful signal is which items entered, left or moved."
      },
      {
        label: "Refresh prices",
        body: "No item-level movement was found. Re-import after GE changes or save a new baseline."
      }
    ]);
  });
});
