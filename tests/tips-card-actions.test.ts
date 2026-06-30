import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const tipsCardSource = readFileSync(join(process.cwd(), "src/components/tips-card.tsx"), "utf8");
const bankResultSource = readFileSync(join(process.cwd(), "src/components/bank-result.tsx"), "utf8");

describe("bank tips card actions", () => {
  it("lets bank tips jump to the affected items in the bank search", () => {
    expect(tipsCardSource).toContain("onSearchItems?: (query: string, sourceLabel?: string) => void");
    expect(tipsCardSource).toContain("bankSearchQueryForItems(itemRefsForTips(tips))");
    expect(tipsCardSource).toContain("onSearchItems(searchQuery, tips.length === 1 ? tips[0].title : `${tips.length} bank tips`)");
    expect(tipsCardSource).toContain("onSearchItems(searchQuery, group.label)");
    expect(tipsCardSource).toContain("Find items");
    expect(tipsCardSource).toContain("Find affected items");
    expect(tipsCardSource).toContain("Open step-by-step action plan");
    expect(tipsCardSource).toContain("aria-controls={tipsBodyId}");
    expect(tipsCardSource).toContain("Collapse");
    expect(tipsCardSource).toContain("bank tips.");
    expect(tipsCardSource).toContain("role=\"region\"");
    expect(tipsCardSource).toContain("Action steps for");
    expect(tipsCardSource).toContain("aria-label={`Find affected bank items for ${actionLabel}`}");
    expect(tipsCardSource).toContain("aria-label={`Open step-by-step action plan for ${actionLabel}`}");
    expect(tipsCardSource).toContain("onMarkDone?: () => void");
    expect(tipsCardSource).toContain("onMarkDone={() => onDismissTip(group.tips[0].id)}");
    expect(tipsCardSource).toContain("onMarkDone={onDismissGroup}");
    expect(tipsCardSource).toContain("onMarkDone();");
    expect(tipsCardSource).toContain("Mark done");
    expect(tipsCardSource).toContain("aria-label={`Mark ${actionLabel} tip as done`}");
    expect(tipsCardSource).toContain("aria-label={`Mark ${group.label} tip as done`}");
    expect(tipsCardSource).toContain("dismissLabel={`Dismiss ${group.label} tip`}");
    expect(tipsCardSource).toContain("dismissLabel={`Dismiss ${group.label} tips`}");
    expect(tipsCardSource).toContain("aria-label={dismissLabel}");
    expect(tipsCardSource).toContain("aria-label={`Dismiss ${tip.title} tip`}");
    expect(tipsCardSource).toContain("aria-label={`Copy tips for ${tips.length === 1 ? tips[0].title : `${tips.length} Scapestack bank tips`}`}");
    expect(tipsCardSource).not.toContain("Open exact step-by-step action plan");
    expect(tipsCardSource).toContain("Open action steps for");
    expect(tipsCardSource).toContain("aria-label={`Open action steps for ${group.label}`}");
    expect(tipsCardSource).toContain('type="button"');
    expect(tipsCardSource).toContain("aria-expanded={!collapsed}");
    expect(tipsCardSource).not.toContain('role="button"');
    expect(tipsCardSource).not.toContain("tabIndex={0}");
    expect(tipsCardSource).not.toContain(`role="button"
          tabIndex={0}
          onClick={onOpen}`);
    expect(tipsCardSource).not.toContain(`role="button"
          tabIndex={0}
          onClick={(e) => { e.stopPropagation(); onDismiss(); }}`);
    expect(tipsCardSource).toContain("Wiki guide");
    expect(tipsCardSource).toContain("title={action.label}");
    expect(tipsCardSource).toContain("aria-label={action.label}");
    expect(tipsCardSource).toContain('useState<"idle" | "copied" | "error">("idle")');
    expect(tipsCardSource).toContain("setManualCopyText(actionPlanText)");
    expect(tipsCardSource).toContain("Clipboard failed — copy manually");
    expect(tipsCardSource).toContain("Manual copy fallback for");
    expect(tipsCardSource).toContain("event.currentTarget.select()");
    expect(bankResultSource).toContain("<TipsCard tips={bankTips} onSearchItems={searchSuggestionItems} />");
    expect(bankResultSource).toContain("const bankTipSearchQuery = useMemo(() => bankSearchQueryForTips(bankTips), [bankTips]);");
    expect(bankResultSource).toContain("if (bankTipSearchQuery) {");
    expect(bankResultSource).toContain('searchSuggestionItems(bankTipSearchQuery, "Bank tips");');
    expect(bankResultSource).toContain("const [actionSearch, setActionSearch]");
    expect(bankResultSource).toContain("setActionSearch({ query, sourceLabel })");
    expect(bankResultSource).toContain("totalSearchMatches");
    expect(bankResultSource).toContain("Showing");
    expect(bankResultSource).toContain("bank item");
    expect(bankResultSource).toContain("Clear action search");
    expect(bankResultSource).toContain("setActionSearch(null)");
  });

  it("lets users undo dismissed bank tips immediately", () => {
    expect(tipsCardSource).toContain("lastDismissedTip");
    expect(tipsCardSource).toContain("setLastDismissedTip({ ids: [id], label: tip?.title ?? \"Bank tip\" })");
    expect(tipsCardSource).toContain("setLastDismissedTip({ ids: g.tips.map((tip) => tip.id), label: g.label })");
    expect(tipsCardSource).toContain("const restoreLastDismissedTip = () =>");
    expect(tipsCardSource).toContain("for (const id of lastDismissedTip.ids) next.delete(id)");
    expect(tipsCardSource).toContain("Hidden for now:");
    expect(tipsCardSource).toContain("Undo hide");
  });
});
