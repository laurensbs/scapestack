import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearRecommendationFeedback,
  isRecommendationSuppressed,
  latestRecommendationFeedback,
  latestRecommendationMemory,
  loadRecommendationFeedback,
  recommendationMemoryCounts,
  recordRecommendationMemory,
  restoreRecommendation,
  suppressRecommendation
} from "@/lib/recommendation-feedback";

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

describe("recommendation feedback", () => {
  it("suppresses and restores a recommendation", () => {
    suppressRecommendation({ id: "kc:vardorvis", kind: "kc", reason: "not_today" });

    expect(isRecommendationSuppressed("kc:vardorvis")).toBe(true);

    restoreRecommendation("kc:vardorvis");

    expect(isRecommendationSuppressed("kc:vardorvis")).toBe(false);
  });

  it("can suppress completed recommendations separately from not-today hides", () => {
    suppressRecommendation({
      id: "quest:dragon-slayer",
      kind: "quest",
      title: "Dragon Slayer",
      reason: "already_done"
    });

    const feedback = loadRecommendationFeedback();
    expect(feedback.suppressed["quest:dragon-slayer"]?.reason).toBe("already_done");
    expect(feedback.suppressed["quest:dragon-slayer"]?.title).toBe("Dragon Slayer");
    expect(isRecommendationSuppressed("quest:dragon-slayer")).toBe(true);
  });

  it("returns the most recent feedback entry for welcome-back copy", () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000);
    suppressRecommendation({ id: "kc:vorkath", kind: "kc", title: "Push Vorkath to 50 KC", reason: "not_today" });
    vi.setSystemTime(2_000);
    suppressRecommendation({ id: "skill:farming", kind: "skill", title: "Push Farming to 99", reason: "already_done" });

    expect(latestRecommendationFeedback()?.id).toBe("skill:farming");
    expect(latestRecommendationFeedback()?.title).toBe("Push Farming to 99");
  });

  it("clears all suppressed recommendations", () => {
    suppressRecommendation({ id: "quest:qpc", kind: "quest", reason: "too_hard" });
    suppressRecommendation({ id: "bank:tidy", kind: "bank", reason: "too_boring" });

    clearRecommendationFeedback();

    expect(loadRecommendationFeedback().suppressed).toEqual({});
    expect(loadRecommendationFeedback().recent).toEqual([]);
  });

  it("records try-another memory without hiding the recommendation", () => {
    recordRecommendationMemory({
      id: "quest:mm2",
      kind: "quest",
      title: "Finish Monkey Madness II",
      action: "try_another",
      mood: "unlock",
      routeLens: "smart",
      rsn: "Lauky"
    });

    expect(isRecommendationSuppressed("quest:mm2")).toBe(false);
    expect(recommendationMemoryCounts(loadRecommendationFeedback(), { rsn: "lauky" })).toEqual({
      "quest:mm2": 1
    });
    expect(latestRecommendationMemory(loadRecommendationFeedback(), { rsn: "Lauky" })?.title)
      .toBe("Finish Monkey Madness II");
  });

  it("weights harder feedback more strongly than a light route skip", () => {
    recordRecommendationMemory({ id: "boss:callisto", kind: "boss", action: "try_another", rsn: "Lauky" });
    suppressRecommendation({ id: "quest:dt2", kind: "quest", title: "Finish Desert Treasure II", reason: "too_hard" });

    const counts = recommendationMemoryCounts(loadRecommendationFeedback(), { rsn: "Lauky" });

    expect(counts["boss:callisto"]).toBe(1);
    expect(counts["quest:dt2"]).toBe(3);
  });

  it("restore removes recent memory for that pick too", () => {
    suppressRecommendation({ id: "quest:dragon-slayer", kind: "quest", reason: "not_today" });

    restoreRecommendation("quest:dragon-slayer");

    expect(isRecommendationSuppressed("quest:dragon-slayer")).toBe(false);
    expect(recommendationMemoryCounts(loadRecommendationFeedback())["quest:dragon-slayer"]).toBeUndefined();
  });

  it("survives corrupt localStorage", () => {
    localStorage.setItem("scapestack:recommendation-feedback:v1", "{not json");

    expect(loadRecommendationFeedback().suppressed).toEqual({});
  });
});
