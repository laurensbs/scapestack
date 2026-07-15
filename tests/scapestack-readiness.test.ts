import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { PUBLIC_SYNC_URL } from "@/lib/plugin-sync-actions";
import { buildScapestackReadiness, scapestackPluginHubStateFromStatus } from "@/lib/scapestack-readiness";

describe("Scapestack readiness rail", () => {
  it("guides players from missing bank context to bank paste first", () => {
    const readiness = buildScapestackReadiness({
      surface: "next",
      hasBankContext: false,
      hasRsn: true,
      rsn: "Zezima"
    });

    expect(readiness.primaryAction).toEqual({ label: "Add bank", href: "/bank" });
    expect(readiness.signals.map((signal) => [signal.id, signal.status])).toEqual([
      ["bank", "missing"],
      ["rsn", "ready"],
      ["sync", "missing"]
    ]);
    expect(readiness.signals.map((signal) => [signal.id, signal.sourceLabel])).toEqual([
      ["bank", "No bank"],
      ["rsn", "Hiscores loaded"],
      ["sync", "RuneLite later"]
    ]);
    expect(readiness.signals.find((signal) => signal.id === "bank")?.action).toEqual({
      label: "Add bank",
      href: "/bank"
    });
    expect(readiness.signals.find((signal) => signal.id === "bank")).toMatchObject({
      adds: ["gear", "supplies", "quantities", "GP"],
      boundary: "Does not prove quests, diaries, collection log or Slayer state."
    });
    expect(readiness.signals.find((signal) => signal.id === "rsn")).toMatchObject({
      adds: ["stats", "combat level", "public boss KC"],
      boundary: "Does not include bank, inventory, quest completion, diaries or private settings."
    });
    expect(readiness.signals.find((signal) => signal.id === "sync")).toMatchObject({
      adds: ["skills", "XP", "quests", "diaries", "collection log", "Slayer", "bank items"],
      boundary: "Bank item IDs/names/quantities are included when bank checks are on; never includes inventory, equipment, chat, screenshots, clicks or account login."
    });
    expect(readiness.signals.find((signal) => signal.id === "sync")?.action).toEqual({
      label: "Check RuneLite",
      href: "/plugin?rsn=Zezima&from=next#verify-sync"
    });
    expect(readiness.signals.find((signal) => signal.id === "sync")?.copy).toEqual({
      label: "Copy sync URL",
      value: PUBLIC_SYNC_URL
    });
    const syncSignal = readiness.signals.find((signal) => signal.id === "sync");
    expect(syncSignal?.detail).toContain("Use /next now");
    expect(syncSignal?.detail).toContain("Check RuneLite later");
    expect(syncSignal?.notice).toBeUndefined();
    expect(syncSignal?.steps).toEqual([
      expect.objectContaining({
        label: "Open RuneLite",
        body: expect.stringContaining("Turn on Scapestack Sync")
      }),
      expect.objectContaining({
        label: "Use scapestack.org link",
        body: expect.stringContaining("https://www.scapestack.org/api/sync")
      }),
      expect.objectContaining({
        label: "Check the RSN",
        body: expect.stringContaining("same OSRS name")
      })
    ]);
    expect(readiness.body).toContain("RuneLite only helps avoid finished quests");
    expect(readiness.body).not.toContain("gear now; RuneLite sync makes");
  });

  it("switches the sync setup copy once sync can be verified", () => {
    const readiness = buildScapestackReadiness({
      surface: "bank",
      hasBankContext: true,
      hasRsn: true,
      pluginHubState: "merged",
      rsn: "Mole Slapper"
    });
    const syncSignal = readiness.signals.find((signal) => signal.id === "sync");

    expect(syncSignal?.detail).toContain("Check this same RSN");
    expect(syncSignal?.detail).toContain("/next can skip finished progress");
    expect(syncSignal?.detail).not.toContain("/next stops guessing");
    expect(syncSignal?.sourceLabel).toBe("RuneLite can help");
    expect(syncSignal?.notice).toBe("RuneLite can be checked from the plugin page.");
    expect(syncSignal?.steps?.[0]).toEqual({
      label: "Open RuneLite",
      body: "Turn on Scapestack Sync for this account."
    });
    expect(syncSignal?.copy).toEqual({
      label: "Copy sync URL",
      value: PUBLIC_SYNC_URL
    });
    expect(syncSignal?.copy?.value).not.toContain("127.0.0.1");
  });

  it("keeps live Plugin Hub review blockers out of the player sync path", () => {
    expect(scapestackPluginHubStateFromStatus({
      state: "open",
      tone: "warning",
      label: "Plugin Hub PR #12536 open",
      detail: "Awaiting RuneLite maintainer review.",
      checkSummary: null,
      submittedCommit: null,
      standaloneCommit: null,
      pinSummary: null,
      reviewCopySummary: "Live PR body still needs review-copy fixes: token transport.",
      reviewCopyIssues: ["token transport"],
      updatedAt: null,
      reviewCount: 0,
      reviewSummary: null,
      url: "https://github.com/runelite/plugin-hub/pull/12536"
    })).toBe("review-blocked");

    const readiness = buildScapestackReadiness({
      surface: "next",
      hasBankContext: true,
      hasRsn: true,
      pluginHubState: "review-blocked",
      rsn: "Lynx Titan"
    });
    const syncSignal = readiness.signals.find((signal) => signal.id === "sync");

    expect(readiness.primaryAction).toEqual({
      label: "Check RuneLite",
      href: "/plugin?rsn=Lynx+Titan&from=next#verify-sync"
    });
    expect(syncSignal).toMatchObject({
      sourceLabel: "RuneLite later",
      detail: expect.stringContaining("Use /next now"),
      notice: undefined,
      action: {
        label: "Check RuneLite",
        href: "/plugin?rsn=Lynx+Titan&from=next#verify-sync"
      }
    });
    expect(syncSignal?.copy).toEqual({
      label: "Copy sync URL",
      value: PUBLIC_SYNC_URL
    });
    expect(syncSignal?.steps).toBeDefined();
  });

  it("still offers sync URL setup when Plugin Hub state is closed or unavailable", () => {
    const closed = buildScapestackReadiness({
      surface: "goals",
      hasBankContext: true,
      hasRsn: true,
      pluginHubState: "closed",
      rsn: "Lynx Titan"
    });
    const unknown = buildScapestackReadiness({
      surface: "goals",
      hasBankContext: true,
      hasRsn: true,
      pluginHubState: "unknown",
      rsn: "Lynx Titan"
    });

    expect(closed.primaryAction).toEqual({
      label: "Check RuneLite",
      href: "/plugin?rsn=Lynx+Titan&from=goals#verify-sync"
    });
    expect(unknown.primaryAction).toEqual({
      label: "Check RuneLite",
      href: "/plugin?rsn=Lynx+Titan&from=goals#verify-sync"
    });
    expect(closed.signals.find((signal) => signal.id === "sync")?.sourceLabel).toBe("RuneLite later");
    expect(unknown.signals.find((signal) => signal.id === "sync")?.sourceLabel).toBe("RuneLite later");
    expect(closed.signals.find((signal) => signal.id === "sync")?.copy).toEqual({
      label: "Copy sync URL",
      value: PUBLIC_SYNC_URL
    });
    expect(unknown.signals.find((signal) => signal.id === "sync")?.copy).toEqual({
      label: "Copy sync URL",
      value: PUBLIC_SYNC_URL
    });
  });

  it("gives missing RSN chips their own fix route without dropping bank handoff context", () => {
    const readiness = buildScapestackReadiness({
      surface: "dps",
      hasBankContext: true,
      hasRsn: false
    });

    expect(readiness.primaryAction).toEqual({
      label: "Add OSRS name",
      href: "/next?from=dps"
    });
    expect(readiness.signals.find((signal) => signal.id === "rsn")?.action).toEqual({
      label: "Add OSRS name",
      href: "/next?from=dps"
    });
  });

  it("threads typed RSNs into the missing-RSN chip and primary action", () => {
    const readiness = buildScapestackReadiness({
      surface: "bank",
      hasBankContext: true,
      hasRsn: false,
      rsn: "Typed Main"
    });

    expect(readiness.primaryAction).toEqual({
      label: "Add OSRS name",
      href: "/next?rsn=Typed+Main&from=bank"
    });
    expect(readiness.signals.find((signal) => signal.id === "rsn")?.action).toEqual({
      label: "Add OSRS name",
      href: "/next?rsn=Typed+Main&from=bank"
    });
  });

  it("sends bank-plus-rsn players to RuneLite sync check before claiming completion", () => {
    const readiness = buildScapestackReadiness({
      surface: "bank",
      hasBankContext: true,
      hasRsn: true,
      rsn: "Mole Slapper"
    });

    expect(readiness.primaryAction.label).toBe("Check RuneLite");
    expect(readiness.primaryAction.href).toBe("/plugin?rsn=Mole+Slapper&from=bank#verify-sync");
    expect(readiness.signals.find((signal) => signal.id === "sync")?.detail).toContain("Use /next now");
  });

  it("routes synced players back into /next", () => {
    const readiness = buildScapestackReadiness({
      surface: "goals",
      hasBankContext: true,
      hasRsn: true,
      hasPluginSync: true,
      rsn: "Iron Lynx"
    });

    expect(readiness.primaryAction).toEqual({
      label: "Open next plan",
      href: "/next?rsn=Iron+Lynx&from=goals"
    });
    expect(readiness.primaryAction.label).not.toBe("Open exact /next");
    expect(readiness.signals.map((signal) => signal.status)).toEqual(["exact", "ready", "exact"]);
    expect(readiness.signals.find((signal) => signal.id === "sync")?.action).toEqual({
      label: "Check RuneLite",
      href: "/plugin?rsn=Iron+Lynx&from=goals#verify-sync"
    });
    expect(readiness.signals.find((signal) => signal.id === "sync")?.copy).toBeUndefined();
    expect(readiness.signals.find((signal) => signal.id === "sync")?.steps).toBeUndefined();
    expect(readiness.signals.find((signal) => signal.id === "bank")?.sourceLabel).toBe("Bank added");
    expect(readiness.signals.find((signal) => signal.id === "sync")?.sourceLabel).toBe("RuneLite helping");
  });

  it("does not label outdated plugin sync as exact", () => {
    const readiness = buildScapestackReadiness({
      surface: "next",
      hasBankContext: true,
      hasRsn: true,
      hasPluginSync: true,
      pluginSyncState: "outdated",
      rsn: "Lynx Titan"
    });

    const syncSignal = readiness.signals.find((signal) => signal.id === "sync");
    expect(syncSignal?.status).toBe("ready");
    expect(syncSignal?.detail).toContain("Update RuneLite");
    expect(syncSignal?.sourceLabel).toBe("Press Sync again");
    expect(readiness.primaryAction).toEqual({
      label: "Fresh RuneLite check",
      href: "/plugin?rsn=Lynx+Titan&from=next#verify-sync"
    });
    expect(readiness.title).toBe("Make this next plan sharper");
    expect(readiness.body).toContain("Setup and stats can plan now");
    expect(readiness.body).toContain("Press RuneLite sync again before long quests");
  });

  it("supports Slayer as a first-class Scapestack surface", () => {
    const readiness = buildScapestackReadiness({
      surface: "slayer",
      hasBankContext: true,
      hasRsn: true,
      hasPluginSync: true,
      pluginSyncState: "stale",
      rsn: "Duradel Main"
    });

    expect(readiness.title).toBe("Make this Slayer task sharper");
    expect(readiness.primaryAction).toEqual({
      label: "Fresh RuneLite check",
      href: "/plugin?rsn=Duradel+Main&from=slayer#verify-sync"
    });
    expect(readiness.signals.find((signal) => signal.id === "sync")?.detail).toContain("Press Sync again");
  });

  it("keeps the rail title player-facing instead of counting signals", () => {
    const readiness = buildScapestackReadiness({
      surface: "bank",
      hasBankContext: true,
      hasRsn: true,
      hasPluginSync: false,
      rsn: "Lynx Titan"
    });

    expect(readiness.title).toBe("Make this setup sharper");
    expect(readiness.body).toContain("Setup and stats are enough for a first plan");
    expect(readiness.title).not.toContain("signals connected");
  });

  it("is mounted on the core product result routes", () => {
    const files = [
      "src/app/bank/page.tsx",
      "src/app/slayer/slayer-client.tsx"
    ];

    for (const file of files) {
      const source = readFileSync(join(process.cwd(), file), "utf8");
      expect(source, file).toContain("ScapestackReadinessRail");
      expect(source, file).toContain('surface="');
    }

    const goalsSource = readFileSync(join(process.cwd(), "src/app/goals/goals-client.tsx"), "utf8");
    expect(goalsSource).not.toContain("ScapestackReadinessRail");
    expect(goalsSource).toContain("Add more context");
    expect(goalsSource).not.toContain("Make rewards smarter");
    expect(goalsSource).toContain("Bank rewards are ticked from the items you pasted");

    const dpsSource = readFileSync(join(process.cwd(), "src/app/dps/dps-client.tsx"), "utf8");
    expect(dpsSource).not.toContain("ScapestackReadinessRail");
    expect(dpsSource).toContain("Pick a boss");
    expect(dpsSource).toContain("Search any boss. Click a tile for gear, supplies, upgrades and a first trip.");
    expect(dpsSource).toContain('label: "Bring" | "Missing" | "Try first"');
    expect(dpsSource).toContain("buildBossInventoryPlan({ boss, bankItems, owned, dps })");

    const nextSource = readFileSync(join(process.cwd(), "src/app/next/next-client.tsx"), "utf8");
    expect(nextSource).not.toContain("ScapestackReadinessRail");
    expect(nextSource).toContain("function makePlanSmarterCopy");
    expect(nextSource).toContain("Add bank only when GP, gear or items should change the method.");
    expect(nextSource).not.toContain("Add supplies if needed");
    expect(nextSource).not.toContain("Better supplies, boss picks and Bank Tags.");
  });

  it("renders per-signal inline actions in the rail component", () => {
    const source = readFileSync(
      join(process.cwd(), "src/components/scapestack-readiness-rail.tsx"),
      "utf8",
    );

    expect(source).toContain("signal.action");
    expect(source).not.toContain("signal.copy");
    expect(source).not.toContain("signal.steps");
    expect(source).not.toContain("signal.notice");
    expect(source).not.toContain("copySyncValue");
    expect(source).not.toContain("Copied sync URL.");
    expect(source).not.toContain("Clipboard failed — select the sync URL and copy it manually.");
    expect(source).not.toContain('fetch("/api/plugin-hub/status")');
    expect(source).not.toContain("scapestackPluginHubStateFromStatus(status)");
    expect(source).toContain("setRsnDraft");
    expect(source).toContain("OSRS name for this plan");
    expect(source).toContain("signal.sourceLabel");
    expect(source).not.toContain("signal.adds.map");
    expect(source).not.toContain("Adds {item}");
    expect(source).not.toContain("signal.boundary");
    expect(source).not.toContain("Source:");
    expect(source).toContain("{signal.action.label}");
    expect(source).not.toContain('signal.status === "missing" ? "Fix" : "Open"');
    expect(source).not.toContain("Fix:");
    expect(source).not.toContain("Open:");
  });

  it("persists parsed bank handoff before the bank readiness rail links away", () => {
    const source = readFileSync(join(process.cwd(), "src/app/bank/page.tsx"), "utf8");

    expect(source).toContain('import { persistBankHandoffPayload } from "@/lib/next-bank-handoff";');
    expect(source).toContain("persistBankHandoffPayload(res.result.tabs, window)");
  });
});
