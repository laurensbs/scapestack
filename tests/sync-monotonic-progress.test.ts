import { beforeEach, describe, expect, it, vi } from "vitest";
import syncPayloadV3 from "./fixtures/plugin-sync-v3.json";
import { computeNextUp } from "@/lib/next-up";
import { pinnedGoalSuggestionsFromPlan } from "@/lib/pinned-goal-suggestions";
import type { PluginBankStatus } from "@/lib/plugin-bank-status";
import { getQuests } from "@/lib/quest-db";

const store = vi.hoisted(() => ({
  row: null as Record<string, unknown> | null,
  latest: null as Record<string, unknown> | null
}));

vi.mock("@/lib/sync-auth", () => ({
  extractBearerToken: () => "test-token-1234567890",
  verifyClaim: async () => true
}));

vi.mock("@/lib/db", () => ({
  hasDatabase: () => true,
  sql: () => {
    const query = async (
      strings: TemplateStringsArray,
      ..._values: unknown[]
    ): Promise<Record<string, unknown>[]> => {
      const source = strings.join("?");
      if (source.includes("FROM player_sync current")) {
        return store.row ? [store.row] : [];
      }
      return [];
    };
    query.query = async () => [];
    return query;
  }
}));

vi.mock("@/lib/account-history-repo", () => ({
  persistSyncAndSnapshot: async (input: {
    state: Record<string, unknown>;
    pluginVersion: string;
  }) => {
    store.latest = structuredClone(input.state);
    store.row = {
      account_type: input.state.accountType,
      skills: input.state.skills,
      quests_completed: input.state.questsCompleted,
      diaries_completed: input.state.diariesCompleted,
      collection_log_item_ids: input.state.collectionLogItemIds,
      boss_kc: input.state.bossKc,
      bank_items: input.state.bankItems,
      bank_status: input.state.bankStatus,
      slayer: input.state.slayer,
      snapshot_coverage: input.state.snapshotCoverage,
      synced_at: "2026-08-01T12:00:00.000Z",
      snapshot_checksum: null,
      snapshot_captured_at: null,
      snapshot_availability: input.state.availability
    };
    return {
      syncedAt: "2026-08-01T12:00:00.000Z",
      snapshotId: null,
      snapshotCreated: true,
      snapshotChecksum: "test-checksum",
      accountDelta: null
    };
  }
}));

const TOKEN = "11111111-2222-3333-4444-555555555555";
const SKILL_NAMES = [
  "Attack", "Defence", "Strength", "Hitpoints", "Ranged", "Prayer",
  "Magic", "Cooking", "Woodcutting", "Fletching", "Fishing", "Firemaking",
  "Crafting", "Smithing", "Mining", "Herblore", "Agility", "Thieving",
  "Slayer", "Farming", "Runecraft", "Hunter", "Construction"
];

function request(payload: unknown): Request {
  return new Request("http://local.test/api/sync", {
    method: "POST",
    headers: {
      authorization: `Bearer ${TOKEN}`,
      "content-type": "application/json"
    },
    body: JSON.stringify(payload)
  });
}

beforeEach(() => {
  store.row = null;
  store.latest = null;
  vi.resetModules();
});

