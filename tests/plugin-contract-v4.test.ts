import { describe, expect, it } from "vitest";
import syncPayloadV3 from "./fixtures/plugin-sync-v3.json";
import {
  parsePluginSnapshotContract,
  normalizePluginSnapshotCoverage,
  snapshotAvailabilityFromCoverage,
  PLUGIN_SNAPSHOT_CONTRACT_VERSION,
  PLUGIN_SNAPSHOT_CONTRACT_VERSION_V4
} from "@/lib/plugin-snapshot-contract";
import { redactSyncedPlayer, syncedPlayerForViewer } from "@/lib/synced-player-visibility";
import type { SyncedPlayer } from "@/lib/sync-repo";

const NOW = Date.parse("2026-07-18T15:00:00Z");

/**
 * A valid v4 body, grown from the byte-real v3 fixture the Java serializer
 * wrote. Everything v3 stays identical; v4 adds three coverage domains and
 * their payloads.
 */
function v4Body(): Record<string, unknown> {
  const body = structuredClone(syncPayloadV3) as Record<string, unknown> & {
    coverage: Record<string, unknown>;
  };
  body.contractVersion = 4;
  body.coverage.equipment = { state: "available", capturedAt: "2026-07-18T12:34:00Z" };
  body.coverage.farming = { state: "available", capturedAt: "2026-07-18T12:34:00Z" };
  body.coverage.combatAchievements = { state: "available", capturedAt: "2026-07-18T12:34:00Z" };
  body.equipment = [
    { id: 4151, name: "Abyssal whip", quantity: 1 },
    { id: 11840, name: "Dragon boots", quantity: 1 }
  ];
  body.farming = [
    { patch: "herb-falador", crop: "Ranarr weed", state: "growing", readyAt: "2026-07-18T13:50:00Z" },
    { patch: "herb-catherby", crop: null, state: "empty", readyAt: null }
  ];
  body.combatAchievements = { points: 431, tier: "hard" };
  body.syncTrigger = "logout";
  return body;
}

describe("the server accepts both contract versions", () => {
  it("still parses the untouched v3 fixture as v3", () => {
    // The published plugin speaks v3, and it must keep working byte-for-byte
    // while the server also understands v4. This is the whole point of
    // accepting a range before any plugin ships the new version.
    const result = parsePluginSnapshotContract(structuredClone(syncPayloadV3), NOW);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("unreachable");
    expect(result.value.kind).toBe("v3");
    expect(result.value.contractVersion).toBe(PLUGIN_SNAPSHOT_CONTRACT_VERSION);
  });

  it("parses a full v4 body", () => {
    const result = parsePluginSnapshotContract(v4Body(), NOW);
    expect(result).toMatchObject({ ok: true });
    if (!result.ok) throw new Error("unreachable");
    expect(result.value.kind).toBe("v4");
    expect(result.value.contractVersion).toBe(PLUGIN_SNAPSHOT_CONTRACT_VERSION_V4);
    if (result.value.coverage === null) throw new Error("expected coverage");
    expect(result.value.coverage.equipment?.state).toBe("available");
  });

  it("rejects versions outside the accepted set, naming what is accepted", () => {
    for (const version of [1, 2, 5, "3", null]) {
      const body = structuredClone(syncPayloadV3) as Record<string, unknown>;
      body.contractVersion = version;
      const result = parsePluginSnapshotContract(body, NOW);
      expect(result.ok, String(version)).toBe(false);
      if (result.ok) throw new Error("unreachable");
      expect(result.error).toContain("accepted: 3, 4");
    }
  });

  it("keeps the published constant at 3 until a plugin actually ships v4", () => {
    // Release checks pin against this. It moving early would let the
    // release tooling claim a v4 plugin exists when none does.
    expect(PLUGIN_SNAPSHOT_CONTRACT_VERSION).toBe(3);
    expect(PLUGIN_SNAPSHOT_CONTRACT_VERSION_V4).toBe(4);
  });
});

