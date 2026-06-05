import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const sources = [
  "src/lib/next-up.ts",
  "src/lib/path-progress.ts",
  "src/app/next/next-client.tsx"
].map((file) => ({
  file,
  source: readFileSync(join(process.cwd(), file), "utf8")
}));

describe("diary recommendation copy", () => {
  it("does not overclaim that Hiscores prove every diary task is clear", () => {
    for (const { file, source } of sources) {
      expect(source, file).not.toContain("skills now clear every");
      expect(source, file).not.toContain("clear every task in this tier");
      expect(source, file).not.toContain("clear every Hard task");
    }
  });

  it("describes diary eligibility as visible skill-gate evidence", () => {
    const combined = sources.map(({ source }) => source).join("\n");

    expect(combined).toContain("visible stats clear");
    expect(combined).toContain("skill gates");
  });
});
