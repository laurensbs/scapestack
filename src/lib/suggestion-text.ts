import type { Suggestion } from "./suggestions";

export interface SuggestionPriority {
  label: string;
  reason: string;
  rank: number;
}

export function getSuggestionPriority(suggestion: Suggestion): SuggestionPriority {
  if (suggestion.tone === "warning") {
    return {
      label: "Fix first",
      reason: "This is likely wasting space, GP, or attention right now.",
      rank: 0
    };
  }

  if ((suggestion.gpImpact ?? 0) >= 25_000_000) {
    return {
      label: "Cash check",
      reason: "High-value capital should either support your next goal or become liquid GP.",
      rank: 1
    };
  }

  if (suggestion.id.includes("decant") || suggestion.id.includes("cleanup") || suggestion.id.includes("coins")) {
    return {
      label: "Quick cleanup",
      reason: "Fast bank-space win with a clear in-game action.",
      rank: 2
    };
  }

  if (suggestion.tone === "win") {
    return {
      label: "Optional win",
      reason: "Useful opportunity, but not blocking your next session.",
      rank: 4
    };
  }

  return {
    label: "Next pass",
    reason: "Worth reviewing after the urgent cleanup is handled.",
    rank: 3
  };
}

export function formatSuggestionActionPlan(suggestion: Suggestion): string {
  const priority = getSuggestionPriority(suggestion);
  const lines = [
    suggestion.title,
    `Priority: ${priority.label} — ${priority.reason}`,
    "",
    suggestion.body,
    suggestion.gpImpact ? `GP impact: ${suggestion.gpImpact.toLocaleString()} gp` : null,
    suggestion.matchedItems?.length
      ? `Matched items: ${suggestion.matchedItems.map((item) => `${item.name} (#${item.id})`).join(", ")}`
      : suggestion.itemIds?.length ? `Matched item IDs: ${suggestion.itemIds.join(", ")}` : null,
    "",
    ...suggestion.steps.map((step, index) => `${index + 1}. ${step}`),
    suggestion.actionHref ? "" : null,
    suggestion.actionHref ? `Guide: ${suggestion.actionHref}` : null
  ].filter((line): line is string => line !== null);

  return lines.join("\n");
}
