import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { resolveSnapshotAvailability } from "@/lib/account-snapshot-delta";
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

describe("the availability gate the SQL actually reads", () => {
  const historyRepo = readFileSync(join(process.cwd(), "src/lib/account-history-repo.ts"), "utf8");

  /**
   * The one that got away, and the reason this test is structural rather than
   * a list of three names.
   *
   * PERSIST_SYNC_SQL gates every column on `($17::jsonb ->> '<domain>') =
   * 'available'`, and $17 is whatever resolveSnapshotAvailability returns. That
   * function built an object literal with exactly the seven core keys, so for
   * the three v4 columns the comparison was `NULL = 'available'` — never true.
   * The CASE fell to ELSE and kept the stored value, every time. The columns
   * were written on INSERT and never once updated for an account that already
   * had a row.
   *
   * It survived a production round-trip because that test used a fresh RSN,
   * which takes the INSERT path. Only an account syncing twice shows it.
   */
  it("can emit every domain the SQL gates on", () => {
    const gated = new Set<string>();
    for (const match of historyRepo.matchAll(/\$17::jsonb ->> '([A-Za-z]+)'/g)) {
      gated.add(match[1]);
    }
    expect(gated.size, "no availability gates found — did the SQL change?").toBeGreaterThan(5);

    // Everything explicit, so the resolver has something to pass through.
    const emitted = new Set(Object.keys(resolveSnapshotAvailability({
      accountType: "normal",
      skills: [],
      questsCompleted: [],
      diariesCompleted: [],
      collectionLogItemIds: [],
      bankItems: [],
      bankStatus: { enabled: true, itemCount: 0, capturedAt: null, unavailableReason: null },
      slayer: null,
      availability: {
        skills: "available", quests: "available", diaries: "available",
        collectionLog: "available", bossKc: "available", slayer: "available",
        bank: "available", equipment: "available", farming: "available",
        combatAchievements: "available"
      }
    })));

    const unreachable = [...gated].filter((domain) => !emitted.has(domain));
    expect(unreachable, `columns gated on keys that can never appear: ${unreachable.join(", ")}`).toEqual([]);
  });

  it("omits a v4 domain the snapshot did not carry, so a v3 sync cannot erase it", () => {
    // The asymmetry is deliberate: an absent key means the CASE keeps the
    // stored value, which is exactly what a v3 plugin — silent about
    // equipment — should do to data a v4 sync wrote.
    const resolved = resolveSnapshotAvailability({
      accountType: "normal",
      skills: [],
      questsCompleted: [],
      diariesCompleted: [],
      collectionLogItemIds: [],
      bankItems: [],
      bankStatus: { enabled: false, itemCount: 0, capturedAt: null, unavailableReason: "opt-in-off" },
      slayer: null,
      availability: { skills: "available" }
    });
    expect("equipment" in resolved).toBe(false);
    expect(JSON.parse(JSON.stringify(resolved)).equipment).toBeUndefined();
  });
});

describe("redaction cannot be outgrown by a new field", () => {
  it("names every SyncedPlayer field it is not redacting", () => {
    // redactSyncedPlayer spreads ...player and then overrides a hand-written
    // list. Any field added to SyncedPlayer later is therefore public by
    // default — the failure would be silent and the field would be gone from
    // the server's control the moment it shipped.
    //
    // This test does not judge which fields are safe; it forces the decision
    // to be made once, here, by anyone who adds one.
    const ALLOWED_PUBLIC = new Set([
      "rsn", "displayName", "accountType", "questsCompleted", "diariesCompleted",
      "bossKc", "bankStatus", "pluginVersion", "snapshotCoverage", "availability",
      "lastSyncSummary", "syncedAt"
    ]);
    const REDACTED = new Set([
      "bankItems", "collectionLogItemIds", "skills", "slayer",
      "equipment", "farming", "combatAchievements"
    ]);

    const source = readFileSync(join(process.cwd(), "src/lib/sync-repo.ts"), "utf8");
    const block = source.match(/export interface SyncedPlayer \{([\s\S]+?)\n\}/);
    expect(block, "SyncedPlayer interface not found").toBeTruthy();
    const declared = new Set<string>();
    for (const line of block![1].split("\n")) {
      const field = line.match(/^\s{2}([A-Za-z][A-Za-z0-9]*)\??:/);
      if (field) declared.add(field[1]);
    }
    expect(declared.size).toBeGreaterThan(10);

    const undecided = [...declared].filter((f) => !ALLOWED_PUBLIC.has(f) && !REDACTED.has(f));
    expect(
      undecided,
      `New SyncedPlayer field(s) with no redaction decision: ${undecided.join(", ")}. `
        + "Add to REDACTED (and to redactSyncedPlayer) or to ALLOWED_PUBLIC, deliberately."
    ).toEqual([]);
  });
});

describe("the new domains have human copy, not field names", () => {
  it("labels every domain a scan can report", () => {
    // pluginChangedLine falls back to the raw key, so a missing label is not
    // an error — it is "Scan accepted: ..., combatAchievements." in copy the
    // player reads.
    const view = readFileSync(join(process.cwd(), "src/lib/plugin-connection-view.ts"), "utf8");
    const block = view.match(/const labels: Record<string, string> = \{([\s\S]+?)\n  \};/);
    expect(block, "labels map not found").toBeTruthy();
    const labelled = new Set<string>();
    for (const entry of block![1].matchAll(/^\s*([A-Za-z]+):/gm)) labelled.add(entry[1]);

    const result = parsePluginSnapshotContract(v4Body(), NOW);
    if (!result.ok || result.value.coverage === null) throw new Error("expected coverage");
    const unlabelled = Object.keys(result.value.coverage).filter((domain) => !labelled.has(domain));
    expect(unlabelled, `domains rendered as raw keys: ${unlabelled.join(", ")}`).toEqual([]);
  });
});

describe("the bank does not leave the server on the quest route either", () => {
  it("redacts /quests/[slug] for anyone but the paired owner", () => {
    // This route read the snapshot straight from the database and passed the
    // whole bank to a client component, so /quests/<slug>?rsn=<any name>
    // returned that player's full bank — names, ids, quantities — in the
    // public RSC payload. Verified live before the fix. /next was fixed for
    // exactly this in July; this route was missed.
    const page = readFileSync(join(process.cwd(), "src/app/quests/[slug]/page.tsx"), "utf8");
    expect(page).toContain("resolveViewerRsn");
    expect(page).toContain("syncedBankItems={clientBankItems}");
    // The server still computes against the real bank, or the route and the
    // requirement checks would silently get worse for the owner too.
    expect(page).toContain("bankItems: serverBankItems");
    expect(page).not.toContain("syncedBankItems={syncedPlayer?.bankItems ?? []}");
  });
});
