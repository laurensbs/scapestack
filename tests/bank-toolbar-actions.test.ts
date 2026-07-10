import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "src/components/bank-result.tsx"), "utf8");

describe("bank toolbar actions", () => {
  it("labels the primary bank action buttons as explicit actions", () => {
    expect(source).toContain('ariaLabel: "Smart tidy this organized bank again"');
    expect(source).toContain('ariaLabel: "Copy cleaned bank tabs to RuneLite"');
    expect(source).toContain('aria-label={`${decision.primaryLabel}: ${decision.title}`}');
    expect(source).toContain('aria-label={`${decision.secondaryLabel}: ${decision.title}`}');
    expect(source).toContain("Copy export instead");
    expect(source).toContain("Open next trip");
    expect(source).toContain('aria-label="Edit pasted bank input"');
  });

  it("uses real non-submit buttons for the toolbar actions", () => {
    expect(source).toContain('<button\n            type="button"\n            onClick={() => onPrimary(decision.primaryAction)}');
    expect(source).toContain('<button\n            type="button"\n            onClick={() => secondaryQuickAction.action === "tidy" ? onTidy() : onPrimary("copy")}');
    expect(source).toContain('<button\n                type="button"\n                onClick={onEditInput}');
  });

  it("keeps every bank result button as an explicit non-submit action", () => {
    const buttonTags = source.match(/<button\b[\s\S]*?>/g) ?? [];
    const missingType = buttonTags.filter((tag) => !tag.includes('type="button"'));

    expect(buttonTags.length).toBeGreaterThan(40);
    expect(missingType).toEqual([]);
  });
});
