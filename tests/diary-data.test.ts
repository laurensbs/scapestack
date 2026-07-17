import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { DiaryRecord } from "@/lib/diary-db";

const diaries = JSON.parse(
  readFileSync(join(process.cwd(), "data", "diaries.json"), "utf8")
) as Record<string, DiaryRecord>;

describe("Wiki diary task data", () => {
  it("contains exact task lists for all 48 diary tiers", () => {
    expect(Object.keys(diaries)).toHaveLength(12);
    for (const diary of Object.values(diaries)) {
      for (const tier of ["Easy", "Medium", "Hard", "Elite"] as const) {
        expect(diary.tiers[tier].tasks?.length, `${diary.name} ${tier}`).toBeGreaterThan(0);
      }
    }
  });

  it("keeps Karamja Easy as ten concrete actions with stable IDs", () => {
    const tasks = diaries.Karamja.tiers.Easy.tasks ?? [];
    expect(tasks).toHaveLength(10);
    expect(tasks[0]).toMatchObject({
      id: "karamja:easy:1",
      label: "Pick 5 bananas from the plantation located east of the volcano."
    });
    expect(tasks[9]).toMatchObject({
      id: "karamja:easy:10",
      label: "Kill a jogre in the Pothole dungeon."
    });
    expect(tasks[2].requirements).toEqual(expect.arrayContaining(["Mining 40", "Any pickaxe"]));
  });

  it("does not leak Wiki markup into player-facing task labels", () => {
    const labels = Object.values(diaries).flatMap((diary) =>
      Object.values(diary.tiers).flatMap((tier) => tier.tasks?.map((task) => task.label) ?? [])
    );
    expect(labels).not.toContain("");
    for (const label of labels) expect(label).not.toMatch(/\[\[|\{\{|<ref|''/);
  });
});
