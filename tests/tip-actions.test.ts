import { describe, expect, it } from "vitest";
import { buildTipAction, formatTipActionPlan } from "@/lib/tip-actions";
import type { BankTip } from "@/lib/tips";

function tip(overrides: Partial<BankTip>): BankTip {
  return {
    id: "tip:test",
    kind: "decant",
    subKind: "potions",
    severity: "save",
    title: "Super combat potion — doses 4, 2",
    detail: "Decant at Bob to free slots.",
    itemIds: [12695, 12699],
    slotsFreed: 1,
    ...overrides
  };
}

describe("tip actions", () => {
  it("builds a potion decant checklist with a guide", () => {
    const action = buildTipAction(tip({}));
    expect(action.label).toBe("Open decant guide");
    expect(action.href).toContain("wiki");
    expect(action.steps.join(" ")).toContain("Bob Barter");
  });

  it("builds a reward pickup checklist from the tip title", () => {
    const action = buildTipAction(tip({
      id: "pickup:slayer-helm-imbue",
      kind: "untradeable-pickup",
      subKind: undefined,
      title: "Pick up your Slayer helmet (i)",
      detail: "Imbue at NMZ.",
      itemIds: [11865]
    }));

    expect(action.label).toBe("Open Slayer helmet (i) wiki");
    expect(action.instruction).toContain("Claim or assemble");
    expect(action.steps[0]).toContain("Slayer helmet (i)");
  });

  it("formats grouped tip plans as copyable numbered checklists", () => {
    const plan = formatTipActionPlan([
      tip({
        id: "decant:a",
        title: "Prayer potion — doses 4, 1",
        itemRefs: [
          { id: 2434, name: "Prayer potion(4)" },
          { id: 143, name: "Prayer potion(1)" }
        ],
        slotsFreed: 2
      }),
      tip({ id: "decant:b", title: "Saradomin brew — doses 3, 1", slotsFreed: 1 })
    ], "2 Scapestack bank tips");

    expect(plan).toContain("2 Scapestack bank tips");
    expect(plan).toContain("1. Prayer potion");
    expect(plan).toContain("2. Saradomin brew");
    expect(plan).toContain("Matched items: Prayer potion(4) (#2434), Prayer potion(1) (#143)");
    expect(plan).toContain("Matched item IDs: 12695, 12699");
    expect(plan).toContain("Potential slots freed: 2");
    expect(plan).toContain("Guide:");
  });

  it("dedupes repeated tips in formatted plans", () => {
    const duplicate = tip({ id: "decant:dupe" });
    const plan = formatTipActionPlan([duplicate, duplicate]);
    expect(plan.match(/Super combat potion/g)).toHaveLength(1);
  });
});
