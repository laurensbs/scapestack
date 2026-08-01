import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { searchPinnedGoalChoices } from "@/lib/pinned-goals";

describe("pinned goal picker", () => {
  it("searches in player language and pins directly from 64px tiles", () => {
    const source = readFileSync(
      join(process.cwd(), "src/components/pinned-goals-panel.tsx"),
      "utf8"
    );

    expect(searchPinnedGoalChoices("barrows")[0]?.target).toBe("Barrows gloves");
    expect(searchPinnedGoalChoices("bgloves")[0]?.target).toBe("Barrows gloves");
    expect(searchPinnedGoalChoices("99 slay")[0]?.target).toBe("99 Slayer");
    expect(searchPinnedGoalChoices("fairy")[0]?.target).toBe("Fairy rings");
    expect(source).toContain('type="search"');
    expect(source).toContain("size-16");
    expect(source).toContain("onClick={() => onPin(choice)}");
    expect(source).not.toContain("Pin goal");
    expect(source).not.toContain("progressbar");
  });
});
