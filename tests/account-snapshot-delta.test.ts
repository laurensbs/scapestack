import { describe, expect, it } from "vitest";
import { compareAccountSnapshots, type ComparableAccountSnapshot, type SnapshotAvailability } from "@/lib/account-snapshot-delta";
import type { ImmutableSnapshotState } from "@/lib/account-history";

const AVAILABLE: SnapshotAvailability = {
  skills: "available",
  quests: "available",
  diaries: "available",
  collectionLog: "available",
  bossKc: "available",
  slayer: "available",
  bank: "available"
};

function state(overrides: Partial<ImmutableSnapshotState> = {}): ImmutableSnapshotState {
  return {
    accountType: "normal",
    skills: [{ name: "Cooking", level: 80, xp: 2_000_000 }],
    questsCompleted: ["Cook's Assistant"],
    diariesCompleted: [{ region: "Karamja", tier: "Easy" }],
    collectionLogItemIds: [100],
    bossKc: { Vorkath: 48 },
    bankItems: [
      { id: 331, name: "Raw salmon", quantity: 500 },
      { id: 995, name: "Coins", quantity: 1_000_000 }
    ],
    bankStatus: { enabled: true, itemCount: 2, capturedAt: "2026-07-15T10:00:00Z", unavailableReason: null },
    slayer: { points: 100, streak: 10, taskRemaining: 80, currentTaskId: 42, blocks: [] },
    availability: AVAILABLE,
    ...overrides
  };
}

function snapshot(checksum: string, capturedAt: string, overrides: Partial<ImmutableSnapshotState> = {}): ComparableAccountSnapshot {
  return { checksum, capturedAt, state: state(overrides) };
}

