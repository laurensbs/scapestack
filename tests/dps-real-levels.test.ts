import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { BOSSES } from "@/lib/bosses";
import { bossViabilityFromSimpleBank } from "@/lib/boss-viability";
import { buildBossUpgradePlan } from "@/lib/boss-upgrade-plan";
import { bestStyleAndSetup, calcDps, combatStatsFromSkills, MAXED_STATS, type CombatStats } from "@/lib/dps";
import { GEAR, lookupGear } from "@/lib/gear";
import { normalizeBankHandoffItems } from "@/lib/next-bank-handoff";
import { bossRecs } from "@/lib/next-up-bosses";
import type { HiscoreSkill } from "@/lib/hiscores";

const boss = (slug: string) => {
  const found = BOSSES.find((entry) => entry.slug === slug);
  if (!found) throw new Error(`no boss ${slug}`);
  return found;
};

const gear = (...ids: number[]) => ids.flatMap((id) => {
  const item = lookupGear(id);
  return item ? [item] : [];
});

/** Abyssal whip, rune body, black d'hide, mystic top — a real mid-game bank. */
const MID_BANK = [
  { id: 4151, name: "Abyssal whip" },
  { id: 1127, name: "Rune platebody" },
  { id: 2503, name: "Black d'hide body" },
  { id: 4091, name: "Mystic robe top" }
];

const MID: CombatStats = { attack: 70, strength: 75, defence: 70, ranged: 70, magic: 70, prayer: 52 };

const SKILL_NAMES = [
  "Attack", "Defence", "Strength", "Hitpoints", "Ranged", "Prayer", "Magic",
  "Cooking", "Woodcutting", "Fletching", "Fishing", "Firemaking", "Crafting",
  "Smithing", "Mining", "Herblore", "Agility", "Thieving", "Slayer", "Farming",
  "Runecraft", "Hunter", "Construction"
];

function skills(levels: Partial<Record<string, number>>): HiscoreSkill[] {
  return SKILL_NAMES.map((name, id) => ({ id: id + 1, name, rank: 1, level: levels[name] ?? 50, xp: 737_627 }));
}

describe("the engine answers for this account, not a maxed one", () => {
  it("gives a mid-level account a slower kill than a maxed one with the same gear", () => {
    // Regression: STATS was a module constant of 99s with no parameter, so this
    // was one number for everybody. An 85-Attack player reading "73 seconds"
    // was reading a maxed account's kill time.
    const maxed = bestStyleAndSetup(GEAR, boss("vorkath"), MAXED_STATS);
    const mid = bestStyleAndSetup(GEAR, boss("vorkath"), MID);

    expect(maxed.ttk).toBeLessThan(mid.ttk);
    expect(mid.maxHit).toBeLessThan(maxed.maxHit);
    // Not a rounding difference — the old figure was most of a minute optimistic.
    expect(mid.ttk).toBeGreaterThan(maxed.ttk * 1.5);
  });

  it("defaults to a maxed account and says so, rather than refusing to answer", () => {
    // /dps has to work before an account is attached — that is why the boss
    // roster exists at all. The obligation is that the verdict declares it.
    const withoutStats = bossViabilityFromSimpleBank(MID_BANK, boss("giant-mole"));
    const withStats = bossViabilityFromSimpleBank(MID_BANK, boss("giant-mole"), MID);

    expect(withoutStats?.assumedMaxed).toBe(true);
    expect(withStats?.assumedMaxed).toBe(false);
    expect(withoutStats?.dps).toBeGreaterThan(withStats!.dps);
  });

  it("stops attributing a capability claim to the bank when the levels were invented", () => {
    const assumed = bossViabilityFromSimpleBank(MID_BANK, boss("giant-mole"));
    const real = bossViabilityFromSimpleBank(MID_BANK, boss("obor"), MID);
    expect(assumed?.assumedMaxed).toBe(true);
    expect(real?.assumedMaxed).toBe(false);
  });
});

