import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("bank result profile handoff", () => {
  it("links resolved bank RSNs back to the Scapestack player profile", () => {
    const source = readFileSync(join(process.cwd(), "src/components/bank-result.tsx"), "utf8");

    expect(source).toContain('import { rsnSlug } from "@/lib/hiscores";');
    expect(source).toContain('href={`/u/${encodeURIComponent(rsnSlug(inferredRsn))}`}');
    expect(source).toContain("Open ${inferredRsn}'s Scapestack profile");
    expect(source).toContain("hover:underline");
  });
});
