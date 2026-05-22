// Named bank fillers: a missing set piece / pipeline step shows its name on
// the filler tile. Guards buildPvmGearLayout / buildPotionsLayout fillerLabels.
import { describe, it, expect } from "vitest";
import { organize } from "@/lib/organizer";
import { buildUseCaseTabs } from "@/lib/use-case-tabs";

const pad = (n: number) => Array.from({ length: n }, (_, i) => 1600 + i);

describe("named bank fillers", () => {
  it("a missing set piece is named on its filler", async () => {
    // Dharok's helm + platebody owned, platelegs missing.
    const ids = [4716, 4720, 11832, 11834, 11826, 11828, ...pad(70)];
    const r = await organize({ itemIds: ids, includePrices: false });
    const gear = buildUseCaseTabs(r.tabs).find((t) => String(t.name) === "PvM Gear");
    expect(gear).toBeDefined();
    const labels = Object.values(gear!.fillerLabels ?? {});
    expect(labels).toContain("Dharok's platelegs");
  });

  it("fillerLabels is keyed by the same slot index as layout", async () => {
    const ids = [4716, 4720, 11832, 11834, 11826, 11828, ...pad(70)];
    const r = await organize({ itemIds: ids, includePrices: false });
    const gear = buildUseCaseTabs(r.tabs).find((t) => String(t.name) === "PvM Gear");
    const fl = gear!.fillerLabels ?? {};
    // Every labelled slot must actually hold a filler in the layout.
    const { BANK_FILLER_ID } = await import("@/lib/bank-filler");
    for (const slot of Object.keys(fl)) {
      expect(gear!.layout[Number(slot)]).toBe(BANK_FILLER_ID);
    }
  });
});
