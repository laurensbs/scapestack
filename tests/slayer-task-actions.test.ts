import { describe, expect, it } from "vitest";
import { buildSlayerTaskActions } from "@/lib/slayer-task-actions";
import { bossFromDpsParam } from "@/lib/dps-route";
import { MONSTERS } from "@/lib/slayer/monsters";
import type { SlayerMonster } from "@/lib/slayer/types";

function monster(overrides: Partial<SlayerMonster> = {}): SlayerMonster {
  return {
    id: "dust_devil",
    name: "Dust devil",
    hp: 105,
    slayerLevel: 65,
    weakness: "crush",
    locations: ["Catacombs of Kourend"],
    cannonable: true,
    isBoss: false,
    ...overrides
  };
}

describe("slayer task actions", () => {
  it("links every Slayer task to the OSRS Wiki and method tags", () => {
    const actions = buildSlayerTaskActions(monster());

    expect(actions.wikiHref).toBe("https://oldschool.runescape.wiki/w/Special:Search?search=Dust%20devil");
    expect(actions.dpsHref).toBeNull();
    expect(actions.tags).toEqual(["weak: crush", "cannon"]);
  });

  it("links boss tasks into the DPS calculator", () => {
    const actions = buildSlayerTaskActions(monster({
      id: "kraken",
      name: "Kraken",
      isBoss: true,
      cannonable: false,
      weakness: "magic"
    }));

    expect(actions.dpsHref).toBe("/dps?boss=kraken&from=slayer-task");
    expect(actions.tags).toEqual(["weak: magic", "boss"]);
  });

  it("marks boss DPS links bankless when Slayer has no bank handoff", () => {
    const actions = buildSlayerTaskActions(monster({
      id: "kraken",
      name: "Kraken",
      isBoss: true,
      cannonable: false,
      weakness: "magic"
    }), {
      hasBankContext: false
    });

    expect(actions.dpsHref).toBe("/dps?boss=kraken&from=slayer-task&bank=none");
  });

  it("carries the RSN into boss DPS links without disabling active bank context", () => {
    const actions = buildSlayerTaskActions(monster({
      id: "kraken",
      name: "Kraken",
      isBoss: true,
      cannonable: false,
      weakness: "magic"
    }), {
      hasBankContext: true,
      rsn: "Zezima"
    });

    expect(actions.dpsHref).toBe("/dps?boss=kraken&from=slayer-task&rsn=Zezima");
  });

  it("keeps Kalphite Queen task links compatible with DPS routing", () => {
    const actions = buildSlayerTaskActions(monster({
      id: "kalphite_queen",
      name: "Kalphite Queen",
      isBoss: true,
      cannonable: false,
      weakness: "stab"
    }));

    expect(actions.dpsHref).toBe("/dps?boss=kalphite-queen&from=slayer-task");
  });

  it("keeps every Slayer boss task link resolvable by the DPS route", () => {
    const bossTasks = MONSTERS.filter((entry) => entry.isBoss);
    expect(bossTasks.length).toBeGreaterThan(0);

    for (const task of bossTasks) {
      const actions = buildSlayerTaskActions(task);
      const bossParam = new URL(`http://local.test${actions.dpsHref}`).searchParams.get("boss");
      expect(bossFromDpsParam(bossParam)?.name, task.name).toBeTruthy();
    }
  });
});
