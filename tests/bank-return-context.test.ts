import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { bankReturnContextFromSource } from "@/lib/bank-return-context";
import { playerToolSectionPath, sectionFromBankQuery } from "@/lib/player-tool-route";

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

  it("renders only the nameless bank intake instead of a result destination", () => {
    const source = readFileSync(join(process.cwd(), "src/app/bank/bank-intake-only.tsx"), "utf8");

    expect(source).toContain('className="scape-dialog');
    expect(source).toContain("Add bank once");
    expect(source).toContain("<Intake");
    expect(source).toContain("compactSave");
    expect(source).toContain("askRsn");
    expect(source).toContain('saveLabel="Open player page"');
    expect(source).not.toContain("<BankResult");
    expect(source).not.toContain("<BankAffordabilityPanel");
  });

  it("keeps the matching profile section while a nameless DPS visitor adds a bank", () => {
    expect(sectionFromBankQuery({ from: "dps" })).toBe("bosses");
    expect(playerToolSectionPath("Lynx Titan", sectionFromBankQuery({ from: "dps" })))
      .toBe("/p/Lynx%20Titan#bosses");
  });
});
