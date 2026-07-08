import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { bankReturnContextFromSource } from "@/lib/bank-return-context";

describe("bank return context", () => {
  it("explains why DPS users should refresh bank gear", () => {
    expect(bankReturnContextFromSource("dps")).toMatchObject({
      source: "dps",
      label: "Back from kill check",
      title: "Update combat gear before trusting the boss trip"
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

  it("renders the bank intake as a save popup instead of a full return page", () => {
    const source = readFileSync(join(process.cwd(), "src/app/bank/page.tsx"), "utf8");

    expect(source).toContain('role="dialog"');
    expect(source).toContain('data-testid="bank-save-popup"');
    expect(source).toContain("Add bank");
    expect(source).toContain("Paste once. Save. Better trips everywhere.");
    expect(source).toContain("compactSave");
    expect(source).toContain('saveLabel="Save bank"');
    expect(source).toContain("SavedBankChoice");
    expect(source).toContain("Use saved bank");
    expect(source).toContain("Back to plan");
    expect(source).toContain("autoLoadedSavedBank");
    expect(source).toContain("onIntakeSubmit(savedBank.banktags, false, prefilledRsn)");
    expect(source).toContain("Replace");
    expect(source).toContain("Remove");
    expect(source).toContain("bankCloseHref");
    expect(source).not.toContain("<SavedBankBanner");
    expect(source).not.toContain("<BankReturnContextBanner");
    expect(source).not.toContain('data-testid="bank-return-context-banner"');
  });

  it("keeps a DPS boss target while setup is added on the bank page", () => {
    const source = readFileSync(join(process.cwd(), "src/app/bank/page.tsx"), "utf8");

    expect(source).toContain("function bossFromUrl()");
    expect(source).toContain('new URLSearchParams(window.location.search).get("boss")');
    expect(source).toContain("const [returnBossSlug, setReturnBossSlug] = useState<string | null>(null);");
    expect(source).toContain("setReturnBossSlug(bossFromUrl());");
    expect(source).toContain("returnBossSlug={returnBossSlug}");
  });
});
