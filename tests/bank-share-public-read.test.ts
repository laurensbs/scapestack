import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  rows: [] as Array<Record<string, unknown>>
}));
const publicId = "AaBbCcDdEeFfGgHhIiJjKkLl";
const privateId = "MmNnOoPpQqRrSsTtUuVvWwXx";
const revokedId = "YyZz00112233445566778899";

vi.mock("@/lib/db", () => ({
  sql: () => ({
    query: async (query: string, params: unknown[] = []) => {
      const row = state.rows.find((candidate) => candidate.share_id === params[0]);
      if (!row) return [];
      if (query.includes("published_at IS NOT NULL") && row.published_at === null) return [];
      if (query.includes("revoked_at IS NULL") && row.revoked_at !== null) return [];
      return [row];
    }
  })
}));

const snapshot = {
  version: 1,
  displayName: "Lauky",
  gp: 12_000_000,
  rows: [{
    setName: "Ahrim's set",
    owned: 2,
    total: 4,
    missing: ["Ahrim's hood"],
    cost: 420_123,
    verdict: "Buy now",
    gate: "ready"
  }],
  sourceSyncedAt: "2026-07-30T10:00:00.000Z",
  pricedAt: "2026-07-30T10:01:00.000Z"
};

beforeEach(() => {
  state.rows = [
    { share_id: publicId, snapshot, published_at: "2026-07-30T10:02:00.000Z", revoked_at: null },
    { share_id: privateId, snapshot, published_at: null, revoked_at: null },
    { share_id: revokedId, snapshot, published_at: "2026-07-30T10:02:00.000Z", revoked_at: "2026-07-30T10:03:00.000Z" }
  ];
  vi.resetModules();
});

describe("public bank share reads", () => {
  it("returns only explicitly published, unrevoked snapshots", async () => {
    const { getPublicBankShare } = await import("@/lib/bank-share-repo");
    await expect(getPublicBankShare(publicId)).resolves.toMatchObject({
      shareId: publicId,
      snapshot: { gp: 12_000_000 }
    });
    await expect(getPublicBankShare(privateId)).resolves.toBeNull();
    await expect(getPublicBankShare(revokedId)).resolves.toBeNull();
  });
});
