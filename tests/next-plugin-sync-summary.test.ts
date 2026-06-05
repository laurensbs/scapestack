import { describe, expect, it, vi } from "vitest";
import { summarizeNextPluginSync } from "@/lib/next-plugin-sync-summary";
import { CURRENT_PLUGIN_VERSION } from "@/lib/plugin-sync";

const basePlugin = {
  syncedAt: "2026-06-03T11:30:00.000Z",
  quests: 12,
  diaries: 8,
  clItems: 44,
  pluginVersion: CURRENT_PLUGIN_VERSION,
  slayerTaskRemaining: 47,
  slayerBlocks: 2
};

describe("next plugin sync summary", () => {
  it("marks all plugin signals exact when live coverage is complete", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-03T12:00:00.000Z"));

    const summary = summarizeNextPluginSync(basePlugin);

    expect(summary.state).toBe("live");
    expect(summary.title).toBe("Verified RuneLite payload live");
    expect(summary.body).toContain("Verified quest, diary, collection-log and Slayer state");
    expect(summary.body).not.toContain("Exact quest, diary, collection-log and Slayer state");
    expect(summary.signals.map((signal) => [signal.label, signal.status])).toEqual([
      ["Quests", "exact"],
      ["Diaries", "exact"],
      ["CL", "exact"],
      ["Slayer", "exact"]
    ]);

    vi.useRealTimers();
  });

  it("does not claim exact Slayer or collection log when those fields are missing", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-03T12:00:00.000Z"));

    const summary = summarizeNextPluginSync({
      ...basePlugin,
      clItems: 0,
      slayerTaskRemaining: null,
      slayerBlocks: 0
    });

    expect(summary.title).toBe("Verified RuneLite payload with partial coverage");
    expect(summary.body).toContain("Quest and diary state are verified from RuneLite");
    expect(summary.body).toContain("Slayer is still inferred");
    expect(summary.body).not.toContain("Quest and diary state are exact from RuneLite");
    expect(summary.signals.find((signal) => signal.label === "CL")?.status).toBe("partial");
    expect(summary.signals.find((signal) => signal.label === "Slayer")?.status).toBe("missing");

    vi.useRealTimers();
  });

  it("marks stale and outdated payloads as refresh or update before exactness", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-05T12:00:00.000Z"));

    expect(summarizeNextPluginSync(basePlugin).signals.every((signal) => signal.status === "refresh")).toBe(true);
    expect(summarizeNextPluginSync({
      ...basePlugin,
      pluginVersion: "0.1.0"
    }).signals.every((signal) => signal.status === "update")).toBe(true);

    vi.useRealTimers();
  });
});
