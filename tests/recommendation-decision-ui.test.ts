import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync("src/app/next/next-client.tsx", "utf8");

describe("/next RecommendationDecision adoption", () => {
  it("builds the contract after mood routing and renders boundary copy in the headline", () => {
    expect(source.indexOf("pickForRoute(visibleRecs")).toBeLessThan(source.indexOf("buildRecommendationDecision({"));
    expect(source).toContain("recommendationMoodEligibility(rec, mood, minutes).eligible");
    expect(source).toContain("moodEligibleRecs.find((rec) => rec.id === startedId)");
    expect(source).toContain("!recentRejectedMemory.some((entry) => entry.id === rememberedStartedId)");
    expect(source).toContain("moodEligibleRecs.find((rec) => rec.id === selectedRecommendationId)");
    expect(source).toContain("const decisionCopy = recommendationDecisionCopy(decision)");
    expect(source).toContain('{ label: "Start", value: decisionCopy.firstStep }');
    expect(source).toContain('{ label: "Stop at", value: decisionCopy.stopPoint }');
    expect(source).toContain("{decisionCopy.why}");
  });

  it("saves only the typed decision through the connected-account endpoint", () => {
    expect(source).toContain('fetch("/api/account/decision"');
    expect(source).toContain("if (!connectedAccount?.serverAccountId) return;");
    expect(source).toContain("connectedAccount.rsn.toLowerCase() !== activeRsn.toLowerCase()");
    expect(source).toContain("body: JSON.stringify({ decision: activeDecision })");
    expect(source).not.toContain("body: JSON.stringify({ decision: activeDecision, rsn:");
  });

  it("only renders bank claims when bank and completion facts support them", () => {
    expect(source).toContain("const bringLine = (hasBankContext ? nextTripLines");
    expect(source).toContain('line.label === "Grab from bank" || line.label === "Stage for UIM"');
    expect(source).toContain('...(bringLine ? [{ label: "Bring", value: bringLine.value }] : [])');
    expect(source).toContain('unknown.code === "runelite_completion"');
  });
});
