import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "src/components/current-run-bar.tsx"), "utf8");

describe("current run bar", () => {
  it("centralizes account, setup, RuneLite and vibe context without a dashboard panel", () => {
    expect(source).toContain('aria-label="Scapestack account setup"');
    expect(source).toContain("getActiveAccount");
    expect(source).toContain("SAVED_BANK_EVENT");
    expect(source).toContain("window.addEventListener(SAVED_BANK_EVENT, refresh)");
    expect(source).toContain("describeSavedAt");
    expect(source).toContain("Bank saved ${describeSavedAt(bankSavedAt)}");
    expect(source).toContain("loadSavedBank(savedRsn)");
    expect(source).toContain("loadMood(savedRsn)");
    expect(source).toContain("Bank added");
    expect(source).toContain("Add bank");
    expect(source).toContain("Add RuneLite");
    expect(source).toContain("Best now");
    expect(source).not.toContain("signals");
    expect(source).not.toContain("readiness");
    expect(source).not.toContain("dashboard");
  });
});
