import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "src/components/header.tsx"), "utf8");

describe("global header navigation", () => {
  it("marks Scapestack brand and primary tools with explicit navigation labels", () => {
    expect(source).toContain('aria-label="Scapestack home"');
    expect(source).toContain('aria-label="Primary Scapestack tools"');
    expect(source).toContain('aria-label={`${tool.navLabel ?? tool.name}: ${tool.short}`}');
    expect(source).toContain('aria-current={active ? "page" : undefined}');
    expect(source).toContain("AccountSwitcher");
    expect(source).toContain("Add RSN");
    expect(source).toContain("SAVED_BANK_EVENT");
    expect(source).toContain("window.addEventListener(SAVED_BANK_EVENT, refresh)");
    expect(source).toContain("window.addEventListener(SAVED_BANK_EVENT, syncAccount)");
    expect(source).toContain("describeSavedAt");
    expect(source).toContain("Bank saved ${describeSavedAt(bankSavedAt)}");
    expect(source).toContain("Bank added");
    expect(source).toContain("Add bank");
    expect(source).toContain("Refresh RuneLite");
    expect(source).toContain("Add RuneLite");
    expect(source).toContain("runeliteReady");
    expect(source).toContain("<CheckCircle2");
    expect(source).toContain("<RefreshCw");
    expect(source).toContain("Remove account");
    expect(source).toContain("Remove ${rsn} from Scapestack on this device?");
    expect(source).toContain("const removingLegacy = loadSavedRsn()?.trim().toLowerCase() === rsn.trim().toLowerCase();");
    expect(source).toContain("if (removingActive || removingLegacy) clearSavedRsn();");
    expect(source).toContain("removeAccount(rsn);");
    expect(source).toContain("<Package");
    expect(source).toContain("<PlugZap");
    expect(source).toContain("CurrentRunBar");
  });

  it("surfaces the core Plan → Setup → Kill loop as clickable navigation", () => {
    expect(source).toContain("LOOP_STEPS");
    expect(source).toContain('{ label: "Plan", href: "/next" }');
    expect(source).toContain('{ label: "Bank", href: "/bank" }');
    expect(source).toContain('{ label: "Kill", href: "/dps" }');
    expect(source).toContain("Your account");
    expect(source).toContain("Saved once. Used everywhere.");
    expect(source).toContain('aria-label={`${step.label} in Scapestack loop`}');
  });

  it("connects the mobile menu button to the mobile drawer state", () => {
    expect(source).toContain('const mobileNavId = "scapestack-mobile-nav"');
    expect(source).toContain("aria-controls={mobileNavId}");
    expect(source).toContain("aria-expanded={mobileOpen}");
    expect(source).toContain('aria-label="Mobile Scapestack tools"');
    expect(source).toContain("id={mobileNavId}");
  });
});
