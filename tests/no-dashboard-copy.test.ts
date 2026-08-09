import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const playerFacingFiles = [
  "src/app/bank/page.tsx",
  "src/app/bank/bank-intake-only.tsx",
  "src/components/bank-result.tsx",
  "src/app/dps/dps-client.tsx",
  "src/app/goals/goals-client.tsx",
  "src/app/slayer/slayer-client.tsx",
  "src/lib/scapestack-readiness.ts",
  "src/lib/bank-action-loop.ts",
  "src/lib/bank-plugin-intake-bridge.ts",
  "src/lib/recommendation-action.ts",
  "src/lib/recommendation-data-action.ts",
  "src/lib/plugin-onboarding.ts",
  "src/components/bank-plugin-onboarding.tsx",
  "src/components/plugin-sync-checker.tsx"
];

const source = playerFacingFiles.map((file) => readFileSync(join(process.cwd(), file), "utf8")).join("\n");
const bankPageSource = readFileSync(join(process.cwd(), "src/app/bank/bank-intake-only.tsx"), "utf8");

describe("player-facing copy avoids dashboard language", () => {
  it("keeps bank, DPS, Slayer and RuneLite surfaces in player language", () => {
    const banned = [
      "Planning context",
      "Data receipt",
      "Setup details",
      "Bank handoff loaded",
      "Bank parsed for DPS",
      "Bank parsed for goals",
      "exact bank context",
      "Boss setup locked",
      "Paste a combat bank before trusting boss rows",
      "Boss rows are blocked",
      "No bank source attached",
      "Plan context",
      "Add RSN context",
      "Open synced /next",
      "Refresh sync",
      "Check sync",
      "Sync checker available",
      "Safe path today",
      "Progress Scapestack Sync can add",
      "verified account coverage",
      "data source",
      "exact account state",
      "Slayer signals found"
    ];

    for (const phrase of banned) {
      expect(source, phrase).not.toContain(phrase);
    }
  });

  it("keeps the replacement copy concrete and OSRS-native", () => {
    expect(source).toContain("Add bank once");
    // Each entry point now states the question it answers instead of the one
    // heading all three used to share. "Bank setup / Add bank once / The
    // answer opens on that player page" was rendered byte-identically by
    // "Setup", "Boss" and "Task" — three labels, one form, no bosses on the
    // page about bosses.
    expect(bankPageSource).toContain("Can I kill this?");
    expect(bankPageSource).toContain("Is this task worth it?");
    expect(bankPageSource).toContain("What can this bank finish?");
    expect(bankPageSource).not.toContain("ScapestackReadinessRail");
    expect(source).toContain("Paste check");
    expect(source).toContain("Pick a boss");
    expect(source).toContain("Search any boss. Click a row for gear, supplies, upgrades and a first trip.");
    expect(source).toContain("Build one RuneLite tab from owned gear, supplies and the boss you want to try.");
    expect(source).toContain("Need a weapon first");
    expect(source).toContain("Check RuneLite");
    expect(source).toContain("RuneLite can help later");
    expect(source).toContain("Bank added");
    expect(source).toContain("Items found for this task");
  });
});
