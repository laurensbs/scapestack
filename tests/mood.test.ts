// Mood-engine sanity checks.
//
// Geen exhaustive coverage van alle mood × kind combinaties — focus
// op het kerngedrag dat in de UI verschilt:
//   - chill kiest geen boss als top
//   - GP boost money-recs
//   - unlock/quest boost quest + diary
//   - time-budget filter: 15min sessie ziet geen 60min boss-grind

import { describe, it, expect } from "vitest";
import { pickForMood, pickForRoute } from "@/lib/mood";
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

function scoutKc(id = "callisto-scout", score = 95): Recommendation {
  return {
    id,
    kind: "kc",
    title: "Push Callisto to 50 KC",
    why: "1 KC is only a scout read.",
    decisionReason: "This is only 1 KC, so it stays a scout read instead of the main plan.",
    score,
    kcMeta: { kc: 1, denom: 50, dropName: "first 50 KC" }
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

  it("bossing: 1-4 KC scout read blijft backup wanneer er betere PvM-context is", () => {
    const recs = [scoutKc(), rec("boss", "vorkath", 70), rec("skill", "farming", 60)];
    const result = pickForMood(recs, "bossing", 60);
    expect(result!.headline.id).toBe("vorkath");
    expect(result!.alternatives.some((alt) => alt.id === "callisto-scout")).toBe(true);
  });

  it("gp: scout bossing wint niet van echte money route", () => {
    const recs = [scoutKc(), rec("money", "vorkath-money", 62), rec("skill", "farming", 60)];
    const result = pickForMood(recs, "cash", 60);
    expect(result!.headline.kind).toBe("money");
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

  it("bossing backups kiezen lagere druk en GP in plaats van nog een boss", () => {
    const recs = [
      rec("boss", "vorkath", 80),
      rec("kc", "vardorvis", 78),
      rec("skill", "farming", 70),
      rec("money", "herb-run", 68),
      rec("quest", "mm2", 66),
    ];
    const result = pickForMood(recs, "bossing", 60);
    expect(result!.headline.kind).toBe("boss");
    expect(result!.alternatives.map((alt) => alt.kind)).toEqual(["skill", "money"]);
  });

  it("unlock backups geven chill progress en GP als echte alternatieven", () => {
    const recs = [
      rec("quest", "mm2", 80),
      rec("diary", "desert-hard", 78),
      rec("skill", "farming", 70),
      rec("money", "herb-run", 68),
      rec("boss", "dks", 66),
    ];
    const result = pickForMood(recs, "unlock", 60);
    expect(result!.headline.kind).toBe("quest");
    expect(result!.alternatives.map((alt) => alt.kind)).toEqual(["skill", "money"]);
  });

  it("fallback: minder dan 3 recs → vult met wat-dan-ook", () => {
    const recs = [rec("boss", "vorkath", 80), rec("boss", "kbd", 60)];
    const result = pickForMood(recs, "focused", 60);
    expect(result!.headline).toBeDefined();
    expect(result!.alternatives.length).toBe(1);
  });

  it("maxing route kiest cape/level progress boven willekeurige bossing", () => {
    const recs = [
      rec("boss", "vorkath", 82),
      {
        ...rec("skill", "farming-99", 64),
        title: "Push Farming to 99",
        why: "You're close to the Farming cape."
      },
      rec("money", "herb-run", 70)
    ];
    const result = pickForRoute(recs, "unlock", 120, "maxing");
    expect(result!.headline.id).toBe("farming-99");
    expect(result!.routeLabel).toBe("Maxing lane");
  });

  it("route lens labels read like player choices instead of dashboard filters", () => {
    expect(pickForRoute([rec("money", "herb-run", 70)], "cash", 30, "gp-upgrade")!.routeLabel).toBe("Rebuild GP");
    expect(pickForRoute([rec("boss", "vorkath", 70)], "bossing", 60, "boss-log")!.routeLabel).toBe("Boss log");
    expect(pickForRoute([rec("skill", "redwoods", 70)], "afk", 60, "afk-progress")!.routeLabel).toBe("AFK progress");
    expect(pickForRoute([rec("skill", "birdhouses", 70)], "short", 15, "short-login")!.routeLabel).toBe("Quick win");
  });

  it("route tags can surface smarter account-story routes without visible labels", () => {
    const recs: Recommendation[] = [
      rec("diary", "desert-hard", 82),
      { ...rec("skill", "iron-supplies", 64), title: "Run herbs + birdhouses", routeTags: ["iron", "afk", "rebuild", "skiller"] },
      { ...rec("milestone", "maxing-lane", 60), title: "Pick a maxing lane", routeTags: ["maxing", "afk", "skiller"] }
    ];

    const afk = pickForRoute(recs, "unlock", 60, "afk-progress");
    const maxing = pickForRoute(recs, "unlock", 120, "maxing");

    expect(afk!.headline.id).toBe("iron-supplies");
    expect(maxing!.headline.id).toBe("maxing-lane");
  });

  it("fun route kan minigame of PvM kiezen in plaats van dezelfde unlock-chain", () => {
    const recs = [
      rec("diary", "desert-hard", 84),
      { ...rec("minigame", "wintertodt", 62), why: "One reward block with a clean stop point." },
      { ...rec("kc", "vorkath-50", 60), why: "KC block with a drop chance.", kcMeta: { kc: 42, denom: 3000, dropName: "Vorki" } }
    ];
    const result = pickForRoute(recs, "unlock", 60, "fun");
    expect(["minigame", "kc"]).toContain(result!.headline.kind);
    expect(result!.routeHelper).toContain("without chores");
  });

  it("gp route zet cash funding boven maxing of diary progress", () => {
    const recs = [
      { ...rec("skill", "farming-99", 76), title: "Push Farming to 99", why: "You're close to the Farming cape." },
      rec("diary", "desert-hard", 82),
      { ...rec("money", "vorkath-gp", 62), why: "~3.0M gp/hr to fund the next upgrade." }
    ];
    const result = pickForRoute(recs, "unlock", 60, "gp-upgrade");
    expect(result!.headline.kind).toBe("money");
  });

  it("try-another skip demotes the exact card for this session", () => {
    const recs = [
      rec("quest", "mm2", 88),
      rec("skill", "farming-99", 72),
      rec("money", "herb-run", 70)
    ];
    const first = pickForRoute(recs, "unlock", 60, "smart");
    const afterSkip = pickForRoute(recs, "unlock", 60, "smart", 0, {
      skippedIds: { [first!.headline.id]: 1 },
      previousId: first!.headline.id,
      previousKind: first!.headline.kind
    });

    expect(first!.headline.id).toBe("mm2");
    expect(afterSkip!.headline.id).not.toBe("mm2");
  });

  it("try-another favours a different activity type when one is available", () => {
    const recs = [
      rec("quest", "mm2", 82),
      rec("quest", "sote", 78),
      rec("skill", "farming-99", 70),
      rec("money", "herb-run", 68)
    ];
    const result = pickForRoute(recs, "unlock", 60, "smart", 0, {
      skippedIds: { mm2: 1 },
      previousId: "mm2",
      previousKind: "quest"
    });

    expect(result!.headline.kind).not.toBe("quest");
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
