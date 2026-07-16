import { describe, expect, it } from "vitest";
import type { HiscoreSkill } from "@/lib/hiscores";
import {
  buildSkillRoute,
  ROUTABLE_SKILLS,
  skillMethods,
  skillRouteNeeds,
  skillRoutePlanSeed
} from "@/lib/skill-routes";
import { XP_TABLE } from "@/lib/skill-methods/types";

function skill(name: string, level: number, xp = XP_TABLE[level]): HiscoreSkill {
  return { id: 1, name, rank: 1, level, xp };
}

describe("shared skill routes", () => {
  it("gives every OSRS skill a valid fallback without generic trip baggage", () => {
    expect(ROUTABLE_SKILLS).toHaveLength(24);
    for (const name of ROUTABLE_SKILLS) {
      const methods = skillMethods(name);
      expect(methods.length, name).toBeGreaterThan(0);
      expect(methods[0]?.skill).toBe(name);
      expect(methods[0]?.xpPerHour, name).toBeGreaterThan(0);

      const route = buildSkillRoute({ skill: skill(name, 50), targetLevel: 60 });
      expect(route?.recommended, name).toBeTruthy();
      expect(route?.xpRemaining, name).toBeGreaterThan(0);
      const plan = skillRoutePlanSeed(route!);
      expect(plan.steps.join(" ")).not.toMatch(/check teleports|bring food|quest items|combat gear/i);
    }
  });

  it("uses exact current XP for low, mid and near-99 routes", () => {
    const low = buildSkillRoute({ skill: skill("Agility", 1, 0), targetLevel: 10 })!;
    const mid = buildSkillRoute({ skill: skill("Mining", 50), targetLevel: 60 })!;
    const near99 = buildSkillRoute({ skill: skill("Cooking", 98, XP_TABLE[99] - 1_000), targetLevel: 99 })!;

    expect(low.xpRemaining).toBe(XP_TABLE[10]);
    expect(mid.xpRemaining).toBe(XP_TABLE[60] - XP_TABLE[50]);
    expect(near99.xpRemaining).toBe(1_000);
    expect(near99.shortSession.label).toBe("Reach Cooking 99");
  });

  it("returns a complete route with no grind for a maxed skill", () => {
    const route = buildSkillRoute({ skill: skill("Woodcutting", 99), targetLevel: 99 })!;

    expect(route.maxed).toBe(true);
    expect(route.xpRemaining).toBe(0);
    expect(route.shortSession.xp).toBe(0);
  });

  it("distinguishes banked, buyable, source-yourself and unknown requirements", () => {
    const banked = buildSkillRoute({
      skill: skill("Cooking", 80),
      targetLevel: 81,
      bank: [{ id: 383, name: "Raw shark", quantity: 250 }],
      accountType: "regular"
    })!;
    const buyable = buildSkillRoute({ skill: skill("Cooking", 80), targetLevel: 81, accountType: "regular" })!;
    const iron = buildSkillRoute({ skill: skill("Cooking", 80), targetLevel: 81, accountType: "ironman" })!;
    const unknown = buildSkillRoute({ skill: skill("Slayer", 70), targetLevel: 71, accountType: "regular" })!;

    expect(banked.recommended?.supplies[0]).toMatchObject({ state: "banked", bankedQuantity: 250 });
    expect(banked.recommended?.bankedXp).toBeNull();
    expect(skillRouteNeeds(banked)).toContain("Raw food in bank");
    expect(buyable.recommended?.supplies[0]?.state).toBe("buyable");
    expect(iron.recommended?.supplies[0]?.state).toBe("source-yourself");
    expect(unknown.recommended?.supplies[0]?.state).toBe("unknown");
  });

  it("never returns negative quantities, XP, time or GP", () => {
    for (const name of ROUTABLE_SKILLS) {
      const route = buildSkillRoute({ skill: skill(name, 98, XP_TABLE[99] + 50_000), targetLevel: 99 })!;
      expect(route.xpRemaining, name).toBeGreaterThanOrEqual(0);
      expect(route.shortSession.xp, name).toBeGreaterThanOrEqual(0);
      for (const method of route.methods) {
        expect(method.hours, name).toBeGreaterThanOrEqual(0);
        expect(method.quantityRequired ?? 0, name).toBeGreaterThanOrEqual(0);
        expect(method.bankedQuantity ?? 0, name).toBeGreaterThanOrEqual(0);
        expect(method.bankedXp ?? 0, name).toBeGreaterThanOrEqual(0);
      }
    }
  });
});
