import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "src/components/bank-result.tsx"), "utf8");

describe("bank toolbar actions", () => {
  it("labels the primary bank action buttons as explicit actions", () => {
    expect(source).toContain('aria-label="Save a local snapshot of this organized bank"');
    expect(source).toContain('aria-label="Copy every organized Bank Tags tab to RuneLite"');
    expect(source).toContain('aria-label="Open next-session recommendations using this bank"');
    expect(source).toContain('aria-label="Smart tidy this organized bank again"');
    expect(source).toContain('aria-label="Customize bank tab order and pinned items"');
    expect(source).toContain('aria-label="Edit pasted bank input"');
  });

  it("uses real non-submit buttons for the toolbar actions", () => {
    expect(source).toContain('<button\n            type="button"\n            onClick={saveCurrentSnapshot}');
    expect(source).toContain('<button\n            type="button"\n            onClick={copyAll}');
    expect(source).toContain('<button type="button" onClick={onEditInput}');
  });

  it("keeps every bank result button as an explicit non-submit action", () => {
    const buttonTags = source.match(/<button\b[\s\S]*?>/g) ?? [];
    const missingType = buttonTags.filter((tag) => !tag.includes('type="button"'));

    expect(buttonTags.length).toBeGreaterThan(40);
    expect(missingType).toEqual([]);
  });
});