describe("monotonic RuneLite progress", () => {
  it("keeps a full v3 reading after an empty login-race sync and removes completed Barrows gloves from the goal list", async () => {
    const quests = await getQuests();
    const names = [...quests.values()].map((quest) => quest.name);
    const fullQuestList = [
      "Recipe for Disaster",
      ...names.filter((name) => name !== "Recipe for Disaster")
    ].slice(0, 180);
    expect(fullQuestList).toHaveLength(180);

    const full = structuredClone(syncPayloadV3) as Record<string, unknown> & {
      coverage: Record<string, unknown>;
      questsCompleted: string[];
      diariesCompleted: Array<{ region: string; tier: "Easy" | "Medium" | "Hard" | "Elite" }>;
      collectionLogItemIds: number[];
    };
    full.questsCompleted = fullQuestList;
    full.skills = SKILL_NAMES.map((name) => ({ name, level: 99, xp: 13_034_431 }));
    full.bankItems = [
      { id: 221, name: "Eye of newt", quantity: 1 },
      { id: 954, name: "Rope", quantity: 1 }
    ];
    full.bankStatus = {
      enabled: true,
      itemCount: 2,
      capturedAt: "2026-08-01T11:59:00.000Z",
      unavailableReason: null
    };

    const empty = structuredClone(full) as typeof full & {
      collectionLogStatus: Record<string, unknown>;
    };
    empty.questsCompleted = [];
    empty.diariesCompleted = [];
    empty.collectionLogItemIds = [];
    empty.bankItems = [{ id: 995, name: "Coins", quantity: 25 }];
    empty.bankStatus = {
      enabled: true,
      itemCount: 1,
      capturedAt: "2026-08-01T12:00:00.000Z",
      unavailableReason: null
    };
    empty.collectionLogStatus = {
      opened: false,
      widgetLoads: 0,
      lastWidgetItemCount: 0,
      obtainedItemCount: 0,
      capturedAt: ""
    };
    empty.coverage.collectionLog = {
      state: "not-loaded",
      reason: "collection-log-not-opened"
    };

    const { POST } = await import("@/app/api/sync/route");
    expect((await POST(request(full))).status).toBe(200);
    expect((await POST(request(empty))).status).toBe(200);

    const latest = store.latest as {
      accountType: string;
      skills: Array<{ name: string; level: number; xp?: number }>;
      questsCompleted: string[];
      diariesCompleted: Array<{ region: string; tier: string }>;
      collectionLogItemIds: number[];
      bankItems: Array<{ id: number; name: string; quantity: number }>;
      bankStatus: PluginBankStatus;
    };
    expect(latest.questsCompleted).toHaveLength(180);
    expect(latest.diariesCompleted).toEqual(full.diariesCompleted);
    expect(latest.collectionLogItemIds).toEqual(full.collectionLogItemIds);
    expect(latest.bankItems).toEqual([{ id: 995, name: "Coins", quantity: 25 }]);

    const skills = [
      { id: 0, name: "Overall", rank: 1, level: 2277, xp: 299_791_913 },
      ...latest.skills.map((skill, index) => ({
        id: index + 1,
        name: skill.name,
        rank: 1,
        level: skill.level,
        xp: skill.xp ?? 13_034_431
      }))
    ];
    const plan = await computeNextUp({
      skills,
      bank: latest.bankItems,
      questPoints: 300,
      scapestackSync: {
        displayName: "Lauky",
        accountType: latest.accountType,
        questsCompleted: latest.questsCompleted,
        diariesCompleted: latest.diariesCompleted,
        collectionLogItemIds: latest.collectionLogItemIds,
        bankStatus: latest.bankStatus
      }
    });
    expect(pinnedGoalSuggestionsFromPlan(plan)).not.toContainEqual({
      kind: "unlock",
      unlockId: "barrows-gloves"
    });

    const omitted = structuredClone(full) as Record<string, unknown>;
    delete omitted.questsCompleted;
    delete omitted.diariesCompleted;
    delete omitted.collectionLogItemIds;
    expect((await POST(request(omitted))).status).toBe(200);
    expect(store.latest).toMatchObject({
      questsCompleted: fullQuestList,
      diariesCompleted: full.diariesCompleted,
      collectionLogItemIds: full.collectionLogItemIds
    });

    const explicitNull = structuredClone(full) as Record<string, unknown>;
    explicitNull.questsCompleted = null;
    explicitNull.diariesCompleted = null;
    explicitNull.collectionLogItemIds = null;
    expect((await POST(request(explicitNull))).status).toBe(200);
    expect(store.latest).toMatchObject({
      questsCompleted: fullQuestList,
      diariesCompleted: full.diariesCompleted,
      collectionLogItemIds: full.collectionLogItemIds
    });

    const shrinking = structuredClone(full) as typeof full;
    shrinking.questsCompleted = [fullQuestList[0]];
    shrinking.diariesCompleted = [full.diariesCompleted[0]];
    shrinking.collectionLogItemIds = [full.collectionLogItemIds[0]];
    expect((await POST(request(shrinking))).status).toBe(200);
    expect(store.latest).toMatchObject({
      questsCompleted: fullQuestList,
      diariesCompleted: full.diariesCompleted,
      collectionLogItemIds: full.collectionLogItemIds
    });

    const incompleteReset = structuredClone(full) as Record<string, unknown>;
    incompleteReset.fullResync = true;
    delete incompleteReset.diariesCompleted;
    expect((await POST(request(incompleteReset))).status).toBe(400);
    expect(store.latest).toMatchObject({ questsCompleted: fullQuestList });

    const fullResync = structuredClone(full) as Record<string, unknown>;
    fullResync.fullResync = true;
    fullResync.questsCompleted = ["Cook's Assistant"];
    fullResync.diariesCompleted = [];
    fullResync.collectionLogItemIds = [];
    expect((await POST(request(fullResync))).status).toBe(200);
    expect(store.latest).toMatchObject({
      questsCompleted: ["Cook's Assistant"],
      diariesCompleted: [],
      collectionLogItemIds: []
    });
  });
});