describe("prayer follows the account's Prayer level", () => {
  // The old code applied Piety, Rigour and Augury to everyone unconditionally.
  // Levels and percentages are from oldschool.runescape.wiki/w/Prayer.
  //
  // Measured on an explicit melee setup rather than bestStyleAndSetup, because
  // that picks whichever style wins — and a magic setup's max hit does not move
  // with a prayer that only raises magic accuracy, so the assertion would be
  // reading a number the change cannot affect.
  const whip = gear(4151);
  const at = (prayer: number, defence = 75): CombatStats => ({ ...MID, prayer, defence });
  const hit = (stats: CombatStats) => calcDps({ weapon: whip[0] }, boss("giant-mole"), "slash", stats).maxHit;

  it("has a whip to measure with", () => {
    expect(whip).toHaveLength(1);
  });

  it("does not hand Piety to an account that cannot use it", () => {
    expect(hit(at(69))).toBeLessThan(hit(at(70)));
  });

  it("still gives the lower prayers to the levels that have them", () => {
    // Monotonic across the whole ladder, strictly up from end to end. Not
    // strictly up at every step: max hit is floored, and at 75 Strength with a
    // bare whip Ultimate Strength (+15%) and Chivalry (+18%) both land on 22.
    // That is the game's own rounding, not a missing tier.
    const ladder = [1, 4, 13, 31, 60, 70].map((prayer) => hit(at(prayer)));
    for (let i = 1; i < ladder.length; i += 1) {
      expect(ladder[i], `prayer step ${i}`).toBeGreaterThanOrEqual(ladder[i - 1]);
    }
    expect(ladder[ladder.length - 1]).toBeGreaterThan(ladder[0]);
    expect(hit(at(3))).toBeLessThan(hit(at(13)));
    expect(hit(at(13))).toBeLessThan(hit(at(31)));
  });

  it("requires the Defence level Chivalry and Piety also need", () => {
    // 70 Prayer alone is not Piety — it wants 70 Defence too.
    expect(hit(at(70, 60))).toBeLessThan(hit(at(70, 70)));
  });
});

describe("the spell a low-Magic account can actually cast", () => {
  it("does not credit a 40-Magic account with Fire Surge", () => {
    // The base was a flat 28 — the Fire Surge hit — for every account.
    const staff = gear(1381); // Staff of air, a plain weapon so the base spell decides
    if (staff.length === 0) return;
    const low = bestStyleAndSetup(staff, boss("giant-mole"), { ...MID, magic: 40, prayer: 1 });
    const high = bestStyleAndSetup(staff, boss("giant-mole"), { ...MID, magic: 99, prayer: 1 });
    expect(low.maxHit).toBeLessThan(high.maxHit);
  });

  it("never produces a negative max hit from a powered staff below its requirement", () => {
    // The scaling formulas are only defined at or above each staff's own Magic
    // requirement; unclamped, floor((magic - 75) / 3) + 15 goes negative.
    const sang = GEAR.filter((item) => /sanguinesti staff/i.test(item.name));
    if (sang.length === 0) return;
    for (const magic of [1, 20, 50, 74, 75, 99]) {
      const result = bestStyleAndSetup(sang, boss("giant-mole"), { ...MID, magic });
      expect(result.maxHit, `magic ${magic}`).toBeGreaterThanOrEqual(0);
      expect(Number.isFinite(result.dps), `magic ${magic}`).toBe(true);
    }
  });
});

