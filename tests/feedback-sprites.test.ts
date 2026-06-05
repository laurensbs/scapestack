import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const dropCelebrationSource = readFileSync(join(process.cwd(), "src/components/drop-celebration.tsx"), "utf8");
const diffBannerSource = readFileSync(join(process.cwd(), "src/components/diff-banner.tsx"), "utf8");

describe("feedback component sprites", () => {
  it("uses ItemSprite fallback handling for drop celebrations and bank diffs", () => {
    for (const source of [dropCelebrationSource, diffBannerSource]) {
      expect(source).toContain('import { ItemSprite } from "@/components/item-sprite";');
      expect(source).toContain("<ItemSprite");
      expect(source).not.toContain("ICON_URL");
    }
  });

  it("explains why the drop celebration appeared without implying server storage", () => {
    expect(dropCelebrationSource).toContain("New since last visit");
    expect(dropCelebrationSource).toContain("Detected from your Bank Memory item names");
    expect(dropCelebrationSource).toContain("browser-only saved bank");
  });
});
