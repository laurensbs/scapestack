import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "src/components/boss-picker.tsx"), "utf8");

describe("Boss picker affordance", () => {
  it("exposes the dropdown as a labelled boss setup dialog", () => {
    expect(source).toContain('const pickerId = "boss-picker-dialog";');
    expect(source).toContain("Choose boss for DPS setup. Current boss:");
    expect(source).toContain('aria-haspopup="dialog"');
    expect(source).toContain("aria-controls={open ? pickerId : undefined}");
    expect(source).toContain("aria-expanded={open}");
    expect(source).toContain("role=\"dialog\"");
    expect(source).toContain('aria-label="Choose boss for DPS setup"');
  });

  it("labels boss search, result status and clear action", () => {
    expect(source).toContain('const searchId = "boss-picker-search";');
    expect(source).toContain('const statusId = "boss-picker-status";');
    expect(source).toContain("Search bosses in picker");
    expect(source).toContain('name="boss-picker-search"');
    expect(source).toContain('autoComplete="off"');
    expect(source).toContain("spellCheck={false}");
    expect(source).toContain("aria-describedby={statusId}");
    expect(source).toContain('role="status"');
    expect(source).toContain("bosses available");
    expect(source).toContain('aria-label="Clear boss picker search"');
  });

  it("renders each boss option as an explicit selectable control", () => {
    expect(source).toContain("aria-pressed={isSelected}");
    expect(source).toContain('aria-label={`${isSelected ? "Selected" : "Select"} ${boss.name}');
    expect(source).toContain("`, ${boss.hp} HP`");
    expect(source).not.toContain('title="Clear"\\n              >');
  });
});
