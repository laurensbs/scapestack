import { afterEach, describe, expect, it, vi } from "vitest";
import {
  defaultPluginBankStatus,
  isPluginBankStatusStale,
  normalizePluginBankStatus,
  pluginBankStatusLabel,
  pluginBankStatusTone
} from "@/lib/plugin-bank-status";

describe("plugin bank status copy", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("explains bank sync off", () => {
    const status = defaultPluginBankStatus(0);

    expect(status).toMatchObject({ enabled: false, itemCount: 0, unavailableReason: "opt-in-off" });
    expect(pluginBankStatusLabel(status)).toBe("Bank sync is off; item checks use only pasted/saved bank");
    expect(pluginBankStatusTone(status)).toBe("muted");
  });

  it("explains bank sync on with no loaded bank", () => {
    const status = normalizePluginBankStatus({
      enabled: true,
      itemCount: 0,
      unavailableReason: "bank-not-opened-this-session"
    });

    expect(pluginBankStatusLabel(status)).toBe("Open your bank in RuneLite, then sync again");
    expect(pluginBankStatusTone(status)).toBe("warn");
  });

  it("explains bank sync on with zero captured items", () => {
    const status = normalizePluginBankStatus({
      enabled: true,
      itemCount: 0,
      unavailableReason: "no-items-captured"
    });

    expect(pluginBankStatusLabel(status)).toBe("Bank sync is on, but no items were captured");
    expect(pluginBankStatusTone(status)).toBe("warn");
  });

  it("explains bank sync on with item stacks", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-08T13:00:00.000Z"));
    const status = normalizePluginBankStatus({
      enabled: true,
      itemCount: 612,
      capturedAt: "2026-07-08T12:00:00.000Z"
    });

    expect(pluginBankStatusLabel(status)).toBe("Bank synced: 612 item stacks");
    expect(pluginBankStatusTone(status)).toBe("good");
  });

  it("uses staging copy for UIM accounts", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-08T13:00:00.000Z"));
    const status = normalizePluginBankStatus({
      enabled: true,
      itemCount: 612,
      capturedAt: "2026-07-08T12:00:00.000Z"
    });

    expect(pluginBankStatusLabel(status, "ultimate")).toBe("UIM: bank checks are staging only");
  });

  it("warns when a captured bank snapshot is stale", () => {
    const status = normalizePluginBankStatus({
      enabled: true,
      itemCount: 612,
      capturedAt: "2026-07-07T12:00:00.000Z"
    });
    const nowMs = new Date("2026-07-08T13:00:00.000Z").getTime();

    expect(isPluginBankStatusStale(status, nowMs)).toBe(true);
    expect(pluginBankStatusLabel(status, null, nowMs)).toBe("Bank sync is stale; open your bank in RuneLite, then sync again");
    expect(pluginBankStatusTone(status, nowMs)).toBe("warn");
  });
});
