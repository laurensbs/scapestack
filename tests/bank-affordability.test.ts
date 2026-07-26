import { describe, expect, it } from "vitest";
import {
  affordabilityLine,
  buildAffordabilityReport,
  coinsIn,
  formatGpExact,
  tradeableIndex
} from "@/lib/bank-affordability";
import type { GoalSet } from "@/lib/goals";
import type { WikiLatestPrice } from "@/lib/wiki";

/**
 * The claim under test is a money claim about a real account, so every branch
 * that could overstate gets its own case. Being wrong about a kill time costs
 * a trip; being wrong about "you can afford this" costs the player's evening
 * and the site's credibility in one move.
 */

const price = (high: number): WikiLatestPrice =>
  ({ high, low: Math.round(high * 0.98), highTime: 0, lowTime: 0 } as unknown as WikiLatestPrice);

const prices = new Map<number, WikiLatestPrice>([
  [4708, price(1_000_000)],   // Ahrim's hood
  [4712, price(840_000)],     // Ahrim's robetop
  [4714, price(600_000)],     // Ahrim's robeskirt
  [4710, price(2_500_000)]    // Ahrim's staff
]);

const AHRIMS: GoalSet = {
  id: "ahrims",
  name: "Ahrim's set",
  category: "barrows",
  goals: [
    { id: "ahrim-hood", name: "Ahrim's hood", itemIds: [4708] },
    { id: "ahrim-top", name: "Ahrim's robetop", itemIds: [4712] },
    { id: "ahrim-skirt", name: "Ahrim's robeskirt", itemIds: [4714] },
    { id: "ahrim-staff", name: "Ahrim's staff", itemIds: [4710] }
  ]
};

/** A set with an untradeable in the gap: money cannot finish it. */
const MIXED: GoalSet = {
  id: "mixed",
  name: "Mixed set",
  category: "misc-untradeable",
  goals: [
    { id: "have-it", name: "Ahrim's hood", itemIds: [4708] },
    { id: "buyable", name: "Ahrim's robetop", itemIds: [4712] },
    { id: "earned", name: "Fire cape", namePattern: /^fire cape/i }
  ]
};

const coins = (amount: number) => ({ id: 995, name: "Coins", quantity: amount });

/**
 * The tradeable universe, as the Grand Exchange mapping would give it.
 * Fire cape is deliberately absent — that absence IS how the module learns it
 * cannot be bought, so the fixture has to model it rather than assert it.
 */
const TRADEABLE = tradeableIndex(new Map([
  [4708, { id: 4708, name: "Ahrim's hood" }],
  [4712, { id: 4712, name: "Ahrim's robetop" }],
  [4714, { id: 4714, name: "Ahrim's robeskirt" }],
  [4710, { id: 4710, name: "Ahrim's staff" }]
]));

