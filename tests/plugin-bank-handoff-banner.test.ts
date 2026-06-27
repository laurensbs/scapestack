import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "src/components/plugin-bank-handoff-banner.tsx"), "utf8");

describe("plugin bank handoff banner", () => {
  it("passes the URL RSN into bridge actions", () => {
    expect(source).toContain('const [rsn, setRsn] = useState("");');
    expect(source).toContain("const actions = buildPluginBankBridgeActions(rsn);");
    expect(source).toContain('setRsn(params.get("rsn")?.trim() ?? "");');
  });

  it("does not surface stale browser bank context when bank=none is explicit", () => {
    expect(source).toContain('params.get("bank") === "none"');
    expect(source).toContain("setSummary(null);");
    expect(source).toContain("return;");
  });

  it("does not claim exact /next before sync verification", () => {
    expect(source).toContain("Sync can help this plan");
    expect(source).toContain("repeats quests, diaries, log items or Slayer");
    expect(source).toContain('data-testid="plugin-bank-sync-signals"');
    expect(source).toContain("{signal.detail}");
    expect(source).toContain("Added after sync check.");
    expect(source).not.toContain("Sync can now sharpen this exact bank plan");
    expect(source).not.toContain("Plan exact /next");
    expect(source).not.toContain("Exact unlock checks");
  });

  it("surfaces bank-aware downstream tools from the plugin handoff", () => {
    expect(source).toContain("Crosshair");
    expect(source).toContain("Skull");
    expect(source).toContain('action.id === "dps"');
    expect(source).toContain('action.id === "slayer"');
  });
});
