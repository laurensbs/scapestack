import { describe, expect, it } from "vitest";
import { releaseDriftChangesFromStatus, summarizePluginReleaseDrift } from "@/lib/plugin-release-drift";

describe("plugin release drift", () => {
  it("filters git status to Plugin Hub handoff paths", () => {
    const changes = releaseDriftChangesFromStatus([
      " M plugin/src/main/java/app/scapestack/runelite/ScapestackSyncPlugin.java",
      "?? src/app/plugin/page.tsx",
      "?? src/components/plugin-sync-checker.tsx",
      "?? src/lib/plugin-sync-proof.ts",
      " M src/app/bank/page.tsx",
      " M scripts/extract-plugin.sh",
      "?? scripts/print-plugin-review-packet.ts",
      "?? tests/plugin-review-packet.test.ts",
      " M README.md"
    ].join("\n"));

    expect(changes.map((change) => change.path)).toEqual([
      "plugin/src/main/java/app/scapestack/runelite/ScapestackSyncPlugin.java",
      "src/app/plugin/page.tsx",
      "src/components/plugin-sync-checker.tsx",
      "src/lib/plugin-sync-proof.ts",
      "scripts/extract-plugin.sh",
      "scripts/print-plugin-review-packet.ts",
      "tests/plugin-review-packet.test.ts"
    ]);
  });

  it("summarizes dirty release drift without double-counting plugin paths", () => {
    const drift = summarizePluginReleaseDrift([
      { status: "M", path: "plugin/src/main/java/app/scapestack/runelite/ScapestackSyncPlugin.java" },
      { status: "M", path: "plugin/src/test/java/app/scapestack/runelite/ScapestackSyncPluginTest.java" },
      { status: "M", path: "plugin/PUBLISHING.md" },
      { status: "M", path: "src/app/plugin/page.tsx" },
      { status: "M", path: "src/components/plugin-sync-checker.tsx" },
      { status: "M", path: "src/lib/plugin-sync-proof.ts" },
      { status: "M", path: "scripts/print-plugin-review-packet.ts" },
      { status: "M", path: "tests/plugin-review-packet.test.ts" },
      { status: "M", path: "scripts/check-plugin-release.mjs" }
    ]);

    expect(drift.status).toBe("dirty");
    expect(drift.count).toBe(9);
    expect(drift.groups).toEqual([
      { label: "Plugin source", count: 1 },
      { label: "Plugin tests", count: 1 },
      { label: "Plugin build/docs", count: 1 },
      { label: "Web Plugin surface", count: 3 },
      { label: "Release tooling/tests", count: 3 }
    ]);
    expect(drift.samplePaths).toHaveLength(6);
  });

  it("summarizes a clean checkout as release-ready", () => {
    expect(summarizePluginReleaseDrift([])).toEqual({
      status: "clean",
      count: 0,
      groups: [],
      samplePaths: []
    });
  });
});