describe("what the bank can actually finish tonight", () => {
  it("prices only the gap, not the set", () => {
    const report = buildAffordabilityReport(
      [coins(2_000_000), { id: 4708, name: "Ahrim's hood" }, { id: 4710, name: "Ahrim's staff" }],
      prices, TRADEABLE,
      [AHRIMS]
    );
    const row = report.buyableNow[0];
    expect(row?.setName).toBe("Ahrim's set");
    expect(row?.owned).toBe(2);
    // robetop 840k + robeskirt 600k. The hood and staff are already owned and
    // must not be charged for — that is the whole difference between this and
    // a price checker.
    expect(row?.cost).toBe(1_440_000);
    expect(row?.remainingGp).toBe(560_000);
  });

  it("says short rather than affordable when the coins do not cover it", () => {
    const report = buildAffordabilityReport(
      [coins(1_000_000), { id: 4708, name: "Ahrim's hood" }, { id: 4710, name: "Ahrim's staff" }],
      prices, TRADEABLE,
      [AHRIMS]
    );
    expect(report.buyableNow).toHaveLength(0);
    expect(report.shortBy[0]?.cost).toBe(1_440_000);
    expect(report.shortBy[0]?.affordable).toBe(false);
    expect(affordabilityLine(report)).toBeNull();
  });

  it("refuses to price a gap containing something that cannot be bought", () => {
    const report = buildAffordabilityReport(
      [coins(999_999_999), { id: 4708, name: "Ahrim's hood" }],
      prices, TRADEABLE,
      [MIXED]
    );
    // A billion GP does not buy a Fire cape. Claiming "affordable" here would
    // be the single most damaging sentence this feature could print.
    expect(report.buyableNow).toHaveLength(0);
    expect(report.notForSale[0]?.cost).toBeNull();
    expect(report.notForSale[0]?.affordable).toBeNull();
    expect(report.notForSale[0]?.missing.find((piece) => piece.goalId === "earned")?.tradeable).toBe(false);
  });

  it("claims nothing at all when the price feed is down", () => {
    const report = buildAffordabilityReport(
      [coins(50_000_000), { id: 4708, name: "Ahrim's hood" }],
      new Map(), TRADEABLE,
      [AHRIMS]
    );
    expect(report.pricesUnavailable).toBe(true);
    expect(report.buyableNow).toHaveLength(0);
    expect(affordabilityLine(report)).toBeNull();
  });

  it("quotes the insta-buy side, because that is what the player will pay", () => {
    const report = buildAffordabilityReport(
      [coins(10_000_000), { id: 4708, name: "Ahrim's hood" }, { id: 4710, name: "Ahrim's staff" }],
      prices, TRADEABLE,
      [AHRIMS]
    );
    // low would be 0.98x and would understate every gap on the page.
    expect(report.buyableNow[0]?.cost).toBe(840_000 + 600_000);
    expect(report.buyableNow[0]?.cost).not.toBe(Math.round(840_000 * 0.98) + Math.round(600_000 * 0.98));
  });

  it("ignores sets the player has not started and sets they have finished", () => {
    const nothing = buildAffordabilityReport([coins(50_000_000)], prices, TRADEABLE, [AHRIMS]);
    expect(nothing.buyableNow).toHaveLength(0);
    expect(nothing.shortBy).toHaveLength(0);

    const done = buildAffordabilityReport(
      [coins(50_000_000),
        { id: 4708, name: "Ahrim's hood" }, { id: 4712, name: "Ahrim's robetop" },
        { id: 4714, name: "Ahrim's robeskirt" }, { id: 4710, name: "Ahrim's staff" }],
      prices, TRADEABLE, [AHRIMS]
    );
    expect(done.buyableNow).toHaveLength(0);
  });

  it("ranks closest-to-done ahead of merely cheapest", () => {
    const cheapFarAway: GoalSet = {
      id: "cheap", name: "Cheap set", category: "barrows",
      goals: [
        { id: "c1", name: "Ahrim's hood", itemIds: [4708] },
        { id: "c2", name: "Ahrim's robetop", itemIds: [4712] },
        { id: "c3", name: "Ahrim's robeskirt", itemIds: [4714] }
      ]
    };
    const report = buildAffordabilityReport(
      [coins(500_000_000),
        // one piece off Ahrim's, two pieces off the cheap set
        { id: 4708, name: "Ahrim's hood" }, { id: 4712, name: "Ahrim's robetop" }, { id: 4714, name: "Ahrim's robeskirt" }],
      prices, TRADEABLE,
      [AHRIMS, cheapFarAway]
    );
    expect(report.buyableNow[0]?.setId).toBe("ahrims");
    expect(report.buyableNow[0]?.missing).toHaveLength(1);
  });

  it("writes the sentence the way a player would say it", () => {
    const report = buildAffordabilityReport(
      [coins(14_500_000), { id: 4708, name: "Ahrim's hood" }, { id: 4710, name: "Ahrim's staff" }],
      prices, TRADEABLE,
      [AHRIMS]
    );
    const line = affordabilityLine(report);
    expect(line).toBe(
      "14,500,000 gp banked. Ahrim's robetop and Ahrim's robeskirt — 1,440,000 gp. That finishes Ahrim's set."
    );
    // The exact figure, not a rounded headline: this number gets typed into
    // the Grand Exchange.
    expect(line).not.toContain("1.44M");
  });

  it("does not print how far you are from something forty times your bank", () => {
    // Measured on a real 42m bank before this filter existed: the panel said
    // "CoX uniques — Short 1,740,331,472 gp". That is arithmetic performed at
    // the player, not information.
    const outOfReach: GoalSet = {
      id: "faraway", name: "Faraway set", category: "raid-uniques",
      goals: [
        { id: "f1", name: "Ahrim's hood", itemIds: [4708] },
        { id: "f2", name: "Ahrim's staff", itemIds: [4710] }
      ]
    };
    // Owns the hood, 100k banked, the staff costs 2.5m — 25x the bank.
    const far = buildAffordabilityReport(
      [coins(100_000), { id: 4708, name: "Ahrim's hood" }], prices, TRADEABLE, [outOfReach]
    );
    expect(far.shortBy).toHaveLength(0);

    // Same set, 1m banked: the 2.5m staff is 2.5x, inside the line, and worth
    // aiming at. Without this half the filter could be "hide everything".
    const near = buildAffordabilityReport(
      [coins(1_000_000), { id: 4708, name: "Ahrim's hood" }], prices, TRADEABLE, [outOfReach]
    );
    expect(near.shortBy).toHaveLength(1);
    expect(near.shortBy[0]?.cost).toBe(2_500_000);
  });

  it("reads coins out of the bank rather than assuming zero", () => {
    expect(coinsIn([coins(1_234)])).toBe(1_234);
    expect(coinsIn([{ id: 995, name: "Coins" }])).toBe(0);
    expect(coinsIn([{ id: 4151, name: "Abyssal whip", quantity: 1 }])).toBe(0);
    expect(formatGpExact(1_843_201)).toBe("1,843,201 gp");
  });
});
