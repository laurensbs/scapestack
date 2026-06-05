import type { OrganizedItem, OrganizedTab } from "./organizer";

export function bankSearchQueryForItems(items: Array<{ name: string }>, limit = 4): string {
  return items
    .map((item) => item.name.trim())
    .filter(Boolean)
    .slice(0, limit)
    .join(" | ");
}

export function bankSearchTokens(query: string): string[] {
  return query
    .split(/[|,]/)
    .map((token) => token.trim().toLowerCase())
    .filter(Boolean);
}

export function matchesBankSearch(item: OrganizedItem, query: string): boolean {
  const tokens = bankSearchTokens(query);
  if (tokens.length === 0) return true;
  const name = item.name.toLowerCase();
  const subtab = item.subtab.toLowerCase();
  return tokens.some((token) => name.includes(token) || subtab.includes(token) || tokenMatchesItemId(token, item.id));
}

function tokenMatchesItemId(token: string, itemId: number): boolean {
  const normalized = token
    .replace(/\b(?:osrs\s+)?item\s+id\b/g, "")
    .replace(/\bid\b/g, "")
    .replace(/#/g, " ")
    .trim();
  if (!/^\d+(?:\s+\d+)*$/.test(normalized)) return false;
  return normalized.split(/\s+/).includes(String(itemId));
}

export function countBankSearchMatches(tab: OrganizedTab, query: string): number {
  const tokens = bankSearchTokens(query);
  if (tokens.length === 0) return 0;
  return tab.items.reduce((count, item) => count + (matchesBankSearch(item, query) ? 1 : 0), 0);
}

export function firstMatchingBankTabIndex(tabs: OrganizedTab[], query: string): number {
  let bestIndex = -1;
  let bestCount = 0;
  tabs.forEach((tab, index) => {
    const count = countBankSearchMatches(tab, query);
    if (count > bestCount) {
      bestCount = count;
      bestIndex = index;
    }
  });
  return bestIndex;
}
