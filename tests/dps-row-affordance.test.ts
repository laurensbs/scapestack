import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "src/app/dps/dps-client.tsx"), "utf8");

describe("DPS boss row affordance", () => {
  it("labels the boss search and sort controls as real interactive controls", () => {
    expect(source).toContain('htmlFor="dps-boss-search"');
    expect(source).toContain("Search bosses for a kill setup");
    expect(source).toContain('id="dps-boss-search"');
    expect(source).toContain('name="boss"');
    expect(source).toContain('aria-describedby="dps-boss-search-help dps-boss-search-status"');
    expect(source).toContain("Type a boss name, press Enter to open the first match");
    expect(source).toContain('aria-label="Clear boss search"');
    expect(source).toContain('id="dps-boss-search-status"');
    expect(source).toContain('role="status"');
    expect(source).toContain("BOSS_FILTERS");
    expect(source).toContain('aria-label="Filter bosses"');
    expect(source).toContain('aria-pressed={bossFilter === filter.key}');
    expect(source).toContain("aria-pressed={sortBy === opt.key}");
    expect(source).toContain("aria-label={`Sort boss rows by ${opt.label}`}");
  });

  it("renders bosses as explicit clickable cards instead of dashboard rows", () => {
    expect(source).toContain("function BossCard");
    expect(source).toContain("<article\n      id={`boss-${boss.slug}`}");
    expect(source).toContain("<button\n        type=\"button\"\n        onClick={onOpen}");
    expect(source).toContain("aria-label={`Open ${boss.name} ${activity ? \"activity setup\" : \"kill setup\"} details`}");
    expect(source).toContain("title={`Open ${boss.name} ${activity ? \"activity setup\" : \"kill setup\"} details`}");
    expect(source).toContain("scapestack-boss-tile group w-full");
    expect(source).not.toContain('<span className="text-[10px] uppercase tracking-[0.18em] text-[var(--color-text-muted)]">{boss.slug}</span>');
    expect(source).toContain("grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3");
    expect(source).not.toContain("Open details");
    expect(source).toContain("Add a weapon to see the trip setup and missing upgrades.");
    expect(source).toContain('import { Edit3, Sword, Search, X, Sparkles, ExternalLink } from "lucide-react";');
    expect(source).toContain("function bossTripVerdict");
    expect(source).toContain("const status = bossTripVerdict(boss, dps, accountType, inventoryPlan);");
    expect(source).toContain("buildBossInventoryPlan({ boss, bankItems, owned, dps })");
    expect(source).toContain('className="block h-full min-h-[236px] w-full p-5 text-left"');
    expect(source).toContain('"Do one trip"');
    expect(source).toContain('"Good with bank"');
    expect(source).toContain('"Good first trip"');
    expect(source).toContain('"Not worth yet"');
    expect(source).toContain('"Risky trip"');
    expect(source).toContain('"HCIM risk"');
    expect(source).toContain('"Activity setup"');
    expect(source).toContain("killPace");
    expect(source).toContain("bossProfitEstimate(boss, dps, accountType)");
    expect(source).toContain("Est. {formatRateRange(profitEstimate.grossGpPerHour.range, formatGp)}/hr");
    expect(source).toContain('!profitEstimate.spendable && " loot value"');
    expect(source).not.toContain('<span className="text-[var(--color-text-muted)]">DPS</span>');
    expect(source).not.toContain("role=\"button\"");
    expect(source).not.toContain("tabIndex={0}");
  });

  it("keeps boss-specific upgrades inside the clicked boss modal", () => {
    const modalSource = readFileSync(join(process.cwd(), "src/components/boss-detail-modal.tsx"), "utf8");

    expect(modalSource).toContain("buildBossUpgradePlan({ boss, owned, bankItems, current: dps, accountType })");
    expect(modalSource).toContain("Best next improvement");
    expect(modalSource).toContain("wikiSearchUrl(upgradePlan.item.name)");
    expect(modalSource).toContain("wikiPriceUrl(upgradePlan.item.id)");
    expect(modalSource).toContain("upgradePlan.sourcePath");
    expect(modalSource).toContain("upgradePlan.affordable");
    expect(source).not.toContain("function suggestUpgradesForBoss(owned: GearItem[], boss: Boss): UpgradeSuggestion[]");
  });

  it("starts DPS as a boss browser instead of a dashboard verdict", () => {
    expect(source).toContain("Can I kill this with my bank?");
    expect(source).not.toContain('import { bossViabilityFromGear, styleLabel, type BossViability } from "@/lib/boss-viability";');
    expect(source).not.toContain("function dpsDecisionScore");
    expect(source).not.toContain("function pickBestBossTrip");
    expect(source).toContain("window.scrollTo({ top: 0, behavior: \"instant\" });");
    expect(source).toContain("Pick a boss");
    expect(source).toContain("Search any boss. Click a tile for gear, supplies, upgrades and a first trip.");
    expect(source).toContain('label: "Bring" | "Missing" | "Try first"');
    expect(source).toContain('<BossTripLine label="Bring" value={before} />');
    expect(source).toContain('<BossTripLine label="Try first" value={finish} />');
    expect(source).not.toContain("Before you leave");
    expect(source).not.toContain("Still missing");
    expect(source).not.toContain("Finish after");
    expect(source).not.toContain("Boss category");
    expect(source).toContain("visibleResults.length} bosses");
    expect(source).toContain("const visibleResults = filteredResults;");
    expect(source).toContain('label: "All"');
    expect(source).toContain('label: "GP"');
    expect(source).toContain('label: "Solo"');
    expect(source).toContain('useState<BossFilter>("all")');
    expect(source).toContain("const bossTripFitScore = (entry: BossDpsResult) =>");
    expect(source).toContain("function accountTypeFromDpsParams");
    expect(source).toContain("function bossRiskPenaltyForAccount");
    expect(source).toContain("score -= bossRiskPenaltyForAccount(boss, plannerAccountType);");
    expect(source).toContain("bossKnowledgeRankingAdjustment(knowledge)");
    expect(source).toContain("bossKnowledgeSupportsSingleDps");
    expect(source).toContain("bossKnowledgeAllowsGpRate");
    expect(source).not.toContain("Show recommended bosses");
    expect(source).not.toContain("Show all ${filteredResults.length} in this category");
    expect(source).not.toContain('label: "Activities"');
    expect(source).toContain("Wintertodt/Tempoross/GotR stay visible");
    expect(source).toContain("isNonCombatBossActivity(boss)");
    expect(source).toContain("function activityBeforeLeave");
    expect(source).toContain("function activityMissingLine");
    expect(source).not.toContain("All bosses");
    expect(source).not.toContain("bosses checked");
    expect(source).not.toContain("<DpsDecisionHero");
    expect(source).not.toContain("Make this smarter");
    expect(source).not.toContain("Recommended for your bank");
    expect(source).not.toContain("Compare other bosses");
    expect(source).not.toContain("Search and sort the full table only when the first trip is not the one.");
    expect(source).not.toContain("Boss options with this bank");
    expect(source).not.toContain("Gear recognized");
    expect(source).not.toContain("Per-boss DPS with your gear");
  });

  it("makes upgrade items actionable with Wiki and GE price links", () => {
    const modalSource = readFileSync(join(process.cwd(), "src/components/boss-detail-modal.tsx"), "utf8");

    expect(modalSource).toContain('import { wikiPriceUrl } from "@/lib/item-action";');
    expect(modalSource).toContain('import { wikiSearchUrl } from "@/lib/wiki";');
    expect(modalSource).toContain("Best next improvement");
    expect(modalSource).toContain("upgradePlan.sourcePath ? wikiSearchUrl(upgradePlan.item.name) : wikiPriceUrl(upgradePlan.item.id)");
    expect(modalSource).toContain("{upgradePlan.item.name}");
    expect(modalSource).toContain("+{upgradePlan.gain.toFixed(2)} DPS");
    expect(modalSource).toContain("{upgradePlan.actionLabel}");
  });
});
