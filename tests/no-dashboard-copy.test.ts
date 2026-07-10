import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const playerFacingFiles = [
  "src/app/bank/page.tsx",
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
    expect(source).toContain("Make the next trip smarter");
    expect(source).toContain("Paste check");
    expect(source).toContain("Pick one boss trip");
    expect(source).toContain("Choose one boss. Scapestack shows the setup to check, what is missing, and when to leave.");
    expect(source).toContain("Build one RuneLite tab from owned gear, supplies and the boss you want to try.");
    expect(source).toContain("Need a weapon first");
    expect(source).toContain("Check RuneLite");
    expect(source).toContain("RuneLite can help later");
    expect(source).toContain("Bank added");
    expect(source).toContain("Slayer checks found");
  });
});
