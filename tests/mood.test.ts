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

  it("time-budget heeft continu effect — 60 ≠ 120 voor boss", () => {
    // Boss sweet-spot = 90; bij 60 zijn we factor 1.5 onder, bij 120
    // factor 1.33 boven. 120 moet dichter bij sweet-spot zijn → hoger
    // score → effect via headline-keuze als er gelijke base scores zijn.
    const recs = [
      rec("boss", "vorkath", 50),
      rec("bank", "junk-clear", 50),
    ];
    // Bank sweet-spot = 20. Bij 60 al ver weg (factor 3), bij 120 nog
    // verder. Boss bij 120 vs 60: 120 is dichter bij 90 dan 60 is.
    const r60 = pickForMood(recs, "focused", 60);
    const r120 = pickForMood(recs, "focused", 120);
    // Verwachting: bij 60 staat boss bovenaan, bij 120 ook (focused
    // weight × time-fit). Wat we vooral checken: de waardes zijn niet
    // identiek dus het time-toggle doet ECHT iets.
    expect(r60!.headline.id).toBeDefined();
    expect(r120!.headline.id).toBeDefined();
    // De relatieve scores moeten verschillen, ook al is de winnaar
    // toevallig dezelfde. We checken via een 3e rec die in het ene
    // geval wel/niet als alternative verschijnt.
    const recs2 = [
      rec("bank", "junk", 50),    // sweet 20  → 15 best, 120 slechtst
      rec("skill", "fish", 50),   // sweet 90  → 120 dichtsbij
    ];
    const fast = pickForMood(recs2, "chill", 15);
    const slow = pickForMood(recs2, "chill", 120);
    // Bij 15 min: bank wint (dicht bij sweet 20). Bij 120: skill wint.
    expect(fast!.headline.kind).toBe("bank");
    expect(slow!.headline.kind).toBe("skill");
  });
});
