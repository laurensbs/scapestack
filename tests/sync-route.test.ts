import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  allowed: true,
  upserts: [] as unknown[],
  failUpsert: false,
  dbConfigured: false,
  dbRows: [] as Array<{ table_name: string; column_name: string }>,
  dbError: null as Error | null
}));

vi.mock("@/lib/sync-auth", () => ({
  extractBearerToken: (header: string | null) => {
    const match = header?.match(/^Bearer ([-A-Za-z0-9_.~]{16,200})$/);
    return match?.[1] ?? null;
  },
  verifyClaim: async () => state.allowed
}));

vi.mock("@/lib/sync-repo", () => ({
  upsertSyncedPlayer: async (payload: unknown) => {
    if (state.failUpsert) throw new Error("db down");
    state.upserts.push(payload);
    return { syncedAt: "2026-06-03T10:00:00.000Z", syncSummary: null };
  }
}));

vi.mock("@/lib/db", () => ({
  hasDatabase: () => state.dbConfigured,
  sql: () => async () => {
    if (state.dbError) throw state.dbError;
    return state.dbRows;
  }
}));

vi.mock("@/lib/slayer/task-ids", () => ({
  mapBlockTaskIds: (ids: number[]) => ids.map((id) => `mapped-${id}`)
}));

const VALID_TOKEN = "11111111-2222-3333-4444-555555555555";

