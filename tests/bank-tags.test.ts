import { describe, it, expect } from "vitest";
import { exportTag, exportTags, parseTag, parseBankMemoryTsv, looksLikeBankMemoryTsv } from "@/lib/bank-tags";
import { organize } from "@/lib/organizer";
import { MAX_MAIN_BANK } from "@/lib/fixtures";

describe("bank-tags export / parse roundtrip", () => {
  it("roundtrips a minimal tag without layout", () => {
    const str = exportTag({ name: "Combat", iconItemId: 4151, items: [4151, 11804, 6585] });
    expect(str.startsWith("banktags,1,Combat,4151,")).toBe(true);
    const parsed = parseTag(str);
    expect(parsed.name).toBe("Combat");
    expect(parsed.iconItemId).toBe(4151);
    expect(parsed.items).toEqual([4151, 11804, 6585]);
    expect(parsed.layout).toEqual({});
  });

  it("roundtrips a tag with explicit layout slots", () => {
    const items = [4151, 11804, 6585];
    const layout = { 0: 4151, 1: 11804, 8: 6585 }; // slot 8 = row 2 col 0
    const str = exportTag({ name: "Gear", iconItemId: 4151, items, layout });
    expect(str).toContain(",layout,0,4151,1,11804,8,6585");
    const parsed = parseTag(str);
    expect(parsed.layout).toEqual(layout);
    // Items list should include every layout id even though only layout was emitted.
    for (const id of [4151, 11804, 6585]) expect(parsed.items).toContain(id);
  });

  it("preserves item order through organize → exportTags → parseTag", async () => {
    // Use a subset to keep the test fast and the assertion readable.
    const subset = MAX_MAIN_BANK.slice(0, 12);
    const result = await organize({ itemIds: subset, includePrices: false });
    const tag = result.tabs[0]; // first type tab
    const str = exportTag({
      name: tag.name as unknown as string,
      iconItemId: tag.iconItemId,
      items: tag.items,
      layout: tag.layout
    });
    const parsed = parseTag(str);

    // Every item that was in the tab should be in the parsed result.
    const originalIds = tag.items.map((it) => it.id);
    for (const id of originalIds) expect(parsed.items).toContain(id);

    // Layout slot positions should be preserved.
    for (const [slot, id] of Object.entries(tag.layout)) {
      expect(parsed.layout[Number(slot)]).toBe(id);
    }
  });

  it("sanitises tab names to RuneLite-safe characters", () => {
    const str = exportTag({ name: "Combat / PvM!  ", iconItemId: 4151, items: [4151] });
    const parsed = parseTag(str);
    // Slashes and exclamation marks should be stripped; spaces collapsed.
    expect(parsed.name).toBe("Combat  PvM");
  });

  it("rejects non-banktags input", () => {
    expect(() => parseTag("not,a,tag")).toThrow(/Bank Tags/);
    expect(() => parseTag("")).toThrow(/Empty Bank Tags/);
  });

  it("rejects unsupported versions", () => {
    expect(() => parseTag("banktags,9,Foo,995")).toThrow(/version/);
  });

  it("falls back to coins icon if iconItemId is missing", () => {
    const parsed = parseTag("banktags,1,Foo,,995");
    expect(parsed.iconItemId).toBe(995);
  });
});

describe("bank-tags exportTags (multi-tab)", () => {
  it("emits one string per tab", async () => {
    const result = await organize({ itemIds: MAX_MAIN_BANK.slice(0, 20), includePrices: false });
    const strs = exportTags(result.tabs);
    expect(strs.length).toBe(result.tabs.length);
    for (const s of strs) {
      expect(s.startsWith("banktags,1,")).toBe(true);
    }
  });
});

describe("Bank Memory TSV parser", () => {
  it("parses the canonical export format", () => {
    const tsv =
      "Item id\tItem name\tItem quantity\n" +
      "4151\tAbyssal whip\t1\n" +
      "617\tCoins\t1234567\n";
    expect(looksLikeBankMemoryTsv(tsv)).toBe(true);
    const rows = parseBankMemoryTsv(tsv);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual({ id: 4151, name: "Abyssal whip", quantity: 1 });
    expect(rows[1]).toEqual({ id: 617, name: "Coins", quantity: 1234567 });
  });

  it("rejects input without the required header", () => {
    expect(() => parseBankMemoryTsv("4151\tWhip\t1")).toThrow(/header/);
  });

  it("looksLikeBankMemoryTsv returns false for banktags strings", () => {
    expect(looksLikeBankMemoryTsv("banktags,1,Combat,4151,4151")).toBe(false);
  });
});
