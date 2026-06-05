import { describe, expect, it } from "vitest";
import { parseLatestPrices, parseWikiMapping, wikiSearchUrl } from "@/lib/wiki";

describe("wiki data service", () => {
  it("builds safe OSRS Wiki search URLs", () => {
    expect(wikiSearchUrl("Karamja Diary — Hard")).toBe(
      "https://oldschool.runescape.wiki/w/Special:Search?search=Karamja%20Diary%20%E2%80%94%20Hard"
    );
  });

  it("parses item mapping rows", () => {
    const mapping = parseWikiMapping([{
      id: 4151,
      name: "Abyssal whip",
      examine: "A weapon from the abyss.",
      members: true,
      limit: 70,
      highalch: 72000,
      lowalch: 48000,
      icon: "Abyssal whip.png"
    }]);

    expect(mapping.get(4151)).toMatchObject({
      name: "Abyssal whip",
      members: true,
      limit: 70,
      highalch: 72000
    });
  });

  it("parses latest prices and uses the strongest available price", () => {
    const prices = parseLatestPrices({
      "4151": { high: 1_700_000, low: 1_650_000, highTime: 1, lowTime: 2 },
      "995": { low: 1, lowTime: 3 },
      bad: { high: 100 }
    });

    expect(prices.get(4151)?.value).toBe(1_700_000);
    expect(prices.get(995)?.value).toBe(1);
    expect(prices.has(Number.NaN)).toBe(false);
  });
});
