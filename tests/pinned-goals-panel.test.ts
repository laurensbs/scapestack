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

  it("uses Archivo weights by meaning and tracks uppercase labels only", () => {
    const source = readFileSync(
      join(process.cwd(), "src/components/pinned-goals-panel.tsx"),
      "utf8"
    );
    const trackedClassLists = [...source.matchAll(/className="([^"]*\btracking-[^"]*)"/g)]
      .map((match) => match[1]);

    expect(source).toContain("font-normal");
    expect(source).toContain("font-semibold");
    expect(source).not.toMatch(/\bfont-(?:medium|bold|extrabold)\b/);
    expect(trackedClassLists.length).toBeGreaterThan(0);
    for (const classes of trackedClassLists) {
      expect(classes).toContain("uppercase");
    }

    const progressColumnClasses = source.match(
      /<span className="([^"]*tabular-nums[^"]*)">\s*<JournalStatusMark/
    )?.[1] ?? "";
    expect(progressColumnClasses).toContain("tabular-nums");
    // The progress number is data, not a name — it reads at 400 with its
    // data colour; semibold is budgeted to names (page-budget.spec.ts).
    expect(progressColumnClasses).toContain("font-normal");
  });
});
