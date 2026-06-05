import { describe, expect, it } from "vitest";
import {
  countBankSearchMatches,
  firstMatchingBankTabIndex,
  bankSearchQueryForItems,
  bankSearchTokens,
  matchesBankSearch
} from "@/lib/bank-search";
import type { OrganizedItem, OrganizedTab } from "@/lib/organizer";

function item(name: string, subtab = "", id = 1): OrganizedItem {
  return {
    id,
    name,
    quantity: 1,
    unitPrice: 0,
    stackValue: 0,
    highalch: 0,
    geLimit: 0,
    subtab,
    slot: null,
    weight: 0
  };
}

function tab(name: string, items: OrganizedItem[]): OrganizedTab {
  return {
    name: name as OrganizedTab["name"],
    iconItemId: 995,
    items,
    layout: {},
    quantity: items.reduce((sum, bankItem) => sum + bankItem.quantity, 0),
    value: items.reduce((sum, bankItem) => sum + bankItem.stackValue, 0)
  };
}

describe("bank search helpers", () => {
  it("builds a multi-token query from matched suggestion items", () => {
    expect(bankSearchQueryForItems([
      { name: "Super attack(1)" },
      { name: "Super attack(3)" },
      { name: "Saradomin brew(2)" }
    ])).toBe("Super attack(1) | Super attack(3) | Saradomin brew(2)");
  });

  it("keeps generated search queries short enough for the input", () => {
    expect(bankSearchQueryForItems([
      { name: "One" },
      { name: "Two" },
      { name: "Three" },
      { name: "Four" },
      { name: "Five" }
    ])).toBe("One | Two | Three | Four");
  });

  it("matches any pipe or comma separated token against item name or subtab", () => {
    expect(bankSearchTokens("whip | karambwan, rune")).toEqual(["whip", "karambwan", "rune"]);
    expect(matchesBankSearch(item("Abyssal whip"), "karambwan | whip")).toBe(true);
    expect(matchesBankSearch(item("Death rune", "Runes"), "potions | runes")).toBe(true);
    expect(matchesBankSearch(item("Coal"), "karambwan | whip")).toBe(false);
  });

  it("matches exact OSRS item IDs without turning normal names into ID searches", () => {
    expect(matchesBankSearch(item("Abyssal whip", "Slash", 4151), "4151")).toBe(true);
    expect(matchesBankSearch(item("Abyssal whip", "Slash", 4151), "#4151")).toBe(true);
    expect(matchesBankSearch(item("Abyssal whip", "Slash", 4151), "item ID 4151")).toBe(true);
    expect(matchesBankSearch(item("Abyssal whip", "Slash", 4151), "4151 11840")).toBe(true);
    expect(matchesBankSearch(item("Dragon boots", "High tier", 11840), "4151 11840")).toBe(true);
    expect(matchesBankSearch(item("Abyssal whip", "Slash", 4151), "dragon 2h")).toBe(false);
    expect(matchesBankSearch(item("Coins", "Currency", 995), "99")).toBe(false);
  });

  it("finds the visible bank tab with the strongest multi-token match", () => {
    const tabs = [
      tab("Combat", [item("Abyssal whip", "", 4151), item("Dragon defender", "", 12954)]),
      tab("Potions", [item("Super attack(1)"), item("Super attack(3)"), item("Saradomin brew(2)")]),
      tab("Runes", [item("Death rune")])
    ];

    expect(countBankSearchMatches(tabs[1], "Super attack(1) | Super attack(3)")).toBe(2);
    expect(countBankSearchMatches(tabs[0], "4151 12954")).toBe(2);
    expect(firstMatchingBankTabIndex(tabs, "#12954")).toBe(0);
    expect(firstMatchingBankTabIndex(tabs, "Super attack(1) | Super attack(3)")).toBe(1);
    expect(firstMatchingBankTabIndex(tabs, "does-not-exist")).toBe(-1);
  });
});
