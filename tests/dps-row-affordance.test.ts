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
    expect(source).toContain("aria-pressed={sortBy === opt.key}");
    expect(source).toContain("aria-label={`Sort boss rows by ${opt.label}`}");
  });

  it("renders boss rows as explicit setup-detail buttons", () => {
    expect(source).toContain("function BossRow");
    expect(source).toContain("<button\n      type=\"button\"\n      id={`boss-${boss.slug}`}");
    expect(source).toContain("aria-label={`Open ${boss.name} kill setup details`}");
    expect(source).toContain("title={`Open ${boss.name} kill setup details`}");
    expect(source).toContain("Details");
    expect(source).toContain("View requirements");
    expect(source).toContain('import { CheckCheck, Copy, Edit3, Sword, Zap, Target, TrendingUp, Coins, Search, X, Sparkles, ExternalLink, ChevronDown } from "lucide-react";');
    expect(source).not.toContain("role=\"button\"");
    expect(source).not.toContain("tabIndex={0}");
  });

  it("switches upgrade suggestions from global to focused boss context", () => {
    expect(source).toContain("const focusedBossUpgrades = useMemo(");
    expect(source).toContain("focusedBoss ? suggestUpgradesForBoss(owned, focusedBoss).slice(0, 3) : []");
    expect(source).toContain("const visibleUpgrades = focusedBoss ? focusedBossUpgrades : upgrades;");
    expect(source).toContain("{focusedBoss ? `${focusedBoss.name} upgrade check` : \"Upgrade before camping\"}");
    expect(source).toContain("Only items that help ${focusedBoss.name} from this bank.");
    expect(source).toContain("Worth checking before you camp a boss for a longer session.");
    expect(source).toContain('{focusedBoss ? "vs current setup" : "avg"}');
    expect(source).toContain("Helps <span className=\"text-[var(--color-gold-soft)]\">{focusedBoss.name}</span> directly.");
    expect(source).toContain("function suggestUpgradesForBoss(owned: GearItem[], boss: Boss): UpgradeSuggestion[]");
  });

  it("starts DPS as a boss-trip verdict instead of a dashboard", () => {
    expect(source).toContain("function DpsDecisionHero");
    expect(source).toContain("Can I kill this?");
    expect(source).toContain("Best trip from this bank");
    expect(source).toContain("Can kill: do one short trip");
    expect(source).toContain("Test trip only");
    expect(source).toContain("Not worth yet");
    expect(source).toContain("ReadyToLeave");
    expect(source).toContain("function buildDpsReadyToLeave");
    expect(source).toContain("ReadyToLeaveStatus");
    expect(source).toContain('"Ready to leave"');
    expect(source).toContain('"Missing food"');
    expect(source).toContain('"Missing teleport"');
    expect(source).toContain('"Gear looks weak"');
    expect(source).toContain('"Add gear first"');
    expect(source).toContain("const readiness = buildDpsReadyToLeave(decision, result, weaponCount);");
    expect(source).toContain('import { bossViabilityFromGear, styleLabel, type BossViability } from "@/lib/boss-viability";');
    expect(source).toContain("function dpsDecisionScore");
    expect(source).toContain("function pickBestBossTrip");
    expect(source).toContain("const decisionBossViability = useMemo(");
    expect(source).toContain("Bank says ${result.boss.name}");
    expect(source).toContain("window.scrollTo({ top: 0, behavior: \"instant\" });");
    expect(source).toContain("Make this smarter");
    expect(source).toContain("Setup, RSN, RuneLite");
    expect(source).toContain("Compare other bosses");
    expect(source).toContain("Search and sort the full table only when the first trip is not the one.");
    expect(source).toContain("Boss options with this bank");
    expect(source).not.toContain("Gear recognized");
    expect(source).not.toContain("Per-boss DPS with your gear");
  });

  it("makes upgrade items actionable with Wiki and GE price links", () => {
    expect(source).toContain('import { copyText } from "@/lib/clipboard";');
    expect(source).toContain('import { wikiPriceUrl } from "@/lib/item-action";');
    expect(source).toContain('import { wikiSearchUrl } from "@/lib/wiki";');
    expect(source).toContain('import { buildDpsUpgradeBuyLine } from "@/lib/dps-upgrade-actions";');
    expect(source).toContain('const [copiedUpgradeList, setCopiedUpgradeList] = useState<"copied" | "failed" | null>(null);');
    expect(source).toContain('const [copiedUpgradeItem, setCopiedUpgradeItem] = useState<{ id: number; status: "copied" | "failed" } | null>(null);');
    expect(source).toContain("const [showUpgradeShoppingList, setShowUpgradeShoppingList] = useState(false);");
    expect(source).toContain("const upgradeShoppingList = useMemo(() => {");
    expect(source).toContain("`${focusedBoss.name} DPS upgrades`");
    expect(source).toContain("buildDpsUpgradeBuyLine({");
    expect(source).toContain("scope: focusedBoss ? \"vs current setup\" : \"avg\"");
    expect(source).toContain("const copyUpgradeShoppingList = async () => {");
    expect(source).toContain("const result = await copyText(upgradeShoppingList);");
    expect(source).toContain('if (result === "failed") {');
    expect(source).toContain('setCopiedUpgradeList("failed");');
    expect(source).toContain("return;");
    expect(source).toContain("Copy shopping list");
    expect(source).toContain("View list");
    expect(source).toContain("Hide list");
    expect(source).toContain("aria-expanded={showUpgradeShoppingList}");
    expect(source).toContain("Show upgrade shopping list text");
    expect(source).toContain("Upgrade list copied");
    expect(source).toContain("Clipboard failed — copy shopping list manually");
    expect(source).toContain("Upgrade shopping list text");
    expect(source).toContain('(copiedUpgradeList === "failed" || showUpgradeShoppingList)');
    expect(source).toContain("value={upgradeShoppingList}");
    expect(source).toContain("event.currentTarget.select()");
    expect(source).toContain("Manual ${focusedBoss.name} upgrade shopping list");
    expect(source).toContain("href={wikiSearchUrl(upgrade.gear.name)}");
    expect(source).toContain("href={wikiPriceUrl(upgrade.gear.id)}");
    expect(source).toContain("Open ${upgrade.gear.name} item ID ${upgrade.gear.id} on the OSRS Wiki");
    expect(source).toContain("Open ${upgrade.gear.name} item ID ${upgrade.gear.id} GE price on the OSRS Wiki");
    expect(source).toContain("#{upgrade.gear.id} · {upgrade.gear.slot}");
    expect(source).toContain("const copyUpgradeBuyLine = async (upgrade: UpgradeSuggestion) => {");
    expect(source).toContain("Copy ${upgrade.gear.name} item ID ${upgrade.gear.id} DPS upgrade buy line");
    expect(source).toContain("Copy buy line");
    expect(source).toContain("GE price");
  });
});
