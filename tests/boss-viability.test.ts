import { describe, expect, it } from "vitest";
import { BOSSES } from "@/lib/bosses";
import {
  bossViabilityDecisionLine,
  bossViabilityFromBankItems,
  bossViabilityFromSimpleBank
} from "@/lib/boss-viability";
import type { BankHandoffItem } from "@/lib/next-bank-handoff";

function boss(slug: string) {
  const found = BOSSES.find((candidate) => candidate.slug === slug);
  if (!found) throw new Error(`Missing boss fixture: ${slug}`);
  return found;
}

function bankItem(id: number, name: string, quantity = 1): BankHandoffItem {
  return {
    id,
    name,
    quantity,
    unitPrice: 0,
    stackValue: 0,
    subtab: "Test",
    slot: null,
    weight: 0
  };
}

describe("boss viability", () => {
  it("keeps Check kill backed by the broad boss list", () => {
    const slugs = new Set(BOSSES.map((entry) => entry.slug));

    expect(BOSSES.length).toBeGreaterThanOrEqual(55);
    expect(Array.from(slugs)).toEqual(expect.arrayContaining([
      "vorkath",
      "zulrah",
      "graardor",
      "nex",
      "callisto",
      "vardorvis",
      "toa",
      "cox",
      "tob",
      "tzkal-zuk",
      "moons-of-peril"
    ]));
  });

  it("blocks boss plans when the bank has no usable weapon", () => {
    const viability = bossViabilityFromSimpleBank([{ id: 995, name: "Coins" }], boss("vorkath"));

    expect(viability?.tone).toBe("blocked");
    expect(viability?.canKill).toBe(false);
    expect(viability?.summary).toContain("No usable weapon");
    expect(viability ? bossViabilityDecisionLine(viability) : "").toContain("Skipped Vorkath");
  });

  it("turns owned gear into a compact test-trip verdict", () => {
    const viability = bossViabilityFromSimpleBank([
      { id: 12926, name: "Toxic blowpipe" },
      { id: 12002, name: "Necklace of anguish" },
      { id: 22109, name: "Ava's assembler" },
      { id: 27229, name: "Masori body (f)" },
      { id: 27232, name: "Masori chaps (f)" },
      { id: 11230, name: "Dragon dart" }
    ], boss("vorkath"));

    expect(viability?.tone).toBe("test");
    expect(viability?.canKill).toBe(true);
    expect(viability?.summary).toContain("Best owned setup: Toxic blowpipe");
    expect(viability?.summary).toContain("missing Salve makes it worse");
    expect(viability?.missing).toContain("Salve amulet(ei)");
    expect(viability?.summary).toContain("DPS");
    expect(viability?.firstTrip).toContain("unlock Salve amulet(ei)");
  });

  it("turns low Zulrah supplies into a useful warning instead of a vague ready state", () => {
    const viability = bossViabilityFromBankItems([
      bankItem(24424, "Tumeken's shadow"),
      bankItem(12899, "Trident of the swamp"),
      bankItem(12926, "Toxic blowpipe"),
      bankItem(12002, "Necklace of anguish"),
      bankItem(12932, "Occult necklace"),
      bankItem(22109, "Ava's assembler"),
      bankItem(11230, "Dragon dart"),
      bankItem(385, "Shark", 2)
    ], boss("zulrah"));

    expect(viability?.canKill).toBe(true);
    expect(viability?.summary).toContain("Your bank supports Zulrah, but supplies are low.");
    expect(viability?.firstTrip).toContain("Restock food and venom protection");
    expect(viability?.missing).toContain("Zulrah supplies");
  });

  it("prefers a sensible mainhand over a marginal godsword DPS edge", () => {
    const viability = bossViabilityFromSimpleBank([
      { id: 4151, name: "Abyssal whip" },
      { id: 11804, name: "Bandos godsword" },
      { id: 11832, name: "Bandos chestplate" },
      { id: 11834, name: "Bandos tassets" },
      { id: 19553, name: "Amulet of torture" },
      { id: 12954, name: "Dragon defender" },
      { id: 7462, name: "Barrows gloves" }
    ], boss("vardorvis"));

    expect(viability?.weaponName).toBe("Abyssal whip");
    expect(viability?.summary).toContain("Abyssal whip");
  });
});
