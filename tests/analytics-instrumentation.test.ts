import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

describe("decision funnel instrumentation", () => {
  it("wires the complete /next decision lifecycle to player actions", () => {
    const source = read("src/app/next/next-client.tsx");
    for (const event of [
      "rsn:submitted",
      "plan:first_rendered",
      "mood:changed",
      "recommendation:impression",
      "recommendation:accepted",
      "recommendation:another",
      "recommendation:skipped",
      "trip:started",
      "trip:completed_manual",
      "trip:completed_sync"
    ]) {
      expect(source, `${event} should be wired in /next`).toContain(`track(\"${event}\"`);
    }
  });

  it("wires bank, RuneLite, return, timeline and boss context actions", () => {
    expect(read("src/components/add-bank-modal.tsx")).toMatch(/hadBankBeforeSave\s*\?\s*"bank:refreshed"\s*:\s*"bank:attached"/);
    const plugin = read("src/components/plugin-sync-checker.tsx");
    expect(plugin).toContain("runelite:sync_success");
    expect(plugin).toContain("runelite:sync_failure");
    const timeline = read("src/components/account-timeline.tsx");
    expect(timeline).toContain("return:visit");
    expect(timeline).toContain("timeline:viewed");
    const boss = read("src/components/boss-detail-modal.tsx");
    expect(boss).toContain("boss:opened");
    expect(boss).toContain("boss:loadout_used");
  });

  it("documents every canonical funnel event", () => {
    const docs = read("docs/ANALYTICS-EVENTS.md");
    const contract = read("src/lib/analytics.ts");
    for (const event of [
      "rsn:submitted",
      "plan:first_rendered",
      "recommendation:impression",
      "recommendation:accepted",
      "recommendation:another",
      "recommendation:skipped",
      "trip:started",
      "trip:completed_manual",
      "trip:completed_sync",
      "runelite:sync_success",
      "runelite:sync_failure",
      "bank:attached",
      "bank:refreshed",
      "return:visit",
      "timeline:viewed",
      "boss:opened",
      "boss:loadout_used"
    ]) {
      expect(contract).toContain(`\"${event}\"`);
      expect(docs).toContain(`\`${event}\``);
    }
  });
});
