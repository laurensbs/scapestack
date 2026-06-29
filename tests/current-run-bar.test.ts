import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "src/components/current-run-bar.tsx"), "utf8");

describe("current run bar", () => {
  it("centralizes account, setup, RuneLite and vibe context without a dashboard panel", () => {
    expect(source).toContain('aria-label="Current Scapestack run"');
    expect(source).toContain("getActiveAccount");
    expect(source).toContain("loadSavedBank(savedRsn)");
    expect(source).toContain("Setup added");
    expect(source).toContain("Add setup");
    expect(source).toContain("RuneLite later");
    expect(source).toContain("Best now");
    expect(source).not.toContain("signals");
    expect(source).not.toContain("readiness");
    expect(source).not.toContain("dashboard");
  });
});
