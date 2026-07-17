import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "src/app/slayer/slayer-client.tsx"), "utf8");

describe("Slayer sync status copy", () => {
  it("separates a connected account from a verified live Slayer task", () => {
    expect(source).toContain("Found ${player!.slayer!.taskRemaining.toLocaleString()} left on your current task.");
    expect(source).toContain("RuneLite is connected, but no active Slayer task was found.");
    expect(source).toContain("Stats loaded. Add RuneLite to read the current task.");
    expect(source).toContain("const [hasPluginPayload, setHasPluginPayload] = useState(false)");
    expect(source).toContain("setHasPluginPayload(false)");
    expect(source).toContain("setHasPluginPayload(Boolean(player))");
  });

  it("keeps readiness context collapsed below the task route", () => {
    expect(source).toContain('import { ScapestackReadinessRail } from "@/components/scapestack-readiness-rail";');
    expect(source).toContain("<ScapestackReadinessRail");
    expect(source).toContain('surface="slayer"');
    expect(source).toContain("hasBankContext={bank.length > 0}");
    expect(source).toContain("hasRsn={Boolean(rsn.trim())}");
    expect(source).toContain("hasPluginSync={hasPluginPayload}");
    expect(source).toContain('pluginSyncState={hasPluginPayload ? (syncHealth === "unknown" ? "stale" : syncHealth) : null}');
    expect(source).toContain("rsn={rsn}");
    expect(source.indexOf("<SlayerTaskRoute")).toBeLessThan(source.indexOf("<ScapestackReadinessRail"));
  });

  it("labels the single account lookup for keyboard and screenreader use", () => {
    expect(source).toContain('htmlFor="slayer-rsn-input"');
    expect(source).toContain("Load your Slayer task");
    expect(source).toContain('id="slayer-rsn-input"');
    expect(source).toContain('name="rsn"');
    expect(source).toContain('aria-describedby="slayer-rsn-help slayer-lookup-status"');
    expect(source).toContain("Uses Hiscores for levels and RuneLite for your task, points, streak, blocks and bank.");
    expect(source).toContain('aria-label="Look up Slayer data from Hiscores and RuneLite sync"');
    expect(source).not.toContain("Quest requirements voltooid");
  });
});
