import { describe, expect, it } from "vitest";
import { refreshSummary } from "@/components/account-refresh-line";

/**
 * The line a player reads after pressing "Check again".
 *
 * The endpoint behind it had been built, public and rate-limited for a while
 * with no caller anywhere in the product. What it says is the whole value, so
 * the copy is tested apart from the fetch.
 */

describe("what changed since last time", () => {
  it("counts in XP, levels and KC — the player's own units", () => {
    expect(refreshSummary({
      since: new Date(Date.now() - 2 * 86_400_000).toISOString(),
      xpGained: 412_000,
      levelsGained: 1,
      levelUps: [{ skill: "attack", from: 83, to: 84 }],
      kcGained: { vardorvis: 23 }
    })).toBe("+412k xp · Attack 84 · Vardorvis +23 since 2 days ago.");
  });

  it("says the first reading is a first reading, never a zero week", () => {
    // `since: null` means unknown. Rendering it as "+0 xp" would report a
    // player's very first visit as a session in which they did nothing.
    const line = refreshSummary({ since: null, xpGained: 0, levelsGained: 0, kcGained: {} });
    expect(line).toContain("First reading");
    expect(line).not.toContain("0 xp");
    expect(line).not.toContain("Nothing moved");
  });

  it("says nothing moved when nothing moved, rather than inventing a clause", () => {
    expect(refreshSummary({
      since: new Date(Date.now() - 86_400_000).toISOString(),
      xpGained: 0, levelsGained: 0, levelUps: [], kcGained: {}
    })).toBe("Nothing moved since yesterday.");
  });

  it("drops clauses that have no number", () => {
    const line = refreshSummary({
      since: new Date(Date.now() - 86_400_000).toISOString(),
      xpGained: 90_000, levelsGained: 0, levelUps: [], kcGained: {}
    });
    expect(line).toBe("+90k xp since yesterday.");
    expect(line).not.toContain("+0");
  });

  it("never prints a number in the wrong unit", () => {
    expect(refreshSummary({
      since: new Date(Date.now() - 86_400_000).toISOString(),
      xpGained: 999_600, kcGained: {}
    })).toContain("+1M xp");
  });

  it("names the skill that levelled, not a count", () => {
    const line = refreshSummary({
      since: new Date(Date.now() - 86_400_000).toISOString(),
      xpGained: 0,
      levelsGained: 2,
      levelUps: [{ skill: "slayer", from: 92, to: 93 }, { skill: "farming", from: 70, to: 71 }],
      kcGained: {}
    });
    expect(line).toContain("Slayer 93");
    expect(line).toContain("Farming 71");
    expect(line).not.toContain("2 levels");
  });
});
