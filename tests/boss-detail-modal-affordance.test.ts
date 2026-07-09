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
    expect(source).toContain("Trip verdict");
    expect(source).toContain("Try one trip");
    expect(source).toContain("Gear missing");
    expect(source).toContain("Not worth yet");
    expect(source).toContain("Risky trip");
    expect(source).toContain("Copy RuneLite tab");
    expect(source).toContain("bossSetupTagString");
    expect(source).toContain("Kill numbers");
    expect(source).toContain("Best setup");
    expect(source).toContain("Activity setup");
    expect(source).toContain("No combat DPS");
    expect(source).toContain("isNonCombatBossActivity");
    expect(source).toContain("Upgrades you don&apos;t have");
    expect(source).toContain("Inventory setup");
    expect(source).toContain("Bright chips = in your bank");
    expect(source).toContain("Buy chips = missing");
    expect(source).toContain("Try another boss");
    expect(source).toContain("bossRail");
    expect(source).toContain('aria-current={active ? "true" : undefined}');
    expect(source).toContain("onSelectBoss?: (boss: Boss) => void");
    expect(source).toContain("max-h-[90vh]");
    expect(source).toContain("overflow-y-auto overscroll-contain");
    expect(source).toContain('data-testid="boss-modal-scroll-panel"');
    expect(source).toContain('data-testid="boss-inventory-setup"');
    expect(source.indexOf("Trip verdict")).toBeLessThan(source.indexOf("Kill numbers"));
    expect(source.indexOf("Inventory setup")).toBeLessThan(source.indexOf("Upgrades you don&apos;t have"));
  });

  it("treats Wintertodt-style skilling bosses as activity setup, not combat DPS", () => {
    expect(source).toContain("const activitySetup = isNonCombatBossActivity(boss);");
    expect(source).toContain("() => activitySetup ? [] : suggestUpgradesForBoss(owned, boss, dps)");
    expect(source).toContain("activitySetup ? \"Activity setup\" : `${boss.hp} HP`");
    expect(source).toContain("This is not a combat DPS check.");
    expect(source).toContain("!activitySetup && (");
    expect(source).toContain("bossSetupTagString(boss, dps, activitySetup ? inventoryRows : undefined)");
  });

  it("builds boss inventory from the pasted bank and marks missing buys", () => {
    expect(source).toContain("bankItems?: BankHandoffItem[]");
    expect(source).toContain("buildInventoryRows({ preset, bankItems, owned, dps })");
    expect(source).toContain("function buildInventoryRows");
    expect(source).toContain("function findBankItemByPattern");
    expect(source).toContain("function bankItemFromGear");
    expect(source).toContain("Extra supplies");
    expect(source).toContain("slot.item ? wikiSearchUrl(slot.item.name) : wikiSearchUrl(slot.label)");
    expect(source).toContain("Buy");
    expect(source).toContain("x{slot.item.quantity.toLocaleString()}");
  });
});
