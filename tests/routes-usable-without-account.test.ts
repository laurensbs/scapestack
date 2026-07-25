import { readFileSync } from "node:fs";
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
describe("catalogue routes show their catalogue without an account", () => {
  it("keeps the boss roster mounted on /dps", () => {
    const client = source("src/app/dps/dps-client.tsx");
    expect(client).toContain("BossRoster");
    expect(BOSSES.length).toBeGreaterThan(40);
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
  it("keeps /skills, /quests, /diary, /gp and /ge as redirects into /next", () => {
    // STRATEGY.md folded these into /next as recommendation kinds. They are
    // 308s so cached links and search results keep working — filling them with
    // content would resurrect tools that were deliberately retired.
    for (const route of ["skills", "quests", "diary", "gp", "ge"]) {
      const page = source(`src/app/${route}/page.tsx`);
      expect(page, route).toMatch(/redirect|permanentRedirect/);
    }
  });
});
