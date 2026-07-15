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
    const source = readFileSync(join(process.cwd(), "src/components/boss-detail-modal.tsx"), "utf8");

    expect(source).toContain("() => activitySetup ? [] : suggestUpgradesForBoss(owned, boss, dps)");
    expect(source).toContain("Upgrade before camping");
    expect(source).toContain("{u.item.name}");
    expect(source).toContain("+{u.gain.toFixed(2)} DPS");
    expect(source).toContain("href={wikiSearchUrl(u.item.name)}");
    expect(source).toContain("href={wikiPriceUrl(u.item.id)}");
    expect(source).toContain("Open ${u.item.name} on the OSRS Wiki");
    expect(source).toContain("Open ${u.item.name} GE price");
  });
});
