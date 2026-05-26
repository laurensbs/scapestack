// Mood-engine sanity checks.
//
// Geen exhaustive coverage van alle mood × kind combinaties — focus
// op het kerngedrag dat in de UI verschilt:
//   - chill kiest geen boss als top
//   - cash boost money-recs
//   - quest boost quest + diary
//   - time-budget filter: 15min sessie ziet geen 60min boss-grind

import { describe, it, expect } from "vitest";
import { pickForMood } from "@/lib/mood";
import type { Recommendation } from "@/lib/next-up";

function rec(kind: Recommendation["kind"], id: string, score = 50): Recommendation {
  return {
    id,
    kind,
    title: `${kind}-${id}`,
    why: "test",
    score
  };
}

describe("pickForMood", () => {
  it("null wanneer recs leeg", () => {
    expect(pickForMood([], "chill", 60)).toBeNull();
  });

  it("chill: skill wint boven boss bij gelijke base score", () => {
    const recs = [rec("boss", "vorkath", 50), rec("skill", "fishing", 50)];
    const result = pickForMood(recs, "chill", 60);
    expect(result!.headline.kind).toBe("skill");
  });

  it("focused: boss/kc wint boven skill", () => {
    const recs = [rec("skill", "fishing", 50), rec("boss", "vorkath", 50)];
    const result = pickForMood(recs, "focused", 60);
    expect(result!.headline.kind).toBe("boss");
  });

  it("cash: money-rec wint van gelijk-scorende boss", () => {
    const recs = [rec("boss", "vorkath", 50), rec("money", "blast", 50)];
    const result = pickForMood(recs, "cash", 60);
    // money × cash(2.0) × time(1.0) = 100
    // boss × cash(1.4) × time(1.2 60min) = 84
    expect(result!.headline.kind).toBe("money");
  });

  it("quest: questing wint van boss met dezelfde base score", () => {
    const recs = [rec("boss", "kbd", 60), rec("quest", "dt2", 50)];
    const result = pickForMood(recs, "quest", 60);
    // quest × 2.0 × timeMult(1.2 voor 60min) = 120; boss × 0.6 × 1.2 = 43.2
    expect(result!.headline.kind).toBe("quest");
  });

  it("15min budget: boss-rec krijgt penalty", () => {
    const recs = [rec("boss", "vorkath", 50), rec("bank", "junk", 30)];
    const result = pickForMood(recs, "chill", 15);
    // bank × chill(1.3) × time(1.4) = 54.6 ; boss × chill(0.4) × time(0.6) = 12
    expect(result!.headline.kind).toBe("bank");
  });

  it("alternatives hebben andere kinds dan headline (diversity)", () => {
    const recs = [
      rec("skill", "fishing", 80),
      rec("skill", "wc", 75),
      rec("boss", "vorkath", 70),
      rec("quest", "dt2", 65),
    ];
    const result = pickForMood(recs, "focused", 60);
    // Headline = boss. Alts moeten kind != boss zijn (zolang voorhanden).
    expect(result!.headline.kind).toBe("boss");
    const altKinds = result!.alternatives.map((a) => a.kind);
    expect(altKinds).not.toContain("boss");
  });

  it("fallback: minder dan 3 recs → vult met wat-dan-ook", () => {
    const recs = [rec("boss", "vorkath", 80), rec("boss", "kbd", 60)];
    const result = pickForMood(recs, "focused", 60);
    expect(result!.headline).toBeDefined();
    expect(result!.alternatives.length).toBe(1);
  });
});
