import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "src/components/boss-detail-modal.tsx"), "utf8");

describe("boss detail modal affordance", () => {
  it("exposes boss setup details as a named and described dialog", () => {
    expect(source).toContain('const titleId = "boss-modal-title";');
    expect(source).toContain('const descriptionId = "boss-modal-description";');
    expect(source).toContain('const statsId = "boss-modal-stats";');
    expect(source).toContain('role="dialog"');
    expect(source).toContain('aria-modal="true"');
    expect(source).toContain("aria-labelledby={titleId}");
    expect(source).toContain("aria-describedby={`${descriptionId} ${statsId}`}");
    expect(source).toContain("id={titleId}");
    expect(source).toContain("id={descriptionId}");
    expect(source).toContain("<section id={statsId}>");
  });

  it("labels close controls with the active boss name", () => {
    expect(source).toContain("aria-label={`Close ${boss.name} boss setup details`}");
    expect(source).toContain('aria-hidden="true"');
    expect(source).not.toContain('aria-label="Close"');
  });

  it("keeps the boss modal grounded in owned-bank setup copy", () => {
    expect(source).toContain("Can I do this?");
    expect(source).toContain("Do one trip");
    expect(source).toContain("Gear missing");
    expect(source).toContain("Not worth yet");
    expect(source).toContain("Risky trip");
    expect(source).toContain("Copy RuneLite tab");
    expect(source).toContain("bossSetupTagString");
    expect(source).toContain("Kill speed");
    expect(source).toContain("Gear from bank");
    expect(source).toContain("Activity setup");
    expect(source).toContain("No combat DPS");
    expect(source).toContain("No single DPS or GP/hour is shown here");
    expect(source).toContain("Build a learner raid");
    expect(source).toContain("Pick the role first");
    expect(source).toContain("Plan the full run");
    expect(source).toContain("isNonCombatBossActivity");
    expect(source).toContain("Best next improvement");
    expect(source).toContain("First-trip inventory");
    expect(source).toContain("Missing before you go");
    expect(source).toContain("Other usable items in your bank");
    expect(source).toContain("Try another boss");
    expect(source).toContain("bossRail");
    expect(source).toContain('aria-current={active ? "true" : undefined}');
    expect(source).toContain("onSelectBoss?: (boss: Boss) => void");
    expect(source).toContain("max-h-[90vh]");
    expect(source).toContain("overflow-y-auto overscroll-contain");
    expect(source).toContain('data-testid="boss-modal-scroll-panel"');
    expect(source).toContain('data-testid="boss-inventory-setup"');
    expect(source.indexOf("Can I do this?")).toBeLessThan(source.indexOf("Kill speed"));
    expect(source.indexOf("First-trip inventory")).toBeLessThan(source.indexOf("Best next improvement"));
  });

  it("treats Wintertodt-style skilling bosses as activity setup, not combat DPS", () => {
    expect(source).toContain("const activitySetup = isNonCombatBossActivity(boss);");
    expect(source).toContain("() => activitySetup || !singleDps ? null : buildBossUpgradePlan({ boss, owned, bankItems, current: dps, accountType })");
    expect(source).toContain('activitySetup ? "Activity setup" : knowledge.groupSize');
    expect(source).toContain("This is not a combat DPS check.");
    expect(source).toContain("!activitySetup && (");
    expect(source).toContain("const inventoryTagRows = activitySetup ? inventoryRows : undefined;");
    expect(source).toContain("bossSetupTagString(boss, dps, inventoryTagRows)");
    expect(source).toContain("activitySetup || singleDps ? bossSetupTagString");
  });

  it("builds boss inventory from the pasted bank and marks missing buys", () => {
    expect(source).toContain("bankItems?: BankHandoffItem[]");
    expect(source).toContain("buildBossInventoryPlan({ boss, preset, bankItems, owned, dps: bankDps })");
    expect(source).toContain("inventoryPlan.leaveWith");
    expect(source).toContain("inventoryPlan.firstTrip");
    expect(source).toContain("inventoryPlan.firstTripRange");
    expect(source).toContain('data-testid="osrs-inventory-grid"');
    expect(source).toContain("inventoryPlan.mandatoryMissing");
    expect(source).toContain("slot.quantity");
  });
});
