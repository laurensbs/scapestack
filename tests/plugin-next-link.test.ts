import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "src/components/plugin-next-link.tsx"), "utf8");

describe("plugin next link", () => {
  it("preserves browser bank handoff when linking back to /next", () => {
    expect(source).toContain('import { readBankHandoffPayload } from "@/lib/next-bank-handoff";');
    expect(source).toContain('const params = new URLSearchParams(window.location.search);');
    expect(source).toContain('hasBankContext = params.get("bank") !== "none" && readBankHandoffPayload(window).length > 0');
    expect(source).toContain("nextUrlFromPluginSearch(window.location.search, { hasBankContext })");
    expect(source).toContain('useState("/next?from=plugin&bank=none")');
    expect(source).not.toContain('useState("/next?source=plugin-sync&bank=none")');
  });
});
