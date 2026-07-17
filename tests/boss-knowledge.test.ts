import { describe, expect, it } from "vitest";
import { BOSSES } from "@/lib/bosses";
import {
  bossKnowledge,
  bossKnowledgeAllowsGpRate,
  bossKnowledgeRankingAdjustment,
  bossKnowledgeSupportsSingleDps
} from "@/lib/boss-knowledge";

describe("boss knowledge catalog", () => {
  it("gives every visible encounter explicit, complete knowledge", () => {
    expect(BOSSES).toHaveLength(60);
    expect(new Set(BOSSES.map((boss) => boss.slug)).size).toBe(BOSSES.length);

    for (const boss of BOSSES) {
      const entry = bossKnowledge(boss);
      expect(entry.bossSlug, boss.slug).toBe(boss.slug);
      expect(["full", "guided", "estimate"], boss.slug).toContain(entry.support);
      expect(entry.groupSize.length, boss.slug).toBeGreaterThan(0);
      expect(entry.setupBands.minimum.length, boss.slug).toBeGreaterThan(0);
      expect(entry.setupBands.comfortable.length, boss.slug).toBeGreaterThan(0);
      expect(entry.setupBands.strong.length, boss.slug).toBeGreaterThan(0);
      expect(entry.inventoryArchetype.length, boss.slug).toBeGreaterThan(0);
      expect(entry.stopPoint.length, boss.slug).toBeGreaterThan(0);
      expect(entry.gpData.note.length, boss.slug).toBeGreaterThan(0);
      expect(entry.playerLine.length, boss.slug).toBeGreaterThan(0);
      if (entry.dpsModel !== "not-applicable") {
        expect(entry.combatStyles.length, boss.slug).toBeGreaterThan(0);
      }
    }
  });

  it("keeps raids and role-based encounters out of single-DPS and GP-rate claims", () => {
    for (const slug of ["cox", "tob", "toa"]) {
      const boss = BOSSES.find((candidate) => candidate.slug === slug)!;
      const entry = bossKnowledge(boss);
      expect(entry.support).toBe("estimate");
      expect(entry.encounterType).toBe("raid");
      expect(entry.dpsModel).toBe("room-by-room");
      expect(entry.combatStyles.length).toBeGreaterThanOrEqual(3);
      expect(bossKnowledgeSupportsSingleDps(entry)).toBe(false);
      expect(bossKnowledgeAllowsGpRate(entry)).toBe(false);
    }

    for (const slug of ["graardor", "kree", "zilyana", "kril", "nex", "corp", "hueycoatl"]) {
      const boss = BOSSES.find((candidate) => candidate.slug === slug)!;
      expect(bossKnowledgeSupportsSingleDps(bossKnowledge(boss)), slug).toBe(false);
    }
  });

  it("makes Wilderness risk materially lower-ranked than a supported solo trip", () => {
    const vorkath = bossKnowledge(BOSSES.find((boss) => boss.slug === "vorkath")!);
    const callisto = bossKnowledge(BOSSES.find((boss) => boss.slug === "callisto")!);

    expect(callisto.wildernessRisk).toBe(true);
    expect(callisto.deathRisk).toBe("extreme");
    expect(callisto.gpData.state).toBe("volatile");
    expect(bossKnowledgeRankingAdjustment(callisto)).toBeLessThan(bossKnowledgeRankingAdjustment(vorkath));
  });

  it("treats activities and full-run encounters as prep rather than combat calculators", () => {
    for (const slug of ["wintertodt", "tempoross", "guardians-of-the-rift", "zalcano"]) {
      const entry = bossKnowledge(BOSSES.find((boss) => boss.slug === slug)!);
      expect(entry.encounterType).toBe("activity");
      expect(entry.dpsModel).toBe("not-applicable");
      expect(entry.gpData.state).toBe("not-applicable");
    }

    for (const slug of ["tztok-jad", "tzkal-zuk", "fortis-colosseum"]) {
      const entry = bossKnowledge(BOSSES.find((boss) => boss.slug === slug)!);
      expect(entry.encounterType).toBe("wave");
      expect(entry.supplyPressure).toBe("full-run");
      expect(bossKnowledgeSupportsSingleDps(entry)).toBe(false);
    }
  });
});
