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
    expect(source).toContain("Best style with your gear");
    expect(source).toContain("Best setup");
    expect(source).toContain("Upgrades you don&apos;t have");
    expect(source).toContain("Best inventory setup");
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
