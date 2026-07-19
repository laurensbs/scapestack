import { afterEach, describe, expect, it, vi } from "vitest";
import { waitForAcceptedPluginSync } from "@/lib/plugin-sync-watch";

describe("RuneLite browser readback watch", () => {
  afterEach(() => vi.useRealTimers());

  it("observes an accepted scan within the bounded 15 second window", async () => {
    vi.useFakeTimers();
    const read = vi.fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ syncedAt: "2026-07-19T18:00:55.460Z" });

    const pending = waitForAcceptedPluginSync({
      read,
      initialSyncedAt: null,
      timeoutMs: 15_000,
      intervalMs: 1_500
    });
    await vi.advanceTimersByTimeAsync(3_000);

    await expect(pending).resolves.toEqual({ syncedAt: "2026-07-19T18:00:55.460Z" });
    expect(read).toHaveBeenCalledTimes(2);
  });

  it("waits for a newer timestamp instead of accepting the scan already on screen", async () => {
    vi.useFakeTimers();
    const old = "2026-07-19T18:00:00.000Z";
    const fresh = "2026-07-19T18:00:10.000Z";
    const read = vi.fn()
      .mockResolvedValueOnce({ syncedAt: old })
      .mockResolvedValueOnce({ syncedAt: fresh });

    const pending = waitForAcceptedPluginSync({
      read,
      initialSyncedAt: old,
      timeoutMs: 15_000,
      intervalMs: 1_500
    });
    await vi.advanceTimersByTimeAsync(3_000);

    await expect(pending).resolves.toEqual({ syncedAt: fresh });
  });

  it("stops cleanly without inventing a successful scan", async () => {
    vi.useFakeTimers();
    const pending = waitForAcceptedPluginSync({
      read: vi.fn().mockResolvedValue(null),
      initialSyncedAt: null,
      timeoutMs: 3_000,
      intervalMs: 1_000
    });
    await vi.advanceTimersByTimeAsync(3_000);
    await expect(pending).resolves.toBeNull();
  });
});
