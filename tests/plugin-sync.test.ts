import { describe, expect, it, vi } from "vitest";
import { CURRENT_PLUGIN_VERSION, isPluginVersionAtLeast, pluginSyncHealth } from "@/lib/plugin-sync";

describe("plugin sync health", () => {
  it("compares semantic versions without string ordering bugs", () => {
    expect(isPluginVersionAtLeast("0.3.0")).toBe(true);
    expect(isPluginVersionAtLeast("v0.3.1")).toBe(true);
    expect(isPluginVersionAtLeast("0.10.0", "0.3.0")).toBe(true);
    expect(isPluginVersionAtLeast("0.1.9")).toBe(false);
    expect(isPluginVersionAtLeast(undefined)).toBe(false);
  });

  it("marks old plugin payloads as outdated before stale/live checks", () => {
    expect(pluginSyncHealth({
      pluginVersion: "0.1.0",
      syncedAt: "2026-06-03T08:00:00.000Z"
    })).toBe("outdated");
  });

  it("marks current plugin payloads live or stale by age", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-03T12:00:00.000Z"));

    expect(pluginSyncHealth({
      pluginVersion: CURRENT_PLUGIN_VERSION,
      syncedAt: "2026-06-03T11:30:00.000Z"
    })).toBe("live");

    expect(pluginSyncHealth({
      pluginVersion: CURRENT_PLUGIN_VERSION,
      syncedAt: "2026-06-02T07:00:00.000Z"
    })).toBe("stale");

    vi.useRealTimers();
  });
});
