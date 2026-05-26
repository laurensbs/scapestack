// Fishing methods + plan() sanity tests.
// Beschermt tegen typos in de tabel + invariants in xp-tabel-helper.

import { describe, it, expect } from "vitest";
import { XP_TABLE, xpToLevel, plan } from "@/lib/skill-methods/types";
import { FISHING_METHODS } from "@/lib/skill-methods/fishing";

describe("XP_TABLE", () => {
  it("99 vereist 13M XP", () => {
    expect(XP_TABLE[99]).toBeGreaterThan(13_000_000);
    expect(XP_TABLE[99]).toBeLessThan(14_000_000);
  });

  it("monotonically increasing", () => {
    for (let i = 2; i < 99; i++) {
      expect(XP_TABLE[i]).toBeGreaterThan(XP_TABLE[i - 1]);
    }
  });
});

describe("xpToLevel", () => {
  it("0 wanneer target ≤ current", () => {
    expect(xpToLevel(50, 50)).toBe(0);
    expect(xpToLevel(99, 50)).toBe(0);
  });

  it("1 → 99 = ~13M XP", () => {
    const total = xpToLevel(1, 99);
    expect(total).toBeGreaterThan(13_000_000);
  });

  it("90 → 99 sample", () => {
    const xp = xpToLevel(90, 99);
    expect(xp).toBeGreaterThan(7_500_000);
    expect(xp).toBeLessThan(8_500_000);
  });
});

describe("plan()", () => {
  it("Karambwan van 1 → 99 = ±260 uur", () => {
    const kara = FISHING_METHODS.find((m) => m.id === "karambwan")!;
    const p = plan(kara, 0, 99);
    expect(p.hours).toBeGreaterThan(200);
    expect(p.hours).toBeLessThan(300);
    // Profit positief
    expect(p.netGp).toBeGreaterThan(50_000_000);
  });

  it("Reeds-on-target → 0 uur", () => {
    const sharks = FISHING_METHODS.find((m) => m.id === "shark")!;
    const p = plan(sharks, XP_TABLE[99], 99);
    expect(p.xpRemaining).toBe(0);
    expect(p.hours).toBe(0);
  });

  it("Negatieve gpPerHour → netGp negatief", () => {
    const barb = FISHING_METHODS.find((m) => m.id === "barb_fishing")!;
    const p = plan(barb, XP_TABLE[48], 60);
    expect(p.netGp).toBeLessThan(0);
  });
});

describe("FISHING_METHODS data integrity", () => {
  it("geen duplicate IDs", () => {
    const ids = FISHING_METHODS.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("levelReq ∈ [1, 99]", () => {
    for (const m of FISHING_METHODS) {
      expect(m.levelReq).toBeGreaterThanOrEqual(1);
      expect(m.levelReq).toBeLessThanOrEqual(99);
    }
  });

  it("Fishing zit in trains[] van elke methode", () => {
    for (const m of FISHING_METHODS) {
      expect(m.trains).toContain("Fishing");
    }
  });

  it("xpPerHour > 0 voor alle methodes", () => {
    for (const m of FISHING_METHODS) {
      expect(m.xpPerHour, m.id).toBeGreaterThan(0);
    }
  });

  it("tags zijn van het gedefinieerde set", () => {
    const allowed = new Set(["afk", "intensive", "profit", "loss", "tick-manip"]);
    for (const m of FISHING_METHODS) {
      for (const tag of m.tags) {
        expect(allowed.has(tag)).toBe(true);
      }
    }
  });
});