describe("version and coverage must agree", () => {
  it("rejects a v3 body that names a v4 domain", () => {
    // No v3 plugin sends one, so this means a v4 plugin is mislabelling
    // itself — the confusion a version field exists to prevent.
    const body = structuredClone(syncPayloadV3) as Record<string, unknown> & {
      coverage: Record<string, unknown>;
    };
    body.coverage.equipment = { state: "available", capturedAt: "2026-07-18T12:34:00Z" };
    expect(parsePluginSnapshotContract(body, NOW)).toEqual({
      ok: false,
      error: "Unknown coverage domain: equipment"
    });
  });

  it("requires every v4 domain in a v4 body", () => {
    const body = v4Body();
    delete (body.coverage as Record<string, unknown>).farming;
    delete body.farming;
    expect(parsePluginSnapshotContract(body, NOW)).toEqual({
      ok: false,
      error: "coverage.farming is required"
    });
  });

  it("lets a v4 domain be honestly unavailable", () => {
    const body = v4Body();
    (body.coverage as Record<string, unknown>).farming = {
      state: "not-loaded",
      reason: "farming-widgets-not-observed"
    };
    delete body.farming;
    const result = parsePluginSnapshotContract(body, NOW);
    expect(result.ok).toBe(true);
  });

  it("rejects v4 data sent without available coverage", () => {
    for (const field of ["equipment", "farming", "combatAchievements"] as const) {
      const body = v4Body();
      (body.coverage as Record<string, unknown>)[field] = {
        state: "unavailable",
        reason: "test"
      };
      // Data left in place while coverage denies it.
      const result = parsePluginSnapshotContract(body, NOW);
      expect(result.ok, field).toBe(false);
      if (result.ok) throw new Error("unreachable");
      expect(result.error).toContain(field);
    }
  });
});

describe("the v4 payloads are validated, not just accepted", () => {
  it("allows empty equipment — a naked account is still an observed one", () => {
    const body = v4Body();
    body.equipment = [];
    expect(parsePluginSnapshotContract(body, NOW).ok).toBe(true);
  });

  it("rejects malformed equipment rows", () => {
    for (const bad of [
      [{ id: -1, name: "x", quantity: 1 }],
      [{ id: 4151, name: "", quantity: 1 }],
      [{ id: 4151, name: "Whip", quantity: 0 }],
      new Array(17).fill({ id: 4151, name: "Whip", quantity: 1 })
    ]) {
      const body = v4Body();
      body.equipment = bad;
      expect(parsePluginSnapshotContract(body, NOW).ok).toBe(false);
    }
  });

  it("rejects a farming patch in a state the game does not have", () => {
    const body = v4Body();
    body.farming = [{ patch: "herb-falador", crop: "Ranarr", state: "flourishing", readyAt: null }];
    expect(parsePluginSnapshotContract(body, NOW)).toEqual({
      ok: false,
      error: "farming contains malformed or excessive values"
    });
  });

  it("allows a readyAt in the future — that is what a timer is", () => {
    const body = v4Body();
    body.farming = [{ patch: "herb-falador", crop: "Ranarr weed", state: "growing", readyAt: "2026-07-19T02:00:00Z" }];
    expect(parsePluginSnapshotContract(body, NOW).ok).toBe(true);
  });

  it("rejects a readyAt further out than anything can grow", () => {
    const body = v4Body();
    body.farming = [{ patch: "herb-falador", crop: "Ranarr weed", state: "growing", readyAt: "2026-09-01T00:00:00Z" }];
    expect(parsePluginSnapshotContract(body, NOW).ok).toBe(false);
  });

  it("holds Combat Achievement points and tier to the game's own shape", () => {
    const good = v4Body();
    good.combatAchievements = { points: 0, tier: null };
    expect(parsePluginSnapshotContract(good, NOW).ok).toBe(true);

    for (const bad of [
      { points: -1, tier: null },
      { points: 10_001, tier: "hard" },
      { points: 3.5, tier: "hard" },
      { points: 100, tier: "legendary" }
    ]) {
      const body = v4Body();
      body.combatAchievements = bad;
      expect(parsePluginSnapshotContract(body, NOW).ok, JSON.stringify(bad)).toBe(false);
    }
  });

  it("validates the sync trigger without requiring it", () => {
    const absent = v4Body();
    delete absent.syncTrigger;
    expect(parsePluginSnapshotContract(absent, NOW).ok).toBe(true);

    const wrong = v4Body();
    wrong.syncTrigger = "crash";
    expect(parsePluginSnapshotContract(wrong, NOW)).toEqual({
      ok: false,
      error: "syncTrigger is invalid"
    });
  });
});

