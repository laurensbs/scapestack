import { describe, expect, it } from "vitest";
import { buildItemVerdict, wikiPriceUrl } from "@/lib/item-action";

const base = {
  name: "Abyssal whip",
  quantity: 1,
  unitPrice: 1_700_000,
  stackValue: 1_700_000,
  highalch: 72_000,
  geLimit: 70,
  isJunk: false,
  isStale: false,
  goalCount: 0
};

describe("item action verdicts", () => {
  it("builds Wiki price URLs from safe absolute item IDs", () => {
    expect(wikiPriceUrl(4151)).toBe("https://prices.runescape.wiki/osrs/item/4151");
    expect(wikiPriceUrl(-995)).toBe("https://prices.runescape.wiki/osrs/item/995");
    expect(wikiPriceUrl(Number.NaN)).toBe("https://prices.runescape.wiki/osrs/item/995");
  });

  it("keeps active goal items ahead of cleanup signals", () => {
    const verdict = buildItemVerdict({
      ...base,
      name: "Barrows gloves",
      isJunk: true,
      goalCount: 2
    });

    expect(verdict.tone).toBe("keep");
    expect(verdict.title).toContain("active goal");
    expect(verdict.body).toContain("2 tracked goals");
  });

  it("flags junk as a cleanup candidate", () => {
    const verdict = buildItemVerdict({
      ...base,
      name: "Empty vial",
      unitPrice: 2,
      stackValue: 200,
      highalch: 0,
      geLimit: 0,
      isJunk: true
    });

    expect(verdict.tone).toBe("sell");
    expect(verdict.title).toBe("Cleanup candidate");
    expect(verdict.bullets.join(" ")).toContain("Re-run Smart tidy");
  });

  it("prioritizes high-alch profit when it beats GE materially", () => {
    const verdict = buildItemVerdict({
      ...base,
      name: "Rune platebody",
      unitPrice: 37_000,
      stackValue: 37_000,
      highalch: 39_000
    });

    expect(verdict.tone).toBe("sell");
    expect(verdict.title).toBe("High-alch beats GE");
    expect(verdict.body).toContain("2K gp");
  });

  it("marks valuable stale stacks for review", () => {
    const verdict = buildItemVerdict({
      ...base,
      stackValue: 12_000_000,
      isStale: true
    });

    expect(verdict.tone).toBe("review");
    expect(verdict.title).toBe("Valuable but stale");
  });
});
