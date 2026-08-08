import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { GOAL_SETS } from "@/lib/goals";
import { BOSSES } from "@/lib/bosses";
import { MASTERS } from "@/lib/slayer/masters";

const source = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

// A page whose whole promise is a catalogue should not be an empty form. /dps
// asked "Can I kill this?" and showed no bosses; /goals asked "What unlock
// next?" and showed none of the forty-two sets. Content stands on its own and
// the account makes it personal — never the other way round.
describe("the former catalogue routes hand off to the player page", () => {
  it("renders the full boss roster from the canonical profile section", () => {
    const page = source("src/app/dps/page.tsx");
    const profile = source("src/app/u/[rsn]/page.tsx");
    const sections = source("src/components/player-tools-sections.tsx");
    expect(page).toContain('playerToolSectionPath(rsn, "bosses")');
    expect(profile).toContain("BOSSES");
    expect(profile).toContain("<PlayerToolsSections");
    expect(sections).toContain("<PlayerBossesSection");
    expect(BOSSES.length).toBeGreaterThan(40);
  });

  it("links each boss so the tiles work without JavaScript", () => {
    const roster = source("src/components/boss-roster.tsx");
    expect(roster).toContain("/dps?boss=");
    expect(roster).toContain("onPick?:");
  });

  it("keeps the unlock roster mounted on /goals", () => {
    const client = source("src/app/goals/goals-client.tsx");
    expect(client).toContain("GoalRoster");
    expect(GOAL_SETS.length).toBeGreaterThan(30);
  });

  it("shows every goal set, so adding a category cannot silently hide one", () => {
    const roster = source("src/components/goal-roster.tsx");
    // The component groups by category and appends anything unlisted under
    // "More". Without that fallback a new category would vanish from the page.
    expect(roster).toContain('label: "More"');
    expect(roster).toContain("!known.has(set.category)");
  });
});

describe("/slayer states requirements, not conclusions, before there is input", () => {
  const client = source("src/app/slayer/slayer-client.tsx");

  it("does not name a master until an RSN has been entered", () => {
    // combatLevel and slayerLevel default to 3 and 1 and feed rankMasters, so
    // the page used to assert "Turael is the strongest available master" to a
    // visitor who had entered nothing. On a product that claims to know the
    // player's account, a verdict from placeholder values is the worst
    // possible first impression.
    expect(client).toContain("rsn && topMaster");
    expect(client).not.toMatch(/:\s*topMaster\s*\n\s*\?\s*`\$\{topMaster\} is the strongest/);
  });

  it("shows the master reference instead while there is nothing to go on", () => {
    expect(client).toContain("SlayerMasterReference");
    expect(client).toContain("rsn.trim() ? <MasterRoutes");
  });

  it("takes the requirements from the master data rather than restating them", () => {
    const reference = source("src/components/slayer-master-reference.tsx");
    expect(reference).toContain("MASTERS");
    expect(reference).not.toMatch(/combatRequirement:\s*\d+/);
    // Duradel is the one with all three kinds of requirement; if the data ever
    // loses them the reference silently becomes wrong.
    expect(MASTERS.duradel.combatRequirement).toBeGreaterThan(0);
    expect(MASTERS.duradel.slayerRequirement).toBeGreaterThan(0);
    expect(MASTERS.duradel.questRequirements.length).toBeGreaterThan(0);
  });
});

describe("routes that deliberately have no catalogue", () => {
  it("keeps the retired routes as config redirects, not route components", () => {
    // STRATEGY.md folded these into /next as recommendation kinds. They used
    // to be page.tsx files whose whole body was permanentRedirect(), which
    // made them look like product surfaces in the tree — a nav promising six
    // tools where three did not exist. The bounce lives in next.config.ts
    // now; a route directory reappearing here would resurrect a retired tool.
    const config = source("next.config.ts");
    for (const route of ["skills", "quests", "diary", "gp", "ge", "hiscore"]) {
      expect(existsSync(join(process.cwd(), `src/app/${route}/page.tsx`)), route).toBe(false);
      expect(config).toContain(`source: "/${route}"`);
    }
  });
});

describe("the bank is optional where the page already works", () => {
  it("does not number the paste box on the catalogue routes", () => {
    // "type your OSRS name" versus "Step 3 of 4" on the same screen. /dps and
    // /goals now list their whole catalogue before anything is pasted, so the
    // bank is an upgrade there, not step three of a mandatory flow.
    const intake = source("src/components/intake.tsx");
    expect(intake).not.toContain("Step 3 of 4");
    expect(intake).toContain("optional");

    for (const route of ["src/app/dps/dps-client.tsx", "src/app/goals/goals-client.tsx"]) {
      expect(source(route), route).toMatch(/<Intake[^>]*optional/);
    }
  });

  it("leaves /bank its real sequence", () => {
    // A nameless player gets one real paste flow; a known player is redirected.
    const bank = source("src/app/bank/bank-intake-only.tsx");
    expect(bank).toContain("compactSave");
    expect(bank).toContain("askRsn");
    expect(bank).not.toMatch(/<Intake[^>]*optional/);
  });
});
