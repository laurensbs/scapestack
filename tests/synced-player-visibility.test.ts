import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  isRedactedSyncedPlayer,
  redactSyncedPlayer,
  syncedPlayerForViewer
} from "@/lib/synced-player-visibility";
import type { SyncedPlayer } from "@/lib/sync-repo";

function player(overrides: Partial<SyncedPlayer> = {}): SyncedPlayer {
  return {
    rsn: "lynx titan",
    displayName: "Lynx Titan",
    accountType: "normal",
    skills: [{ name: "Attack", level: 99, xp: 200_000_000 }],
    questsCompleted: ["Dragon Slayer II"],
    diariesCompleted: [{ region: "Varrock", tier: "Elite" }],
    collectionLogItemIds: [11832, 20997],
    bossKc: { Vorkath: 900 },
    bankItems: [
      { id: 4151, name: "Abyssal whip", quantity: 1 },
      { id: 995, name: "Coins", quantity: 2_147_000_000 }
    ],
    bankStatus: { enabled: true, itemCount: 2, unavailableReason: null, capturedAt: null },
    slayer: {
      points: 5000, streak: 120, taskRemaining: 42, currentTaskId: 7,
      taskName: "Abyssal demons", taskLocation: "Catacombs", blocks: []
    },
    pluginVersion: "0.3.0",
    // A REAL summary, not null: the 2026-08-08 adversarial pass found the
    // never-leaks test below passing vacuously because this field was null
    // while redactSyncedPlayer spread it straight through to strangers —
    // collection-log item names and exact xpGained included.
    lastSyncSummary: {
      previousSyncedAt: "2026-07-20T12:00:00.000Z",
      questsCompleted: ["Desert Treasure II"],
      diariesCompleted: [{ region: "Kandarin", tier: "Elite" }],
      collectionLogItemIds: [27277],
      collectionLogItems: [{ id: 27277, name: "Tumeken's shadow (uncharged)" }],
      skills: [{ name: "Slayer", previousLevel: 98, currentLevel: 99, xpGained: 1234567 }],
      bank: {
        previousItemCount: 1,
        currentItemCount: 2,
        previousUnavailableReason: null,
        currentUnavailableReason: null,
        enabledChanged: false
      }
    },
    syncedAt: "2026-07-25T12:00:00.000Z",
    ...overrides
  } as SyncedPlayer;
}

describe("synced player visibility", () => {
  it("gives the account owner the untouched snapshot", () => {
    const full = player();
    expect(syncedPlayerForViewer(full, "lynx titan")).toBe(full);
    expect(isRedactedSyncedPlayer(syncedPlayerForViewer(full, "lynx titan"))).toBe(false);
  });

  it("withholds bank, collection log and Slayer task from everyone else", () => {
    for (const viewer of [null, "zezima", "LYNX TITAN".toLowerCase() + " "]) {
      const seen = syncedPlayerForViewer(player(), viewer);
      expect(isRedactedSyncedPlayer(seen), `viewer=${viewer}`).toBe(true);
      expect(seen!.bankItems).toEqual([]);
      expect(seen!.collectionLogItemIds).toEqual([]);
      expect(seen!.slayer).toBeNull();
    }
  });

  it("never leaks an item name or quantity through a redacted snapshot", () => {
    const serialised = JSON.stringify(redactSyncedPlayer(player()));
    expect(serialised).not.toContain("Abyssal whip");
    expect(serialised).not.toContain("Coins");
    expect(serialised).not.toContain("2147000000");
    expect(serialised).not.toContain("Abyssal demons");
    expect(serialised).not.toContain("Catacombs");
    // The four fields the old spread passed through untouched:
    expect(serialised, "summary leaks item names").not.toContain("Tumeken");
    expect(serialised, "summary leaks exact XP").not.toContain("1234567");
    expect(serialised, "quest list leaks").not.toContain("Dragon Slayer II");
    expect(serialised, "summary quest list leaks").not.toContain("Desert Treasure II");
    expect(serialised, "diary list leaks").not.toContain("Varrock");
    expect(serialised, "boss KC leaks").not.toContain("Vorkath");
  });

  it("drops exact XP but keeps the levels the Hiscores already publish", () => {
    const seen = redactSyncedPlayer(player());
    expect(seen.skills).toEqual([{ name: "Attack", level: 99 }]);
    expect(JSON.stringify(seen)).not.toContain("200000000");
  });

  it("keeps counts so the UI can explain the plan instead of implying emptiness", () => {
    const seen = redactSyncedPlayer(player());
    expect(seen.redactedCounts).toEqual({
      bankItems: 2,
      collectionLogItemIds: 2,
      hasSlayerTask: true,
      // Contract v4 domains — zero until a v4 plugin has synced this account,
      // and redacted like the bank once one has.
      equipmentItems: 0,
      farmingPatches: 0,
      hasCombatAchievements: false,
      questsCompleted: 1,
      diariesCompleted: 1
    });
    // Status, freshness and account type are not secrets — they drive copy.
    expect(seen.bankStatus.enabled).toBe(true);
    expect(seen.syncedAt).toBe("2026-07-25T12:00:00.000Z");
    expect(seen.displayName).toBe("Lynx Titan");
  });

  it("passes null through untouched", () => {
    expect(syncedPlayerForViewer(null, "lynx titan")).toBeNull();
  });
});

describe("visibility is enforced at every server boundary", () => {
  const source = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

  it("redacts before planning, not after", () => {
    // This assertion used to read `syncedPlayerForViewer(scapestack.value` and
    // passed for months while `initialPlan` — computed from the same bank and
    // returned in the same object — went out unredacted. Matching the presence
    // of a redaction call says nothing about what else is in the payload.
    //
    // The order is the invariant: redact, then plan. If the plan is built from
    // the full snapshot there is no later step that can make it safe, because
    // the leak is in derived copy and ownership maps rather than in a field
    // anyone would think to strip.
    const planning = source("src/lib/planning-context.ts");
    const redactAt = planning.indexOf("const visible = syncedPlayerForViewer(");
    const planAt = planning.indexOf("const initialPlan = await computeInitialPlan(");
    expect(redactAt, "no redaction before the planner").toBeGreaterThan(-1);
    expect(planAt).toBeGreaterThan(-1);
    expect(redactAt, "planned before redacting").toBeLessThan(planAt);
    expect(planning).toContain("scapestackSync: visible");
    // The raw type must not be what the payload advertises.
    expect(planning).toContain("scapestackSync: VisibleSyncedPlayer | null;");
  });

  it("redacts the publicly callable server actions", () => {
    const actions = source("src/app/actions.ts");
    expect(actions).toContain("syncedPlayerForViewer(await getSyncedPlayer(rsn)");
    expect(actions).toContain("loadPlanningContext(rsn, { viewerRsn: await resolveViewerRsn() })");
    // A bare getSyncedPlayer return would hand the caller everything again.
    expect(actions).not.toMatch(/return getSyncedPlayer\(rsn\);/);
  });

  it("resolves the viewer from the session cookie, never from a query param", () => {
    const viewer = source("src/lib/viewer-account.ts");
    expect(viewer).toContain("ACCOUNT_SESSION_COOKIE");
    expect(viewer).toContain("getConnectedAccount");
    expect(viewer).not.toContain("searchParams");
  });
});
