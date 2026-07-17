import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "src/components/add-bank-modal.tsx"), "utf8");

describe("AddBankModal", () => {
  it("keeps add-bank as one small paste or drop modal with optional help", () => {
    expect(source).toContain("export function AddBankModal");
    expect(source).toContain('role="dialog"');
    expect(source).toContain('aria-labelledby="add-bank-modal-title"');
    expect(source).toContain("Add bank");
    expect(source).toContain("Paste Bank Memory once. Scapestack saves it on this device.");
    expect(source).toContain("BANK_MEMORY_EXAMPLE");
    expect(source).toContain("How to copy your bank");
    expect(source).toContain('<BankSetupSteps compact className="mt-3" />');
    expect(source).toContain("dropBankFile");
    expect(source).toContain("readBankFile");
    expect(source).toContain("Drop .txt, .tsv or .csv here");
    expect(source).toContain("Choose file");
    expect(source).toContain("Paste");
    expect(source).toContain("Save bank");
    expect(source).toContain("Organize this bank instead");
    expect(source).toContain("navigator.clipboard.readText()");
    expect(source).toContain("Clipboard blocked. Paste manually below.");
  });

  it("saves bank to the active RSN without asking for another name", () => {
    expect(source).toContain("getActiveAccount()?.rsn");
    expect(source).toContain("loadSavedRsn()");
    expect(source).toContain("saveSavedBank(trimmed, effectiveRsn || null);");
    expect(source).toContain("if (effectiveRsn) saveSavedRsn(effectiveRsn);");
    expect(source).toContain("onSaved?.(trimmed, effectiveRsn);");
    expect(source).toContain("Attaches to ${effectiveRsn}");
    expect(source).not.toContain('name="rsn"');
    expect(source).not.toContain("OSRS name");
  });
});
