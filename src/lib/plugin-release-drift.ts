import { execFileSync } from "node:child_process";

type ReleaseDriftStatus = "clean" | "dirty" | "unavailable";

export interface ReleaseDriftChange {
  status: string;
  path: string;
}

export interface ReleaseDriftGroup {
  label: string;
  count: number;
}

export interface PluginReleaseDrift {
  status: ReleaseDriftStatus;
  count: number;
  groups: ReleaseDriftGroup[];
  samplePaths: ReleaseDriftChange[];
}

const RELEASE_IMPACT_PREFIXES = [
  "plugin/",
  "src/lib/plugin-sync.ts",
  "src/lib/plugin-hub-status.ts",
  "src/lib/plugin-",
  "src/app/plugin/",
  "src/components/plugin-",
  "scripts/print-plugin-review-packet.ts",
  "scripts/check-plugin-release.mjs",
  "scripts/extract-plugin.sh",
  "package.json",
  "tests/plugin-release-check.test.ts",
  "tests/plugin-hub-status.test.ts",
  "tests/plugin-review-packet.test.ts",
  "tests/plugin-page-copy.test.ts"
];

const RELEASE_IMPACT_GROUPS = [
  {
    label: "Plugin source",
    matches: (path: string) => path.startsWith("plugin/src/main/")
  },
  {
    label: "Plugin tests",
    matches: (path: string) => path.startsWith("plugin/src/test/")
  },
  {
    label: "Plugin build/docs",
    matches: (path: string) => path.startsWith("plugin/")
  },
  {
    label: "Web Plugin surface",
    matches: (path: string) => path.startsWith("src/app/plugin/")
      || path.startsWith("src/components/plugin-")
      || path.startsWith("src/lib/plugin-")
      || path === "src/lib/plugin-hub-status.ts"
      || path === "src/lib/plugin-sync.ts"
  },
  {
    label: "Release tooling/tests",
    matches: (path: string) => path.startsWith("scripts/")
      || path.startsWith("tests/plugin-")
      || path === "package.json"
  }
];

export function releaseDriftChangesFromStatus(statusText: string): ReleaseDriftChange[] {
  return statusText
    .split("\n")
    .map((line) => line.trimEnd())
    .filter(Boolean)
    .map((line) => {
      const path = line.slice(3).replace(/^"|"$/g, "");
      return { status: line.slice(0, 2).trim() || "modified", path };
    })
    .filter((entry) => RELEASE_IMPACT_PREFIXES.some((prefix) => entry.path.startsWith(prefix)));
}

export function summarizePluginReleaseDrift(changes: ReleaseDriftChange[]): PluginReleaseDrift {
  const groupCounts = new Map(RELEASE_IMPACT_GROUPS.map((group) => [group.label, 0]));

  for (const change of changes) {
    const group = RELEASE_IMPACT_GROUPS.find((candidate) => candidate.matches(change.path));
    if (group) groupCounts.set(group.label, (groupCounts.get(group.label) ?? 0) + 1);
  }

  const groups = RELEASE_IMPACT_GROUPS
    .map((group) => ({ label: group.label, count: groupCounts.get(group.label) ?? 0 }))
    .filter((group) => group.count > 0);

  return {
    status: changes.length > 0 ? "dirty" : "clean",
    count: changes.length,
    groups,
    samplePaths: changes.slice(0, 6)
  };
}

export function getLocalPluginReleaseDrift(): PluginReleaseDrift {
  try {
    const output = execFileSync("git", ["status", "--short", ...RELEASE_IMPACT_PREFIXES], {
      cwd: process.cwd(),
      encoding: "utf8"
    });
    return summarizePluginReleaseDrift(releaseDriftChangesFromStatus(output));
  } catch {
    return {
      status: "unavailable",
      count: 0,
      groups: [],
      samplePaths: []
    };
  }
}
