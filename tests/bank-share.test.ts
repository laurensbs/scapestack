import { describe, expect, it } from "vitest";
import {
  bankSharePath,
  buildBankShareSnapshot,
  parseBankShareSnapshot,
  validBankShareId
} from "@/lib/bank-share";
import type { AffordabilityReport, AffordableSet } from "@/lib/bank-affordability";

const bought: AffordableSet = {
  setId: "ahrims",
  setName: "Ahrim's set",
  owned: 2,
  total: 4,
  missing: [
    { goalId: "hood", name: "Ahrim's hood", price: 420_123, tradeable: true },
    { goalId: "staff", name: "Ahrim's staff", price: 1_420_000, tradeable: true }
  ],
  cost: 1_840_123,
  affordable: true,
  remainingGp: 10_159_877
};

const short: AffordableSet = {
  setId: "bandos",
  setName: "Bandos set",
  owned: 1,
  total: 3,
  missing: [{ goalId: "chestplate", name: "Bandos chestplate", price: 15_000_000, tradeable: true }],
  cost: 15_000_000,
  affordable: false,
  remainingGp: -3_000_000
};

function report(overrides: Partial<AffordabilityReport> = {}): AffordabilityReport {
  return {
    gp: 12_000_000,
    pricesUnavailable: false,
    buyableNow: [bought],
    shortBy: [short],
    notForSale: [],
    ...overrides
  };
}

describe("bank affordability share snapshots", () => {
  it("freezes exact real-number rows without retaining the raw bank", () => {
    const snapshot = buildBankShareSnapshot({
      displayName: "Lynx Titan",
      report: report(),
      sourceSyncedAt: "2026-07-30T10:00:00.000Z",
      pricedAt: "2026-07-30T10:01:00.000Z"
    });

    expect(snapshot).toEqual({
      version: 1,
      displayName: "Lynx Titan",
      gp: 12_000_000,
      rows: [
        {
          setName: "Ahrim's set",
          owned: 2,
          total: 4,
          missing: ["Ahrim's hood", "Ahrim's staff"],
          cost: 1_840_123,
          verdict: "Buy now",
          gate: "ready"
        },
        {
          setName: "Bandos set",
          owned: 1,
          total: 3,
          missing: ["Bandos chestplate"],
          cost: 15_000_000,
          verdict: "Short 3,000,000 gp",
          gate: "test"
        }
      ],
      sourceSyncedAt: "2026-07-30T10:00:00.000Z",
      pricedAt: "2026-07-30T10:01:00.000Z"
    });
    expect(JSON.stringify(snapshot)).not.toMatch(/bankItems|itemId|quantity/);
    expect(parseBankShareSnapshot(snapshot)).toEqual(snapshot);
  });

  it("refuses to make a card from missing prices or an empty answer", () => {
    const input = {
      displayName: "Lynx Titan",
      sourceSyncedAt: "2026-07-30T10:00:00.000Z",
      pricedAt: "2026-07-30T10:01:00.000Z"
    };
    expect(buildBankShareSnapshot({ ...input, report: report({ pricesUnavailable: true }) })).toBeNull();
    expect(buildBankShareSnapshot({ ...input, report: report({ buyableNow: [], shortBy: [] }) })).toBeNull();
  });

  it("uses an opaque path with no item names or query string", () => {
    const shareId = "AbCdEfGhIjKlMnOpQrStUvWx";
    expect(validBankShareId(shareId)).toBe(true);
    expect(bankSharePath(shareId)).toBe(`/share/bank/${shareId}`);
    expect(bankSharePath("Ahrims?items=hood,staff")).toBeNull();
    expect(bankSharePath(shareId)).not.toContain("?");
  });
});
