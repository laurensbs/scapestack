import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("RSN profile handoffs", () => {
  it("consolidates the old profile into the canonical player hub", () => {
    const legacy = readFileSync(join(process.cwd(), "src/app/u/[rsn]/page.tsx"), "utf8");
    const page = readFileSync(join(process.cwd(), "src/app/p/[rsn]/page.tsx"), "utf8");
    const skills = readFileSync(join(process.cwd(), "src/components/player-skills-table.tsx"), "utf8");
    const answer = readFileSync(join(process.cwd(), "src/components/player-plan-answer.tsx"), "utf8");

    // /u/[rsn] carries the account detail; /p/[rsn] carries the answer and
    // nothing else. The split happened 2026-08-08 when /p went on a
    // three-section budget (tests/e2e/page-budget.spec.ts).
    expect(legacy).not.toContain("redirect(");
    expect(legacy).toContain("<PlayerToolsSections");
    expect(legacy).toContain("<PlayerSkillsTable");
    expect(legacy).toContain("<PlayerIdentityBand");
    expect(page).toContain("loadPlanningContext(decoded");
    expect(page).toContain("viewerRsn");
    expect(page).toContain('pluginVerifyUrlForSyncedRsn(displayName, "profile"');
    expect(page).toContain("<PlayerPlanPanel");
    expect(page).not.toContain("<PlayerToolsSections");
    expect(page).not.toContain("<PlayerSkillsTable");
    expect(page).not.toContain("<AccountTimeline");
    expect(answer).toContain('data-next-trip-card="true"');
    expect(answer).toContain("Not this?");
    expect(skills).toContain('data-account-home-board="true"');
    expect(skills).toContain('<table className="scape-table"');
    expect(skills).toContain('<th scope="col" data-num>Level</th>');
    expect(skills).toContain('<th scope="col" data-num>XP</th>');
    expect(skills).toContain('<th scope="col" data-num>Rank</th>');
  });

  it("uses the connected account timeline and hides it when history is empty", () => {
    const source = readFileSync(join(process.cwd(), "src/components/account-timeline.tsx"), "utf8");

    expect(source).toContain('"use client"');
    expect(source).toContain("/api/account/timeline");
    expect(source).toContain('data-account-timeline="true"');
    expect(source).toContain("Since last time");
    expect(source).toContain("if (visible.length === 0) return null");
    expect(source).not.toContain("dashboard");
    expect(source).not.toMatch(/>\s*Analytics\s*</i);
  });

  it("mounts the shared readiness rail on player profiles with local bank detection", () => {
    const railSource = readFileSync(join(process.cwd(), "src/app/u/[rsn]/profile-readiness-rail.tsx"), "utf8");
    const readinessSource = readFileSync(join(process.cwd(), "src/lib/scapestack-readiness.ts"), "utf8");

    expect(railSource).toContain('"use client"');
    expect(railSource).toContain('import { ScapestackReadinessRail } from "@/components/scapestack-readiness-rail";');
    expect(railSource).toContain('import { latestSnapshot } from "@/lib/snapshot-history";');
    expect(railSource).toContain("latestSnapshot(rsn)");
    expect(railSource).toContain("setHasLocalBank(Boolean(snapshot && snapshot.items.length > 0))");
    expect(railSource).toContain('surface="profile"');
    expect(railSource).toContain("hasBankContext={hasLocalBank}");
    expect(railSource).toContain("hasRsn");
    expect(readinessSource).toContain('export type ScapestackSurface = "bank" | "next" | "dps" | "goals" | "profile" | "slayer";');
    expect(readinessSource).toContain('profile: "profile"');
  });
});
