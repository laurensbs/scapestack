import { beforeEach, describe, expect, it, vi } from "vitest";

const database = vi.hoisted(() => ({
  checksums: new Map<string, number>(),
  nextSnapshotId: 1,
  deleted: false,
  queries: [] as Array<{ query: string; params: unknown[] }>,
  query: vi.fn(async (query: string, params: unknown[] = []) => {
    database.queries.push({ query, params });
    if (query.includes("WITH identity AS")) {
      const checksum = String(params[13]);
      const existing = database.checksums.get(checksum);
      const snapshotId = existing ?? database.nextSnapshotId++;
      if (!existing) database.checksums.set(checksum, snapshotId);
      return [{
        synced_at: "2026-07-15T12:00:00.000Z",
        snapshot_id: snapshotId,
        snapshot_created: existing === undefined
      }];
    }
    if (query.includes("deleted_identity")) return [{ deleted: database.deleted }];
    return [];
  })
}));

vi.mock("@/lib/db", () => ({
  sql: () => ({ query: database.query })
}));

import { buildHistoricalBankSummary, buildSnapshotChecksum, buildSnapshotSummary, type ImmutableSnapshotState } from "@/lib/account-history";
import { deleteAccountHistory, persistSyncAndSnapshot, PERSIST_SYNC_SQL } from "@/lib/account-history-repo";

function state(overrides: Partial<ImmutableSnapshotState> = {}): ImmutableSnapshotState {
  return {
    accountType: "normal",
    skills: [{ name: "Cooking", level: 80, xp: 2_000_000 }],
    questsCompleted: ["Cook's Assistant"],
    diariesCompleted: [{ region: "Karamja", tier: "Easy" }],
    collectionLogItemIds: [1, 2],
    bankItems: [{ id: 331, name: "Raw salmon", quantity: 500 }],
    bankStatus: { enabled: true, itemCount: 1, capturedAt: "2026-07-15T10:00:00Z", unavailableReason: null },
    slayer: null,
    ...overrides
  };
}

beforeEach(() => {
  database.checksums.clear();
  database.nextSnapshotId = 1;
  database.deleted = false;
  database.queries.length = 0;
  database.query.mockClear();
});

describe("immutable account snapshots", () => {
  it("deduplicates an identical retry but appends changed account state", async () => {
    const first = await persistSyncAndSnapshot({
      rsn: "lauky", displayName: "Lauky", state: state(), pluginVersion: "4.0.0", syncSummary: null
    });
    const retry = await persistSyncAndSnapshot({
      rsn: "lauky", displayName: "Lauky", state: state(), pluginVersion: "4.0.1", syncSummary: null
    });
    const changed = await persistSyncAndSnapshot({
      rsn: "lauky", displayName: "Lauky",
      state: state({ skills: [{ name: "Cooking", level: 81, xp: 2_200_000 }] }),
      pluginVersion: "4.0.1", syncSummary: { skills: ["Cooking"] }
    });

    expect(first).toMatchObject({ snapshotId: 1, snapshotCreated: true });
    expect(retry).toMatchObject({ snapshotId: 1, snapshotCreated: false });
    expect(changed).toMatchObject({ snapshotId: 2, snapshotCreated: true });
    expect(database.queries).toHaveLength(3);
  });

  it("uses one atomic write for identity, history and latest state", () => {
    expect(PERSIST_SYNC_SQL).toContain("WITH identity AS");
    expect(PERSIST_SYNC_SQL).toContain("inserted_snapshot AS");
    expect(PERSIST_SYNC_SQL).toContain("latest AS");
    expect(PERSIST_SYNC_SQL).toContain("ON CONFLICT (account_id, checksum) DO NOTHING");
    expect(PERSIST_SYNC_SQL).not.toContain("token_hash");
  });

  it("keeps full bank contents out of historical summaries", () => {
    const snapshot = state();
    const summary = buildSnapshotSummary(snapshot);
    const bank = buildHistoricalBankSummary(snapshot);

    expect(summary).toMatchObject({ totalLevel: 80, totalXp: 2_000_000, bankItems: 1 });
    expect(bank).toMatchObject({ available: true, itemCount: 1 });
    expect(bank.checksum).toHaveLength(64);
    expect(JSON.stringify(bank)).not.toContain("Raw salmon");
    expect(JSON.stringify(bank)).not.toContain("331");
  });

  it("makes checksums deterministic across harmless ordering and names", () => {
    const first = buildSnapshotChecksum(state({
      questsCompleted: ["Dragon Slayer I", "Cook's Assistant"],
      bankItems: [
        { id: 331, name: "Raw salmon", quantity: 500 },
        { id: 335, name: "Raw trout", quantity: 250 }
      ]
    }));
    const reordered = buildSnapshotChecksum(state({
      questsCompleted: ["Cook's Assistant", "Dragon Slayer I"],
      bankItems: [
        { id: 335, name: "renamed display value", quantity: 250 },
        { id: 331, name: "Raw salmon", quantity: 500 }
      ]
    }));
    expect(reordered).toBe(first);
  });

  it("persists the typed delta beside a changed snapshot", async () => {
    const previousState = state({
      availability: {
        skills: "available", quests: "available", diaries: "available",
        collectionLog: "available", bossKc: "unknown", slayer: "unknown", bank: "available"
      }
    });
    const previousChecksum = buildSnapshotChecksum(previousState);
    const result = await persistSyncAndSnapshot({
      rsn: "lauky",
      displayName: "Lauky",
      state: state({
        skills: [{ name: "Cooking", level: 81, xp: 2_250_000 }],
        availability: previousState.availability
      }),
      pluginVersion: "4.1.0",
      syncSummary: null,
      capturedAt: "2026-07-15T12:00:00.000Z",
      previousSnapshot: {
        checksum: previousChecksum,
        capturedAt: "2026-07-15T10:00:00.000Z",
        state: previousState
      }
    });

    expect(result.accountDelta).toMatchObject({
      kind: "changed",
      elapsedSeconds: 7200,
      totalXp: { status: "changed", movement: { delta: 250_000 } }
    });
    const storedDelta = JSON.parse(String(database.queries[0]?.params[17]));
    expect(storedDelta.deltaId).toBe(result.accountDelta.deltaId);
    expect(storedDelta.facts).toContainEqual(expect.objectContaining({ kind: "xp", key: "Cooking", amount: 250_000 }));
  });
});

describe("account privacy deletion", () => {
  it("deletes identity, latest state and claim in the cascading repository operation", async () => {
    database.deleted = true;
    await expect(deleteAccountHistory("lauky")).resolves.toBe(true);
    const deletion = database.queries[0]?.query ?? "";
    expect(deletion).toContain("DELETE FROM player_sync");
    expect(deletion).toContain("DELETE FROM player_claim");
    expect(deletion).toContain("DELETE FROM account_identity");
  });
});
