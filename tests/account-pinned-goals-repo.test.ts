import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPinnedGoal } from "@/lib/pinned-goals";

const state = vi.hoisted(() => ({
  rows: [] as Array<{ account_id: string; goal_key: string; goal: unknown; pinned_at: string }>
}));

vi.mock("@/lib/sync-repo", () => ({ ensureSyncSchema: async () => undefined }));
vi.mock("@/lib/db", () => ({
  sql: () => ({
    query: async (query: string, params: unknown[] = []) => {
      if (query.includes("INSERT INTO account_pinned_goal")) {
        const [accountId, goalKey, rawGoal, pinnedAt] = params as string[];
        if (!state.rows.some((row) => row.account_id === accountId && row.goal_key === goalKey)) {
          state.rows.push({ account_id: accountId!, goal_key: goalKey!, goal: JSON.parse(rawGoal!), pinned_at: pinnedAt! });
        }
        return [];
      }
      if (query.includes("DELETE FROM account_pinned_goal")) {
        const [accountId, goalKey] = params as string[];
        const found = state.rows.find((row) => row.account_id === accountId && row.goal_key === goalKey);
        state.rows = state.rows.filter((row) => row !== found);
        return found ? [{ goal_key: found.goal_key }] : [];
      }
      if (query.includes("SELECT goal")) {
        const rows = query.includes("WHERE account_id = $1::uuid")
          ? state.rows.filter((row) => row.account_id === params[0])
          : query.includes("JOIN account_identity") && query.includes("WHERE identity.rsn = $1")
            ? state.rows.filter((row) => row.account_id === (params[0] === "lynx titan" ? "account-1" : "account-2"))
          : state.rows;
        return rows.map((row) => ({ goal: row.goal }));
      }
      return [];
    }
  })
}));

beforeEach(() => {
  state.rows = [];
  vi.resetModules();
});

describe("account pinned goal repository", () => {
  it("persists across reads without exposing one account's goals to another", async () => {
    const goal = createPinnedGoal({
      kind: "level",
      skill: "Slayer",
      targetLevel: 99,
      pinnedAt: "2026-07-31T10:00:00.000Z"
    })!;
    const repo = await import("@/lib/account-pinned-goals-repo");
    await repo.upsertAccountPinnedGoal("account-1", goal);

    await expect(repo.getAccountPinnedGoals("account-1")).resolves.toEqual([goal]);
    await expect(repo.getAccountPinnedGoals("account-2")).resolves.toEqual([]);
    await expect(repo.getAccountPinnedGoalsByRsn("Lynx Titan")).resolves.toEqual([goal]);
    await expect(repo.getAccountPinnedGoalsByRsn("Other Player")).resolves.toEqual([]);
    await expect(repo.deleteAccountPinnedGoal("account-2", goal.key)).resolves.toBe(false);
    await expect(repo.getAccountPinnedGoals("account-1")).resolves.toEqual([goal]);
  });
});
