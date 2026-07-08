import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "src/components/bank-result.tsx"), "utf8");

describe("bank import warning UI", () => {
  it("tells players when pasted item IDs are kept as fallbacks", () => {
    expect(source).toContain("initial.importWarnings.fallbackItemCount > 0 || initial.importWarnings.duplicateItemCount > 0");
    expect(source).toContain("Import note");
    expect(source).toContain("Imported");
    expect(source).toContain("Collapsed");
    expect(source).toContain("duplicate ID");
    expect(source).toContain("Some newer/unknown item IDs were kept as fallback tiles.");
    expect(source).toContain("Check first ID on Wiki");
    expect(source).toContain("OSRS item ID");
    expect(source).toContain("const fallbackItemSearchQuery = useMemo(");
    expect(source).toContain('() => initial.importWarnings.fallbackItemIds.slice(0, 12).join(" ")');
    expect(source).toContain('onClick={() => searchSuggestionItems(fallbackItemSearchQuery, "fallback item IDs")}');
    expect(source).toContain('aria-label="Show fallback item IDs in the bank grid"');
    expect(source).toContain("Show in bank");
    expect(source).not.toContain("initial.importWarnings.fallbackItemIds.slice(0, 6).map((id) => (");
    expect(source).not.toContain("initial.importWarnings.ignoredItemCount > 0");
  });
});