describe("a boss the account can actually kill", () => {
  const midSkills = skills({
    Attack: 70, Strength: 75, Defence: 70, Hitpoints: 75, Ranged: 70,
    Magic: 70, Prayer: 52, Slayer: 50
  });

  it("always leaves a mid-game account at least one boss it can actually kill", () => {
    // The property, not the mechanism. The window only proposes bosses within
    // 25 combat levels below the player; once the DPS stopped assuming maxed
    // stats the engine correctly blocked all of them and left a whip-carrying
    // account with no boss at all. Either the window or the fallback has to
    // produce something ready — which of the two does it is not the point.
    const recs = bossRecs(89, MID_BANK, midSkills, {}, null, { skills: midSkills }, MID);
    const ready = recs.filter((rec) => {
      const target = BOSSES.find((entry) => entry.slug === rec.bossSlug);
      return target
        ? bossViabilityFromSimpleBank(MID_BANK, target, MID)?.tone === "ready"
        : false;
    });
    expect(ready.length, recs.map((rec) => rec.id).join(", ")).toBeGreaterThan(0);
  });

  it("states a measured kill time when it falls back", () => {
    const recs = bossRecs(110, [{ id: 1333, name: "Rune scimitar" }], skills({
      Attack: 90, Strength: 90, Defence: 90, Hitpoints: 90, Ranged: 80,
      Magic: 80, Prayer: 70, Slayer: 60
    }), {}, null, { skills: midSkills }, {
      attack: 90, strength: 90, defence: 90, ranged: 80, magic: 80, prayer: 70
    });
    const fallback = recs.filter((rec) => rec.why.startsWith("Your bank is behind"));
    expect(fallback.length).toBeGreaterThan(0);
    expect(fallback[0].decisionReason).toMatch(/\d+ sec|\d+ min/);
  });

  it("never sends an under-geared account into the Wilderness as its fallback", () => {
    // The fallback exists to hand a confidence-building fight to an account
    // whose gear is behind its combat level. Losing what little gear it has is
    // the worst outcome available.
    for (const cl of [95, 100, 110, 120]) {
      const recs = bossRecs(cl, [{ id: 1333, name: "Rune scimitar" }], midSkills, {}, null, { skills: midSkills }, MID);
      for (const rec of recs.filter((entry) => entry.why.startsWith("Your bank is behind"))) {
        const target = BOSSES.find((entry) => entry.slug === rec.bossSlug);
        expect(target?.category, `${cl}: ${rec.id}`).not.toBe("wildy");
      }
    }
  });

  it("stays out of the way when the window already works", () => {
    const recs = bossRecs(89, MID_BANK, midSkills, {}, null, { skills: midSkills }, MAXED_STATS);
    expect(recs.map((rec) => rec.id)).not.toContain("boss:obor");
  });

  it("does not fire at all without levels, where every verdict is a guess", () => {
    const recs = bossRecs(89, MID_BANK, midSkills, {}, null, { skills: midSkills }, null);
    expect(recs.map((rec) => rec.id)).not.toContain("boss:obor");
  });

  it("never lets the pair take two of the three headline slots", () => {
    const recs = bossRecs(89, MID_BANK, midSkills, {}, null, { skills: midSkills }, MID);
    const fallbacks = recs.filter((rec) => rec.why.startsWith("Nothing at your combat level"));
    expect(fallbacks.length).toBeLessThanOrEqual(2);
    if (fallbacks.length === 2) {
      expect(fallbacks[0].score).toBeGreaterThan(fallbacks[1].score);
    }
  });

  it("stays quiet for an account that is already bossing", () => {
    // hasBossExperience skips a boss before any viability check, so an account
    // farming Vorkath had no in-window boss left to mark the window healthy —
    // and got told nothing at its combat level was winnable.
    const recs = bossRecs(89, MID_BANK, midSkills, { Vorkath: 400 }, null, { skills: midSkills }, MID);
    expect(recs.map((rec) => rec.id)).not.toContain("boss:obor");
  });

  it("collapses a boss group instead of spending two slots on one trip", () => {
    // The caller's seenGroups is only filled for bosses inside the window, and
    // the fallback only looks below it, so the guard could never fire: the
    // Dagannoth Kings came out as two separate recommendations.
    const maxed = skills(Object.fromEntries(SKILL_NAMES.map((name) => [name, 99])));
    const recs = bossRecs(120, [{ id: 4587, name: "Dragon scimitar" }], maxed, {}, null, { skills: maxed }, MAXED_STATS);
    const dks = recs.filter((rec) => /dks|dagannoth/i.test(rec.id));
    expect(dks.length).toBeLessThanOrEqual(1);
  });

  it("applies the same gear-name gate the main pass applies", () => {
    // Skipping it let the fallback recommend bosses the main pass had
    // deliberately suppressed for this exact bank.
    const recs = bossRecs(120, MID_BANK, midSkills, {}, null, { skills: midSkills }, MID);
    for (const rec of recs.filter((entry) => entry.why.startsWith("Your bank is behind"))) {
      expect(rec.gearConfidence, rec.id).toBe("confirmed");
    }
  });

  it("never stamps combat advice on an activity with no hit points", () => {
    const maxed = skills(Object.fromEntries(SKILL_NAMES.map((name) => [name, 99])));
    const recs = bossRecs(120, [{ id: 4587, name: "Dragon scimitar" }], maxed, {}, null, { skills: maxed }, MAXED_STATS);
    for (const rec of recs) {
      const entry = BOSSES.find((candidate) => `boss:${candidate.slug}` === rec.id);
      if (entry) expect(entry.hp, rec.id).toBeGreaterThan(0);
    }
  });

  it("respects the Slayer gate before counting a boss as proof the window works", () => {
    // Regression: the check ran before the gates, so Kraken — killable on paper,
    // then dropped for needing 87 Slayer against this account's 50 — marked the
    // window healthy and suppressed the fallback built for exactly this account.
    const recs = bossRecs(89, MID_BANK, midSkills, {}, null, { skills: midSkills }, MID);
    expect(recs.map((rec) => rec.id)).not.toContain("boss:kraken");
  });
});

