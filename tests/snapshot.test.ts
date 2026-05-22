import { describe, it, expect } from "vitest";
import { organize } from "@/lib/organizer";
import { buildUseCaseTabs } from "@/lib/use-case-tabs";
import {
  SMALL_MAIN_BANK, MAX_MAIN_BANK, SKILLER_BANK, IRONMAN_BANK
} from "./fixtures/banks";

// Snapshot tests capture the full layout for each fixture bank. When the
// organizer's behaviour intentionally changes, run `npm test -- -u` to
// update the snapshots; check the diff to confirm the changes are what you
// expected.
//
// The shape we snapshot is intentionally minimal — tab name + item names in
// order. We don't snapshot item IDs (because they could drift across wiki
// dumps) or stack values (depend on the GE feed). This keeps the snapshot
// focused on *layout regressions* alone.

async function layoutShape(itemIds: number[]) {
  const result = await organize({ itemIds, includePrices: false });
  const useCase = buildUseCaseTabs(result.tabs);
  return useCase.map((t) => ({
    tab: String(t.name),
    items: t.items.map((it) => it.name)
  }));
}

describe("snapshot — full bank layouts", () => {
  it("MAX_MAIN_BANK", async () => {
    expect(await layoutShape(MAX_MAIN_BANK)).toMatchSnapshot();
  });

  it("SMALL_MAIN_BANK (consolidated tab)", async () => {
    expect(await layoutShape(SMALL_MAIN_BANK)).toMatchSnapshot();
  });

  it("IRONMAN_BANK (consolidated tab)", async () => {
    expect(await layoutShape(IRONMAN_BANK)).toMatchSnapshot();
  });

  it("SKILLER_BANK (consolidated tab)", async () => {
    expect(await layoutShape(SKILLER_BANK)).toMatchSnapshot();
  });
});
