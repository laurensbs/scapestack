import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PlayerPlanAnswer } from "@/components/player-plan-answer";
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
  it("names both alternatives on one line beside the action, with one reject control", () => {
    // These were a table: an <h3> "Not this?", a <thead> with ROUTE / GOAL /
    // sr-only ACTION, two 32px sprites, two helper sentences and two
    // eye-slash Hide buttons — 211px to reject the answer against 286px to
    // state it. Column headers promise a dataset and two rows is not one.
    const html = renderToStaticMarkup(createElement(PlayerPlanAnswer, {
      rec: headline,
      decisionCopy: {
        title: headline.title, why: headline.why, firstStep: "Start.", stopPoint: "Stop.",
        timebox: "60 minutes", requiredSetup: [], confidence: "guess", sourceLine: null
      },
      planLines: [],
      actionContext: { from: "next", rsn: "Lauky" },
      alternatives,
      onSelectAlternative: vi.fn(),
      onRejectHeadline: vi.fn()
    }));

    expect(html).toContain("Not tonight?");
    expect(html).toContain("Push Vardorvis to 50 KC");
    expect(html).toContain("Finish While Guthix Sleeps");
    // One control that means "not this, ever", bound to the headline —
    // instead of one hide button per alternative the player has just met.
    expect(html.match(/aria-label="Hide [^"]+"/g)).toHaveLength(1);
    expect(html).toContain("Something else");
    expect(html, "the table grammar must not come back").not.toContain("<thead");
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
