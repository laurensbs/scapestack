import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { runNextAudit } from "../scripts/audit-next";
import { NEXT_AUDIT_SCENARIOS } from "../scripts/next-audit-scenarios";
import { evaluateAuditRule, type AuditRuleContext } from "../scripts/next-audit-rules";
import { computeNextUp, type Recommendation } from "@/lib/next-up";

describe("recommendation quality gate", () => {
  it("covers the required account archetypes with passing hard invariants", async () => {
    const report = await runNextAudit(NEXT_AUDIT_SCENARIOS, new Date("2026-07-15T12:00:00.000Z"));

    expect(NEXT_AUDIT_SCENARIOS.map((scenario) => scenario.id)).toEqual(expect.arrayContaining([
      "returning-main",
      "maxed-iron",
      "bank-only-early",
      "early-rsn-main",
      "midgame-iron",
      "midgame-pvm",
      "skiller",
      "one-kc-callisto",
      "active-slayer",
      "hiscores-only-main",
      "rich-bank-main",
      "stale-runelite",
      "chill-selection"
    ]));
    expect(report.generatedAt).toBe("2026-07-15T12:00:00.000Z");
    expect(report.passed).toBe(true);
    expect(report.totals.hardFailures).toBe(0);
    expect(report.totals.scenarios).toBeGreaterThanOrEqual(13);
    expect(report.totals.rules).toBeGreaterThanOrEqual(70);
  });

  it("fails the report when a hard invariant is violated", async () => {
    const base = NEXT_AUDIT_SCENARIOS[0];
    const report = await runNextAudit([{
      ...base,
      id: "deliberate-hard-failure",
      rules: [{
        id: "impossible-headline",
        level: "hard",
        description: "Deliberately impossible recommendation id.",
        type: "headline-matches",
        matcher: { ids: ["does:not:exist"] }
      }]
    }], new Date("2026-07-15T12:00:00.000Z"));

    expect(report.passed).toBe(false);
    expect(report.totals.hardFailures).toBe(1);
    expect(report.scenarios[0].rules[0]).toMatchObject({ passed: false, level: "hard" });
  });

  it("reports an editorial miss without failing the quality gate", async () => {
    const base = NEXT_AUDIT_SCENARIOS[0];
    const report = await runNextAudit([{
      ...base,
      id: "deliberate-editorial-note",
      rules: [{
        id: "optional-route",
        level: "editorial",
        description: "A deliberately absent optional route.",
        type: "visible-any",
        matcher: { ids: ["does:not:exist"] }
      }]
    }], new Date("2026-07-15T12:00:00.000Z"));

    expect(report.passed).toBe(true);
    expect(report.totals.hardFailures).toBe(0);
    expect(report.totals.editorialNotes).toBe(1);
  });

  it("rejects an intense boss headline for Chill", async () => {
    const result = await computeNextUp(NEXT_AUDIT_SCENARIOS[0].input);
    const bossHeadline: Recommendation = {
      id: "boss:chambers-of-xeric",
      kind: "boss",
      title: "Run Chambers of Xeric",
      why: "Synthetic invalid Chill recommendation.",
      decisionReason: "Synthetic test fixture.",
      score: 100
    };
    const context: AuditRuleContext = {
      result,
      headline: bossHeadline,
      visible: [bossHeadline],
      selection: { mood: "chill", minutes: 60, routeLens: "smart" }
    };
    const outcome = evaluateAuditRule({
      id: "chill-safe",
      level: "hard",
      description: "Chill cannot produce a boss or KC headline.",
      type: "mood-headline-safe"
    }, context);

    expect(outcome.passed).toBe(false);
    expect(outcome.actual).toContain("Chambers of Xeric");
  });

  it("rejects a 1 KC scout as the primary recommendation", async () => {
    const result = await computeNextUp(NEXT_AUDIT_SCENARIOS[0].input);
    const scoutHeadline: Recommendation = {
      id: "kc:Callisto:first-50",
      kind: "kc",
      title: "Push Callisto to 50 KC",
      why: "1 KC is only a scout read.",
      decisionReason: "This is only 1 KC, so it stays a scout read.",
      score: 100,
      kcMeta: { kc: 1, denom: 50, dropName: "first 50 KC" }
    };
    const outcome = evaluateAuditRule({
      id: "no-scout-headline",
      level: "hard",
      description: "A 1-4 KC scout cannot become the primary recommendation.",
      type: "headline-is-not-scout-kc"
    }, {
      result,
      headline: scoutHeadline,
      visible: [scoutHeadline]
    });

    expect(outcome.passed).toBe(false);
  });

  it("keeps the hard audit in ci:check and ignores generated reports", () => {
    const packageJson = JSON.parse(readFileSync(join(process.cwd(), "package.json"), "utf8")) as {
      scripts: Record<string, string>;
    };
    const gitignore = readFileSync(join(process.cwd(), ".gitignore"), "utf8");

    expect(packageJson.scripts["ci:check"]).toContain("npm run audit:next");
    expect(packageJson.scripts["audit:next"]).toContain("scripts/audit-next.ts");
    expect(gitignore).toContain(".artifacts/");
  });
});
