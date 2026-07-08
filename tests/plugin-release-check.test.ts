import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import pkg from "../package.json";
import { describe, expect, it } from "vitest";

describe("plugin release check", () => {
  it("runs the offline Plugin Hub readiness gate", () => {
    const output = execFileSync("node", ["scripts/check-plugin-release.mjs", "--offline"], {
      encoding: "utf8"
    });

    expect(output).toContain(`Offline Plugin Hub release checks passed for v${pkg.version}`);
    expect(output).toContain("opt-in defaults");
    expect(output).toContain("standalone extract surface");
    expect(output).not.toContain("Live Plugin Hub release check passed");
  });

  it("exposes release-check commands for local and live review work", () => {
    expect(pkg.scripts["plugin:release-check"]).toBe("node scripts/check-plugin-release.mjs --offline");
    expect(pkg.scripts["plugin:release-check:live"]).toBe("node scripts/check-plugin-release.mjs --live-pr");
    expect(pkg.scripts["plugin:release-plan"]).toBe("node scripts/check-plugin-release.mjs --plan");
    expect(pkg.scripts["plugin:review-packet"]).toBe("tsx scripts/print-plugin-review-packet.ts");
    expect(pkg.scripts["plugin:pr-update-command"]).toBe("tsx scripts/print-plugin-review-packet.ts --gh-command");
    expect(pkg.scripts["plugin:review-reply-command"]).toBe("tsx scripts/print-plugin-review-packet.ts --reply-command");
    expect(pkg.scripts["plugin:review-handoff-command"]).toBe("tsx scripts/print-plugin-review-packet.ts --handoff-command");
  });

  it("prints the Plugin Hub handoff checklist before publishing", () => {
    const output = execFileSync("node", ["scripts/check-plugin-release.mjs", "--plan"], {
      encoding: "utf8"
    });

    expect(output).toContain("Release plan:");
    expect(output).toContain("Local release-impact changes:");
    expect(output).toContain("Release-impact groups:");
    expect(output).toContain("First changed paths:");
    expect(output).toContain("Standalone handoff repo:");
    expect(output).toContain("extract-plugin.sh");
    expect(output).toContain("--dry-run");
    expect(output).toContain("plugins/scapestack-sync commit=<new sha>");
    expect(output).toContain("plugin:release-check:live");
    expect(output).toContain("npm run ci:check");
    expect(output).toContain("Plugin Hub pin equals the standalone head");
    expect(output).toContain("plugin:review-packet");
    expect(output).toContain("plugin:review-reply-command");
    expect(output).toContain("plugin:review-handoff-command");
    expect(output).toContain("replace stale PR-body copy");
    expect(output).toContain("sync is opt-in");
    expect(output).toContain("posted data is RSN + game-state only");
  });

  it("summarizes standalone repo status for handoff decisions", async () => {
    // @ts-expect-error The release helper is a Node CLI .mjs file.
    const helper = await import("../scripts/check-plugin-release.mjs") as {
      summarizeStandaloneStatus: (
        statusText: string,
        head?: string,
        target?: string
      ) => { count: number; dirty: boolean; summary: string };
    };

    const dirty = helper.summarizeStandaloneStatus([
      " M README.md",
      "?? src/main/java/app/scapestack/runelite/SyncGate.java"
    ].join("\n"), "39931dc965e4e9f01bf549bdc192b85c4cd6c1fc", "/tmp/scapestack-runelite-plugin");
    const clean = helper.summarizeStandaloneStatus("", "39931dc965e4e9f01bf549bdc192b85c4cd6c1fc", "/tmp/scapestack-runelite-plugin");

    expect(dirty).toMatchObject({ count: 2, dirty: true });
    expect(dirty.summary).toContain("2 uncommitted paths ready to commit");
    expect(dirty.summary).toContain("39931dc");
    expect(clean).toMatchObject({ count: 0, dirty: false });
    expect(clean.summary).toContain("is clean at head 39931dc");
  });

  it("documents the reviewer packet handoff in publishing docs", () => {
    const publishing = readFileSync("plugin/PUBLISHING.md", "utf8");

    expect(publishing).toContain("npm run plugin:review-packet");
    expect(publishing).toContain("npm run plugin:review-reply-command");
    expect(publishing).toContain("npm run plugin:review-handoff-command");
    expect(publishing).toContain("Paste that packet into the Plugin Hub PR body");
    expect(publishing).toContain("rewrites the stale PR body");
    expect(publishing).toContain("Replace stale PR-body copy");
    expect(publishing).toContain("raw token is only sent as the Authorization bearer");
    expect(publishing).toContain("web-app merge contract");
    expect(publishing).toContain("/next?rsn=...&source=plugin-sync&bank=none");
    expect(publishing).toContain("prevents stale");
    expect(publishing).toContain("browser-only Bank Memory or Bank Tags paste");
    expect(publishing).toContain("Ambiguous web handoff");
  });

  it("filters git status to release-impact paths", async () => {
    // @ts-expect-error The release helper is a Node CLI .mjs file.
    const helper = await import("../scripts/check-plugin-release.mjs") as {
      releaseImpactChangesFromStatus: (statusText: string) => Array<{ status: string; path: string }>;
    };

    expect(helper.releaseImpactChangesFromStatus([
      " M plugin/src/main/java/app/scapestack/runelite/ScapestackSyncPlugin.java",
      "?? src/app/plugin/page.tsx",
      "?? src/components/plugin-sync-checker.tsx",
      "?? src/lib/plugin-sync-proof.ts",
      " M src/app/bank/page.tsx",
      "?? scripts/print-plugin-review-packet.ts",
      "?? tests/plugin-review-packet.test.ts",
      "?? tests/plugin-release-check.test.ts"
    ].join("\n")).map((entry) => entry.path)).toEqual([
      "plugin/src/main/java/app/scapestack/runelite/ScapestackSyncPlugin.java",
      "src/app/plugin/page.tsx",
      "src/components/plugin-sync-checker.tsx",
      "src/lib/plugin-sync-proof.ts",
      "scripts/print-plugin-review-packet.ts",
      "tests/plugin-review-packet.test.ts",
      "tests/plugin-release-check.test.ts"
    ]);
  });

  it("groups release-impact paths by handoff area", async () => {
    // @ts-expect-error The release helper is a Node CLI .mjs file.
    const helper = await import("../scripts/check-plugin-release.mjs") as {
      groupReleaseImpactChanges: (
        changes: Array<{ status: string; path: string }>
      ) => Array<{ label: string; changes: Array<{ status: string; path: string }> }>;
    };

    const groups = helper.groupReleaseImpactChanges([
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

    expect(groups.map((group) => [group.label, group.changes.length])).toEqual([
      ["Plugin source", 1],
      ["Plugin tests", 1],
      ["Plugin build/docs", 1],
      ["Web Plugin surface", 3],
      ["Release tooling/tests", 3]
    ]);
  });

  it("detects stale live PR body copy before maintainer review", async () => {
    // @ts-expect-error The release helper is a Node CLI .mjs file.
    const helper = await import("../scripts/check-plugin-release.mjs") as {
      reviewCopyIssuesFromBody: (body: string) => string[];
    };

    expect(helper.reviewCopyIssuesFromBody([
      "Sync on login defaults to on.",
      "The raw token never leaves the install.",
      "POST `https://www.scapestack.org/api/sync` on every login + on quest-complete chat messages.",
      "Shutdown interrupts the named daemon sync worker.",
      "No IP, no machine fingerprint, no chat-log content."
    ].join("\n"))).toEqual([
      "sync-on-login defaults",
      "token transport",
      "POST timing",
      "shutdown thread interrupt",
      "quest-complete opt-in gate",
      "Slayer payload",
      "bank/inventory/equipment exclusion"
    ]);

    expect(helper.reviewCopyIssuesFromBody([
      "Sync on login defaults off.",
      "Refresh after quests defaults off.",
      "Quest-complete refresh is also gated behind Sync on login.",
      "The raw install token is sent only as an Authorization bearer; Scapestack stores sha256(token).",
      "Slayer task state is included after opt-in.",
      "Shutdown cancels the active OkHttp call while the background worker returns normally.",
      "Bank sync sends item IDs/names/quantities only after separate opt-in. No inventory or equipment data is sent."
    ].join("\n"))).toEqual([]);

    expect(helper.reviewCopyIssuesFromBody([
      "Live PR body appears aligned with current consent, token, data and web-handoff wording.",
      "Shutdown interrupts the named daemon sync worker.",
      "Sync on login defaults off.",
      "Refresh after quests defaults off.",
      "Quest-complete refresh is also gated behind Sync on login.",
      "Slayer task state is included after opt-in.",
      "Bank sync sends item IDs/names/quantities only after separate opt-in. No inventory or equipment data is sent."
    ].join("\n"))).toContain("shutdown thread interrupt");
  });

  it("documents live PR body as a hard release gate", () => {
    const script = readFileSync("scripts/check-plugin-release.mjs", "utf8");

    expect(script).toContain("Live PR body: stale review copy");
    expect(script).toContain("stale PR body copy");
    expect(script).toContain("Live Plugin Hub gate failed");
    expect(script).toContain("quest-complete opt-in gate");
    expect(script).toContain("public HTML fallback after API");
    expect(script).toContain("public HTML unreadable");
    expect(script).toContain("process.exitCode = 1");
    expect(script).toContain("Live Plugin Hub release check passed");
    expect(script).toContain("GitHub fetch failed");
  });

  it("extracts stale PR body copy from public GitHub HTML as a live fallback", async () => {
    // @ts-expect-error The release helper is a Node CLI .mjs file.
    const helper = await import("../scripts/check-plugin-release.mjs") as {
      publicPrStatusFromHtml: (html: string) => {
        state: string;
        reviewCount: number | null;
        maintainerGate: boolean;
        submittedCommit: string | null;
        reviewCopyIssues: string[];
      } | null;
    };

    const status = helper.publicPrStatusFromHtml(`
      <main>
        <h1>Add scapestack-sync#12536</h1>
        <span>Open</span>
        <p>Sync on login defaults to on.</p>
        <p>The raw token never leaves the install.</p>
        <p>POST https://www.scapestack.org/api/sync on every login + on quest-complete chat messages.</p>
        <p>Live PR body appears aligned with current consent, token, data and web-handoff wording.</p>
        <p>Shutdown interrupts the named daemon sync worker.</p>
        <p>No IP, no machine fingerprint, no chat-log content.</p>
        <a href="https://github.com/laurensbs/scapestack-runelite-plugin/tree/39931dc965e4e9f01bf549bdc192b85c4cd6c1fc">pin</a>
        <p>This plugin requires a review from a Plugin Hub maintainer.</p>
        <p>No reviews</p>
      </main>
    `);

    expect(status).toMatchObject({
      state: "open",
      reviewCount: 0,
      maintainerGate: true,
      submittedCommit: "39931dc965e4e9f01bf549bdc192b85c4cd6c1fc",
      reviewCopyIssues: [
        "sync-on-login defaults",
        "token transport",
        "POST timing",
        "shutdown thread interrupt",
        "quest-complete opt-in gate",
        "Slayer payload",
        "bank/inventory/equipment exclusion"
      ]
    });
  });

  it("flags generated or non-Plugin-Hub files in standalone extracts", async () => {
    // @ts-expect-error The release helper is a Node CLI .mjs file.
    const helper = await import("../scripts/check-plugin-release.mjs") as {
      disallowedStandalonePluginFiles: (files: string[]) => string[];
    };

    expect(helper.disallowedStandalonePluginFiles([
      ".gitignore",
      "build.gradle",
      "gradle/wrapper/gradle-wrapper.jar",
      "gradle/wrapper/gradle-wrapper.properties",
      "runelite-plugin.properties",
      "README.md",
      "src/main/java/app/scapestack/runelite/ScapestackSyncPlugin.java",
      "src/test/java/app/scapestack/runelite/ScapestackSyncPluginTest.java"
    ])).toEqual([]);

    expect(helper.disallowedStandalonePluginFiles([
      "bin/main/app/scapestack/runelite/ScapestackSyncPlugin.class",
      "build/libs/plugin.jar",
      ".gradle/file-system.probe",
      "README.md.published",
      "src/main/resources/unexpected.properties"
    ])).toEqual([
      "bin/main/app/scapestack/runelite/ScapestackSyncPlugin.class",
      "build/libs/plugin.jar",
      ".gradle/file-system.probe",
      "README.md.published",
      "src/main/resources/unexpected.properties"
    ]);
  });

  it("keeps the standalone README template accurate for Plugin Hub review", () => {
    const extractScript = readFileSync("scripts/extract-plugin.sh", "utf8");

    expect(extractScript).toContain("Sync on login");
    expect(extractScript).toContain("Refresh after quests");
    expect(extractScript).toContain("source=plugin-sync&bank=none");
    expect(extractScript).toContain("localhost");
    expect(extractScript).toContain("Slayer state");
    expect(extractScript).toContain("Data contract");
    expect(extractScript).toContain("RuneScape password");
    expect(extractScript).toContain("bank, inventory, equipment");
    expect(extractScript).toContain("Authorization: Bearer <token>");
    expect(extractScript).toContain("verified RuneLite payload");
    expect(extractScript).toContain("only as the Authorization bearer on claim/sync requests");
    expect(extractScript).not.toContain("works from real data");
    expect(extractScript).not.toContain("first-claim security");
    expect(extractScript).toContain("Wrote $TARGET/README.md");
    expect(extractScript).toContain("README.md.published");
  });

  it("removes the legacy generated standalone README artifact", () => {
    const target = mkdtempSync(join(tmpdir(), "scapestack-plugin-extract-"));

    try {
      writeFileSync(join(target, "README.md.published"), "stale review copy");

      const output = execFileSync("bash", ["scripts/extract-plugin.sh", target], {
        encoding: "utf8"
      });

      expect(output).toContain("Removed legacy");
      expect(existsSync(join(target, "README.md"))).toBe(true);
      expect(readFileSync(join(target, "README.md"), "utf8")).toContain("Sync on login");
      expect(existsSync(join(target, "README.md.published"))).toBe(false);
    } finally {
      rmSync(target, { force: true, recursive: true });
    }
  });

  it("previews standalone extraction without mutating the target", () => {
    const target = mkdtempSync(join(tmpdir(), "scapestack-plugin-extract-"));

    try {
      writeFileSync(join(target, "manual-note.txt"), "keep me");
      writeFileSync(join(target, "README.md.published"), "stale review copy");

      const output = execFileSync("bash", ["scripts/extract-plugin.sh", target, "--dry-run"], {
        encoding: "utf8"
      });

      expect(output).toContain("Dry-run mode");
      expect(output).toContain("Dry-run only; no files were changed.");
      expect(output).toContain("build.gradle");
      expect(output).toContain("README.md.published (legacy generated file)");
      expect(output).not.toContain("bin/main");
      expect(readFileSync(join(target, "manual-note.txt"), "utf8")).toBe("keep me");
      expect(readFileSync(join(target, "README.md.published"), "utf8")).toBe("stale review copy");
      expect(existsSync(join(target, "build.gradle"))).toBe(false);
      expect(existsSync(join(target, "README.md"))).toBe(false);
    } finally {
      rmSync(target, { force: true, recursive: true });
    }
  });

  it("does not report generated README changes when the standalone README is current", () => {
    const target = mkdtempSync(join(tmpdir(), "scapestack-plugin-extract-"));

    try {
      execFileSync("bash", ["scripts/extract-plugin.sh", target], {
        encoding: "utf8"
      });

      const output = execFileSync("bash", ["scripts/extract-plugin.sh", target, "--dry-run"], {
        encoding: "utf8"
      });

      expect(output).toContain("No rsync file changes detected.");
      expect(output).not.toContain("README.md (generated)");
      expect(output).toContain("Dry-run only; no files were changed.");
    } finally {
      rmSync(target, { force: true, recursive: true });
    }
  });

  it("documents that Plugin Hub review only sees the pinned standalone commit", () => {
    const publishing = readFileSync("plugin/PUBLISHING.md", "utf8");

    expect(publishing).toContain("npm run plugin:release-plan");
    expect(publishing).toContain("npm run ci:check");
    expect(publishing).toContain("plugins/scapestack-sync");
    expect(publishing).toContain("Local monorepo improvements do not affect review");
    expect(publishing).toContain("PII/data leakage");
    expect(publishing).toContain("RuneScape password, bank/inventory/equipment");
  });
});
