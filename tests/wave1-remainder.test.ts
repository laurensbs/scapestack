import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { computeNextUp } from "@/lib/next-up";
import { minigameRecs } from "@/lib/next-up-minigames";
import type { HiscoreSkill } from "@/lib/hiscores";

const SKILL_NAMES = [
  "Attack", "Defence", "Strength", "Hitpoints", "Ranged", "Prayer", "Magic",
  "Cooking", "Woodcutting", "Fletching", "Fishing", "Firemaking", "Crafting",
  "Smithing", "Mining", "Herblore", "Agility", "Thieving", "Slayer", "Farming",
  "Runecraft", "Hunter", "Construction"
];

function uniform(level: number): HiscoreSkill[] {
  const rows = SKILL_NAMES.map((name, id) => ({ id: id + 1, name, rank: 1, level, xp: 737_627 }));
  const total = rows.reduce((sum, row) => sum + row.level, 0);
  return [{ id: 0, name: "Overall", rank: 1, level: total, xp: 0 }, ...rows];
}

const ids = (skills: HiscoreSkill[]) =>
  minigameRecs(skills, { skills }).map((rec) => rec.id.replace("minigame:", ""));

describe("a minigame stays offered for as long as it is worth doing", () => {
  it("does not go silent above level 77", () => {
    // Regression: one number did two jobs — open, and still relevant — and it
    // was gateLevel + 25 for everything. The highest gate in the list is
    // Agility 52, so no minigame was ever offered above 77 in its own gate
    // skill and an all-80 account got none at all.
    expect(ids(uniform(80)).length).toBeGreaterThan(0);
    expect(ids(uniform(90)).length).toBeGreaterThan(0);
    expect(ids(uniform(99)).length).toBeGreaterThan(0);
  });

  it("keeps Wintertodt visible across the range its own card promises", () => {
    // The card reads "the fastest path from 50 to 99 Firemaking" and the window
    // hid it for the top 24 levels of exactly that range.
    for (const level of [50, 60, 75, 85, 99]) {
      expect(ids(uniform(level)), `Firemaking ${level}`).toContain("wintertodt");
    }
  });

  it("still refuses to open one before its gate", () => {
    expect(ids(uniform(40))).not.toContain("wintertodt");     // Firemaking 50
    expect(ids(uniform(40))).not.toContain("volcanic-mine");  // Mining 50
    expect(ids(uniform(20))).not.toContain("gotr");           // Runecraft 27
  });

  it("retires the ones a high account has genuinely outgrown", () => {
    // Motherlode is superseded long before 99 Mining, and Mahogany Homes
    // before 99 Construction. Their own payoff lines say so.
    expect(ids(uniform(99))).not.toContain("motherlode");
    expect(ids(uniform(99))).not.toContain("mahogany-homes");
  });

  it("ranks a fresh unlock above one the account has long passed", () => {
    const fresh = minigameRecs(uniform(50), { skills: uniform(50) })
      .find((rec) => rec.id === "minigame:wintertodt");
    const old = minigameRecs(uniform(99), { skills: uniform(99) })
      .find((rec) => rec.id === "minigame:wintertodt");
    expect(fresh).toBeTruthy();
    expect(old).toBeTruthy();
    expect(old!.score).toBeLessThan(fresh!.score * 0.7);
  });

  it("never puts a minigame near the top of a maxed account's list", () => {
    // This is what the window was really for, and it is the one job worth
    // keeping. Removing the window without adding the decay put "Try
    // Wintertodt" second on a 2376-total account's plan.
    return computeNextUp({ skills: uniform(99), questPoints: 300 }).then((result) => {
      const all = [result.headline, ...result.rest].filter(Boolean);
      const first = all.findIndex((rec) => rec!.kind === "minigame");
      expect(first === -1 || first >= 3, `minigame at position ${first}`).toBe(true);
      if (first >= 0) expect(all[first]!.score).toBeLessThan(40);
    });
  });
});

describe("the two gates that were invented rather than sourced", () => {
  it("gates Soul Wars on combat and total level, not on Attack", () => {
    // The wiki gives 40 combat and 500 total. Attack 40 was never a Soul Wars
    // requirement, so the minigame opened and closed on the wrong number.
    const lowTotal = uniform(20);   // 460 total, combat well under 40
    expect(ids(lowTotal)).not.toContain("soul-wars");
    const eligible = uniform(45);   // comfortably past both bars
    expect(ids(eligible)).toContain("soul-wars");
  });

  it("does not retire either of them at combat 100", () => {
    // relevantUntil 100 made both vanish for any account past it. The Fighter
    // torso is still the best non-Bandos body long after that, and Soul Wars is
    // tradeable XP at any level — the decay should rank them down, not hide
    // them.
    expect(ids(uniform(80))).toContain("barbarian-assault");
    expect(ids(uniform(80))).toContain("soul-wars");
  });

  it("does not claim an entry requirement that does not exist", () => {
    const ba = minigameRecs(uniform(70), { skills: uniform(70) })
      .find((rec) => rec.id === "minigame:barbarian-assault");
    expect(ba?.planSeed?.prep).not.toMatch(/Combat 3/);
    expect(ba?.planSeed?.prep).toContain("Nothing gates this");
    const sw = minigameRecs(uniform(70), { skills: uniform(70) })
      .find((rec) => rec.id === "minigame:soul-wars");
    // Both halves of the real bar, not just the combat one.
    expect(sw?.planSeed?.prep).toContain("500 total");
  });

  it("puts no requirement on Barbarian Assault, because the game puts none", () => {
    // "There are no requirements to play." The invented Hitpoints 40 bar plus
    // the 25-level window made the Fighter torso — the best mid-game body slot
    // in the game — invisible to every account above 65 Hitpoints.
    expect(ids(uniform(10))).toContain("barbarian-assault");
    expect(ids(uniform(70))).toContain("barbarian-assault");
  });
});

describe("the explanation describes the trip that is on screen", () => {
  const source = readFileSync(join(process.cwd(), "src/app/next/next-client.tsx"), "utf8");

  it("explains WhatToDo's pick, not the engine's default", () => {
    // Regression: "Why this trip?" read result.headline while the card rendered
    // WhatToDo's own pick — re-ranked by mood, time budget, route lens,
    // shuffle, saved feedback and explicit selection. They diverge on the first
    // render for most accounts and always after any interaction, so the panel
    // routinely explained a trip that was not on screen.
    expect(source).toContain("onActivePickChange");
    expect(source).toContain("const explainedRec = shownRec ?? headline;");
    expect(source).toContain("rec={explainedRec}");
    expect(source).toContain("headline={explainedRec}");
  });

  it("still has something to explain before the child has reported", () => {
    // The fallback to the engine's headline is what keeps the panel populated
    // on the very first paint.
    expect(source).toMatch(/shownRec \?\? headline/);
  });
});
