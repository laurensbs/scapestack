import { describe, expect, it } from "vitest";
import {
  bankHandoffItemsFromBankItems,
  bankHandoffItemsFromTabs,
  clearBankHandoffPayload,
  createBankHandoffPayload,
  createBankHandoffPayloadFromItems,
  NEXT_BANK_HANDOFF_TTL_MS,
  NEXT_BANK_HANDOFF_KEY,
  nextUpBankFromHandoff,
  normalizeBankHandoffItems,
  organizedItemsFromHandoff,
  parseBankHandoffPayload,
  persistBankHandoffPayloadFromItems,
  persistSerializedBankHandoff,
  readBankHandoffPayload,
  serializeBankHandoffPayload,
  serializeBankHandoffPayloadFromItems,
  summarizeBankHandoff
} from "@/lib/next-bank-handoff";
import type { OrganizedTab } from "@/lib/organizer";

describe("next bank handoff", () => {
  it("creates handoff context from simple next-up bank items", () => {
    expect(bankHandoffItemsFromBankItems([
      { id: 4151, name: "Abyssal whip" },
      { id: 11832, name: "Bandos chestplate" }
    ], "Demo")).toEqual([
      expect.objectContaining({
        id: 4151,
        name: "Abyssal whip",
        quantity: 1,
        stackValue: 0,
        subtab: "Demo",
        slot: null,
        weight: 0
      }),
      expect.objectContaining({
        id: 11832,
        name: "Bandos chestplate",
        weight: 1
      })
    ]);
  });

  it("serializes full bank item context from organized tabs", () => {
    const tabs: OrganizedTab[] = [{
      name: "Combat",
      iconItemId: 4151,
      quantity: 3,
      value: 5_100_000,
      layout: { 0: 4151 },
      items: [{
        id: 4151,
        name: "Abyssal whip",
        quantity: 3,
        unitPrice: 1_700_000,
        stackValue: 5_100_000,
        highalch: 72_000,
        geLimit: 70,
        subtab: "Melee",
        slot: "weapon",
        weight: 12
      }]
    }];

    expect(bankHandoffItemsFromTabs(tabs)).toEqual([{
      id: 4151,
      name: "Abyssal whip",
      quantity: 3,
      unitPrice: 1_700_000,
      stackValue: 5_100_000,
      highalch: 72_000,
      geLimit: 70,
      subtab: "Melee",
      slot: "weapon",
      weight: 12
    }]);
  });

  it("wraps handoff items in a fresh versioned payload", () => {
    const tabs: OrganizedTab[] = [{
      name: "Combat",
      iconItemId: 4151,
      quantity: 1,
      value: 1_700_000,
      layout: { 0: 4151 },
      items: [{
        id: 4151,
        name: "Abyssal whip",
        quantity: 1,
        unitPrice: 1_700_000,
        stackValue: 1_700_000,
        subtab: "Melee",
        slot: "weapon",
        weight: 1
      }]
    }];

    const payload = createBankHandoffPayload(tabs, 1_780_000_000_000);

    expect(payload).toMatchObject({
      v: 1,
      createdAt: 1_780_000_000_000,
      items: [expect.objectContaining({ id: 4151, name: "Abyssal whip" })]
    });
  });

  it("serializes organized tabs into parseable storage JSON", () => {
    const tabs: OrganizedTab[] = [{
      name: "Magic",
      iconItemId: 6914,
      quantity: 1,
      value: 2_500_000,
      layout: {},
      items: [{
        id: 6914,
        name: "Master wand",
        quantity: 1,
        unitPrice: 2_500_000,
        stackValue: 2_500_000,
        subtab: "Magic",
        slot: "weapon",
        weight: 2
      }]
    }];

    const raw = serializeBankHandoffPayload(tabs, 1_780_000_000_500);
    const parsed = parseBankHandoffPayload(raw, 1_780_000_000_501);

    expect(JSON.parse(raw)).toMatchObject({ v: 1, createdAt: 1_780_000_000_500 });
    expect(parsed).toEqual([expect.objectContaining({ id: 6914, name: "Master wand" })]);
  });

  it("wraps already-normalized handoff items for cross-tool handoff", () => {
    const payload = createBankHandoffPayloadFromItems(normalizeBankHandoffItems([
      { id: 4151, name: "Abyssal whip", quantity: 1, subtab: "Melee", slot: "weapon" },
      { id: "bad", name: "Ignored" }
    ]), 1_780_000_000_123);

    expect(payload).toEqual({
      v: 1,
      createdAt: 1_780_000_000_123,
      items: [expect.objectContaining({
        id: 4151,
        name: "Abyssal whip",
        quantity: 1,
        subtab: "Melee",
        slot: "weapon"
      })]
    });
  });

  it("serializes normalized handoff items into parseable storage JSON", () => {
    const raw = serializeBankHandoffPayloadFromItems(normalizeBankHandoffItems([
      { id: 12924, name: "Toxic blowpipe", quantity: 1, subtab: "Ranged", slot: "weapon" }
    ]), 1_780_000_001_000);

    expect(parseBankHandoffPayload(raw, 1_780_000_001_001)).toEqual([
      expect.objectContaining({ id: 12924, name: "Toxic blowpipe", subtab: "Ranged" })
    ]);
  });

  it("persists serialized handoff to both browser storage layers", () => {
    const calls: string[] = [];
    const target = {
      sessionStorage: { setItem: (key: string, value: string) => calls.push(`session:${key}:${value}`) },
      localStorage: { setItem: (key: string, value: string) => calls.push(`local:${key}:${value}`) }
    };

    expect(persistSerializedBankHandoff("payload", target)).toBe(true);
    expect(calls).toEqual([
      `session:${NEXT_BANK_HANDOFF_KEY}:payload`,
      `local:${NEXT_BANK_HANDOFF_KEY}:payload`
    ]);
  });

  it("keeps persisting when one storage layer fails", () => {
    let storedKey = "";
    let storedValue = "";
    const target = {
      sessionStorage: { setItem: () => { throw new Error("blocked"); } },
      localStorage: { setItem: (key: string, value: string) => { storedKey = key; storedValue = value; } }
    };

    expect(persistBankHandoffPayloadFromItems(normalizeBankHandoffItems([
      { id: 11832, name: "Bandos chestplate", quantity: 1, subtab: "Melee", slot: "body" }
    ]), target, 1_780_000_002_000)).toBe(true);
    expect(storedKey).toBe(NEXT_BANK_HANDOFF_KEY);
    expect(parseBankHandoffPayload(storedValue, 1_780_000_002_001))
      .toEqual([expect.objectContaining({ id: 11832, name: "Bandos chestplate" })]);
  });

  it("clears serialized handoff from both browser storage layers", () => {
    const calls: string[] = [];
    const target = {
      sessionStorage: { removeItem: (key: string) => calls.push(`session:${key}`) },
      localStorage: { removeItem: (key: string) => calls.push(`local:${key}`) }
    };

    expect(clearBankHandoffPayload(target)).toBe(true);
    expect(calls).toEqual([
      `session:${NEXT_BANK_HANDOFF_KEY}`,
      `local:${NEXT_BANK_HANDOFF_KEY}`
    ]);
  });

  it("keeps clearing when one storage layer fails", () => {
    let clearedKey = "";
    const target = {
      sessionStorage: { removeItem: () => { throw new Error("blocked"); } },
      localStorage: { removeItem: (key: string) => { clearedKey = key; } }
    };

    expect(clearBankHandoffPayload(target)).toBe(true);
    expect(clearedKey).toBe(NEXT_BANK_HANDOFF_KEY);
  });

  it("reads fresh handoff from localStorage when sessionStorage is stale", () => {
    const stale = serializeBankHandoffPayloadFromItems(normalizeBankHandoffItems([
      { id: 11806, name: "Saradomin godsword", quantity: 1 }
    ]), 1_000);
    const fresh = serializeBankHandoffPayloadFromItems(normalizeBankHandoffItems([
      { id: 11804, name: "Bandos godsword", quantity: 1 }
    ]), 2_000);

    const items = readBankHandoffPayload({
      sessionStorage: { getItem: () => stale },
      localStorage: { getItem: () => fresh }
    }, 2_001, 100);

    expect(items).toEqual([expect.objectContaining({ id: 11804, name: "Bandos godsword" })]);
  });

  it("continues reading when sessionStorage throws", () => {
    const fresh = serializeBankHandoffPayloadFromItems(normalizeBankHandoffItems([
      { id: 12924, name: "Toxic blowpipe", quantity: 1 }
    ]), 2_000);

    const items = readBankHandoffPayload({
      sessionStorage: { getItem: () => { throw new Error("blocked"); } },
      localStorage: { getItem: () => fresh }
    }, 2_000);

    expect(items).toEqual([expect.objectContaining({ id: 12924, name: "Toxic blowpipe" })]);
  });

  it("parses fresh payloads and ignores stale localStorage fallbacks", () => {
    const fresh = JSON.stringify({
      v: 1,
      createdAt: 1_000,
      items: [{ id: 11804, name: "Bandos godsword", quantity: 1, stackValue: 20_000_000 }]
    });
    const stale = JSON.stringify({
      v: 1,
      createdAt: 1_000,
      items: [{ id: 11806, name: "Saradomin godsword", quantity: 1, stackValue: 28_000_000 }]
    });

    expect(parseBankHandoffPayload(fresh, 1_000 + NEXT_BANK_HANDOFF_TTL_MS)).toHaveLength(1);
    expect(parseBankHandoffPayload(stale, 1_001 + NEXT_BANK_HANDOFF_TTL_MS)).toEqual([]);
  });

  it("still accepts legacy array handoff payloads", () => {
    const legacy = JSON.stringify([
      { id: 995, name: "Coins", quantity: 1_000_000, unitPrice: 1, stackValue: 1_000_000 }
    ]);

    expect(parseBankHandoffPayload(legacy, 10_000)).toEqual([
      expect.objectContaining({ id: 995, name: "Coins", quantity: 1_000_000 })
    ]);
  });

  it("normalizes malformed session payloads defensively", () => {
    const items = normalizeBankHandoffItems([
      { id: "-995", name: " Coins ", quantity: "1000", unitPrice: "1", stackValue: "1000", slot: "" },
      { id: "bad", name: "Ignored" },
      { id: 4151, quantity: -2 }
    ]);

    expect(items).toEqual([
      expect.objectContaining({
        id: 995,
        name: "Coins",
        quantity: 1000,
        unitPrice: 1,
        stackValue: 1000,
        subtab: "Bank handoff",
        slot: null
      }),
      expect.objectContaining({
        id: 4151,
        name: "#4151",
        quantity: 2
      })
    ]);
  });

  it("keeps organized shape for owned gear and dedupes next-up bank input", () => {
    const handoff = normalizeBankHandoffItems([
      { id: 4151, name: "Abyssal whip", quantity: 1, subtab: "Melee", slot: "weapon" },
      { id: 4151, name: "Abyssal whip", quantity: 2, subtab: "Duplicate", slot: "weapon" },
      { id: 11832, name: "Bandos chestplate", quantity: 1, subtab: "Melee", slot: "body" }
    ]);

    expect(nextUpBankFromHandoff(handoff)).toEqual([
      { id: 4151, name: "Abyssal whip", quantity: 3 },
      { id: 11832, name: "Bandos chestplate", quantity: 1 }
    ]);
    expect(organizedItemsFromHandoff(handoff)[0]).toMatchObject({
      id: 4151,
      name: "Abyssal whip",
      quantity: 1,
      subtab: "Melee",
      slot: "weapon"
    });
  });

  it("summarizes handoff value and top stacks for the next banner", () => {
    const summary = summarizeBankHandoff(normalizeBankHandoffItems([
      { id: 11806, name: "Saradomin godsword", quantity: 1, stackValue: 28_780_000 },
      { id: 11804, name: "Bandos godsword", quantity: 1, stackValue: 20_000_000 },
      { id: 995, name: "Coins", quantity: 1_000_000, unitPrice: 1, stackValue: 1_000_000 },
      { id: 4151, name: "Abyssal whip", quantity: 1, stackValue: 0 }
    ]));

    expect(summary).toMatchObject({
      itemCount: 4,
      totalValue: 49_780_000,
      pricedItems: 3,
      label: "4 items · 49.78M gp"
    });
    expect(summary.topItems.map((item) => item.name)).toEqual([
      "Saradomin godsword",
      "Bandos godsword",
      "Coins"
    ]);
  });
});
