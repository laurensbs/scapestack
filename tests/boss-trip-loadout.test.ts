import { describe, expect, it } from "vitest";
import { BOSSES } from "@/lib/bosses";
import { buildBossInventoryPlan } from "@/lib/boss-trip-loadout";
import type { DpsBreakdown } from "@/lib/dps";
import { GEAR } from "@/lib/gear";
import { normalizeBankHandoffItems } from "@/lib/next-bank-handoff";

const blowpipe = GEAR.find((gear) => gear.name === "Toxic blowpipe")!;

function dps(): DpsBreakdown {
  return {
    style: "ranged",
    weapon: blowpipe,
    maxHit: 30,
    hitChance: 0.7,
    dps: 8,
    ttk: 90,
    setup: { weapon: blowpipe },
    gearScore: 120
  };
}

describe("boss trip loadout", () => {
  it("turns Vorkath into a concrete bank trip instead of generic gear copy", () => {
    const vorkath = BOSSES.find((boss) => boss.slug === "vorkath")!;
    const plan = buildBossInventoryPlan({
      boss: vorkath,
      bankItems: normalizeBankHandoffItems([
        { id: 12926, name: "Toxic blowpipe", quantity: 1 },
        { id: 21978, name: "Dragonfire ward", quantity: 1 },
        { id: 21975, name: "Extended super antifire(4)", quantity: 8 },
        { id: 12913, name: "Anti-venom+(4)", quantity: 12 },
        { id: 385, name: "Shark", quantity: 250 },
        { id: 8013, name: "Teleport to house", quantity: 20 }
      ]),
      owned: [blowpipe],
      dps: dps()
    });

    expect(plan.leaveWith).toContain("Salve");
    expect(plan.firstTrip).toContain("one Vorkath kill");
    expect(plan.missingLine).toContain("Salve amulet(ei)");
    expect(plan.rows[0].slots.map((slot) => slot.item?.name ?? slot.label)).toContain("Extended super antifire(4)");
    expect(plan.rows[0].slots.map((slot) => slot.item?.name ?? slot.label)).toContain("Anti-venom+(4)");
  });

  it("builds multi-style raid switches instead of one generic weapon row", () => {
    const cox = BOSSES.find((boss) => boss.slug === "cox")!;
    const ranged = GEAR.find((gear) => gear.name === "Toxic blowpipe")!;
    const magic = GEAR.find((gear) => gear.name === "Trident of the seas")!;
    const crush = GEAR.find((gear) => gear.name === "Elder maul")!;
    const plan = buildBossInventoryPlan({
      boss: cox,
      bankItems: normalizeBankHandoffItems([
        { id: ranged.id, name: ranged.name, quantity: 1 },
        { id: magic.id, name: magic.name, quantity: 1 },
        { id: crush.id, name: crush.name, quantity: 1 }
      ]),
      owned: [ranged, magic, crush],
      dps: dps()
    });

    expect(plan.rows[0].label).toBe("Required switches");
    expect(plan.rows[0].slots.map((slot) => slot.label)).toEqual([
      "Crush weapon",
      "Range weapon",
      "Magic weapon"
    ]);
    expect(plan.leaveWith).toContain("Multi-style switches");
    expect(plan.firstTrip).toContain("learner raid");
  });
});
