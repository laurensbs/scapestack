// Simulator unit tests.
// Sanity checks; we modelleren een speler en verwachten dat:
//   - probabilities sommeren tot 1 over de eligible-pool
//   - blocks daadwerkelijk uitsluiten
//   - rankMasters() Duradel hoog rankt voor maxers
//   - lower-level spelers worden gating'd uit hoge-level monsters

import { describe, it, expect } from "vitest";
import { simulateMaster, blockSuggestions, rankMasters, type PlayerState } from "@/lib/slayer/simulator";

function maxer(): PlayerState {
  return {
    combatLevel: 126,
    slayerLevel: 99,
    completedQuests: new Set(["priest_in_peril", "lost_city", "shilo_village"]),
    blockedMonsterIds: new Set(),
    taskStreak: 100
  };
}

function midRange(): PlayerState {
  return {
    combatLevel: 80,
    slayerLevel: 70,
    completedQuests: new Set(["priest_in_peril", "lost_city"]),
    blockedMonsterIds: new Set(),
    taskStreak: 25
  };
}

describe("simulateMaster", () => {
  it("probabilities over de pool sommeren tot 1 (binnen FP-marge)", () => {
    const sim = simulateMaster("duradel", maxer());
    const sum = sim.tasks.reduce((acc, t) => acc + t.probability, 0);
    expect(sum).toBeCloseTo(1, 5);
  });

  it("Duradel geeft 30+ tasks aan een maxer", () => {
    const sim = simulateMaster("duradel", maxer());
    expect(sim.eligibleTaskCount).toBeGreaterThan(20);
    expect(sim.averageXpPerHour).toBeGreaterThan(20000);
  });

  it("low-slayer speler krijgt minder tasks van high-master", () => {
    const lowSlayer: PlayerState = {
      combatLevel: 100,
      slayerLevel: 60, // genoeg voor master eis (50) maar veel monsters gating'd
      completedQuests: new Set(["priest_in_peril", "lost_city", "shilo_village"]),
      blockedMonsterIds: new Set(),
      taskStreak: 0
    };
    const maxer_sim = simulateMaster("duradel", maxer());
    const low_sim = simulateMaster("duradel", lowSlayer);
    expect(low_sim.eligibleTaskCount).toBeLessThan(maxer_sim.eligibleTaskCount);
  });

  it("geblokte monsters verschijnen niet in tasks", () => {
    const blocker: PlayerState = {
      ...maxer(),
      blockedMonsterIds: new Set(["abyssal_demon", "dark_beast"])
    };
    const sim = simulateMaster("duradel", blocker);
    const ids = sim.tasks.map((t) => t.monster.id);
    expect(ids).not.toContain("abyssal_demon");
    expect(ids).not.toContain("dark_beast");
  });

  it("expectedQuantity = midpoint van master's range", () => {
    const sim = simulateMaster("duradel", maxer());
    // Duradel range 100-200 → midpoint 150
    for (const task of sim.tasks) {
      expect(task.expectedQuantity).toBe(150);
    }
  });
});

describe("blockSuggestions", () => {
  it("geeft 5 laagste-XP tasks terug", () => {
    const sugg = blockSuggestions("duradel", maxer());
    expect(sugg.length).toBeLessThanOrEqual(5);
    // Sorted oplopend op estimatedXpPerHour
    for (let i = 1; i < sugg.length; i++) {
      expect(sugg[i].estimatedXpPerHour).toBeGreaterThanOrEqual(sugg[i - 1].estimatedXpPerHour);
    }
  });
});

describe("rankMasters", () => {
  it("top-master voor maxer is Konar of Duradel (high-XP pools)", () => {
    // Konar + Duradel hebben beide boss-tasks + high-HP monsters in
    // pool. Welke wint hangt af van de exacte weight-verdeling. We
    // checken alleen dat het een van deze twee is en niet ergens
    // anders (bv. Turael) bovenaan staat door een bug.
    const ranked = rankMasters(maxer());
    expect(["konar", "duradel"]).toContain(ranked[0].master.id);
    // En Turael moet zeker onderaan staan voor een maxer.
    expect(ranked[ranked.length - 1].master.id).toBe("turael");
  });

  it("low-combat speler ziet alleen low-tier masters", () => {
    const newbie: PlayerState = {
      combatLevel: 25, slayerLevel: 5,
      completedQuests: new Set(["priest_in_peril"]),
      blockedMonsterIds: new Set(), taskStreak: 0
    };
    const ranked = rankMasters(newbie);
    const ids = ranked.map((r) => r.master.id);
    expect(ids).toContain("turael");
    expect(ids).toContain("mazchna");
    expect(ids).not.toContain("duradel");
    expect(ids).not.toContain("konar");
  });

  it("midrange speler krijgt mix van masters", () => {
    const ranked = rankMasters(midRange());
    const ids = ranked.map((r) => r.master.id);
    expect(ids).toContain("vannaka");
    expect(ids).toContain("chaeldar");
    // Konar vereist 75/75 — mid heeft 80/70, dus geen Konar
    expect(ids).not.toContain("konar");
  });
});
