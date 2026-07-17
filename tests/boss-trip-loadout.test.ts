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
    expect(plan.canStart).toBe(false);
    expect(plan.mandatoryMissing).toContain("Chaos runes");
    expect(plan.inventory).toHaveLength(28);
  });

  it("blocks Vorkath until anti-dragon protection and Crumble Undead runes are banked", () => {
    const vorkath = BOSSES.find((boss) => boss.slug === "vorkath")!;
    const plan = buildBossInventoryPlan({
      boss: vorkath,
      bankItems: normalizeBankHandoffItems([
        { id: 12017, name: "Salve amulet(ei)", quantity: 1 },
        { id: 21975, name: "Extended super antifire(4)", quantity: 4 },
        { id: 562, name: "Chaos rune", quantity: 500 },
        { id: 4696, name: "Dust rune", quantity: 500 },
        { id: 385, name: "Shark", quantity: 50 }
      ]),
      owned: [blowpipe],
      dps: dps()
    });

    expect(plan.canStart).toBe(false);
    expect(plan.mandatoryMissing).toEqual(["Anti-dragon shield"]);
    expect(plan.rows[0].slots.find((slot) => slot.label === "Salve amulet(ei)")?.item?.name).toBe("Salve amulet(ei)");
  });

  it("builds a compatible worn Vorkath setup when a one-handed weapon is available", () => {
    const vorkath = BOSSES.find((boss) => boss.slug === "vorkath")!;
    const runeCrossbow = GEAR.find((gear) => gear.name === "Rune crossbow")!;
    const plan = buildBossInventoryPlan({
      boss: vorkath,
      bankItems: normalizeBankHandoffItems([
        { id: runeCrossbow.id, name: runeCrossbow.name, quantity: 1 },
        { id: 22002, name: "Dragonfire ward", quantity: 1 },
        { id: 19547, name: "Salve amulet(ei)", quantity: 1 },
        { id: 21975, name: "Extended super antifire(4)", quantity: 4 },
        { id: 562, name: "Chaos rune", quantity: 500 },
        { id: 4696, name: "Dust rune", quantity: 500 },
        { id: 385, name: "Shark", quantity: 50 }
      ]),
      owned: [runeCrossbow],
      dps: { ...dps(), weapon: runeCrossbow, setup: { weapon: runeCrossbow } }
    });

    expect(plan.canStart).toBe(true);
    expect(plan.wornSetup.weapon?.name).toBe("Rune crossbow");
    expect(plan.wornSetup.shield?.name).toBe("Dragonfire ward");
    expect(plan.wornSetup.neck?.name).toBe("Salve amulet(ei)");
    expect(plan.inventory.some((slot) => slot.item?.name === "Dragonfire ward")).toBe(false);
  });

  it("builds a viable Zulrah switch and supply inventory", () => {
    const zulrah = BOSSES.find((boss) => boss.slug === "zulrah")!;
    const trident = GEAR.find((gear) => gear.name === "Trident of the seas")!;
    const plan = buildBossInventoryPlan({
      boss: zulrah,
      bankItems: normalizeBankHandoffItems([
        { id: blowpipe.id, name: blowpipe.name, quantity: 1 },
        { id: trident.id, name: trident.name, quantity: 1 },
        { id: 12913, name: "Anti-venom+(4)", quantity: 4 },
        { id: 3024, name: "Super restore(4)", quantity: 10 },
        { id: 385, name: "Shark", quantity: 50 },
        { id: 12938, name: "Zul-andra teleport", quantity: 5 }
      ]),
      owned: [blowpipe, trident],
      dps: dps()
    });

    expect(plan.canStart).toBe(true);
    expect(plan.mandatoryMissing).toEqual([]);
    expect(plan.rows[0].slots.filter((slot) => slot.kind === "gear").map((slot) => slot.item?.name)).toEqual([
      "Trident of the seas",
      "Toxic blowpipe"
    ]);
    expect(plan.inventory.filter((slot) => slot.kind === "food" && slot.item)).toHaveLength(14);
  });

  it("keeps Barrows to a concrete one-chest inventory instead of raid switches", () => {
    const barrows = BOSSES.find((boss) => boss.slug === "barrows")!;
    const trident = GEAR.find((gear) => gear.name === "Trident of the seas")!;
    const plan = buildBossInventoryPlan({
      boss: barrows,
      bankItems: normalizeBankHandoffItems([
        { id: 952, name: "Spade", quantity: 1 },
        { id: trident.id, name: trident.name, quantity: 1 },
        { id: 2434, name: "Prayer potion(4)", quantity: 8 },
        { id: 385, name: "Shark", quantity: 30 },
        { id: 19627, name: "Barrows teleport", quantity: 5 }
      ]),
      owned: [trident],
      dps: { ...dps(), style: "magic", weapon: trident, setup: { weapon: trident } }
    });

    expect(plan.canStart).toBe(true);
    expect(plan.firstTripRange).toContain("One chest");
    expect(plan.rows[0].label).toBe("Leave the bank with");
    expect(plan.rows[0].slots.map((slot) => slot.label)).toContain("Spade");
    expect(plan.rows.map((row) => row.label)).not.toContain("Required switches");
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