function syncRequest(body: unknown, headers: HeadersInit = {}): Request {
  return new Request("http://local.test/api/sync", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${VALID_TOKEN}`,
      ...headers
    },
    body: typeof body === "string" ? body : JSON.stringify(body)
  });
}

async function loadRoute() {
  return await import("@/app/api/sync/route");
}

beforeEach(() => {
  state.allowed = true;
  state.upserts = [];
  state.failUpsert = false;
  state.dbConfigured = false;
  state.dbRows = [];
  state.dbError = null;
  vi.resetModules();
});

const PLAYER_SYNC_COLUMNS = [
  "rsn",
  "display_name",
  "account_type",
  "skills",
  "quests_completed",
  "diaries_completed",
  "collection_log_item_ids",
  "bank_items",
  "bank_status",
  "slayer",
  "plugin_version",
  "sync_summary",
  "synced_at"
];
const PLAYER_CLAIM_COLUMNS = ["rsn", "token_hash", "claimed_at", "last_used_at"];

function readySchemaRows() {
  return [
    ...PLAYER_SYNC_COLUMNS.map((column_name) => ({ table_name: "player_sync", column_name })),
    ...PLAYER_CLAIM_COLUMNS.map((column_name) => ({ table_name: "player_claim", column_name }))
  ];
}

describe("GET /api/sync", () => {
  it("reports an unconfigured sync database without leaking secrets", async () => {
    const { GET } = await loadRoute();
    const response = await GET();

    expect(response.status).toBe(200);
    expect(response.headers.get("access-control-allow-origin")).toBe("*");
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      service: "scapestack-sync",
      ready: false,
      endpoints: { sync: "/api/sync", claim: "/api/sync/claim" },
      database: {
        configured: false,
        ready: false,
        missingTables: ["player_sync", "player_claim"],
        reason: "DATABASE_URL is not set"
      }
    });
  });

  it("reports ready when required sync schema columns exist", async () => {
    state.dbConfigured = true;
    state.dbRows = readySchemaRows();
    const { GET } = await loadRoute();
    const response = await GET();
    const body = await response.json();

    expect(body.ready).toBe(true);
    expect(body.plugin.currentVersion).toBe("0.2.0");
    expect(body.limits).toMatchObject({
      maxBodyBytes: 1_000_000,
      quests: 500,
      diaries: 64,
      collectionLogItems: 2000,
      bankItems: 1200
    });
    expect(body.database).toMatchObject({
      configured: true,
      ready: true,
      missingTables: [],
      missingColumns: {
        player_sync: [],
        player_claim: []
      }
    });
  });

  it("reports missing sync schema columns", async () => {
    state.dbConfigured = true;
    state.dbRows = readySchemaRows().filter((row) =>
      !(row.table_name === "player_sync" && row.column_name === "slayer")
    );
    const { GET } = await loadRoute();
    const response = await GET();
    const body = await response.json();

    expect(body.ready).toBe(false);
    expect(body.database.missingTables).toEqual([]);
    expect(body.database.missingColumns.player_sync).toContain("slayer");
  });
});

describe("POST /api/sync", () => {
  it("persists normalized sync data and returns plugin diagnostics", async () => {
    const { POST } = await loadRoute();
    const response = await POST(syncRequest({
      rsn: " Lynx Titan ",
      displayName: "LYNX TITAN",
      accountType: "ultimate_ironman",
      skills: [
        { name: "Agility", level: 35.9 },
        { name: "Prayer", level: 500 },
        { name: "", level: 10 },
        { name: "bad", level: "bad" }
      ],
      questsCompleted: ["Cook's Assistant", 123, "A".repeat(120)],
      diariesCompleted: [
        { region: "Lumbridge & Draynor", tier: "Easy" },
        { region: "Invalid", tier: "Master" }
      ],
      collectionLogItemIds: [4151, 2.9, -1, 999999.8, 1_000_000],
      bankItems: [
        { id: 1511, name: "Logs", quantity: 6.9 },
        { id: 2351, name: "Iron bar", quantity: 0 },
        { id: -1, name: "Bad", quantity: 1 },
        { id: 995, name: "", quantity: 1 }
      ],
      bankStatus: {
        enabled: true,
        itemCount: 4,
        capturedAt: "2026-07-08T12:00:00.000Z"
      },
      slayer: {
        points: 45.9,
        streak: 12,
        taskRemaining: 83,
        currentTaskId: 1337,
        blocks: [1, "bad", 2]
      },
      pluginVersion: "0.2.0"
    }));

    expect(response.status).toBe(200);
    expect(response.headers.get("access-control-allow-origin")).toBe("*");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(state.upserts).toHaveLength(1);
    expect(state.upserts[0]).toMatchObject({
      rsn: "Lynx Titan",
      displayName: "LYNX TITAN",
      accountType: "ultimate_ironman",
      skills: [
        { name: "Agility", level: 35 },
        { name: "Prayer", level: 126 }
      ],
      questsCompleted: ["Cook's Assistant", "A".repeat(100)],
      diariesCompleted: [{ region: "Lumbridge & Draynor", tier: "Easy" }],
      collectionLogItemIds: [4151, 2, 999999],
      bankItems: [
        { id: 1511, name: "Logs", quantity: 6 },
        { id: 2351, name: "Iron bar", quantity: 1 }
      ],
      bankStatus: {
        enabled: true,
        itemCount: 4,
        capturedAt: "2026-07-08T12:00:00.000Z",
        unavailableReason: null
      },
      slayer: {
        points: 45,
        streak: 12,
        taskRemaining: 83,
        currentTaskId: 1337,
        blocks: ["mapped-1", "mapped-2"]
      },
      pluginVersion: "0.2.0"
    });

    const json = await response.json();
    expect(json).toMatchObject({
      ok: true,
      syncedAt: "2026-06-03T10:00:00.000Z",
      player: { rsn: "lynx titan", displayName: "LYNX TITAN", accountType: "ultimate_ironman" },
      plugin: {
        version: "0.2.0",
        slayer: { status: "accepted", currentTaskId: 1337, blocks: 2 },
        bank: {
          enabled: true,
          itemCount: 4,
          capturedAt: "2026-07-08T12:00:00.000Z",
          unavailableReason: null
        }
      },
      counts: { skills: 2, quests: 2, diaries: 1, collectionLogItems: 3, bankItems: 2 },
      diagnostics: {
        received: { skills: 4, quests: 3, diaries: 2, collectionLogItems: 5, bankItems: 4 },
        truncated: { skills: false, quests: false, diaries: false, collectionLogItems: false, bankItems: false }
      }
    });
    expect(json.diagnostics.received.bytes).toBeGreaterThan(0);
  });

  it("rejects unclaimed RSNs without writing", async () => {
    state.allowed = false;
    const { POST } = await loadRoute();
    const response = await POST(syncRequest({
      rsn: "Lynx Titan",
      questsCompleted: [],
      diariesCompleted: [],
      collectionLogItemIds: []
    }));

    expect(response.status).toBe(403);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(state.upserts).toHaveLength(0);
    await expect(response.json()).resolves.toMatchObject({ ok: false });
  });

  it("persists bank status when bank sync is off", async () => {
    const { POST } = await loadRoute();
    const response = await POST(syncRequest({
      rsn: "Lynx Titan",
      questsCompleted: [],
      diariesCompleted: [],
      collectionLogItemIds: [],
      bankStatus: { enabled: false, itemCount: 0, unavailableReason: "opt-in-off" }
    }));

    expect(response.status).toBe(200);
    expect(state.upserts[0]).toMatchObject({
      bankItems: [],
      bankStatus: { enabled: false, itemCount: 0, capturedAt: null, unavailableReason: "opt-in-off" }
    });
    await expect(response.json()).resolves.toMatchObject({
      plugin: {
        bank: { enabled: false, itemCount: 0, unavailableReason: "opt-in-off" }
      }
    });
  });

  it("persists bank status when sync is on but no items are captured", async () => {
    const { POST } = await loadRoute();
    const response = await POST(syncRequest({
      rsn: "Lynx Titan",
      questsCompleted: [],
      diariesCompleted: [],
      collectionLogItemIds: [],
      bankStatus: { enabled: true, itemCount: 0, unavailableReason: "bank-not-opened-this-session" }
    }));

    expect(response.status).toBe(200);
    expect(state.upserts[0]).toMatchObject({
      bankItems: [],
      bankStatus: { enabled: true, itemCount: 0, capturedAt: null, unavailableReason: "bank-not-opened-this-session" }
    });
  });

  it("rejects malformed RSNs before claim verification", async () => {
    const { POST } = await loadRoute();
    const response = await POST(syncRequest({
      rsn: "bad/name",
      questsCompleted: [],
      diariesCompleted: [],
      collectionLogItemIds: []
    }));

    expect(response.status).toBe(400);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(state.upserts).toHaveLength(0);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      error: "rsn contains invalid characters"
    });
  });

  it("rejects oversized declared or actual bodies", async () => {
    const { POST } = await loadRoute();
    const declared = await POST(syncRequest("{}", { "content-length": "1000001" }));
    expect(declared.status).toBe(400);
    await expect(declared.json()).resolves.toMatchObject({ error: "Body too large" });

    const actual = await POST(syncRequest(`{"rsn":"${"A".repeat(1_000_001)}"}`));
    expect(actual.status).toBe(400);
    await expect(actual.json()).resolves.toMatchObject({ error: "Body too large" });
  });

  it("returns CORS preflight headers for Authorization", async () => {
    const { OPTIONS } = await loadRoute();
    const response = await OPTIONS();
    expect(response.status).toBe(204);
    expect(response.headers.get("access-control-allow-origin")).toBe("*");
    expect(response.headers.get("access-control-allow-headers")).toContain("authorization");
    expect(response.headers.get("cache-control")).toBe("no-store");
  });
});
