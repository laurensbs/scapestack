import { describe, expect, it } from "vitest";
import { generateSuggestions } from "@/lib/suggestions";
import { formatSuggestionActionPlan, getSuggestionPriority } from "@/lib/suggestion-text";
import { bankSearchQueryForItems } from "@/lib/bank-search";
import type { OrganizedItem, OrganizedTab } from "@/lib/organizer";
import { organize } from "@/lib/organizer";
import { SAMPLE_BANKTAGS } from "@/lib/utils";

function tab(items: Partial<OrganizedItem>[]): OrganizedTab {
  const filledItems = items.map((item, index): OrganizedItem => ({
    id: item.id ?? index + 1,
    name: item.name ?? "Unknown",
    subtab: "",
    slot: null,
    weight: 0,
    quantity: item.quantity ?? 1,
    unitPrice: item.unitPrice ?? 0,
    stackValue: item.stackValue ?? 0,
    highalch: 0,
    geLimit: 0,
    ...item
  }));

  return {
    name: "Bank" as OrganizedTab["name"],
    iconItemId: 995,
    items: filledItems,
    layout: {},
    quantity: filledItems.reduce((sum, item) => sum + item.quantity, 0),
    value: filledItems.reduce((sum, item) => sum + item.stackValue, 0)
  };
}

describe("smart suggestions", () => {
  it("attaches wiki actions to actionable bank suggestions", () => {
    const suggestions = generateSuggestions([
      tab([
        { id: 149, name: "Super attack(1)" },
        { id: 145, name: "Super attack(3)" }
      ])
    ]);

    const decant = suggestions.find((suggestion) => suggestion.id === "decant-potions");
    expect(decant?.actionLabel).toBe("Open decanting guide");
    expect(decant?.actionHref).toContain("oldschool.runescape.wiki");
    expect(decant?.actionHref).toContain("OSRS%20potion%20decanting");
    expect(decant?.itemIds).toEqual([149, 145]);
    expect(decant?.matchedItems).toEqual([
      { id: 149, name: "Super attack(1)" },
      { id: 145, name: "Super attack(3)" }
    ]);
    expect(bankSearchQueryForItems(decant?.matchedItems ?? [])).toBe("Super attack(1) | Super attack(3)");
    expect(decant?.steps).toEqual([
      "Withdraw the mixed-dose potion stacks.",
      "Talk to Bob Barter at the Grand Exchange.",
      "Decant into 4-dose stacks before rebuilding your supplies tab."
    ]);
  });

  it("links high-value item suggestions to that item", () => {
    const suggestions = generateSuggestions([
      tab([{ id: 4151, name: "Abyssal whip", stackValue: 120_000_000 }])
    ]);

    const expensive = suggestions.find((suggestion) => suggestion.id === "expensive-item");
    expect(expensive?.actionLabel).toBe("Open Abyssal whip wiki");
    expect(expensive?.actionHref).toContain("Abyssal%20whip");
    expect(expensive?.itemIds).toEqual([4151]);
    expect(expensive?.matchedItems).toEqual([{ id: 4151, name: "Abyssal whip" }]);
    expect(expensive?.steps[0]).toBe("Ask if this item is used in your next three goals.");
  });

  it("formats smart suggestions as copyable bank checklists", () => {
    const suggestions = generateSuggestions([
      tab([{ id: 4151, name: "Abyssal whip", stackValue: 120_000_000 }])
    ]);
    const expensive = suggestions.find((suggestion) => suggestion.id === "expensive-item")!;
    const text = formatSuggestionActionPlan(expensive);

    expect(text).toContain("Abyssal whip");
    expect(text).toContain("Priority: Cash check");
    expect(text).toContain("GP impact: 120,000,000 gp");
    expect(text).toContain("Matched items: Abyssal whip (#4151)");
    expect(text).toContain("1. Ask if this item is used in your next three goals.");
    expect(text).toContain("Guide: https://oldschool.runescape.wiki");
  });

  it("prioritizes urgent cleanup over optional wins", () => {
    const suggestions = generateSuggestions([
      tab([
        { id: 8007, name: "Varrock teleport", quantity: 250 },
        { id: 3144, name: "Cooked karambwan", quantity: 1_250 },
        { id: 4151, name: "Abyssal whip", stackValue: 120_000_000 }
      ])
    ]);

    const teleports = suggestions.find((suggestion) => suggestion.id === "tele-stockpile")!;
    const food = suggestions.find((suggestion) => suggestion.id === "stacked-food")!;
    const expensive = suggestions.find((suggestion) => suggestion.id === "expensive-item")!;

    expect(getSuggestionPriority(teleports)).toMatchObject({ label: "Fix first", rank: 0 });
    expect(getSuggestionPriority(expensive)).toMatchObject({ label: "Cash check", rank: 1 });
    expect(getSuggestionPriority(food)).toMatchObject({ label: "Optional win", rank: 4 });
  });

  it("keeps every emitted suggestion directly actionable", () => {
    const suggestions = generateSuggestions([
      tab([
        { id: 995, name: "Coins", quantity: 2_500_000 },
        { id: 149, name: "Super attack(1)" },
        { id: 145, name: "Super attack(3)" },
        { id: 4151, name: "Abyssal whip", stackValue: 120_000_000 },
        { id: 3144, name: "Cooked karambwan", quantity: 1_250 }
      ])
    ]);

    expect(suggestions.length).toBeGreaterThan(0);
    for (const suggestion of suggestions) {
      expect(suggestion.steps.length).toBeGreaterThanOrEqual(2);
      expect(suggestion.itemIds?.length).toBeGreaterThan(0);
      expect(suggestion.matchedItems?.[0].name).toBeTruthy();
      expect(suggestion.steps.every((step) => step.trim().length > 8)).toBe(true);
    }
  });

  it("makes the sample bank demonstrate actionable cleanup", async () => {
    const result = await organize({ input: SAMPLE_BANKTAGS, includePrices: false });
    const suggestions = generateSuggestions(result.tabs);

    expect(suggestions.some((suggestion) => suggestion.id === "decant-potions")).toBe(true);
    expect(suggestions.some((suggestion) => suggestion.steps.length >= 2)).toBe(true);
  });
});
