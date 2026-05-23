// Banded layouts for Teleports / Clue / Quest / Cosmetic — empty
// separator rows between bands prevent the "wall of sprites" feel.
import { describe, it, expect } from "vitest";
import { organize } from "@/lib/organizer";
import { buildUseCaseTabs } from "@/lib/use-case-tabs";

const GRID_COLS = 8;

// True if the layout has at least one all-empty row before its last
// filled slot (= bands with visual separation).
function hasSeparatorRow(layout: Record<number, number>): boolean {
  const filled = Object.keys(layout).map(Number).sort((a, b) => a - b);
  if (filled.length === 0) return false;
  const occupied = new Set(filled);
  const maxSlot = filled[filled.length - 1];
  for (let row = 0; row * GRID_COLS < maxSlot; row++) {
    const rowSlots = Array.from({ length: GRID_COLS }, (_, c) => row * GRID_COLS + c);
    const empty = rowSlots.every((s) => !occupied.has(s));
    const laterFilled = filled.some((s) => s > row * GRID_COLS + GRID_COLS - 1);
    if (empty && laterFilled) return true;
  }
  return false;
}

// A bank with diverse content across all the banded tabs.
const BANK = [
  // Teleports — charged jewellery, tablets, runes, diary
  2552,    // Ring of dueling(8)
  3853,    // Games necklace(8)
  8013,    // Teleport to house tablet
  556, 555, // Air rune, Water rune
  11136,   // Karamja gloves 4 (diary)
  // Clue — scrolls + rewards
  12109,   // Clue scroll (elite)
  19834,   // Reward casket (elite)
  10330,   // 3rd age longsword (master-tier reward)
  // Quest — keys, weapons, books, wearables
  989,     // Crystal key
  35,      // Excalibur
  3839,    // Book of balance
  // Cosmetic — holiday + 3rd age + graceful
  1038,    // Red partyhat
  10330,   // 3rd age (also in cosmetic if classified)
  11850,   // Graceful hood
  // Padding to clear small-bank threshold
  ...Array.from({ length: 50 }, (_, i) => 1600 + i)
];

describe("banded layouts", () => {
  it("Teleports tab has band separators", async () => {
    const r = await organize({ itemIds: BANK, includePrices: false });
    const tab = buildUseCaseTabs(r.tabs).find((t) => String(t.name) === "Teleports");
    if (!tab || Object.keys(tab.layout).length < 4) return;
    expect(hasSeparatorRow(tab.layout)).toBe(true);
  });

  it("Clue tab has band separators", async () => {
    const r = await organize({ itemIds: BANK, includePrices: false });
    const tab = buildUseCaseTabs(r.tabs).find((t) => String(t.name) === "Clue");
    if (!tab || Object.keys(tab.layout).length < 4) return;
    expect(hasSeparatorRow(tab.layout)).toBe(true);
  });
});
