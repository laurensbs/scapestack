import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "src/components/bank-result.tsx"), "utf8");

describe("bank search controls", () => {
  it("labels the bank grid search and clear action explicitly", () => {
    expect(source).toContain('htmlFor="bank-grid-search"');
    expect(source).toContain('id="bank-grid-search"');
    expect(source).toContain('name="bank-search"');
    expect(source).toContain('aria-describedby="bank-grid-search-help bank-grid-search-status"');
    expect(source).toContain('placeholder="Search name, tab or #4151…"');
    expect(source).toContain("Search by item name, subtab or exact OSRS item ID like #4151.");
    expect(source).toContain("Paste multiple IDs separated by spaces to find fallback tiles.");
    expect(source).toContain('aria-label="Clear bank item search"');
    expect(source).toContain('data-testid="bank-search-visible-status"');
    expect(source).toContain("Search shows");
    expect(source).toContain("bank item{totalSearchMatches === 1 ? \"\" : \"s\"} across all tabs");
    expect(source).toContain('aria-label="Clear visible bank search results"');
  });

  it("makes subtab filter chips real pressed buttons", () => {
    expect(source).toContain('type="button"');
    expect(source).toContain("aria-pressed={active}");
    expect(source).toContain("Show ${label} bank items");
    expect(source).toContain('role="status" aria-live="polite"');
  });
});
