import { describe, expect, it } from "vitest";
import {
  buildCalculableSkillRoute,
  completeCalculableRouteStep,
  resolveCalculableRouteProgress,
  selectCalculableRouteStep
} from "../src/lib/calculable-route";
import { buildSkillRoute } from "../src/lib/skill-routes";
import { XP_TABLE } from "../src/lib/skill-methods/types";

function skill(name: string, level: number) {
  return { id: 1, name, level, xp: XP_TABLE[level], rank: 1 };
}

describe("calculable skill routes", () => {
  it("builds an iron Cooking path as source, cook, stop when the bank is short", () => {
    const skillRoute = buildSkillRoute({
      skill: skill("Cooking", 80),
      targetLevel: 81,
      accountType: "ironman",
      bank: [
        { id: 3157, name: "Karambwan vessel", quantity: 1 },
        { id: 3150, name: "Raw karambwanji", quantity: 2_000 }
      ],
      skills: [skill("Cooking", 80), skill("Fishing", 70)],
      sessionMinutes: 45
    })!;
    const route = buildCalculableSkillRoute(skillRoute)!;

    expect(route.steps.map((step) => step.kind)).toEqual(["source", "process", "stop"]);
    expect(route.steps[0].title).toMatch(/Source .* raw karambwan/);
    expect(route.steps[1].title).toMatch(/Cook/i);
    expect(route.estimatedSessions).toBeGreaterThan(0);
    expect(route.supplyDecision).toBe("source-yourself");
  });

  it("removes the source dependency when banked raw food covers the session", () => {
    const skillRoute = buildSkillRoute({
      skill: skill("Cooking", 80),
      targetLevel: 81,
      accountType: "ironman",
      bank: [{ id: 383, name: "Raw shark", quantity: 2_000 }],
      skills: [skill("Cooking", 80), skill("Fishing", 80)],
      sessionMinutes: 45
    })!;
    const route = buildCalculableSkillRoute(skillRoute)!;

    expect(route.steps.map((step) => step.kind)).toEqual(["process", "stop"]);
    expect(route.supplyDecision).toBe("owned");
    expect(route.bankCoveredXp).toBe(route.sessionXp);
  });

  it("gives a main one buy block instead of pricing the whole 99 grind", () => {
    const skillRoute = buildSkillRoute({
      skill: skill("Cooking", 80),
      targetLevel: 99,
      accountType: "regular",
      bank: [],
      sessionMinutes: 45
    })!;
    const route = buildCalculableSkillRoute(skillRoute)!;

    expect(route.steps.map((step) => step.kind)).toEqual(["buy", "process", "stop"]);
    expect(route.supplyDecision).toBe("one-session-only");
    expect(route.steps[0].detail).toContain("Buy one session only");
  });

  it("does not let a later step bypass its hard dependency", () => {
    const skillRoute = buildSkillRoute({
      skill: skill("Cooking", 80),
      targetLevel: 81,
      accountType: "regular",
      bank: [],
      sessionMinutes: 45
    })!;
    const route = buildCalculableSkillRoute(skillRoute)!;
    const process = route.steps.find((step) => step.kind === "process")!;
    const progress = { completedStepIds: [], activeStepId: route.steps[0].id };

    const blocked = selectCalculableRouteStep(route, progress, process.id);
    expect(blocked.accepted).toBe(false);
    expect(blocked.blockerId).toBe(route.steps[0].id);

    const afterBuy = completeCalculableRouteStep(route, progress, route.steps[0].id);
    const resolved = resolveCalculableRouteProgress(route, afterBuy);
    expect(resolved.steps.find((step) => step.id === process.id)?.state).toBe("active");
  });

  it("recalculates the missing block from a fresh bank", () => {
    const empty = buildCalculableSkillRoute(buildSkillRoute({
      skill: skill("Cooking", 80),
      targetLevel: 81,
      accountType: "regular",
      bank: [],
      sessionMinutes: 45
    })!)!;
    const refreshed = buildCalculableSkillRoute(buildSkillRoute({
      skill: skill("Cooking", 80),
      targetLevel: 81,
      accountType: "regular",
      bank: [{ id: 383, name: "Raw shark", quantity: 2_000 }],
      sessionMinutes: 45
    })!)!;

    expect(empty.steps[0].kind).toBe("buy");
    expect(refreshed.steps[0].kind).toBe("process");
    expect(refreshed.remainingSessionXp).toBe(0);
  });

  it("keeps supply ownership unknown when no bank was loaded", () => {
    const route = buildCalculableSkillRoute(buildSkillRoute({
      skill: skill("Cooking", 80),
      targetLevel: 81,
      accountType: "regular",
      sessionMinutes: 45
    })!)!;

    expect(route.supplyDecision).toBe("unknown");
    expect(route.steps.map((step) => step.kind)).toEqual(["process", "stop"]);
    expect(route.bankSummary).toContain("not known");
  });
});
