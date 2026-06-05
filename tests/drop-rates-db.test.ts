import { describe, expect, it } from "vitest";
import { getDropRates } from "@/lib/drop-rates-db";

describe("raid drop rate data", () => {
  it("uses KC-equivalent raid rates instead of raw unique-table weights", async () => {
    const tables = await getDropRates();
    const cox = tables.get("Chambers of Xeric");
    const tob = tables.get("Theatre of Blood");
    const toa = tables.get("Tombs of Amascut");

    expect(cox?.drops.find((drop) => drop.name === "Twisted bow")).toMatchObject({
      denom: 998,
      rarity: "~1/998 raids at 30k pts"
    });
    expect(cox?.drops.find((drop) => drop.name === "Kodai insignia")?.denom)
      .toBeLessThan(2_000);
    expect(tob?.drops.find((drop) => drop.name === "Ghrazi rapier")).toMatchObject({
      denom: 346,
      rarity: "~1/346 personal 4-man KC"
    });
    expect(toa?.drops.find((drop) => drop.name === "Elidinis' ward")).toMatchObject({
      denom: 424,
      rarity: "~1/424 solo 150s"
    });
  });
});