describe("stored coverage keeps reading after the domain list grew", () => {
  it("normalizes a pre-v4 row with only the eight core domains", () => {
    // Regression-critical. Every row written before today has exactly the
    // eight core domains; folding the new ones into the required list would
    // reject all of them on read — the unbackfilled-migration failure class,
    // this time without even a migration.
    const v3Result = parsePluginSnapshotContract(structuredClone(syncPayloadV3), NOW);
    if (!v3Result.ok || v3Result.value.coverage === null) throw new Error("expected v3 coverage");
    const stored = JSON.parse(JSON.stringify(v3Result.value.coverage));
    const normalized = normalizePluginSnapshotCoverage(stored);
    expect(normalized).not.toBeNull();
    expect(normalized!.skills.state).toBe("available");
    expect(normalized!.equipment).toBeUndefined();
  });

  it("keeps the v4 domains when a v4 row is read back", () => {
    const v4Result = parsePluginSnapshotContract(v4Body(), NOW);
    if (!v4Result.ok || v4Result.value.coverage === null) throw new Error("expected v4 coverage");
    const normalized = normalizePluginSnapshotCoverage(JSON.parse(JSON.stringify(v4Result.value.coverage)));
    expect(normalized?.equipment?.state).toBe("available");
    expect(normalized?.combatAchievements?.state).toBe("available");
  });

  it("adds availability keys only for domains that exist on the snapshot", () => {
    const v3Result = parsePluginSnapshotContract(structuredClone(syncPayloadV3), NOW);
    if (!v3Result.ok || v3Result.value.coverage === null) throw new Error("expected coverage");
    const availability = snapshotAvailabilityFromCoverage(v3Result.value.coverage);
    expect("equipment" in availability).toBe(false);

    const v4Result = parsePluginSnapshotContract(v4Body(), NOW);
    if (!v4Result.ok || v4Result.value.coverage === null) throw new Error("expected coverage");
    expect(snapshotAvailabilityFromCoverage(v4Result.value.coverage).equipment).toBe("available");
  });
});

describe("the new domains never leave the server for a stranger", () => {
  const player: SyncedPlayer = {
    rsn: "test player",
    displayName: "Test Player",
    accountType: "normal",
    skills: [{ name: "Attack", level: 80, xp: 2_000_000 }],
    questsCompleted: ["Dragon Slayer II"],
    diariesCompleted: [],
    collectionLogItemIds: [4151],
    bossKc: { Vorkath: 100 },
    bankItems: [{ id: 4151, name: "Abyssal whip", quantity: 1 }],
    bankStatus: { enabled: true, itemCount: 1, capturedAt: "2026-07-18T12:00:00Z", unavailableReason: null },
    slayer: null,
    pluginVersion: "0.4.0",
    equipment: [{ id: 11840, name: "Dragon boots", quantity: 1 }],
    farming: [{ patch: "herb-falador", crop: "Ranarr weed", state: "ready", readyAt: null }],
    combatAchievements: { points: 431, tier: "hard" },
    lastSyncSummary: null,
    syncedAt: "2026-07-18T12:34:56.000Z"
  };

  it("redacts equipment, farming and combat achievements", () => {
    // Equipment is gear worth, same class as the bank. Farming readyAt
    // timestamps reveal when someone plays. CA points are on no public API,
    // and we do not become the first.
    const redacted = redactSyncedPlayer(player);
    expect(redacted.equipment).toBeNull();
    expect(redacted.farming).toBeNull();
    expect(redacted.combatAchievements).toBeNull();
    expect(redacted.redactedCounts.equipmentItems).toBe(1);
    expect(redacted.redactedCounts.farmingPatches).toBe(1);
    expect(redacted.redactedCounts.hasCombatAchievements).toBe(true);
  });

  it("keeps everything for the paired owner", () => {
    const seen = syncedPlayerForViewer(player, "test player");
    expect(seen).toBe(player);
  });

  it("redacts for a different viewer and for no viewer", () => {
    for (const viewer of [null, "someone else"]) {
      const seen = syncedPlayerForViewer(player, viewer);
      expect(seen && "redacted" in seen && seen.redacted).toBe(true);
      expect((seen as { equipment: unknown }).equipment).toBeNull();
    }
  });
});
