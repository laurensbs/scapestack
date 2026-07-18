import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import releaseManifest from "../plugin/release-manifest.json";
import {
  CANDIDATE_PLUGIN_CONTRACT_VERSION,
  CANDIDATE_PLUGIN_VERSION,
  CURRENT_PLUGIN_CONTRACT_VERSION,
  CURRENT_PLUGIN_VERSION,
  MINIMUM_WEBSITE_CONTRACT_VERSION
} from "@/lib/plugin-sync";

function matchVersion(file: string, pattern: RegExp): string {
  const text = readFileSync(file, "utf8");
  const match = text.match(pattern);
  if (!match?.[1]) throw new Error(`Could not read version from ${file}`);
  return match[1];
}

describe("plugin version drift", () => {
  it("keeps web, Plugin Hub metadata and Java payload on the manifest candidate", () => {
    const expected = releaseManifest.candidate.version;
    const versions = {
      webCandidate: CANDIDATE_PLUGIN_VERSION,
      pluginHubManifest: matchVersion("plugin/runelite-plugin.properties", /^version=(.+)$/m),
      javaPayload: matchVersion(
        "plugin/src/main/java/app/scapestack/runelite/ScapestackSyncPlugin.java",
        /PLUGIN_VERSION\s*=\s*"([^"]+)"/
      )
    };

    expect(versions).toEqual({
      webCandidate: expected,
      pluginHubManifest: expected,
      javaPayload: expected
    });
    expect(CANDIDATE_PLUGIN_CONTRACT_VERSION).toBe(releaseManifest.candidate.contractVersion);
    expect(CURRENT_PLUGIN_VERSION).toBe(releaseManifest.published.version);
    expect(CURRENT_PLUGIN_CONTRACT_VERSION).toBe(releaseManifest.published.contractVersion);
    expect(MINIMUM_WEBSITE_CONTRACT_VERSION).toBe(releaseManifest.candidate.minimumWebsiteContractVersion);

    const gradle = readFileSync("plugin/build.gradle", "utf8");
    expect(gradle).toContain("candidateRelease.version");
    expect(gradle).toContain("candidateRelease.runeLiteDependency");
  });

  it("documents every version source in the publishing checklist", () => {
    const publishing = readFileSync("plugin/PUBLISHING.md", "utf8");

    for (const source of [
      "plugin/release-manifest.json",
      "src/lib/plugin-sync.ts",
      "plugin/build.gradle",
      "plugin/runelite-plugin.properties",
      "ScapestackSyncPlugin.PLUGIN_VERSION",
      "plugin/gradle.lockfile"
    ]) {
      expect(publishing).toContain(source);
    }
    expect(publishing).toContain("tests/plugin-version-drift.test.ts");
  });
});
