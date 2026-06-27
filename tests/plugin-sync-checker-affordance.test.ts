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
    expect(source).toContain('aria-label="Re-check RuneLite sync before opening /next"');
  });

  it("keeps proof and /next handoff actions explicit about RuneLite sync", () => {
    expect(source).toContain('formatPluginSyncSessionChecklist(state.player, { origin: syncOrigin })');
    expect(source).toContain("aria-label={`Copy RuneLite to Scapestack session checklist for ${player.displayName || player.rsn}`}");
    expect(source).toContain("Copy checklist");
    expect(source).toContain("Checklist copied");
    expect(source).toContain("Clipboard failed — copy session checklist manually");
    expect(source).toContain("Manual session checklist fallback for ${player.displayName || player.rsn}");
    expect(source).toContain("aria-label={`Copy safe sync proof for ${player.displayName || player.rsn}`}");
    expect(source).toContain("aria-label={`${readiness.actionLabel} for RuneLite sync`}");
    expect(source).toContain("never includes tokens, bank, inventory, chat, screenshots or account login");
  });

  it("shows a sync receipt and keeps bank context browser-only", () => {
    expect(source).toContain('data-testid="plugin-sync-receipt"');
    expect(source).toContain("RuneLite sync receipt");
    expect(source).toContain("Scapestack received progress only");
    expect(source).toContain("quest completions, diary tiers, collection-log items and optional Slayer state");
    expect(source).toContain("Bank, inventory, equipment, chat, screenshots and login credentials are not part of Scapestack Sync.");
    expect(source).toContain('const bankHref = `/bank?rsn=${encodeURIComponent(displayName)}&from=plugin`;');
    expect(source).toContain("Add bank context");
    expect(source).toContain("Add browser-only bank context for ${displayName}");
  });

  it("makes missing-sync recovery a direct RuneLite setup path", () => {
    expect(source).not.toContain('fetch("/api/plugin-hub/status"');
    expect(source).not.toContain("scapestackPluginHubStateFromStatus(body)");
    expect(source).not.toContain("Plugin Hub review handoff is blocked");
    expect(source).not.toContain("Open plugin review status");
    expect(source).not.toContain("canShowMissingSetup");
    expect(source).not.toContain("review-readiness");
    expect(source).toContain("In RuneLite: enable Scapestack Sync, press Sync now, then check again.");
    expect(source).toContain('<CopyCommand value={syncUrls.sync} label="Copy sync URL" />');
    expect(source).not.toContain("Copy claim URL");
    expect(source).toContain('state.kind === "unconfigured" && diagnostic');
  });
});
