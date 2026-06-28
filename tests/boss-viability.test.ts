import { describe, expect, it } from "vitest";
import { BOSSES } from "@/lib/bosses";
import {
  bossViabilityDecisionLine,
  bossViabilityFromSimpleBank
} from "@/lib/boss-viability";

function boss(slug: string) {
  const found = BOSSES.find((candidate) => candidate.slug === slug);
  if (!found) throw new Error(`Missing boss fixture: ${slug}`);
  return found;
}

describe("boss viability", () => {
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
    expect(viability?.summary).toContain("DPS");
    expect(viability?.firstTrip).toContain("Test 1-2 kills");
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
