// task-id mapping tests. Het meeste hier is shape-validatie zodat we
// niet per ongeluk een onbekende monster.id slug in de tabel zetten
// (anders zou de UI proberen te filteren op een non-existent monster).

import { describe, it, expect } from "vitest";
import { TASK_ID_TO_MONSTER, mapBlockTaskIds, mapBlockTaskNames, resolveSlayerTaskMonsterId } from "@/lib/slayer/task-ids";
import { MONSTERS_BY_ID } from "@/lib/slayer/monsters";

describe("TASK_ID_TO_MONSTER", () => {
  it("geen duplicate task-IDs (geen sleutel-collisie)", () => {
    const ids = Object.keys(TASK_ID_TO_MONSTER);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("80%+ van de mapped slugs bestaan in MONSTERS", () => {
    // Sommige task-IDs verwijzen naar monsters die we (nog) niet in
    // monsters.ts hebben (cow, dwarf, hobgoblin, black_demon, ...).
    // Die zijn niet stuk maar wel een TODO. Test eist dat de meeste
    // er wel zijn — anders is de tabel waarschijnlijk fout.
    const slugs = Object.values(TASK_ID_TO_MONSTER);
    const found = slugs.filter((s) => MONSTERS_BY_ID.has(s)).length;
    expect(found / slugs.length).toBeGreaterThan(0.80);
  });

  it("alle slugs zijn lower-snake (geen rommel)", () => {
    for (const slug of Object.values(TASK_ID_TO_MONSTER)) {
      expect(slug).toMatch(/^[a-z][a-z0-9_]*$/);
    }
  });
});

describe("canonical Slayer task names", () => {
  it("uses the game task name when the old raw ID is unknown", () => {
    expect(resolveSlayerTaskMonsterId("Dust devils", 138)).toBe("dust_devil");
  });

  it("normalizes named block-list entries", () => {
    expect(mapBlockTaskNames(["Black bears", "Greater demons", "Greater demons"]))
      .toEqual(["bear", "greater_demon"]);
  });

  it("keeps old known IDs as a compatibility fallback", () => {
    expect(resolveSlayerTaskMonsterId(null, 19)).toBe("dust_devil");
  });
});

describe("mapBlockTaskIds", () => {
  it("vertaalt bekende IDs naar slugs", () => {
    // 61 = abyssal_demon, 70 = dagannoth volgens onze tabel
    expect(mapBlockTaskIds([61, 70])).toEqual(["abyssal_demon", "dagannoth"]);
  });

  it("filtert onbekende IDs stilletjes weg", () => {
    expect(mapBlockTaskIds([999_999, 61])).toEqual(["abyssal_demon"]);
  });

  it("ontdubbelt slugs (twee IDs die op zelfde monster mappen)", () => {
    // ID 14 = cockatrice; ID 14 nog eens → maar één output
    expect(mapBlockTaskIds([14, 14])).toEqual(["cockatrice"]);
  });

  it("lege input → lege output", () => {
    expect(mapBlockTaskIds([])).toEqual([]);
  });
});
