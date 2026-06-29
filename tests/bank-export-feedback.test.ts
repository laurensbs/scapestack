import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "src/components/bank-result.tsx"), "utf8");

describe("bank export feedback", () => {
  it("starts the bank result with one useful next move before technical details", () => {
    expect(source).toContain("function BankDecisionHero");
    expect(source).toContain("What can I do with this bank?");
    expect(source).toContain("DPS can build one owned-gear trip.");
    expect(source).toContain("Send this bank to /next.");
    expect(source).toContain("Check one boss trip before buying upgrades");
    expect(source).toContain("Use this bank for one clear session plan");
    expect(source).toContain("ReadyToLeave");
    expect(source).toContain("function buildBankReadyToLeave");
    expect(source).toContain("ReadyToLeaveStatus");
    expect(source).toContain('"Ready to leave"');
    expect(source).toContain('"Missing food"');
    expect(source).toContain('"Missing teleport"');
    expect(source).toContain('"Gear looks weak"');
    expect(source).toContain("const bankReadiness = useMemo(");
    expect(source).toContain("readiness={bankReadiness}");
    expect(source).toContain("<span>Bank details</span>");
    expect(source).toContain("<span>Saved banks</span>");
    expect(source.indexOf("What can I do with this bank?")).toBeLessThan(source.indexOf("Paste check"));
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
    expect(source).toContain("Open DPS");
    expect(source).toContain("aria-label={`Open DPS calculator for ${boss.name} with this bank`}");
    expect(source).toContain("title={`/dps?boss=${boss.slug}`}");
    expect(source).toContain("opens DPS with this boss selected.");
  });
});
