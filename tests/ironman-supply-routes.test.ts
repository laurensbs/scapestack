import { describe, expect, it } from "vitest";
import type { CompletionItem } from "@/lib/goals";
import type { HiscoreSkill } from "@/lib/hiscores";
import {
  buildSkillRoute,
  ROUTABLE_SKILLS,
  skillRouteNeeds,
  skillRoutePlanSeed
} from "@/lib/skill-routes";
import { XP_TABLE } from "@/lib/skill-methods/types";
import { computeNextUp } from "@/lib/next-up";

function skill(name: string, level: number, xp = XP_TABLE[level]): HiscoreSkill {
  return { id: 1, name, rank: 1, level, xp };
}

function accountSkills(overrides: Record<string, number> = {}): HiscoreSkill[] {
  return ROUTABLE_SKILLS.map((name) => skill(name, overrides[name] ?? 70));
}

function route(input: {
  name?: string;
  level?: number;
  target?: number;
  bank?: CompletionItem[];
  accountType?: "regular" | "ironman" | "hardcore" | "ultimate";
  skills?: HiscoreSkill[];
  minutes?: number;
}) {
  const name = input.name ?? "Cooking";
  const level = input.level ?? 80;
  return buildSkillRoute({
    skill: skill(name, level),
    targetLevel: input.target ?? Math.min(99, level + 1),
    bank: input.bank,
    accountType: input.accountType ?? "ironman",
    skills: input.skills ?? accountSkills({ [name]: level }),
    sessionMinutes: input.minutes ?? 45
  })!;
}

describe("ironman supply routes", () => {
  it("keeps normal accounts on buyable prep instead of an iron source chain", () => {
    const result = route({ accountType: "regular", bank: [] });

    expect(result.supplyRoute).toBeNull();
    expect(skillRouteNeeds(result).join(" ")).toMatch(/Buy raw food/i);
  });

  it("builds a source -> process -> stop route with a conservative rate range", () => {
    const result = route({ bank: [] });
    const source = result.supplyRoute!;

    expect(source.id).toBe("cook-karambwan");
    expect(source.rateLow).toBeGreaterThan(0);
    expect(source.rateHigh).toBeGreaterThan(source.rateLow);
    expect(source.amountTargetHigh).toBeGreaterThanOrEqual(source.amountTargetLow);
    expect(source.steps.map((step) => step.kind)).toEqual(["source", "process", "stop"]);
    expect(source.steps[0]?.text).toMatch(/450-650 per hour/);
    expect(skillRoutePlanSeed(result).steps).toEqual(source.steps.map((step) => step.text));
  });

  it("uses a viable lower-tier bank alternative instead of unnecessary sourcing", () => {
    const result = route({
      bank: [{ id: 377, name: "Raw lobster", quantity: 2_000 }]
    });

    expect(result.bankedXpEstimate.coveredXpLow).toBeGreaterThanOrEqual(result.shortSession.xp);
    expect(result.supplyRoute).toBeNull();
    expect(skillRouteNeeds(result).join(" ")).toContain("raw lobster");
    expect(skillRoutePlanSeed(result).steps.join(" ")).not.toMatch(/fish|source/i);
  });

  it("uses banked food first and sources only the remaining session gap", () => {
    const result = route({
      bank: [{ id: 383, name: "Raw shark", quantity: 100 }]
    });
    const source = result.supplyRoute!;

    expect(source.bankedAlternative).toMatchObject({ name: "raw shark", quantity: 100 });
    expect(source.bankedXpLow).toBeGreaterThan(0);
    expect(source.amountNeededHigh).toBeLessThan(2_000);
    expect(source.reason).toMatch(/Use 100 banked raw shark first/i);
  });

  it("shrinks an oversized source grind to one bounded block", () => {
    const result = route({ target: 99, bank: [], minutes: 120 });
    const source = result.supplyRoute!;

    expect(source.smallerTarget).toBe(true);
    expect(source.amountTargetHigh).toBeLessThan(source.amountNeededHigh);
    expect(source.estimatedMinutesHigh).toBeLessThanOrEqual(60);
    expect(source.stopPoint).toMatch(/source another block later/i);
  });

  it("matches Herblore secondaries to the unfinished potion chain in the bank", () => {
    const result = route({
      name: "Herblore",
      level: 70,
      target: 71,
      bank: [{ id: 99, name: "Ranarr potion (unf)", quantity: 120 }]
    });

    expect(result.supplyRoute).toMatchObject({
      id: "herblore-snape-grass",
      material: "snape grass"
    });
    expect(skillRoutePlanSeed(result).steps.join(" ")).toMatch(/collect or grow snape grass.*finish the ranarr potions/i);
  });

  it("converts owned logs before telling an ironman to cut another stack", () => {
    const result = route({
      name: "Construction",
      level: 70,
      target: 71,
      bank: [
        { id: 6333, name: "Teak logs", quantity: 500 },
        { id: 995, name: "Coins", quantity: 500_000 }
      ]
    });

    expect(result.supplyRoute?.id).toBe("construction-convert-teak");
    expect(result.supplyRoute?.amountTargetHigh).toBeLessThanOrEqual(500);
    expect(result.supplyRoute?.steps[0]?.text).toMatch(/convert your teak logs at a sawmill/i);
  });

  it("uses carry/stage wording for UIM routes", () => {
    const result = route({ accountType: "ultimate", bank: [] });

    expect(result.supplyRoute?.steps[0]?.text).toMatch(/^Carry or stage/);
    expect(result.supplyRoute?.steps.join(" ")).not.toMatch(/bank the stack/i);
  });

  it("does not invent a shortage when bank context is unknown", () => {
    const result = route({ bank: undefined });

    expect(result.bankedXpEstimate.status).toBe("unknown");
    expect(result.supplyRoute).toBeNull();
    expect(skillRouteNeeds(result).join(" ")).toMatch(/Source raw food/i);
    expect(skillRouteNeeds(result).join(" ")).not.toMatch(/karambwan|450-650/);
  });

  it("keeps source, process and stop visible after /next enrichment", async () => {
    const skills = accountSkills({ Cooking: 98, Fishing: 70 });
    const cooking = skills.find((entry) => entry.name === "Cooking")!;
    cooking.xp = 12_500_000;
    const result = await computeNextUp({
      skills,
      bank: [{ id: 995, name: "Coins", quantity: 500_000 }],
      accountMeta: {
        displayName: "Iron Route",
        accountType: "ironman",
        ehp: 0,
        ehb: 0,
        lastChangedAt: null
      }
    });
    const recommendation = [result.headline, ...result.rest]
      .find((entry) => entry?.id === "milestone:maxing-lane:Cooking");

    expect(recommendation?.actionPlan?.steps).toHaveLength(3);
    expect(recommendation?.routeChain?.steps.map((step) => step.label)).toEqual([
      "Source",
      "Process",
      "Stop",
      "Next login"
    ]);
    expect(recommendation?.routeChain?.steps[0]?.text).toMatch(/450-650 per hour/);
    expect(recommendation?.routeChain?.steps[1]?.text).toMatch(/cook/i);
  });
});
