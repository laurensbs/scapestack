import { describe, expect, it } from "vitest";
import { missingDataActionForRecommendation } from "@/lib/recommendation-data-action";
import type { Recommendation } from "@/lib/next-up";

function recWithCaveat(caveat: string): Recommendation {
  return {
    id: "test:rec",
    kind: "quest",
    title: "Do a thing",
    why: "It helps the account.",
    score: 50,
    actionPlan: {
      timebox: "30 min",
      prep: "Prep first.",
      steps: ["Start.", "Finish."],
      confidence: "guided",
      confidenceLabel: "Guided",
      caveat
    }
  };
}

describe("recommendation missing-data actions", () => {
  it("turns RSN caveats into edit-input actions", () => {
    const action = missingDataActionForRecommendation(recWithCaveat("Add your RSN to turn this into stat-aware advice."));

    expect(action).toMatchObject({
      kind: "rsn",
      label: "Add RSN"
    });
    expect(action?.href).toBeUndefined();
  });

  it("turns bank caveats into bank handoff links", () => {
    const action = missingDataActionForRecommendation(
      recWithCaveat("Paste a bank when gear and item checks matter."),
      { rsn: "Lynx Titan" }
    );

    expect(action).toMatchObject({
      kind: "bank",
      label: "Paste bank"
    });
    expect(action?.href).toContain("/bank");
    expect(action?.href).toContain("rsn=Lynx+Titan");
  });

  it("turns inferred quest/diary caveats into plugin sync links", () => {
    const action = missingDataActionForRecommendation(
      recWithCaveat("Quest and diary completion is inferred unless Scapestack Sync has this RSN."),
      { rsn: "Lynx Titan", hasBankContext: true }
    );

  expect(action).toMatchObject({
    kind: "plugin-sync",
    label: "Use Scapestack Sync"
  });
    expect(action?.helper).toContain("finished quests, diaries, collection log and Slayer");
    expect(action?.helper).not.toContain("payload");
    expect(action?.helper).not.toContain("coverage");
    expect(action?.href).toContain("/plugin");
    expect(action?.href).toContain("rsn=Lynx+Titan");
    expect(action?.href).not.toContain("bank=none");
  });

  it("turns outdated connected-sync caveats into plugin sync links", () => {
    const action = missingDataActionForRecommendation(
      recWithCaveat("RuneLite sync is connected, but refresh or update it before relying on quests, diaries, collection log or Slayer for this pick."),
      { rsn: "Lynx Titan" }
    );

  expect(action).toMatchObject({
    kind: "plugin-sync",
    label: "Refresh sync"
  });
    expect(action?.helper).toContain("Refresh or update");
    expect(action?.helper).toContain("quests, diaries, collection log or Slayer");
    expect(action?.helper).not.toContain("payload");
    expect(action?.href).toBe("/plugin?rsn=Lynx+Titan&from=next#verify-sync");
  });

  it("marks plugin sync follow-up links as bankless when /next had no bank handoff", () => {
    const action = missingDataActionForRecommendation(
      recWithCaveat("Quest and diary completion is inferred unless Scapestack Sync has this RSN."),
      { rsn: "Lynx Titan", hasBankContext: false }
    );

    expect(action).toMatchObject({
      kind: "plugin-sync",
      label: "Use Scapestack Sync"
    });
    expect(action?.href).toBe("/plugin?rsn=Lynx+Titan&from=next&bank=none#verify-sync");
  });
});
