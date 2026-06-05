import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import pkg from "../package.json";
import { CURRENT_PLUGIN_VERSION } from "@/lib/plugin-sync";

function matchVersion(file: string, pattern: RegExp): string {
  const text = readFileSync(file, "utf8");
  const match = text.match(pattern);
  if (!match?.[1]) throw new Error(`Could not read version from ${file}`);
  return match[1];
}

describe("plugin version drift", () => {
  it("keeps web, RuneLite build, Plugin Hub manifest and Java payload versions aligned", () => {
    const expected = pkg.version;
    const versions = {
      webChecker: CURRENT_PLUGIN_VERSION,
      gradle: matchVersion("plugin/build.gradle", /version\s*=\s*['"]([^'"]+)['"]/),
      pluginHubManifest: matchVersion("plugin/runelite-plugin.properties", /^version=(.+)$/m),
      javaPayload: matchVersion(
        "plugin/src/main/java/app/scapestack/runelite/ScapestackSyncPlugin.java",
        /PLUGIN_VERSION\s*=\s*"([^"]+)"/
      )
    };

    expect(versions).toEqual({
      webChecker: expected,
      gradle: expected,
      pluginHubManifest: expected,
      javaPayload: expected
    });
  });

  it("documents every version source in the publishing checklist", () => {
    const publishing = readFileSync("plugin/PUBLISHING.md", "utf8");

    for (const source of [
      "package.json",
      "src/lib/plugin-sync.ts",
      "plugin/build.gradle",
      "plugin/runelite-plugin.properties",
      "ScapestackSyncPlugin.PLUGIN_VERSION"
    ]) {
      expect(publishing).toContain(source);
    }
    expect(publishing).toContain("tests/plugin-version-drift.test.ts");
  });
});
