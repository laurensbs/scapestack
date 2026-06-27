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
      ["sync", "Optional account sync"]
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
    expect(syncSignal?.detail).toContain("Use /next now");
    expect(syncSignal?.detail).toContain("check sync");
    expect(syncSignal?.notice).toBeUndefined();
    expect(syncSignal?.steps).toEqual([
      expect.objectContaining({
        label: "Open RuneLite",
        body: expect.stringContaining("Turn on Scapestack Sync")
      }),
      expect.objectContaining({
        label: "Confirm sync URL",
        body: expect.stringContaining("https://www.scapestack.org/api/sync")
      }),
      expect.objectContaining({
        label: "Check RSN",
        body: expect.stringContaining("same OSRS name")
      })
    ]);
    expect(readiness.body).toContain("Sync is optional for finished quests, diaries, log and Slayer");
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

    expect(syncSignal?.detail).toContain("Check the same RSN on /plugin");
    expect(syncSignal?.detail).toContain("/next can avoid finished account progress");
    expect(syncSignal?.detail).not.toContain("/next stops guessing");
    expect(syncSignal?.sourceLabel).toBe("Ready to check");
    expect(syncSignal?.notice).toBe("RuneLite sync can be checked from the plugin page.");
    expect(syncSignal?.steps?.[0]).toEqual({
      label: "Open RuneLite",
      body: "Turn on Scapestack Sync for the account you want to plan."
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
      label: "Check sync",
      href: "/plugin?rsn=Lynx+Titan&from=next#verify-sync"
    });
    expect(syncSignal).toMatchObject({
      sourceLabel: "Optional account sync",
      detail: expect.stringContaining("Use /next now"),
      notice: undefined,
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
      label: "Check sync",
      href: "/plugin?rsn=Lynx+Titan&from=goals#verify-sync"
    });
    expect(unknown.primaryAction).toEqual({
      label: "Check sync",
      href: "/plugin?rsn=Lynx+Titan&from=goals#verify-sync"
    });
    expect(closed.signals.find((signal) => signal.id === "sync")?.sourceLabel).toBe("Optional account sync");
    expect(unknown.signals.find((signal) => signal.id === "sync")?.sourceLabel).toBe("Optional account sync");
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

  it("sends bank-plus-rsn players to RuneLite sync check before claiming completion", () => {
    const readiness = buildScapestackReadiness({
      surface: "bank",
      hasBankContext: true,
      hasRsn: true,
      rsn: "Mole Slapper"
    });

    expect(readiness.primaryAction.label).toBe("Check sync");
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
      label: "Open synced /next",
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
    expect(readiness.signals.find((signal) => signal.id === "sync")?.sourceLabel).toBe("RuneLite sync fresh");
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
    expect(syncSignal?.sourceLabel).toBe("RuneLite sync needs refresh");
    expect(readiness.primaryAction).toEqual({
      label: "Refresh sync",
      href: "/plugin?rsn=Lynx+Titan&from=next#verify-sync"
    });
    expect(readiness.title).toBe("Next planner is ready to plan");
    expect(readiness.body).toContain("Bank and public stats can plan now");
    expect(readiness.body).toContain("Refresh sync before long quests");
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

    expect(readiness.title).toBe("Slayer planner is ready to plan");
    expect(readiness.primaryAction).toEqual({
      label: "Refresh sync",
      href: "/plugin?rsn=Duradel+Main&from=slayer#verify-sync"
    });
    expect(readiness.signals.find((signal) => signal.id === "sync")?.detail).toContain("refresh RuneLite");
  });

  it("keeps the rail title player-facing instead of counting signals", () => {
    const readiness = buildScapestackReadiness({
      surface: "bank",
      hasBankContext: true,
      hasRsn: true,
      hasPluginSync: false,
      rsn: "Lynx Titan"
    });

    expect(readiness.title).toBe("Bank Organizer is ready to plan");
    expect(readiness.body).toContain("Bank and public stats are enough to plan now");
    expect(readiness.title).not.toContain("signals connected");
  });

  it("is mounted on the core product result routes", () => {
    const files = [
      "src/app/bank/page.tsx",
      "src/app/dps/dps-client.tsx",
      "src/app/goals/goals-client.tsx",
      "src/app/slayer/slayer-client.tsx"
    ];

    for (const file of files) {
      const source = readFileSync(join(process.cwd(), file), "utf8");
      expect(source, file).toContain("ScapestackReadinessRail");
      expect(source, file).toContain('surface="');
    }

    const nextSource = readFileSync(join(process.cwd(), "src/app/next/next-client.tsx"), "utf8");
    expect(nextSource).not.toContain("ScapestackReadinessRail");
    expect(nextSource).toContain("Make this smarter");
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
    expect(source).toContain("OSRS name for plan context");
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
