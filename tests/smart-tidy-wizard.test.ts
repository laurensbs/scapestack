import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "src/components/bank-result.tsx"), "utf8");

describe("Smart Tidy wizard", () => {
  it("has the guided Smart Tidy states and player-facing setup choices", () => {
    expect(source).toContain('type SmartTidyStage = "closed" | "choosing" | "preview" | "applying" | "applied"');
    expect(source).toContain("function SmartTidyWizard");
    expect(source).toContain("How do you mostly play?");
    expect(source).toContain("What should be first?");
    expect(source).toContain("PvM");
    expect(source).toContain("Ironman");
    expect(source).toContain("Skilling");
    expect(source).toContain("Questing");
    expect(source).toContain("Minimal");
    expect(source).toContain("Gear");
    expect(source).toContain("Teleports");
    expect(source).toContain("Supplies");
    expect(source).toContain("Current grind");
  });

  it("uses OSRS tab presets and shows real item sprites in the preview", () => {
    expect(source).toContain("SMART_TIDY_PRESETS");
    expect(source).toContain('helper: "PvM gear first"');
    expect(source).toContain('helper: "Quest items kept together"');
    expect(source).toContain('helper: "Teleports, gear, supplies"');
    expect(source).toContain("Before / after preview");
    expect(source).toContain("Current bank");
    expect(source).toContain("Proposed layout");
    expect(source).toContain("<SmartTidyTabPreview");
    expect(source).toContain("tab.items.slice(0, 6).map");
    expect(source).toContain("spriteIdForItem(item.id, item.quantity)");
  });

  it("applies through the existing smart reorganize path and leaves copy as the next step", () => {
    expect(source).toContain('reorganizeTabs(tabs, "smart", preset.archetype)');
    expect(source).toContain("buildUseCaseTabs(smartTabs, preset.archetype)");
    expect(source).toContain("function buildSmartTidyLayout");
    expect(source).toContain("const applySmartTidyLayout");
    expect(source).toContain('tabMode: "useCase"');
    expect(source).toContain('setViewSort("smart")');
    expect(source).toContain("setUserBucketOverrides(new Map())");
    expect(source).toContain("void refreshStrings(next)");
    expect(source).toContain("Apply layout");
    expect(source).toContain("Try another setup");
    expect(source).toContain("Copy tabs to RuneLite");
  });

  it("opens Smart Tidy from the bank action instead of running a bare sort button", () => {
    expect(source).toContain("const openSmartTidyWizard = useCallback");
    expect(source).toContain('setSmartTidyStage((stage) => stage === "closed" ? "choosing" : stage)');
    expect(source).toContain("onTidy={openSmartTidyWizard}");
    expect(source).toContain("openSmartTidyWizard();");
  });

  it("keeps sparse bank layouts compact instead of rendering items far down the grid", () => {
    expect(source).toContain("const shouldDensePackSparseLayout");
    expect(source).toContain("maxSlot + 1 > Math.max(GRID_ROWS_MIN * GRID_COLS, items.length * 4)");
    expect(source).toContain("? Object.fromEntries(items.map((item, index) => [index, item.id]))");
  });
});
