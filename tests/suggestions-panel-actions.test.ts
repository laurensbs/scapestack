import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "src/components/suggestions-panel.tsx"), "utf8");

describe("suggestions panel actions", () => {
  it("does not fail silently when copying suggestion steps is blocked", () => {
    expect(source).toContain("const actionPlanText = formatSuggestionActionPlan(suggestion)");
    expect(source).toContain('useState<"idle" | "copied" | "error">("idle")');
    expect(source).toContain("setManualCopyText(actionPlanText)");
    expect(source).toContain("Copy failed");
    expect(source).toContain("Clipboard failed — copy manually");
    expect(source).toContain("event.currentTarget.select()");
    expect(source).toContain("Manual copy fallback for");
  });

  it("lets users undo a dismissed suggestion immediately", () => {
    expect(source).toContain("lastDismissed");
    expect(source).toContain("setLastDismissed(suggestion ? { id, title: suggestion.title } : { id, title: \"Suggestion\" })");
    expect(source).toContain("const restoreLastDismissed = () =>");
    expect(source).toContain("dismissed.filter((dismissedId) => dismissedId !== lastDismissed.id)");
    expect(source).toContain("persistList(DISMISSED_KEY, next)");
    expect(source).toContain("localStorage.removeItem(key)");
    expect(source).toContain("Hidden for now:");
    expect(source).toContain("Undo hide");
    expect(source).toContain("aria-label={`Restore hidden suggestion ${lastDismissed.title}`}");
  });

  it("lets users mark suggestions done without dismissing them as irrelevant", () => {
    expect(source).toContain('const COMPLETED_KEY = "scapestack-bank:completed-suggestions"');
    expect(source).toContain("const [completed, setCompleted]");
    expect(source).toContain("!completed.includes(s.id)");
    expect(source).toContain("const complete = (id: string) =>");
    expect(source).toContain("setLastCompleted(suggestion ? { id, title: suggestion.title } : { id, title: \"Suggestion\" })");
    expect(source).toContain("persistList(COMPLETED_KEY, next)");
    expect(source).toContain("Marked done for now:");
    expect(source).toContain("Undo done");
    expect(source).toContain("aria-label={`Restore completed suggestion ${lastCompleted.title}`}");
    expect(source).toContain("aria-label={`Mark ${title} done for now from quick actions`}");
    expect(source).toContain("aria-label={`Mark ${title} done for now`}");
    expect(source).toContain("Mark done");
    expect(source).toContain("Restore {hiddenCount} hidden/done");
    expect(source).toContain("aria-label={`Restore ${hiddenCount} hidden or completed smart suggestions`}");
    expect(source).toContain('aria-label="Restore every hidden or completed smart suggestion"');
  });

  it("passes the suggestion title into bank search feedback", () => {
    expect(source).toContain("onSearchItems?: (query: string, sourceLabel?: string) => void");
    expect(source).toContain("onClick={() => onSearchItems(bankSearchQuery, title)}");
    expect(source).toContain("Find in bank");
    expect(source).toContain("aria-label={`Find affected bank items for ${title}`}");
    expect(source).toContain("Jump to items");
    expect(source).toContain("aria-label={`Jump to affected bank items for ${title}`}");
  });

  it("orders and labels suggestions by OSRS-player priority", () => {
    expect(source).toContain("getSuggestionPriority");
    expect(source).toContain(".sort((a, b) => getSuggestionPriority(a).rank - getSuggestionPriority(b).rank)");
    expect(source).toContain("const priority = getSuggestionPriority(suggestion)");
    expect(source).toContain("{priority.label}");
    expect(source).toContain("title={priority.reason}");
  });

  it("explains each suggestion before asking for action", () => {
    expect(source).toContain("const primaryAction = actionHref ? (actionLabel ?? \"Open guide\") : \"Use action plan\"");
    expect(source).toContain("const matchedItemCopy = matchedItems.length === 1 ? \"1 matched item\" : `${matchedItems.length} matched items`");
    expect(source).toContain("Why now");
    expect(source).toContain("<span title={priority.reason}>{priority.reason}</span>");
    expect(source).toContain("Do next");
    expect(source).toContain("{primaryAction}");
    expect(source).toContain("aria-label={matchedItemCopy}");
    expect(source).toContain("{formatGp(gpImpact)} gp impact");
    expect(source).toContain("aria-label={`Open primary guide for ${title}`}");
  });

  it("names every suggestion card action with its suggestion title", () => {
    expect(source).toContain('aria-label="Smart bank suggestions"');
    expect(source).toContain("aria-label={`Smart suggestion: ${title}`}");
    expect(source).toContain("aria-label={`Open ${actionLabel ?? \"guide\"} for ${title}`}");
    expect(source).toContain("aria-label={`Copy action steps for ${title}`}");
    expect(source).toContain("aria-label={`Mark ${title} not relevant`}");
    expect(source).toContain("title={`Dismiss ${title}`}");
    expect(source).toContain("aria-label={`Dismiss ${title} suggestion`}");
  });
});
