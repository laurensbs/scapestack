import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { Recommendation } from "@/lib/next-up";
import { recommendationSessionProfile } from "@/lib/recommendation-session";

function rec(overrides: Partial<Recommendation>): Recommendation {
  return {
    id: "test:recommendation",
    kind: "skill",
    title: "Test recommendation",
    why: "Test fixture",
    score: 50,
    ...overrides
  };
}

describe("recommendation session profile", () => {
  it("recognizes raid and wilderness risk without parsing player-facing UI", () => {
    expect(recommendationSessionProfile(rec({ kind: "kc", bossSlug: "cox" }))).toMatchObject({
      raid: true,
      intensity: "extreme",
      deathCost: "moderate"
    });
    expect(recommendationSessionProfile(rec({ kind: "boss", bossSlug: "callisto" }))).toMatchObject({
      wilderness: true,
      deathCost: "high"
    });
  });

  it("requires an actual low-attention method before calling progress AFK", () => {
    expect(recommendationSessionProfile(rec({ kind: "milestone", routeTags: ["maxing"] })).attention).toBe("active");
    expect(recommendationSessionProfile(rec({
      id: "skill:Prayer:77",
      title: "Push Prayer to 77",
      decisionReason: "This can be an AFK or focused backup."
    })).attention).toBe("active");
    expect(recommendationSessionProfile(rec({
      id: "skill:Woodcutting:99",
      title: "Cut redwoods",
      routeTags: ["afk", "maxing"]
    }))).toMatchObject({ attention: "afk", intensity: "low", idleWindowSeconds: 20 });
  });

  it("reads the first executable stop from a bounded timebox", () => {
    expect(recommendationSessionProfile(rec({ actionPlan: {
      timebox: "10-20 min",
      confidence: "exact",
      confidenceLabel: "Exact",
      prep: "Prep",
      steps: ["Start", "Stop"]
    } })).minimumMinutes).toBe(10);
  });

  it("keeps inaccurate blanket AFK tags out of recommendation generators", () => {
    const source = readFileSync("src/lib/next-up.ts", "utf8");
    expect(source).not.toContain('routeTags: ["fun", "afk", "skiller"');
    expect(source).not.toContain('routeTags: ["maxing", "afk", "skiller"]');
    expect(source).not.toContain('routeTags: ["afk", "skiller", "returning", "unlock"]');
    expect(source).toContain('mg.slug === "motherlode" ? ["afk" as const] : []');
  });
});
