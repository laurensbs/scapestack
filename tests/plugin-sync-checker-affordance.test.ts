import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "src/components/plugin-sync-checker.tsx"), "utf8");

describe("plugin sync checker affordance", () => {
  it("keeps a labelled RSN form only for accounts that need it", () => {
    expect(source).toContain('const rsnHelpId = "plugin-sync-rsn-help";');
    expect(source).toContain('const rsnStatusId = "plugin-sync-rsn-status";');
    expect(source).toContain('htmlFor="plugin-sync-rsn"');
    expect(source).toContain('id="plugin-sync-rsn"');
    expect(source).toContain('name="rsn"');
    expect(source).toContain("maxLength={12}");
    expect(source).toContain('aria-describedby={`${helpId} ${statusId}`}');
    expect(source).toContain("Same display name as RuneLite. Max 12 characters.");
    expect(source).toContain("Use another RSN");
  });

  it("automatically checks URL, active or saved RSN in that order", () => {
    expect(source).toContain('const fromUrl = params.get("rsn")?.trim() ?? "";');
    expect(source).toContain('const active = getActiveAccount()?.rsn?.trim() ?? "";');
    expect(source).toContain("const initialRsn = fromUrl || active || saved;");
    expect(source).toContain('checkRsnValue(initialRsn, fromUrl ? "url" : active ? "active" : "saved")');
    expect(source).toContain("window.addEventListener(ACCOUNT_EVENT, handleAccountChange)");
    expect(source).toContain('if (!active) {');
    expect(source).toContain('setRsn("")');
    expect(source).toContain("requestIdRef.current += 1");
  });

  it("ignores an older check after the player switches account", () => {
    expect(source).toContain("const requestId = ++requestIdRef.current");
    expect(source).toContain("if (requestId !== requestIdRef.current) return;");
  });

  it("announces checks and names refresh actions by account", () => {
    expect(source).toContain('role="status"');
    expect(source).toContain("Checking RuneLite for");
    expect(source).toContain("Enter an OSRS name to check RuneLite.");
    expect(source).toContain('aria-label={`Re-check RuneLite sync for ${state.rsn} after pressing Sync now`}');
    expect(source).toContain('aria-label={`Refresh RuneLite status for ${foundDisplayName}`}');
  });

  it("uses one connected-state story instead of status chips", () => {
    expect(source).toContain("pluginConnectionView(state.player)");
    expect(source).toContain("{connection.title}");
    expect(source).toContain("{connection.scanLabel}");
    expect(source).toContain("{connection.changedLine}");
    expect(source).toContain("{connection.bankLine}");
    expect(source).toContain("Open next plan");
    expect(source).not.toContain("AccountModeBadge");
    expect(source).not.toContain("Slayer task ready");
    expect(source).not.toContain("ServiceReadinessPill");
  });

  it("clears false local connection state when no scan exists", () => {
    expect(source).toContain('if (next.kind === "missing")');
    expect(source).toContain("clearRuneliteChecked(clean)");
    expect(source).toContain("markAccountPluginBankStatus(clean, null)");
    expect(source).toContain('title="Press Sync now"');
    expect(source).toContain("install or enable Scapestack Sync, then press Sync now");
    expect(source).toContain("<RuneliteOpenButton compact />");
  });

  it("hides service commands behind explicit technical troubleshooting", () => {
    expect(source).toContain("Technical troubleshooting");
    expect(source).toContain("Copy service setup command");
    expect(source).toContain("This is not a RuneLite account problem.");
    expect(source.indexOf("Technical troubleshooting")).toBeLessThan(source.indexOf("Copy service setup command"));
    expect(source).not.toContain("Copy scapestack.org sync URL");
    expect(source).not.toContain("LOCAL_SYNC_URL");
  });
});
