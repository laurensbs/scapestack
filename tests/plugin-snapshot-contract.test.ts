import { describe, expect, it } from "vitest";
import syncPayloadV3 from "./fixtures/plugin-sync-v3.json";
import {
  parsePluginSnapshotContract,
  realLevelForXp,
  snapshotAvailabilityFromCoverage
} from "@/lib/plugin-snapshot-contract";

describe("plugin snapshot contract v3", () => {
  it("parses the fixture written by the Java production serializer", () => {
    const result = parsePluginSnapshotContract(syncPayloadV3, Date.parse("2026-07-18T15:00:00Z"));

    expect(result.ok).toBe(true);
    if (!result.ok || result.value.kind !== "v3") throw new Error("expected v3 contract");
    expect(result.value.capturedAt).toBe("2026-07-18T12:34:56.000Z");
    expect(result.value.coverage.collectionLog).toEqual({
      state: "available",
      capturedAt: "2026-07-18T12:30:00.000Z",
      reason: "loaded-categories-only"
    });
    expect(snapshotAvailabilityFromCoverage(result.value.coverage)).toMatchObject({
      skills: "available",
      bossKc: "unsupported",
      bank: "available"
    });
  });

  it("protects real levels at 99 while allowing virtual XP", () => {
    expect(realLevelForXp(0)).toBe(1);
    expect(realLevelForXp(22406)).toBe(35);
    expect(realLevelForXp(13_034_431)).toBe(99);
    expect(realLevelForXp(200_000_000)).toBe(99);
  });

  it("rejects XP that contradicts the reported real level", () => {
    const malformed = structuredClone(syncPayloadV3) as Record<string, unknown> & {
      skills: Array<{ name: string; level: number; xp: number }>;
    };
    malformed.skills[0].xp = 200_000_000;

    expect(parsePluginSnapshotContract(malformed, Date.parse("2026-07-18T15:00:00Z"))).toEqual({
      ok: false,
      error: "skill Agility level does not match XP"
    });
  });

  it("rejects an empty collection log presented as complete coverage", () => {
    const malformed = structuredClone(syncPayloadV3) as Record<string, unknown> & {
      collectionLogStatus: { lastWidgetItemCount: number };
    };
    malformed.collectionLogStatus.lastWidgetItemCount = 0;

    expect(parsePluginSnapshotContract(malformed, Date.parse("2026-07-18T15:00:00Z"))).toEqual({
      ok: false,
      error: "collectionLog cannot be available before item slots are loaded"
    });
  });

  it("requires all eight domains and accepts legacy payloads without pretending they are v3", () => {
    const malformed = structuredClone(syncPayloadV3) as Record<string, unknown> & {
      coverage: Record<string, unknown>;
    };
    delete malformed.coverage.bank;
    expect(parsePluginSnapshotContract(malformed, Date.parse("2026-07-18T15:00:00Z"))).toEqual({
      ok: false,
      error: "coverage.bank is required"
    });
    expect(parsePluginSnapshotContract({ questsCompleted: [] })).toMatchObject({
      ok: true,
      value: { kind: "legacy", contractVersion: null, coverage: null }
    });
  });
});
