import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "src/components/session-mood-picker.tsx"), "utf8");

describe("session mood picker", () => {
  it("keeps the reusable mood picker player-first and account-aware", () => {
    expect(source).toContain("What do you feel like doing?");
    expect(source).toContain("Your next plan changes for this account.");
    expect(source).toContain("saveMood({ mood, minutes }, rsn || undefined)");
    expect(source).toContain("SESSION_MOODS");
    expect(source).toContain('mood: "chill"');
    expect(source).toContain('mood: "cash"');
    expect(source).toContain('mood: "bossing"');
    expect(source).toContain('mood: "unlock"');
    expect(source).toContain('mood: "afk"');
    expect(source).toContain('mood: "short"');
    expect(source).toContain("mobileTile");
    expect(source).not.toContain("dashboard");
    expect(source).not.toContain("signals");
    expect(source).not.toContain("payload");
  });
});