describe("the upgrade card compares like with like", () => {
  it("computes the candidate at the same levels as the figure it subtracts from", () => {
    // Regression: `current` was threaded to the account's real levels while
    // buildBossUpgradePlan still fell back to MAXED_STATS, so every gain
    // carried the whole 99s-vs-real gap. A +0.2 DPS amulet read +2.3, which
    // tripped the modal's "upgrade first" threshold and told the player the
    // boss they had just been sent to was not worth doing.
    const owned = gear(4151, 1127, 2503, 4091);
    const current = bestStyleAndSetup(owned, boss("obor"), MID);
    const plan = buildBossUpgradePlan({
      boss: boss("obor"),
      owned,
      bankItems: normalizeBankHandoffItems([{ id: 995, name: "Coins", quantity: 40_000_000 }]),
      current,
      accountType: null
    });
    expect(plan).toBeTruthy();
    // The whole inflation was roughly the stat gap itself, about 2 DPS here.
    expect(plan!.gain).toBeLessThan(1);
    expect(plan!.gain).toBeGreaterThan(0);
  });

  it("carries the stats on the breakdown so the two sides cannot drift apart", () => {
    const owned = gear(4151);
    expect(bestStyleAndSetup(owned, boss("obor"), MID).stats).toEqual(MID);
    expect(bestStyleAndSetup(owned, boss("obor")).stats).toEqual(MAXED_STATS);
  });
});

describe("every surface that shows a kill time actually supplies the levels", () => {
  // The engine taking a parameter is worthless if no caller passes one. These
  // pin the wiring, because that is the half that silently rots.
  const source = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

  it("fetches the account's Hiscores on /dps instead of only holding an RSN", () => {
    const client = source("src/app/dps/dps-client.tsx");
    expect(client).toContain("hiscoresAction");
    expect(client).toContain("combatStatsFromSkills");
    expect(client).toContain("bestStyleAndSetup(owned, boss, combatStats ?? undefined)");
  });

  it("passes them to the boss modal from both of its parents", () => {
    expect(source("src/app/dps/dps-client.tsx")).toContain("stats={combatStats}");
    expect(source("src/app/next/next-client.tsx")).toContain("stats={combatStats}");
    expect(source("src/components/lazy-boss-detail-modal.tsx")).toContain("stats={stats}");
  });

  it("hands /bank's own skills prop to the section that judges bosses", () => {
    const bank = source("src/components/bank-result.tsx");
    expect(bank).toContain("hiscoreSkills={hiscoreSkills}");
    expect(bank).toContain("combatStatsFromSkills(hiscoreSkills)");
  });

  it("stops claiming the numbers are level 99 when they are not", () => {
    const modal = source("src/components/boss-detail-modal.tsx");
    // The one sentence in the whole app that named whose levels these were.
    // It asserted 99s unconditionally, so it became false the moment real
    // levels arrived — and was already false for every sub-99 account reading
    // its own figures.
    expect(modal).not.toContain("Solo DPS uses level 99 stats and offensive prayers.");
    expect(modal).toContain("Solo DPS uses your levels");
    expect(modal).toContain("assumes level 99 stats");
  });

  it("keeps the audit gate able to run at all", () => {
    // The guard compared import.meta.url against a template-literal file URL.
    // import.meta.url percent-encodes, and this repo's path has a space, so
    // main() never fired: audit:next printed nothing, exited 0, and sat in
    // ci:check as a gate that gated nothing.
    const script = source("scripts/audit-next.ts");
    expect(script).toContain("pathToFileURL(process.argv[1]).href");
    expect(script).not.toContain("`file://${process.argv[1]}`");
  });
});

describe("reading levels off a skill list", () => {
  it("returns null rather than filling gaps with 99s", () => {
    expect(combatStatsFromSkills(null)).toBeNull();
    expect(combatStatsFromSkills([])).toBeNull();
    expect(combatStatsFromSkills([{ name: "Attack", level: 70 }])).toBeNull();
  });

  it("takes Prayer and Defence when present and floors them at 1 when not", () => {
    const full = combatStatsFromSkills(skills({ Attack: 80, Strength: 80, Ranged: 80, Magic: 80, Prayer: 70, Defence: 75 }));
    expect(full).toEqual({ attack: 80, strength: 80, ranged: 80, magic: 80, prayer: 70, defence: 75 });

    const partial = combatStatsFromSkills([
      { name: "Attack", level: 60 }, { name: "Strength", level: 60 },
      { name: "Ranged", level: 60 }, { name: "Magic", level: 60 }
    ]);
    expect(partial).toEqual({ attack: 60, strength: 60, ranged: 60, magic: 60, prayer: 1, defence: 1 });
  });

  it("is case-insensitive, because sources disagree on casing", () => {
    const lower = combatStatsFromSkills([
      { name: "attack", level: 60 }, { name: "strength", level: 60 },
      { name: "ranged", level: 60 }, { name: "magic", level: 60 }
    ]);
    expect(lower?.attack).toBe(60);
  });
});
