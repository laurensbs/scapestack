import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  loadTripTimeline,
  recordTripEvent,
  tripTimelineRecap
} from "@/lib/trip-timeline";

class MemoryStorage {
  private map = new Map<string, string>();
  getItem(key: string) { return this.map.get(key) ?? null; }
  setItem(key: string, value: string) { this.map.set(key, value); }
  removeItem(key: string) { this.map.delete(key); }
  clear() { this.map.clear(); }
}

beforeEach(() => {
  vi.useRealTimers();
  const storage = new MemoryStorage();
  Object.assign(globalThis, {
    localStorage: storage,
    window: { localStorage: storage }
  });
});

describe("trip timeline", () => {
  it("stores started, done and skipped trips per RSN", () => {
    recordTripEvent({ id: "boss:vorkath", kind: "boss", title: "Push Vorkath to 50 KC", action: "started", rsn: "Lauky" });
    recordTripEvent({ id: "boss:vorkath", kind: "boss", title: "Push Vorkath to 50 KC", action: "done", rsn: "Lauky" });
    recordTripEvent({ id: "skill:cooking", kind: "skill", title: "Pick a maxing lane: Cooking", action: "skipped", rsn: "Other" });

    const recap = tripTimelineRecap(loadTripTimeline(), { rsn: "lauky" });

    expect(recap.started).toBe(1);
    expect(recap.done).toBe(1);
    expect(recap.skipped).toBe(0);
    expect(recap.latestDone?.title).toBe("Push Vorkath to 50 KC");
  });

  it("keeps this week focused instead of turning profile into history", () => {
    const now = 10 * 24 * 60 * 60 * 1000;
    recordTripEvent({
      id: "quest:old",
      kind: "quest",
      title: "Old quest",
      action: "done",
      rsn: "Lauky",
      now: now - 8 * 24 * 60 * 60 * 1000
    });
    recordTripEvent({
      id: "skill:farming",
      kind: "skill",
      title: "Run herbs + birdhouses",
      action: "started",
      rsn: "Lauky",
      stopPoint: "Stop after the loop",
      now
    });

    const recap = tripTimelineRecap(loadTripTimeline(), { rsn: "Lauky", now });

    expect(recap.done).toBe(0);
    expect(recap.lastPlannedTrip?.title).toBe("Run herbs + birdhouses");
    expect(recap.lastPlannedTrip?.stopPoint).toBe("Stop after the loop");
  });
});
