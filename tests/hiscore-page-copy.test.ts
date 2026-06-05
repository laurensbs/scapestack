import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "src/app/hiscore/page.tsx"), "utf8");

describe("hiscore lookup page copy and labels", () => {
  it("labels the RSN lookup input instead of relying on placeholder text", () => {
    expect(source).toContain('htmlFor="hiscore-rsn-input"');
    expect(source).toContain("OSRS name for Hiscore lookup");
    expect(source).toContain('id="hiscore-rsn-input"');
    expect(source).toContain('aria-describedby="hiscore-rsn-help"');
    expect(source).toContain('id="hiscore-rsn-help"');
    expect(source).toContain("Player names are capped at 12 characters");
    expect(source).toContain('aria-label="Look up OSRS player Hiscores"');
  });
});
