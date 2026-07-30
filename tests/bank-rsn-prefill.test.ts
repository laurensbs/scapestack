import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { playerToolSectionPath, rsnFromToolQuery } from "@/lib/player-tool-route";

describe("bank RSN prefill", () => {
  it("sends a bank URL with an RSN straight to the canonical player page", () => {
    const pageSource = readFileSync(join(process.cwd(), "src/app/bank/page.tsx"), "utf8");
    const intakeSource = readFileSync(join(process.cwd(), "src/components/intake.tsx"), "utf8");

    expect(pageSource).toContain("rsnFromToolQuery(query)");
    expect(pageSource).toContain("redirect(playerToolSectionPath(rsn, section))");
    expect(playerToolSectionPath(rsnFromToolQuery({ rsn: "Lynx Titan" }), "sets"))
      .toBe("/p/Lynx%20Titan#sets");
    expect(intakeSource).toContain("initialRsn");
    expect(intakeSource).toContain("rsnFromCurrentUrl");
    expect(intakeSource).toContain("saveStoredRsn(urlRsn)");
    expect(intakeSource).toContain("getActiveAccount()?.rsn");
    expect(intakeSource).toContain("const cleanedRsn = targetRsn;");
    expect(intakeSource).not.toContain("RSN overgenomen uit je vorige Scapestack stap.");
    expect(intakeSource).toContain('id="bank-rsn-input"');
  });
});
