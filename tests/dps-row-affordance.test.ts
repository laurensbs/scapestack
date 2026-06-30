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
    expect(source).toContain("<button\n      type=\"button\"\n      id={`boss-${boss.slug}`}");
    expect(source).toContain("aria-label={`Open ${boss.name} kill setup details`}");
    expect(source).toContain("title={`Open ${boss.name} kill setup details`}");
    expect(source).toContain("Open details");
    expect(source).toContain("grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5");
    expect(source).toContain("Add a weapon to see setup and upgrades.");
    expect(source).toContain('import { Edit3, Sword, Search, X, Sparkles, ExternalLink } from "lucide-react";');
    expect(source).not.toContain("role=\"button\"");
    expect(source).not.toContain("tabIndex={0}");
  });

  it("keeps boss-specific upgrades inside the clicked boss modal", () => {
    const modalSource = readFileSync(join(process.cwd(), "src/components/boss-detail-modal.tsx"), "utf8");

    expect(modalSource).toContain("const upgrades = useMemo(() => suggestUpgradesForBoss(owned, boss, dps)");
    expect(modalSource).toContain("Upgrades you don&apos;t have");
    expect(modalSource).toContain("wikiSearchUrl(u.item.name)");
    expect(modalSource).toContain("wikiPriceUrl(u.item.id)");
    expect(modalSource).toContain("Open ${u.item.name} on the OSRS Wiki");
    expect(modalSource).toContain("Open ${u.item.name} GE price");
    expect(source).not.toContain("function suggestUpgradesForBoss(owned: GearItem[], boss: Boss): UpgradeSuggestion[]");
    expect(source).not.toContain("Upgrade before camping");
  });

  it("starts DPS as a boss browser instead of a dashboard verdict", () => {
    expect(source).toContain("Can I kill this with my bank?");
    expect(source).not.toContain('import { bossViabilityFromGear, styleLabel, type BossViability } from "@/lib/boss-viability";');
    expect(source).not.toContain("function dpsDecisionScore");
    expect(source).not.toContain("function pickBestBossTrip");
    expect(source).toContain("window.scrollTo({ top: 0, behavior: \"instant\" });");
    expect(source).toContain("Pick a boss");
    expect(source).toContain("Search any boss. Click one to see your best gear, DPS, supplies and upgrades from this bank.");
    expect(source).toContain("All bosses");
    expect(source).toContain("bosses checked");
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
    expect(modalSource).toContain("Upgrades you don&apos;t have");
    expect(modalSource).toContain("href={wikiSearchUrl(u.item.name)}");
    expect(modalSource).toContain("href={wikiPriceUrl(u.item.id)}");
    expect(modalSource).toContain("Open ${u.item.name} on the OSRS Wiki");
    expect(modalSource).toContain("Open ${u.item.name} GE price");
    expect(modalSource).toContain("{u.item.name}");
    expect(modalSource).toContain("+{u.gain.toFixed(2)} DPS");
    expect(modalSource).toContain("GE <ExternalLink");
  });
});
