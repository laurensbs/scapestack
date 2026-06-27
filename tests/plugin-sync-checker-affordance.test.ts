import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "src/components/plugin-sync-checker.tsx"), "utf8");

describe("plugin sync checker affordance", () => {
  it("labels the RSN verifier as a real RuneLite sync form", () => {
    expect(source).toContain('const rsnHelpId = "plugin-sync-rsn-help";');
    expect(source).toContain('const rsnStatusId = "plugin-sync-rsn-status";');
    expect(source).toContain('htmlFor="plugin-sync-rsn"');
    expect(source).toContain('id="plugin-sync-rsn"');
    expect(source).toContain('name="rsn"');
    expect(source).toContain('type="text"');
    expect(source).toContain("maxLength={12}");
    expect(source).toContain('autoComplete="off"');
    expect(source).toContain("spellCheck={false}");
    expect(source).toContain("aria-describedby={`${rsnHelpId} ${rsnStatusId}`}");
    expect(source).toContain("Same display name as RuneLite");
    expect(source).toContain("Max 12 characters");
  });

  it("announces checker state and names every verifier action by RSN", () => {
    expect(source).toContain('role="status"');
    expect(source).toContain("Checking RuneLite sync for");
    expect(source).toContain("Ready to check RuneLite sync for");
    expect(source).toContain("Enter an OSRS name to check RuneLite sync.");
    expect(source).toContain("aria-label={normalized ? `Check sync for ${normalized}` : \"Enter an OSRS name before checking sync\"}");
    expect(source).toContain("aria-label={`Re-check RuneLite sync for ${state.rsn} after logging in`}");
    expect(source).toContain("aria-label={`Re-check RuneLite sync for ${foundDisplayName}`}");
  });

  it("keeps found-sync actions to open next or check again", () => {
    expect(source).toContain("RuneLite is helping {foundDisplayName}");
    expect(source).toContain("Open one plan that skips finished quests");
    expect(source).toContain("Open one plan");
    expect(source).toContain("Check again");
    expect(source).not.toContain("formatPluginSyncSessionChecklist");
    expect(source).not.toContain("Copy checklist");
    expect(source).not.toContain("Copy proof");
    expect(source).not.toContain("Manual sync proof fallback");
  });

  it("shows only the sync status chips players need", () => {
    expect(source).toContain("Synced {syncAgeLabel(state.player.syncedAt)}");
    expect(source).not.toContain("{state.player.questsCompleted.length} quests");
    expect(source).not.toContain("{state.player.diariesCompleted.length} diary tiers");
    expect(source).not.toContain("{state.player.collectionLogItemIds.length.toLocaleString()} log items");
    expect(source).toContain("Slayer task ready");
    expect(source).not.toContain('data-testid="plugin-sync-receipt"');
    expect(source).not.toContain("RuneLite sync receipt");
    expect(source).not.toContain("Add bank context");
  });

  it("makes missing-sync recovery a direct RuneLite setup path", () => {
    expect(source).not.toContain('fetch("/api/plugin-hub/status"');
    expect(source).not.toContain("scapestackPluginHubStateFromStatus(body)");
    expect(source).not.toContain("Plugin Hub review handoff is blocked");
    expect(source).not.toContain("Open plugin review status");
    expect(source).not.toContain("canShowMissingSetup");
    expect(source).not.toContain("review-readiness");
    expect(source).toContain("In RuneLite: turn on Scapestack Sync, press Sync now, then check again.");
    expect(source).toContain("Copy scapestack.org sync URL");
    expect(source).toContain("Sync URL copied");
    expect(source).not.toContain("Copy claim URL");
    expect(source).toContain('state.kind === "unconfigured" && diagnostic');
  });
});
