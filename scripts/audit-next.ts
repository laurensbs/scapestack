import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { pickForRoute } from "../src/lib/mood";
import { computeNextUp, type Recommendation } from "../src/lib/next-up";
import { NEXT_AUDIT_SCENARIOS, type NextAuditScenario } from "./next-audit-scenarios";
import { evaluateAuditRule, type AuditRuleResult } from "./next-audit-rules";

export interface NextAuditScenarioResult {
  id: string;
  label: string;
  description: string;
  headline: { id: string; kind: string; title: string } | null;
  visible: Array<{ id: string; kind: string; title: string }>;
  basis: string;
  rules: AuditRuleResult[];
  hardFailures: number;
  editorialNotes: number;
}

export interface NextAuditReport {
  schemaVersion: 1;
  generatedAt: string;
  passed: boolean;
  scenarios: NextAuditScenarioResult[];
  totals: {
    scenarios: number;
    rules: number;
    hardFailures: number;
    editorialNotes: number;
  };
}

function compactRecommendation(rec: Recommendation): { id: string; kind: string; title: string } {
  return { id: rec.id, kind: rec.kind, title: rec.title };
}

export async function runNextAudit(
  scenarios: NextAuditScenario[] = NEXT_AUDIT_SCENARIOS,
  now = new Date()
): Promise<NextAuditReport> {
  const scenarioResults: NextAuditScenarioResult[] = [];

  for (const scenario of scenarios) {
    const result = await computeNextUp(scenario.input);
    let headline = result.headline;
    let visible = [result.headline, ...result.rest.slice(0, 7)].filter((rec): rec is Recommendation => rec !== null);

    if (scenario.selection) {
      const picked = pickForRoute(
        visible,
        scenario.selection.mood,
        scenario.selection.minutes,
        scenario.selection.routeLens ?? "smart"
      );
      headline = picked?.headline ?? null;
      visible = picked ? [picked.headline, ...picked.alternatives] : [];
    }

    const rules = scenario.rules.map((auditRule) => evaluateAuditRule(auditRule, {
      result,
      headline,
      visible,
      selection: scenario.selection
    }));
    const hardFailures = rules.filter((rule) => rule.level === "hard" && !rule.passed).length;
    const editorialNotes = rules.filter((rule) => rule.level === "editorial" && !rule.passed).length;

    scenarioResults.push({
      id: scenario.id,
      label: scenario.label,
      description: scenario.description,
      headline: headline ? compactRecommendation(headline) : null,
      visible: visible.map(compactRecommendation),
      basis: result.summary.basis,
      rules,
      hardFailures,
      editorialNotes
    });
  }

  const hardFailures = scenarioResults.reduce((sum, scenario) => sum + scenario.hardFailures, 0);
  const editorialNotes = scenarioResults.reduce((sum, scenario) => sum + scenario.editorialNotes, 0);
  return {
    schemaVersion: 1,
    generatedAt: now.toISOString(),
    passed: hardFailures === 0,
    scenarios: scenarioResults,
    totals: {
      scenarios: scenarioResults.length,
      rules: scenarioResults.reduce((sum, scenario) => sum + scenario.rules.length, 0),
      hardFailures,
      editorialNotes
    }
  };
}

function outputPathFromArgs(args: string[]): string {
  const outputArg = args.find((arg) => arg.startsWith("--output="));
  return resolve(process.cwd(), outputArg?.slice("--output=".length) || ".artifacts/next-audit.json");
}

function printReport(report: NextAuditReport, outputPath: string): void {
  console.log("\nScapestack recommendation quality gate\n");
  for (const scenario of report.scenarios) {
    const marker = scenario.hardFailures > 0 ? "FAIL" : scenario.editorialNotes > 0 ? "NOTE" : "PASS";
    console.log(`${marker}  ${scenario.label}`);
    console.log(`      headline: ${scenario.headline ? `[${scenario.headline.kind}] ${scenario.headline.title}` : "none"}`);
    for (const auditRule of scenario.rules) {
      const ruleMarker = auditRule.passed ? "ok" : auditRule.level === "hard" ? "ERROR" : "note";
      console.log(`      ${ruleMarker.padEnd(5)} ${auditRule.description}`);
      if (!auditRule.passed) console.log(`            actual: ${auditRule.actual}`);
    }
    console.log("");
  }
  console.log(`Scenarios: ${report.totals.scenarios}`);
  console.log(`Rules: ${report.totals.rules}`);
  console.log(`Hard failures: ${report.totals.hardFailures}`);
  console.log(`Editorial notes: ${report.totals.editorialNotes}`);
  console.log(`JSON: ${outputPath}\n`);
}

async function main(): Promise<void> {
  const outputPath = outputPathFromArgs(process.argv.slice(2));
  const report = await runNextAudit();
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  printReport(report, outputPath);
  if (!report.passed) process.exitCode = 1;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
