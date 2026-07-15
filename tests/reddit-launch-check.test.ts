import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const launchDoc = readFileSync(join(process.cwd(), "docs/REDDIT-LAUNCH-CHECK-2026-07-15.md"), "utf8");

function sectionBetween(start: string, end: string) {
  const startIndex = launchDoc.indexOf(start);
  const endIndex = launchDoc.indexOf(end);
  expect(startIndex).toBeGreaterThanOrEqual(0);
  expect(endIndex).toBeGreaterThan(startIndex);
  return launchDoc.slice(startIndex, endIndex);
}

describe("Reddit launch check", () => {
  it("defines a Reddit-native launch packet around anti-bankstanding", () => {
    expect(launchDoc).toContain("First Screenshot");
    expect(launchDoc).toContain("I built a RuneLite-powered tool that tells you what to do next so you stop bankstanding");
    expect(launchDoc).toContain("I kept logging in, opening the bank, checking a few tabs, then doing nothing.");
    expect(launchDoc).toContain("what trip should I actually do?");
    expect(launchDoc).toContain("Expected Objections");
    expect(launchDoc).toContain("Privacy Answer");
    expect(launchDoc).toContain("Why RuneLite Is Optional");
    expect(launchDoc).toContain("Why Bank Stays Local");
  });

  it("keeps the public Reddit body short and out of dashboard language", () => {
    const body = sectionBetween("## Reddit Post Body", "## Expected Objections");

    expect(body).toContain("type your RSN");
    expect(body).toContain("one thing to do first");
    expect(body).toContain("bank helps with gear, supplies and boss checks");
    expect(body).toContain("RuneLite helps avoid quests, diaries, clog slots and Slayer mistakes");
    expect(body).not.toContain("payload");
    expect(body).not.toContain("readiness");
    expect(body).not.toContain("data source");
    expect(body).not.toContain("exact account state");
    expect(body).not.toContain("Plugin Hub");
    expect(body).not.toContain("PR");
    expect(body).not.toContain("dashboard");
  });

  it("keeps support asks out of the main tool header", () => {
    const toolHeader = readFileSync(join(process.cwd(), "src/components/tool-header.tsx"), "utf8");

    expect(toolHeader).not.toContain("SupportPill");
    expect(toolHeader).not.toContain("persistent Support pill");
    expect(toolHeader).toContain("actions ? <div");
  });

  it("keeps mobile viewport explicit for launch screenshots", () => {
    const layout = readFileSync(join(process.cwd(), "src/app/layout.tsx"), "utf8");

    expect(layout).toContain('width: "device-width"');
    expect(layout).toContain("initialScale: 1");
  });
});
