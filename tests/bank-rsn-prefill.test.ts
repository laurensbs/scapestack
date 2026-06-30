import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("bank RSN prefill", () => {
  it("passes the bank URL rsn query into the intake form", () => {
    const pageSource = readFileSync(join(process.cwd(), "src/app/bank/page.tsx"), "utf8");
    const intakeSource = readFileSync(join(process.cwd(), "src/components/intake.tsx"), "utf8");

    expect(pageSource).toContain("rsnFromUrl");
    expect(pageSource).toContain("initialRsn={prefilledRsn}");
    expect(intakeSource).toContain("initialRsn");
    expect(intakeSource).toContain("rsnFromCurrentUrl");
    expect(intakeSource).toContain("saveStoredRsn(urlRsn)");
    expect(intakeSource).toContain("getActiveAccount()?.rsn");
    expect(intakeSource).toContain("const cleanedRsn = targetRsn;");
    expect(intakeSource).not.toContain("RSN overgenomen uit je vorige Scapestack stap.");
    expect(intakeSource).not.toContain('id="bank-rsn-input"');
  });
});
