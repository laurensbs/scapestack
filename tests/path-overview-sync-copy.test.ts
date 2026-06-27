import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "src/components/path-overview.tsx"), "utf8");

describe("path overview sync copy", () => {
  it("uses status-first plugin copy when coverage is estimated", () => {
    expect(source).toContain("Estimated · uses skill/QP heuristics");
    expect(source).toContain("Want synced progress? Check RuneLite sync before setup");
    expect(source).toContain('pluginVerifyUrlForSyncedRsn(meta?.displayName ?? "", "next")');
  });

  it("does not imply Plugin Hub install is already available", () => {
    expect(source).not.toContain("Open the Scapestack RuneLite plugin guide");
    expect(source).not.toContain("Install Scapestack Sync");
  });
});
