import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  decisionConfidence,
  recommendationDecisionCopy,
  type RecommendationDecision,
  type RecommendationDecisionFact
} from "@/lib/recommendation-decision";

/**
 * The page must be able to say it is guessing.
 *
 * /next told Lynx Titan — 200,000,000 XP in every skill — to "Finish Skill
 * capes", in 32px bold under the eyebrow "Do this first", justified with
 * "This best matches your visible account progress". That justification is the
 * last case in reasonCopy: the string emitted when there is no fact to cite.
 * The most confident line on the page appeared exactly when the engine knew
 * least, because the design system had one voice and no way to modulate it.
 */

function decision(reasons: RecommendationDecisionFact[]): RecommendationDecision {
  return {
    version: 1,
    goal: { label: "Finish Skill capes (99s)" },
    firstStep: { label: "Open the skill guide" },
    stopPoint: { label: "Stop after one cape" },
    timebox: { label: "60 minutes" },
    setup: { required: [] },
    fallback: { action: "Pick anything" },
    reasons,
    unknowns: [],
    assumptions: [],
    alternatives: []
  } as unknown as RecommendationDecision;
}

const fact = (
  code: RecommendationDecisionFact["code"],
  provenance: RecommendationDecisionFact["provenance"]
): RecommendationDecisionFact => ({ code, provenance, subject: "x" });

describe("the engine says how much it knows", () => {
  it("calls it a guess when the only reason is that it fits visible progress", () => {
    const only = decision([fact("visible_progress_fit", "public_stats")]);
    expect(decisionConfidence(only)).toBe("guess");
    const copy = recommendationDecisionCopy(only);
    expect(copy.sourceLine).toContain("this is a guess");
    expect(copy.sourceLine).toContain("Connect RuneLite");
  });

  it("still calls it a guess when a session preference is bolted on", () => {
    // "This fits unlock and 60 minutes" is what the player asked for, not
    // something the engine found out. Counting it as evidence is how a guess
    // gets promoted to a fact.
    expect(decisionConfidence(decision([
      fact("visible_progress_fit", "public_stats"),
      fact("session_preference_fit", "preference")
    ]))).toBe("guess");
  });

  it("calls it likely when public stats carry a real fact", () => {
    const likely = decision([fact("boss_kc_progress", "public_stats")]);
    expect(decisionConfidence(likely)).toBe("likely");
    // And says out loud what the Hiscores cannot see, because that is the gap
    // that made the guess wrong in the first place.
    expect(recommendationDecisionCopy(likely).sourceLine)
      .toBe("From your Hiscores. Quests, diaries and worn gear are not visible there.");
  });

  it("calls it measured when the bank or a sync backs it, and drops the footnote", () => {
    for (const provenance of ["bank", "runelite"] as const) {
      const measured = decision([fact("bank_context_used", provenance)]);
      expect(decisionConfidence(measured)).toBe("measured");
      // A fact that cites itself does not need a source line under it.
      expect(recommendationDecisionCopy(measured).sourceLine).toBeNull();
    }
  });

  it("is derived from provenance, so a new reason code cannot forget to set it", () => {
    // There is no `confidence` field anyone can leave out — it is a read of
    // evidence that already has to exist. This guards that property.
    const source = readFileSync(join(process.cwd(), "src/lib/recommendation-decision.ts"), "utf8");
    expect(source).toContain("export function decisionConfidence(");
    expect(source).not.toMatch(/confidence:\s*"(measured|likely|guess)"\s*,/);
  });
});

describe("the page shows it", () => {
  const client = readFileSync(join(process.cwd(), "src/app/next/next-client.tsx"), "utf8");

  it("stops printing 'Do this first' over a guess", () => {
    expect(client).toContain('decisionCopy.confidence === "measured"');
    expect(client).toContain('"Best guess"');
    expect(client).toContain('"Best fit for your levels"');
    expect(client).toContain("decisionCopy.sourceLine");
  });

  it("uses a word and a line, not a third colour scale", () => {
    // The repo already deleted one competing colour language tonight. Adding
    // another to mean "how sure are we" would repeat the exact mistake: the
    // gate ramp means "how good is this", and nothing else may borrow it.
    const hero = client.slice(client.indexOf("Best guess") - 1200, client.indexOf("Best guess") + 1200);
    expect(hero).not.toContain("data-gate");
    expect(hero).not.toMatch(/--color-(good|warning|danger)/);
  });
});
