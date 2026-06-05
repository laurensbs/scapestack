import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { bankReturnContextFromSource } from "@/lib/bank-return-context";

describe("bank return context", () => {
  it("explains why DPS users should refresh bank gear", () => {
    expect(bankReturnContextFromSource("dps")).toMatchObject({
      source: "dps",
      label: "Back from DPS",
      title: "Update combat gear before trusting boss DPS"
    });
    expect(bankReturnContextFromSource("dps")?.body).toContain("weapons, upgrades and supplies");
  });

  it("keeps plugin sync separate from browser-only bank paste", () => {
    expect(bankReturnContextFromSource("plugin")).toMatchObject({
      source: "plugin",
      label: "Back from sync setup"
    });
    expect(bankReturnContextFromSource("plugin")?.body).toContain("RuneLite verifies account state only");
  });

  it("ignores unknown or missing source markers", () => {
    expect(bankReturnContextFromSource(null)).toBeNull();
    expect(bankReturnContextFromSource("unknown")).toBeNull();
  });

  it("renders the return context banner on bank intake", () => {
    const source = readFileSync(join(process.cwd(), "src/app/bank/page.tsx"), "utf8");

    expect(source).toContain("function bankReturnContextFromUrl()");
    expect(source).toContain("bankReturnContextFromSource(new URLSearchParams(window.location.search).get(\"from\"))");
    expect(source).toContain("<BankReturnContextBanner context={returnContext} rsn={prefilledRsn} />");
    expect(source).toContain('data-testid="bank-return-context-banner"');
    expect(source).toContain("RSN: <span");
  });
});
