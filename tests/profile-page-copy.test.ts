import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("RSN profile handoffs", () => {
  it("keeps player profiles action-oriented instead of a static hiscore page", () => {
    const source = readFileSync(join(process.cwd(), "src/app/u/[rsn]/page.tsx"), "utf8");

    expect(source).toContain("nextUrlForProfile(hi.name)");
    expect(source).toContain('params.set("from", "profile")');
    expect(source).not.toContain("nextUrlForSyncedRsn");
    expect(source).not.toContain('params.set("source", "plugin-sync")');
    expect(source).toContain('pluginVerifyUrlForSyncedRsn(hi.name, "profile")');
    expect(source).toContain('bankOrganizerHref(hi.name, "profile")');
    expect(source).toContain("getSyncedPlayer(hi.name)");
    expect(source).toContain("AccountHomeBoard");
    expect(source).toContain('data-account-home-board="true"');
    expect(source).toContain("Welcome back, {rsn}.");
    expect(source).toContain("Start here every login.");
    expect(source).toContain("Plan next trip");
    expect(source).toContain("What changed");
    expect(source).toContain("profileWhatChangedLines");
    expect(source).toContain("XP, quests, diaries, clog and Slayer changes");
    expect(source).not.toContain("ProfileActionRail");
    expect(source).not.toContain("ProfileActionCard");
    expect(source).not.toContain("<ProfileReadinessRail rsn={hi.name} />");
    expect(source).not.toContain("Hiscores als startpunt");
    expect(source).not.toContain("labelen wat exact is");
    expect(source).not.toContain("Plan exact /next");
    expect(source).toContain("Refresh RuneLite");
    expect(source).not.toContain("Verify the plugin setup");
    expect(source).toContain("Add bank");
    expect(source).toContain("Bank Memory");
    expect(source).toContain("Bank Tags");
    expect(source).toContain("account for gear, supplies and unlocks");
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
