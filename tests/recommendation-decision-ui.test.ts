import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync("src/app/next/next-client.tsx", "utf8");

describe("/next RecommendationDecision adoption", () => {
  it("builds the contract after mood routing and renders boundary copy in the headline", () => {
    expect(source.indexOf("pickForRoute(visibleRecs")).toBeLessThan(source.indexOf("buildRecommendationDecision({"));
    expect(source).toContain("const decisionCopy = recommendationDecisionCopy(decision)");
    expect(source).toContain('{ label: "Why this pick", value: decisionCopy.why }');
    expect(source).toContain('{ label: "Start", value: decisionCopy.firstStep }');
    expect(source).toContain('{ label: "Finish after", value: decisionCopy.stopPoint }');
  });

  it("saves only the typed decision through the connected-account endpoint", () => {
    expect(source).toContain('fetch("/api/account/decision"');
    expect(source).toContain("body: JSON.stringify({ decision: activeDecision })");
    expect(source).not.toContain("body: JSON.stringify({ decision: activeDecision, rsn:");
  });
});
