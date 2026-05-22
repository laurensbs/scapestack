import { describe, it, expect } from "vitest";
import { computeTips } from "@/lib/tips";
import type { OrganizedItem, OrganizedTab } from "@/lib/organizer";

// Build a minimal tab with the given items — saves us writing all the
// scaffold fields by hand in every test.
function tab(name: string, items: Partial<OrganizedItem>[]): OrganizedTab {
  const filledItems = items.map((it, i): OrganizedItem => ({
    id: it.id ?? i + 1, name: it.name ?? "Unknown",
    subtab: "", slot: null, weight: 0,
    quantity: it.quantity ?? 1,
    unitPrice: 0, stackValue: 0,
    highalch: 0, geLimit: 0,
    ...it
  }));
  return {
    name: name as OrganizedTab["name"],
    iconItemId: 995,
    items: filledItems,
    layout: {},
    quantity: filledItems.reduce((s, i) => s + i.quantity, 0),
    value: 0
  };
}

describe("tips — decant detector", () => {
  it("flags glory(1) + glory(3) + glory(6) as decant fodder", () => {
    const tips = computeTips([tab("Teleports", [
      { id: 1706, name: "Amulet of glory(1)" },
      { id: 1708, name: "Amulet of glory(3)" },
      { id: 11978, name: "Amulet of glory(6)" }
    ])]);
    const t = tips.find((x) => x.kind === "decant" && x.id === "decant:Amulet of glory");
    expect(t).toBeDefined();
    expect(t!.slotsFreed).toBe(2);
    expect(t!.itemIds).toContain(11978);
    // subKind drives UI grouping ("Decant jewellery" vs "Decant potions").
    expect(t!.subKind).toBe("jewellery");
  });

  it("flags super combat potion across dose states", () => {
    const tips = computeTips([tab("Potions", [
      { id: 12695, name: "Super combat potion(4)" },
      { id: 12697, name: "Super combat potion(3)" },
      { id: 12699, name: "Super combat potion(1)" }
    ])]);
    const t = tips.find((x) => x.id === "decant:Super combat potion");
    expect(t).toBeDefined();
    expect(t!.slotsFreed).toBe(2);
    expect(t!.subKind).toBe("potions");
  });

  it("does not flag a single dose state", () => {
    const tips = computeTips([tab("Potions", [
      { id: 12695, name: "Super combat potion(4)" }
    ])]);
    expect(tips.filter((x) => x.kind === "decant")).toHaveLength(0);
  });

  it("does not flag two stacks of the same charge", () => {
    // Two items with the same (4) — duplicates aren't a decant case.
    const tips = computeTips([tab("Potions", [
      { id: 12695, name: "Super combat potion(4)" },
      { id: 12695, name: "Super combat potion(4)" }
    ])]);
    expect(tips.filter((x) => x.kind === "decant")).toHaveLength(0);
  });
});

describe("tips — stack-merge detector", () => {
  it("flags two variants of the same base (Slayer helmet + Slayer helmet (i))", () => {
    const tips = computeTips([tab("PvM Gear", [
      { id: 11864, name: "Slayer helmet" },
      { id: 11865, name: "Slayer helmet (i)" }
    ])]);
    const t = tips.find((x) => x.kind === "stack-merge");
    expect(t).toBeDefined();
    expect(t!.itemIds).toContain(11864);
    expect(t!.itemIds).toContain(11865);
  });

  it("does NOT flag dose variants — decant handles them", () => {
    const tips = computeTips([tab("Potions", [
      { id: 12695, name: "Super combat potion(4)" },
      { id: 12697, name: "Super combat potion(3)" }
    ])]);
    expect(tips.filter((x) => x.kind === "stack-merge")).toHaveLength(0);
  });
});

describe("tips — outfit-incomplete detector", () => {
  it("flags 2/4 Angler outfit", () => {
    const tips = computeTips([tab("Cosmetic", [
      { id: 13258, name: "Angler hat" },
      { id: 13260, name: "Angler waders" }
    ])]);
    const t = tips.find((x) => x.id === "outfit:Angler");
    expect(t).toBeDefined();
    expect(t!.title).toMatch(/2\/4/);
  });

  it("does not flag a full Lumberjack set", () => {
    const tips = computeTips([tab("Cosmetic", [
      { name: "Lumberjack hat" },
      { name: "Lumberjack top" },
      { name: "Lumberjack legs" },
      { name: "Lumberjack boots" }
    ])]);
    expect(tips.find((x) => x.id === "outfit:Lumberjack")).toBeUndefined();
  });

  it("does not flag an empty outfit", () => {
    const tips = computeTips([tab("Cosmetic", [{ name: "Coins" }])]);
    expect(tips.find((x) => x.kind === "outfit-incomplete")).toBeUndefined();
  });
});

describe("tips — untradeable-pickup detector", () => {
  it("suggests Infernal cape when player has Fire cape but not Infernal", () => {
    const tips = computeTips([tab("PvM Gear", [
      { id: 6570, name: "Fire cape" }
    ])]);
    const t = tips.find((x) => x.id === "pickup:infernal-cape");
    expect(t).toBeDefined();
    expect(t!.itemIds).toContain(21295);
  });

  it("does not suggest Infernal cape when player already has it", () => {
    const tips = computeTips([tab("PvM Gear", [
      { id: 6570, name: "Fire cape" },
      { id: 21295, name: "Infernal cape" }
    ])]);
    expect(tips.find((x) => x.id === "pickup:infernal-cape")).toBeUndefined();
  });

  it("suggests assembling Voidwaker from the 3 pieces", () => {
    const tips = computeTips([tab("Drops", [
      { id: 27681, name: "Voidwaker hilt" },
      { id: 27684, name: "Voidwaker blade" },
      { id: 27687, name: "Voidwaker gem" }
    ])]);
    const t = tips.find((x) => x.id === "pickup:voidwaker-pieces");
    expect(t).toBeDefined();
  });

  it("suggests Slayer helmet (i) when only the uninfused version is owned", () => {
    const tips = computeTips([tab("PvM Gear", [
      { id: 11864, name: "Slayer helmet" }
    ])]);
    expect(tips.find((x) => x.id === "pickup:slayer-helm-imbue")).toBeDefined();
  });
});

describe("tips — overall shape", () => {
  it("returns no tips for an empty bank", () => {
    expect(computeTips([])).toEqual([]);
  });

  it("each tip has a unique id", () => {
    const tips = computeTips([tab("PvM Gear", [
      { id: 6570, name: "Fire cape" },
      { id: 11864, name: "Slayer helmet" },
      { id: 1706, name: "Amulet of glory(1)" },
      { id: 11978, name: "Amulet of glory(6)" }
    ])]);
    const ids = tips.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
