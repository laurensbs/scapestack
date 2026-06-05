import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("profile local bank summary", () => {
  it("uses saved RSN snapshot history and exposes next-step actions", () => {
    const source = readFileSync(join(process.cwd(), "src/app/u/[rsn]/local-bank-summary.tsx"), "utf8");

    expect(source).toContain('import { latestSnapshot } from "@/lib/snapshot-history";');
    expect(source).toContain("setSnap(latestSnapshot(rsn))");
    expect(source).toContain('bankOrganizerHref(rsn, "profile")');
    expect(source).toContain('toolHandoffUrl("/next", "profile", rsn)');
    expect(source).toContain('import { persistBankHandoffPayloadFromItems } from "@/lib/next-bank-handoff";');
    expect(source).toContain('import { bankHandoffItemsFromSnapshot } from "@/lib/profile-bank-handoff";');
    expect(source).toContain("persistBankHandoffPayloadFromItems(bankHandoffItemsFromSnapshot(snap), window)");
    expect(source).toContain("window.location.href = nextHref");
    expect(source).toContain('type="button"');
    expect(source).toContain("onClick={openNextWithBank}");
    expect(source).toContain("Refresh bank");
    expect(source).toContain("Plan with this bank");
  });
});
