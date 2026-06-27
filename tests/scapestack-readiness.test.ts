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

    expect(readiness.primaryAction).toEqual({ label: "Paste bank", href: "/bank" });
    expect(readiness.signals.map((signal) => [signal.id, signal.status])).toEqual([
      ["bank", "missing"],
      ["rsn", "ready"],
      ["sync", "missing"]
    ]);
    expect(readiness.signals.map((signal) => [signal.id, signal.sourceLabel])).toEqual([
      ["bank", "No bank source attached"],
      ["rsn", "Official OSRS Hiscores"],
      ["sync", "Scapestack Sync setup"]
    ]);
    expect(readiness.signals.find((signal) => signal.id === "bank")?.action).toEqual({
      label: "Paste bank",
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
      adds: ["quests", "diaries", "collection log", "Slayer"],
      boundary: "Never includes bank, inventory, equipment, chat, screenshots, clicks or account login."
    });
    expect(readiness.signals.find((signal) => signal.id === "sync")?.action).toEqual({
      label: "Open sync checker",
      href: "/plugin?rsn=Zezima&from=next#verify-sync"
    });
    expect(readiness.signals.find((signal) => signal.id === "sync")?.copy).toEqual({
      label: "Copy sync URL",
      value: PUBLIC_SYNC_URL
    });
    const syncSignal = readiness.signals.find((signal) => signal.id === "sync");
    expect(syncSignal?.detail).toContain("Open the sync checker");
    expect(syncSignal?.detail).toContain(".org endpoint");
    expect(syncSignal?.notice).toContain("sync becomes trusted only after the checker finds this RSN");
    expect(syncSignal?.steps).toEqual([
      expect.objectContaining({
        label: "Open RuneLite",
        body: expect.stringContaining("Enable Scapestack Sync")
      }),
      expect.objectContaining({
        label: "Confirm sync URL",
        body: expect.stringContaining("https://www.scapestack.org/api/sync")
      }),
      expect.objectContaining({
        label: "Verify RSN",
        body: expect.stringContaining("same OSRS name")
      })
    ]);
    expect(readiness.body).toContain("verified RuneLite sync labels quest, diary, collection-log and Slayer coverage");
    expect(readiness.body).not.toContain("gear now; RuneLite sync makes");
  });

  it("switches the sync setup copy once Plugin Hub is merged", () => {
    const readiness = buildScapestackReadiness({
      surface: "bank",
      hasBankContext: true,
      hasRsn: true,
      pluginHubState: "merged",
      rsn: "Mole Slapper"
    });
    const syncSignal = readiness.signals.find((signal) => signal.id === "sync");

    expect(syncSignal?.detail).toContain("Enable Scapestack Sync in RuneLite");
    expect(syncSignal?.detail).toContain("verify a payload before /next trusts account coverage labels");
    expect(syncSignal?.detail).not.toContain("/next stops guessing");
    expect(syncSignal?.sourceLabel).toBe("Scapestack Sync ready");
    expect(syncSignal?.notice).toBe("RuneLite sync can be verified from the plugin page.");
    expect(syncSignal?.steps?.[0]).toEqual({
      label: "Open RuneLite",
      body: "Enable Scapestack Sync for the account you want to plan."
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
      label: "Verify RuneLite sync",
      href: "/plugin?rsn=Lynx+Titan&from=next#verify-sync"
    });
    expect(syncSignal).toMatchObject({
      sourceLabel: "Scapestack Sync setup",
      detail: expect.stringContaining("Open the sync checker"),
      notice: "Scapestack can still plan with bank and Hiscores; sync becomes trusted only after the checker finds this RSN.",
      action: {
        label: "Open sync checker",
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
      label: "Verify RuneLite sync",
      href: "/plugin?rsn=Lynx+Titan&from=goals#verify-sync"
    });
    expect(unknown.primaryAction).toEqual({
      label: "Verify RuneLite sync",
      href: "/plugin?rsn=Lynx+Titan&from=goals#verify-sync"
    });
    expect(closed.signals.find((signal) => signal.id === "sync")?.sourceLabel).toBe("Scapestack Sync setup");
    expect(unknown.signals.find((signal) => signal.id === "sync")?.sourceLabel).toBe("Scapestack Sync setup");
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
      label: "Add RSN context",
      href: "/next?from=dps"
    });
    expect(readiness.signals.find((signal) => signal.id === "rsn")?.action).toEqual({
      label: "Add RSN",
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
      label: "Add RSN context",
      href: "/next?rsn=Typed+Main&from=bank"
    });
    expect(readiness.signals.find((signal) => signal.id === "rsn")?.action).toEqual({
      label: "Add RSN",
      href: "/next?rsn=Typed+Main&from=bank"
    });
  });

  it("sends bank-plus-rsn players to RuneLite payload verification before claiming completion", () => {
    const readiness = buildScapestackReadiness({
      surface: "bank",
      hasBankContext: true,
      hasRsn: true,
      rsn: "Mole Slapper"
    });

    expect(readiness.primaryAction.label).toBe("Verify RuneLite sync");
    expect(readiness.primaryAction.href).toBe("/plugin?rsn=Mole+Slapper&from=bank#verify-sync");
    expect(readiness.signals.find((signal) => signal.id === "sync")?.detail).toContain("Open the sync checker");
  });

  it("routes verified-sync players back into /next", () => {
    const readiness = buildScapestackReadiness({
      surface: "goals",
      hasBankContext: true,
      hasRsn: true,
      hasPluginSync: true,
      rsn: "Iron Lynx"
    });

    expect(readiness.primaryAction).toEqual({
      label: "Open verified /next",
      href: "/next?rsn=Iron+Lynx&from=goals"
    });
    expect(readiness.primaryAction.label).not.toBe("Open exact /next");
    expect(readiness.signals.map((signal) => signal.status)).toEqual(["exact", "ready", "exact"]);
    expect(readiness.signals.find((signal) => signal.id === "sync")?.action).toEqual({
      label: "Open sync checker",
      href: "/plugin?rsn=Iron+Lynx&from=goals#verify-sync"
    });
    expect(readiness.signals.find((signal) => signal.id === "sync")?.copy).toBeUndefined();
    expect(readiness.signals.find((signal) => signal.id === "sync")?.steps).toBeUndefined();
    expect(readiness.signals.find((signal) => signal.id === "bank")?.sourceLabel).toBe("Browser-only bank paste");
    expect(readiness.signals.find((signal) => signal.id === "sync")?.sourceLabel).toBe("Verified RuneLite payload");
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
    expect(syncSignal?.detail).toContain("update the RuneLite plugin");
    expect(syncSignal?.sourceLabel).toBe("RuneLite payload needs refresh");
    expect(readiness.primaryAction).toEqual({
      label: "Refresh sync payload",
      href: "/plugin?rsn=Lynx+Titan&from=next#verify-sync"
    });
    expect(readiness.title).toBe("Next planner has 3/3 signals connected");
    expect(readiness.body).toContain("3/3 signals are connected, 1/3 are verified");
    expect(readiness.body).toContain("must be refreshed or updated");
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

    expect(readiness.title).toBe("Slayer planner has 3/3 signals connected");
    expect(readiness.primaryAction).toEqual({
      label: "Refresh sync payload",
      href: "/plugin?rsn=Duradel+Main&from=slayer#verify-sync"
    });
    expect(readiness.signals.find((signal) => signal.id === "sync")?.detail).toContain("refresh RuneLite");
  });

  it("separates connected signals from exact signals in the rail title", () => {
    const readiness = buildScapestackReadiness({
      surface: "bank",
      hasBankContext: true,
      hasRsn: true,
      hasPluginSync: false,
      rsn: "Lynx Titan"
    });

    expect(readiness.title).toBe("Bank Organizer has 2/3 signals connected");
    expect(readiness.body).toContain("2/3 signals are connected, 1/3 are verified");
    expect(readiness.title).not.toContain("using");
  });

  it("is mounted on the core product result routes", () => {
    const files = [
      "src/app/bank/page.tsx",
      "src/app/next/next-client.tsx",
      "src/app/dps/dps-client.tsx",
      "src/app/goals/goals-client.tsx",
      "src/app/slayer/slayer-client.tsx"
    ];

    for (const file of files) {
      const source = readFileSync(join(process.cwd(), file), "utf8");
      expect(source, file).toContain("ScapestackReadinessRail");
      expect(source, file).toContain('surface="');
    }
  });

  it("renders per-signal inline actions in the rail component", () => {
    const source = readFileSync(
      join(process.cwd(), "src/components/scapestack-readiness-rail.tsx"),
      "utf8",
    );

    expect(source).toContain("signal.action");
    expect(source).toContain("signal.copy");
    expect(source).toContain("signal.steps");
    expect(source).toContain("signal.notice");
    expect(source).toContain("copySyncValue");
    expect(source).toContain("Copied sync URL.");
    expect(source).toContain("Clipboard failed — select the sync URL and copy it manually.");
    expect(source).not.toContain('setCopyState((current) => current === "error" ? "idle" : current), 2600');
    expect(source).toContain('fetch("/api/plugin-hub/status")');
    expect(source).toContain("scapestackPluginHubStateFromStatus(status)");
    expect(source).toContain("setRsnDraft");
    expect(source).toContain("OSRS name for Scapestack readiness");
    expect(source).toContain("signal.sourceLabel");
    expect(source).toContain("signal.adds.map");
    expect(source).toContain("Adds {item}");
    expect(source).toContain("signal.boundary");
    expect(source).toContain("Source:");
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
