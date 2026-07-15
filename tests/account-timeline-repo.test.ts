import { beforeEach, describe, expect, it, vi } from "vitest";

const database = vi.hoisted(() => ({
  rows: [] as Array<Record<string, unknown>>,
  inserted: [] as Array<Record<string, unknown>>,
  calls: [] as Array<{ query: string; params: unknown[] }>,
  query: vi.fn(async (query: string, params: unknown[] = []) => {
    database.calls.push({ query, params });
    if (query.includes("jsonb_to_recordset")) return database.inserted;
    return database.rows;
  })
}));

vi.mock("@/lib/db", () => ({ sql: () => ({ query: database.query }) }));
vi.mock("@/lib/sync-repo", () => ({ ensureSyncSchema: async () => undefined }));

import {
  decodeTimelineCursor,
  getAccountTimeline,
  importLegacyTripEvents,
  validTimelineCursor
} from "@/lib/account-timeline-repo";

beforeEach(() => {
  database.rows = [];
  database.inserted = [];
  database.calls = [];
  database.query.mockClear();
});

describe("account timeline repository", () => {
  it("orders and paginates only rows scoped to the connected account ID", async () => {
    database.rows = [
      {
        source_kind: "trip", source_key: "trip:2", occurred_at: "2026-07-16T11:00:00.000Z",
        data: { eventType: "done", title: "Falador Hard" }
      },
      {
        source_kind: "trip", source_key: "trip:1", occurred_at: "2026-07-16T10:00:00.000Z",
        data: { eventType: "started", title: "Vorkath" }
      }
    ];
    const page = await getAccountTimeline("11111111-2222-4333-8444-555555555555", { limit: 1 });

    expect(page.moments).toEqual([expect.objectContaining({ title: "Finished Falador Hard" })]);
    expect(page.nextCursor).toBeTruthy();
    expect(decodeTimelineCursor(page.nextCursor)).toEqual({ at: "2026-07-16T11:00:00.000Z", key: "trip:2" });
    expect(database.calls[0].params[0]).toBe("11111111-2222-4333-8444-555555555555");
    expect(database.calls[0].query).toContain("WHERE account_id = $1::uuid");
    expect(database.calls[0].query).not.toContain("WHERE identity.rsn");
  });

  it("rejects malformed cursors instead of silently changing pages", () => {
    expect(validTimelineCursor("not-a-cursor")).toBe(false);
    expect(validTimelineCursor(null)).toBe(true);
  });

  it("imports only exact-RSN legacy trips and stays idempotent through a unique key", async () => {
    database.inserted = [{ event_id: "1" }];
    const result = await importLegacyTripEvents(
      "11111111-2222-4333-8444-555555555555",
      "Lauky",
      [
        { version: 1, id: "boss:vorkath", kind: "boss", title: "Vorkath", action: "done", savedAt: Date.parse("2026-07-16T10:00:00Z"), rsnKey: "lauky" },
        { version: 1, id: "quest:dslayer", kind: "quest", title: "Dragon Slayer", action: "done", savedAt: Date.parse("2026-07-16T10:00:00Z"), rsnKey: "other" },
        { version: 1, id: "unscoped", kind: "skill", title: "Cooking", action: "done", savedAt: Date.parse("2026-07-16T10:00:00Z") }
      ],
      Date.parse("2026-07-16T12:00:00Z")
    );

    expect(result).toEqual({ imported: 1, ignored: 2 });
    const call = database.calls.find((entry) => entry.query.includes("jsonb_to_recordset"));
    expect(call?.query).toContain("ON CONFLICT (account_id, legacy_event_id)");
    expect(String(call?.params[1])).toContain("boss:vorkath");
    expect(String(call?.params[1])).not.toContain("Dragon Slayer");
  });
});
