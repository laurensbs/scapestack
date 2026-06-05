import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildDpsUpgradeBuyLine } from "@/lib/dps-upgrade-actions";

describe("DPS upgrade actions", () => {
  it("builds an item-ID exact buy line for one upgrade", () => {
    expect(buildDpsUpgradeBuyLine({
      id: 26219,
      name: "Osmumten's fang",
      slot: "weapon",
      dpsGain: 2.346,
      scope: "vs current setup",
      wikiUrl: "https://oldschool.runescape.wiki/w/Osmumten%27s_fang",
      geUrl: "https://prices.runescape.wiki/osrs/item/26219"
    })).toBe(
      "Osmumten's fang (#26219) — Slot: weapon — DPS gain: +2.3 vs current setup — Wiki: https://oldschool.runescape.wiki/w/Osmumten%27s_fang — GE: https://prices.runescape.wiki/osrs/item/26219"
    );
  });

  it("keeps DPS upgrade cards clickable and item-ID visible", () => {
    const source = readFileSync(join(process.cwd(), "src/app/dps/dps-client.tsx"), "utf8");

    expect(source).toContain("buildDpsUpgradeBuyLine");
    expect(source).toContain("copiedUpgradeItem");
    expect(source).toContain("#{upgrade.gear.id} · {upgrade.gear.slot}");
    expect(source).toContain("Copy buy line");
    expect(source).toContain("copyUpgradeBuyLine(upgrade)");
    expect(source).toContain("Copy ${upgrade.gear.name} item ID ${upgrade.gear.id} DPS upgrade buy line");
    expect(source).toContain("Open ${upgrade.gear.name} item ID ${upgrade.gear.id} on the OSRS Wiki");
    expect(source).toContain("Open ${upgrade.gear.name} item ID ${upgrade.gear.id} GE price on the OSRS Wiki");
  });
});
