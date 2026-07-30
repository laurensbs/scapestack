import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PlayerPlanAlternatives } from "@/components/player-plan-answer";
import {
  hidePlayerPlanRecommendation,
  loadRecommendationFeedback
} from "@/lib/recommendation-feedback";
import type { Recommendation } from "@/lib/next-up";

class MemoryStorage {
  private map = new Map<string, string>();
  getItem(key: string) { return this.map.get(key) ?? null; }
  setItem(key: string, value: string) { this.map.set(key, value); }
  removeItem(key: string) { this.map.delete(key); }
}

const headline: Recommendation = {
  id: "quest:desert-treasure-ii",
  kind: "quest",
  title: "Finish Desert Treasure II",
  why: "Unlock four repeatable bosses.",
  score: 100,
  link: "/quests"
};

const alternatives: Recommendation[] = [
  {
    id: "kc:vardorvis",
    kind: "kc",
    title: "Push Vardorvis to 50 KC",
    why: "Build a bounded boss block.",
    score: 90,
    link: "/dps?boss=vardorvis"
  },
  {
    id: "quest:while-guthix-sleeps",
    kind: "quest",
    title: "Finish While Guthix Sleeps",
    why: "Open the next quest chain.",
    score: 80,
    link: "/quests"
  }
];

beforeEach(() => {
  const storage = new MemoryStorage();
  Object.assign(globalThis, {
    localStorage: storage,
    window: { localStorage: storage, dispatchEvent: vi.fn() }
  });
});

describe("answer-first alternatives", () => {
  it("renders a Hide control for every concrete row and keeps a hidden row gone after reload", () => {
    const html = renderToStaticMarkup(createElement(PlayerPlanAlternatives, {
      headline,
      alternatives,
      onSelect: vi.fn(),
      onHide: vi.fn()
    }));

    expect(html).toContain("Not this?");
    expect(html).toContain("Push Vardorvis to 50 KC");
    expect(html).toContain("Finish While Guthix Sleeps");
    expect(html.match(/aria-label="Hide [^"]+"/g)).toHaveLength(alternatives.length);
    expect(html).not.toMatch(/mood|15 min|30 min|1 hour|2 hours/i);

    hidePlayerPlanRecommendation({
      recommendation: alternatives[0],
      mood: "unlock",
      routeLens: "smart",
      rsn: "Lauky",
      minutes: 60
    });

    const reloaded = loadRecommendationFeedback();
    const visibleAfterReload = alternatives.filter((rec) => !reloaded.suppressed[rec.id]);
    expect(visibleAfterReload.map((rec) => rec.id)).toEqual(["quest:while-guthix-sleeps"]);
    expect(reloaded.suppressed["kc:vardorvis"]).toMatchObject({
      reason: "not_my_style",
      title: "Push Vardorvis to 50 KC"
    });
  });
});
