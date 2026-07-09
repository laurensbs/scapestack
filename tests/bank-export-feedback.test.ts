import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "src/components/bank-result.tsx"), "utf8");

describe("bank export feedback", () => {
  it("starts the bank result with a clear setup board before technical details", () => {
    expect(source).toContain("function BankDecisionHero");
    expect(source).toContain('aria-label="Bank Setup Board"');
    expect(source).toContain("Bank Setup Board");
    expect(source).toContain("Set up your bank");
    expect(source).toContain("Bank loaded");
    expect(source).toContain("Bank needs a paste");
    expect(source).toContain("Pick layout");
    expect(source).toContain("Smart tidy");
    expect(source).toContain("Copy to RuneLite");
    expect(source).toContain("Bank view controls");
    expect(source).toContain("Open the kill check, lock a setup, then do one short trip.");
    expect(source).toContain("Check one boss trip before buying upgrades");
    expect(source).toContain("Use this bank for one clear trip");
    expect(source).toContain("Open the next trip plan that fits tonight.");
    expect(source).toContain("function buildBankReadyToLeave");
    expect(source).toContain("ReadyToLeaveStatus");
    expect(source).toContain('"Good first trip"');
    expect(source).toContain('"Bring food"');
    expect(source).toContain('"Pick a teleport"');
    expect(source).toContain('"Skip for now"');
    expect(source).toContain("const bankReadiness = useMemo(");
    expect(source).toContain("readiness={bankReadiness}");
    expect(source).toContain('id="bank-view-panel"');
    expect(source).toContain("shouldDensePackSparseLayout");
    expect(source).toContain("Trip check");
    expect(source).toContain("First");
    expect(source).toContain("Leave");
    expect(source).not.toContain("<span>Organize tabs</span>");
    expect(source).toContain("<span>Saved banks</span>");
    expect(source.indexOf("Set up your bank")).toBeLessThan(source.indexOf('id="bank-view-panel"'));
    expect(source.indexOf("Bank view controls")).toBeLessThan(source.indexOf('id="bank-view-panel"'));
    expect(source.indexOf('id="bank-view-panel"')).toBeLessThan(source.indexOf("Import details"));
    expect(source.indexOf('id="bank-view-panel"')).toBeLessThan(source.indexOf("<span>Saved banks</span>"));
  });

  it("shows a paste check for bank precision before export", () => {
    expect(source).toContain("function bankSourceReceipt");
    expect(source).toContain('data-testid="bank-source-receipt"');
    expect(source).toContain("Bank Memory TSV");
    expect(source).toContain("RuneLite Bank Tags");
    expect(source).toContain("Exact layout, partial stacks");
    expect(source).toContain("Bank Tags do not include quantities");
    expect(source).toContain("Finished quests, diary steps, clog slots and Slayer");
  });

  it("surfaces item ID and sprite health in the bank result", () => {
    expect(source).toContain("function bankIdSpriteHealth");
    expect(source).toContain('data-testid="bank-id-sprite-health"');
    expect(source).toContain("ID check needs review");
    expect(source).toContain("IDs normalized");
    expect(source).toContain("IDs and sprites ready");
    expect(source).toContain("const tileCount = initial.stats.items");
    expect(source).toContain("const tabCount = initial.stats.tabs");
    expect(source).toContain("visible bank tile");
    expect(source).toContain("organized tab");
    expect(source).toContain("${warnings.recognizedItemCount}/${warnings.parsedItemCount} pasted IDs mapped");
    expect(source).toContain("/api/sprite/item/:id.png");
    expect(source).toContain("keeps those IDs as fallback tiles");
    expect(source).toContain("fallbackItemIds.slice(0, 6)");
  });

  it("keeps copy-to-runelite feedback honest about import adjustments", () => {
    expect(source).toContain("const importAdjustmentSuffix");
    expect(source).toContain("duplicate ID");
    expect(source).toContain("unknown ID");
    expect(source).toContain("kept as fallback");
    expect(source).toContain("Import adjusted:");
    expect(source).toContain("Bank Tags → Import tag tab.${importAdjustmentSuffix}");
    expect(source).toContain("review before importing.${importAdjustmentSuffix}");
    expect(source).toContain("Paste it into RuneLite now.${importAdjustmentSuffix}");
  });

  it("shows a manual export textarea when clipboard copy fails", () => {
    expect(source).toContain('const [manualExportFallback, setManualExportFallback] = useState("")');
    expect(source).toContain("setManualExportFallback(text)");
    expect(source).toContain('if (key.endsWith("-error")) return;');
    expect(source).not.toContain('key === "copy-error" ? 2600 : 1600');
    expect(source).toContain('document.getElementById("bank-export-panel")');
    expect(source).toContain('exportPanel?.scrollIntoView({ behavior: "smooth", block: "start" })');
    expect(source).toContain("exportPanel?.focus({ preventScroll: true })");
    expect(source).toContain("blocks.join(\"\\n\\n\")");
    expect(source).toContain('copied === "copy-error"');
    expect(source).toContain("Manual fallback export");
    expect(source).toContain("id=\"manual-banktags-export\"");
    expect(source).toContain("readOnly");
    expect(source).toContain("value={manualExportFallback || strings.join(\"\\n\")}");
    expect(source).toContain("event.currentTarget.select()");
    expect(source).toContain("Manual Bank Tags export fallback");
    expect(source).toContain("paste the shown export into RuneLite Bank Tags");
    expect(source).toContain('id="bank-export-panel"');
    expect(source).toContain("tabIndex={-1}");
  });

  it("shows a manual boss loadout tag when boss tag copy fails", () => {
    expect(source).toContain("<BossTagSection");
    expect(source).toContain('onOpenDps={(bossSlug) => openBankHandoffRoute(bankToolUrl("/dps", inferredRsn, { boss: bossSlug }))}');
    expect(source).toContain("Pick a boss");
    expect(source).toContain("ScapeStack builds a RuneLite tab from your bank.");
    expect(source).toContain("BOSS_LOADOUT_FILTERS");
    expect(source).toContain("Raids");
    expect(source).toContain("Slayer");
    expect(source).toContain("Wildy");
    expect(source).toContain("GWD");
    expect(source).toContain("Beginner");
    expect(source).toContain("Skilling");
    expect(source).toContain('data-testid="boss-quick-picks"');
    expect(source).toContain("Show all bosses");
    expect(source).toContain("showAllBosses || q ? 60 : 12");
    expect(source).toContain("Owned setup slots");
    expect(source).toContain("Missing upgrades");
    expect(source).toContain("Inventory prep");
    expect(source).toContain("Copy RuneLite tag");
    expect(source).toContain('const [manualBossTag, setManualBossTag] = useState("")');
    expect(source).toContain('flash("boss-tag-error")');
    expect(source).toContain('copied === "boss-tag-error"');
    expect(source).toContain("Clipboard failed — copy boss tag manually");
    expect(source).toContain("Manual boss Bank Tags fallback for");
    expect(source).toContain("value={manualBossTag}");
    expect(source).toContain("event.currentTarget.select()");
  });

  it("makes selected boss loadouts actionable in DPS", () => {
    expect(source).toContain("onOpenDps: (bossSlug: string) => void;");
    expect(source).toContain("Check kill");
    expect(source).toContain("aria-label={`Check ${boss.name} kill setup with this bank`}");
    expect(source).toContain("title={`/dps?boss=${boss.slug}`}");
    expect(source).toContain("Copy the tab to RuneLite, then check the kill before buying upgrades.");
  });

  it("keeps the post-bank action rail player-facing instead of slash-route heavy", () => {
    expect(source).toContain("After tidy");
    expect(source).toContain("Plan next trip");
    expect(source).toContain("RuneLite sync");
    expect(source).not.toContain("Use this bank in");
    expect(source).not.toContain("onGoals={() => openBankHandoffRoute");
    expect(source).not.toContain("onSlayer={() => openBankHandoffRoute");
  });

  it("keeps a DPS boss target when setup is added through the bank", () => {
    expect(source).toContain("returnBossSlug?: string | null;");
    expect(source).toContain("returnBossSlug");
    expect(source).toContain("const dpsHandoffOptions = useMemo(");
    expect(source).toContain("returnBossSlug ? { boss: returnBossSlug } : undefined");
    expect(source).toContain('bankToolUrl("/dps", inferredRsn, dpsHandoffOptions)');
  });
});
