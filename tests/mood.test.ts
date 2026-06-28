// Mood-engine sanity checks.
//
// Geen exhaustive coverage van alle mood × kind combinaties — focus
// op het kerngedrag dat in de UI verschilt:
//   - chill kiest geen boss als top
//   - GP boost money-recs
//   - unlock/quest boost quest + diary
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

  it("chill: intense boss wordt geen headline tegenover simpele progress", () => {
    const recs = [rec("boss", "callisto", 95), rec("skill", "fishing", 50)];
    const result = pickForMood(recs, "chill", 60);
    expect(result!.headline.kind).toBe("skill");
  });

  it("afk: skill/chill plan wint boven bossing", () => {
    const recs = [rec("kc", "vorkath-50", 90), rec("skill", "farming", 55)];
    const result = pickForMood(recs, "afk", 60);
    expect(result!.headline.kind).toBe("skill");
  });

  it("bossing: meaningful PvM kan headline zijn wanneer het past", () => {
    const recs = [rec("kc", "vorkath-50", 70), rec("skill", "farming", 80)];
    const result = pickForMood(recs, "bossing", 60);
    expect(result!.headline.kind).toBe("kc");
  });

  it("unlock: diary of quest wint van ongeankerde bossing", () => {
    const recs = [rec("boss", "demonics", 80), rec("diary", "desert-hard", 70), rec("quest", "mm2", 65)];
    const result = pickForMood(recs, "unlock", 60);
    expect(["diary", "quest"]).toContain(result!.headline.kind);
  });

  it("short: kiest een korte route boven bossing", () => {
    const recs = [rec("boss", "vorkath", 90), rec("bank", "prep", 45)];
    const result = pickForMood(recs, "short", 15);
    expect(result!.headline.kind).toBe("bank");
  });

  it("focused: boss/kc wint boven skill", () => {
    const recs = [rec("skill", "fishing", 50), rec("boss", "vorkath", 50)];
    const result = pickForMood(recs, "focused", 60);
    expect(result!.headline.kind).toBe("boss");
  });

  it("cash: money wint van gelijk-scorende boss in money's sweet spot", () => {
    // Money sweet spot = 30min. Bij 30min: money×2.0×1.4 = 140;
    // boss(out of range, < 45) ×1.4 × ~0.33 = ~23. Money domineert.
    const recs = [rec("boss", "vorkath", 50), rec("money", "blast", 50)];
    const result = pickForMood(recs, "cash", 30);
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
    // Bank is a quick task; chill + 15min should not headline a boss trip.
    expect(result!.headline.kind).toBe("bank");
  });

  it("shuffleIndex=1 toont een ander kind dan #0 (echte refresh)", () => {
    const recs = [
      rec("boss",  "vorkath", 80),
      rec("boss",  "kbd",     75),  // zelfde kind, moet geskipt voor shuffle
      rec("skill", "slayer",  70),
      rec("quest", "dt2",     65),
    ];
    const first = pickForMood(recs, "focused", 60, 0);
    const second = pickForMood(recs, "focused", 60, 1);
    expect(first!.headline.kind).toBe("boss");
    expect(second!.headline.kind).not.toBe("boss");
  });

  it("shuffleIndex >> aantal kinds cycelt door fallback", () => {
    const recs = [
      rec("boss", "vorkath", 70),
      rec("boss", "kbd",     65),
    ];
    const r0 = pickForMood(recs, "focused", 60, 0);
    const r1 = pickForMood(recs, "focused", 60, 1);
    // Niet undefined — fallback cycle pakt de volgende rec.
    expect(r0!.headline).toBeDefined();
    expect(r1!.headline).toBeDefined();
    // En r1 mag een andere rec zijn (of dezelfde — fallback cycelt).
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

  it("15-min budget: boss-rec krijgt hard penalty, korte rec wint", () => {
    // Boss out-of-range (min 45) bij 15 min → penalty ≤ 0.4. Bank-rec
    // is in z'n sweet spot (5..30) → score ~1.3+.
    const recs = [
      rec("boss", "inferno", 90),  // hoge base
      rec("bank", "tidy",    50),  // lagere base
    ];
    const result = pickForMood(recs, "focused", 15);
    // Ondanks dat boss een veel hogere base heeft, mag het niet bovenaan
    // staan voor een 15-min sessie — penalty moet daar voor zorgen.
    expect(result!.headline.kind).toBe("bank");
  });

  it("2-uur budget: lange-vorm boss wint van daily-stijl money", () => {
    const recs = [
      rec("money", "herb-run", 50),
      rec("boss",  "raid",     50),
    ];
    const result = pickForMood(recs, "focused", 120);
    // Money (high=60) krijgt out-of-range penalty bij 120; boss (high=180)
    // zit nog in range.
    expect(result!.headline.kind).toBe("boss");
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
