import { beforeEach, describe, expect, it } from "vitest";
import {
  clearRecommendationFeedback,
  isRecommendationSuppressed,
  loadRecommendationFeedback,
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
    suppressRecommendation({ id: "quest:dragon-slayer", kind: "quest", reason: "already_done" });

    const feedback = loadRecommendationFeedback();
    expect(feedback.suppressed["quest:dragon-slayer"]?.reason).toBe("already_done");
    expect(isRecommendationSuppressed("quest:dragon-slayer")).toBe(true);
  });

  it("clears all suppressed recommendations", () => {
    suppressRecommendation({ id: "quest:qpc", kind: "quest", reason: "too_hard" });
    suppressRecommendation({ id: "bank:tidy", kind: "bank", reason: "too_boring" });

    clearRecommendationFeedback();

    expect(loadRecommendationFeedback().suppressed).toEqual({});
  });

  it("survives corrupt localStorage", () => {
    localStorage.setItem("scapestack:recommendation-feedback:v1", "{not json");

    expect(loadRecommendationFeedback().suppressed).toEqual({});
  });
});
