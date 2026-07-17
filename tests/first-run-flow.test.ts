import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const hero = readFileSync(join(process.cwd(), "src/components/hero-intake.tsx"), "utf8");
const next = readFileSync(join(process.cwd(), "src/app/next/next-client.tsx"), "utf8");
const loader = readFileSync(join(process.cwd(), "src/components/shuffle-loader.tsx"), "utf8");

describe("first-run value flow", () => {
  it("saves a fresh RSN and opens a plan without blocking setup", () => {
    expect(hero).toContain("saveSavedRsn(trimmed)");
    expect(hero).toContain("markAccountFirstSetupSeen(trimmed)");
    expect(hero).toContain('params.set("first", "1")');
    expect(hero).toContain("openPlan({ firstRun });");
    expect(hero).not.toContain("setShowFirstSetup(true)");
    expect(hero).not.toContain('aria-labelledby="hero-first-setup-title"');
  });

  it("uses Best now immediately and keeps route choice optional", () => {
    expect(next).toMatch(/const submitRsn[\s\S]*?runWithRoute\(\);/);
    expect(next).toContain("Choose a session instead");
    expect(next).not.toContain("Pick today&apos;s trip");
  });

  it("keeps invalid and slow lookups understandable", () => {
    expect(next).toContain('setView("not-found")');
    expect(next).toContain("We couldn&apos;t find");
    expect(loader).toContain('role="status"');
    expect(loader).toContain('aria-busy="true"');
    expect(loader).toContain("Building your next trip…");
  });

  it("offers optional setup only after the first plan and only once per tab", () => {
    expect(next).toContain("<FirstPlanSharpening");
    expect(next).toContain("Your first plan is ready.");
    expect(next).toContain("Sharpen next plan");
    expect(next).toContain('sessionStorage.setItem(key, "1")');
    expect(next).toContain("Keep this plan");
    expect(next).toContain("<AddBankModal");
    expect(next).toContain("Add RuneLite");
  });
});
