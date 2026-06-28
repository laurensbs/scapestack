import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "src/app/slayer/slayer-client.tsx"), "utf8");

describe("Slayer sync status copy", () => {
  it("separates generic RuneLite payloads from live Slayer payloads", () => {
    expect(source).toContain("RuneLite: Slayer task live");
    expect(source).toContain("RuneLite: no live task");
    expect(source).toContain("RuneLite not found");
    expect(source).toContain("const [hasPluginPayload, setHasPluginPayload] = useState(false)");
    expect(source).toContain("setHasPluginPayload(false)");
    expect(source).toContain("setHasPluginPayload(Boolean(sync))");
    expect(source).not.toContain('sync ? "+ plugin data" : "(no plugin data yet)"');
  });

  it("mounts the shared Scapestack readiness rail with Slayer-specific sync state", () => {
    expect(source).toContain('import { ScapestackReadinessRail } from "@/components/scapestack-readiness-rail";');
    expect(source).toContain("<ScapestackReadinessRail");
    expect(source).toContain('surface="slayer"');
    expect(source).toContain("hasBankContext={Boolean(bankContext)}");
    expect(source).toContain("hasRsn={Boolean(rsn.trim())}");
    expect(source).toContain("hasPluginSync={hasPluginPayload}");
    expect(source).toContain('pluginSyncState={hasPluginPayload ? (pluginSlayer ? "live" : "stale") : null}');
    expect(source).toContain("rsn={rsn}");
  });

  it("labels lookup controls and quest toggles for keyboard and screenreader use", () => {
    expect(source).toContain('htmlFor="slayer-rsn-input"');
    expect(source).toContain("Look up your OSRS name");
    expect(source).toContain('id="slayer-rsn-input"');
    expect(source).toContain('name="rsn"');
    expect(source).toContain('aria-describedby="slayer-rsn-help slayer-lookup-status"');
    expect(source).toContain("Uses Hiscores for combat/Slayer level and Scapestack Sync");
    expect(source).toContain('aria-label="Look up Slayer data from Hiscores and RuneLite sync"');
    expect(source).toContain("aria-pressed={on}");
    expect(source).toContain('aria-label={`${on ? "Mark incomplete" : "Mark complete"}: ${q.label}`}');
  });
});