describe("typed account snapshot delta", () => {
  it("treats a first sync as a baseline instead of invented progress", () => {
    const current = snapshot("a".repeat(64), "2026-07-15T12:00:00Z");
    const delta = compareAccountSnapshots(null, current, { now: Date.parse("2026-07-15T12:01:00Z") });

    expect(delta.kind).toBe("first-sync");
    expect(delta.fromChecksum).toBeNull();
    expect(delta.elapsedSeconds).toBeNull();
    expect(delta.totalXp).toEqual({ status: "unknown", movement: null });
    expect(delta.facts).toEqual([]);
  });

  it("returns a stable unchanged delta for identical snapshots", () => {
    const before = snapshot("a".repeat(64), "2026-07-15T10:00:00Z");
    const after = snapshot("a".repeat(64), "2026-07-15T11:00:00Z");
    const first = compareAccountSnapshots(before, after, { now: Date.parse("2026-07-15T11:10:00Z") });
    const repeated = compareAccountSnapshots(before, after, { now: Date.parse("2026-07-15T11:20:00Z") });

    expect(first.kind).toBe("unchanged");
    expect(first.elapsedSeconds).toBe(3600);
    expect(first.facts).toEqual([]);
    expect(repeated.deltaId).toBe(first.deltaId);
  });

  it("keeps missing fields from an old payload unknown instead of zero", () => {
    const before = snapshot("a".repeat(64), "2026-07-15T10:00:00Z", {
      skills: [],
      bossKc: null,
      slayer: null,
      bankItems: [],
      bankStatus: { enabled: false, itemCount: 0, capturedAt: null, unavailableReason: "opt-in-off" },
      availability: {
        ...AVAILABLE,
        skills: "unknown",
        bossKc: "unknown",
        slayer: "unknown",
        bank: "unavailable"
      }
    });
    const after = snapshot("b".repeat(64), "2026-07-15T11:00:00Z");
    const delta = compareAccountSnapshots(before, after);

    expect(delta.totalXp.status).toBe("unknown");
    expect(delta.skills).toEqual([]);
    expect(delta.bossKc).toEqual([]);
    expect(delta.slayer.status).toBe("unknown");
    expect(delta.bank.status).toBe("unavailable");
    expect(delta.bank.removed).toEqual([]);
  });

  it("computes XP, unlocks, KC, Slayer and privacy-capped bank movement", () => {
    const before = snapshot("a".repeat(64), "2026-07-15T10:00:00Z");
    const after = snapshot("b".repeat(64), "2026-07-15T12:00:00Z", {
      skills: [{ name: "Cooking", level: 81, xp: 2_250_000 }],
      questsCompleted: ["Cook's Assistant", "Dragon Slayer II"],
      diariesCompleted: [{ region: "Karamja", tier: "Easy" }, { region: "Karamja", tier: "Medium" }],
      collectionLogItemIds: [100, 200],
      bossKc: { Vorkath: 52 },
      bankItems: [
        { id: 331, name: "Raw salmon", quantity: 300 },
        { id: 385, name: "Shark", quantity: 100 }
      ],
      slayer: { points: 115, streak: 11, taskRemaining: 0, currentTaskId: 0, blocks: [] }
    });
    const delta = compareAccountSnapshots(before, after, { now: Date.parse("2026-07-15T12:05:00Z") });

    expect(delta).toMatchObject({
      kind: "changed",
      elapsedSeconds: 7200,
      freshness: "fresh",
      totalXp: { status: "changed", movement: { delta: 250_000 } },
      quests: { status: "changed", added: ["Dragon Slayer II"], removed: [] },
      diaries: { status: "changed", added: [{ region: "Karamja", tier: "Medium" }] },
      collectionLog: { status: "changed", added: [200] },
      slayer: { status: "changed", points: { delta: 15 }, streak: { delta: 1 } },
      bank: { status: "changed", totalChangedItems: 3, truncated: false }
    });
    expect(delta.skills[0]).toMatchObject({ status: "changed", level: { delta: 1 }, xp: { delta: 250_000 } });
    expect(delta.bossKc).toContainEqual(expect.objectContaining({ boss: "Vorkath", status: "changed", movement: expect.objectContaining({ delta: 4 }) }));
    expect(delta.bank.added).toContainEqual(expect.objectContaining({ id: 385, delta: 100 }));
    expect(delta.bank.removed).toContainEqual(expect.objectContaining({ id: 995, delta: -1_000_000 }));
    expect(delta.bank.quantityChanged).toContainEqual(expect.objectContaining({ id: 331, delta: -200 }));
    expect(delta.facts).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: "xp", key: "Cooking", amount: 250_000 }),
      expect.objectContaining({ kind: "boss-kc", key: "Vorkath", amount: 4 }),
      expect.objectContaining({ kind: "quest", key: "Dragon Slayer II" })
    ]));
    expect(delta.facts.every((fact) => typeof fact.kind === "string" && typeof fact.key === "string")).toBe(true);
  });

  it("marks stale scans and impossible negative progress honestly", () => {
    const before = snapshot("a".repeat(64), "2026-07-01T10:00:00Z");
    const after = snapshot("b".repeat(64), "2026-07-02T10:00:00Z", {
      skills: [{ name: "Cooking", level: 79, xp: 1_900_000 }],
      questsCompleted: [],
      bossKc: { Vorkath: 40 }
    });
    const delta = compareAccountSnapshots(before, after, { now: Date.parse("2026-07-15T10:00:00Z") });

    expect(delta.freshness).toBe("stale");
    expect(delta.totalXp).toMatchObject({ status: "regressed", movement: { delta: -100_000, confidence: "source-regression" } });
    expect(delta.skills[0]).toMatchObject({ status: "regressed", level: { delta: -1 }, xp: { delta: -100_000 } });
    expect(delta.quests).toMatchObject({ status: "regressed", removed: ["Cook's Assistant"] });
    expect(delta.bossKc[0]).toMatchObject({ status: "regressed", movement: { delta: -8, confidence: "source-regression" } });
    expect(delta.facts.some((fact) => fact.kind === "xp" && (fact.amount ?? 0) < 0)).toBe(false);
  });

  it("caps retained bank mutations without losing the total change count", () => {
    const before = snapshot("a".repeat(64), "2026-07-15T10:00:00Z", {
      bankItems: [],
      bankStatus: { enabled: true, itemCount: 0, capturedAt: "2026-07-15T10:00:00Z", unavailableReason: null }
    });
    const afterItems = Array.from({ length: 120 }, (_, index) => ({
      id: 10_000 + index,
      name: `Changed item ${index}`,
      quantity: index + 1
    }));
    const after = snapshot("b".repeat(64), "2026-07-15T11:00:00Z", {
      bankItems: afterItems,
      bankStatus: { enabled: true, itemCount: 120, capturedAt: "2026-07-15T11:00:00Z", unavailableReason: null }
    });
    const delta = compareAccountSnapshots(before, after);

    expect(delta.bank).toMatchObject({ status: "changed", totalChangedItems: 120, truncated: true });
    expect(delta.bank.added).toHaveLength(100);
    expect(delta.facts.filter((fact) => fact.kind.startsWith("bank-"))).toHaveLength(100);
  });
});
