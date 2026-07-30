import { describe, expect, it } from "vitest";
import type { ImmutableSnapshotState } from "@/lib/account-history";
import {
  compareAccountSnapshots,
  type ComparableAccountSnapshot,
  type SnapshotAvailability
} from "@/lib/account-snapshot-delta";
import {
  buildLocalBankPriceObservations,
  buildSyncedBankObservations,
  type BankObservationSnapshot
} from "@/lib/bank-observations";
import type { BankSnapshot } from "@/lib/diff";

const AVAILABLE: SnapshotAvailability = {
  skills: "available",
  quests: "available",
  diaries: "available",
  collectionLog: "available",
  bossKc: "available",
  slayer: "available",
  bank: "available"
};

function state(
  bankItems: ImmutableSnapshotState["bankItems"],
  bossKc: Record<string, number> = { Vorkath: 73 }
): ImmutableSnapshotState {
  return {
    accountType: "normal",
    skills: [{ name: "Ranged", level: 90, xp: 5_346_332 }],
    questsCompleted: ["Dragon Slayer II"],
    diariesCompleted: [],
    collectionLogItemIds: [],
    bossKc,
    bankItems,
    bankStatus: {
      enabled: true,
      itemCount: bankItems.length,
      capturedAt: "2026-07-28T10:00:00.000Z",
      unavailableReason: null
    },
    slayer: null,
    availability: AVAILABLE
  };
}

function snapshot(
  checksum: string,
  capturedAt: string,
  bankItems: ImmutableSnapshotState["bankItems"],
  bossKc?: Record<string, number>
): ComparableAccountSnapshot {
  return { checksum, capturedAt, state: state(bankItems, bossKc) };
}

function series(points: ComparableAccountSnapshot[]): BankObservationSnapshot[] {
  return points.map((point, index) => ({
    checksum: point.checksum,
    capturedAt: point.capturedAt,
    delta: compareAccountSnapshots(index === 0 ? null : points[index - 1], point, {
      now: Date.parse(point.capturedAt)
    })
  }));
}

describe("bank observations use the measured snapshot series", () => {
  it("turns real arithmetic into all four observations and stays silent without evidence", () => {
    const tuesday = snapshot("a".repeat(64), "2026-07-07T10:00:00.000Z", [
      { id: 207, name: "Ranarr weed", quantity: 900 }
    ]);
    const wednesday = snapshot("b".repeat(64), "2026-07-08T10:00:00.000Z", [
      { id: 207, name: "Ranarr weed", quantity: 500 }
    ]);
    const changedSeries = series([tuesday, wednesday]);

    // This is the load-bearing fixture check: the generated delta, not a
    // hand-written lookalike, must actually reach the observation engine.
    expect(changedSeries[1].delta?.bank).toMatchObject({
      status: "changed",
      quantityChanged: [expect.objectContaining({ id: 207, delta: -400 })]
    });
    const habit = buildSyncedBankObservations({
      currentBank: wednesday.state.bankItems,
      snapshots: changedSeries
    });
    expect(habit.observations.map((item) => item.sentence)).toContain(
      "Your ranarr stock dropped 400 since Tuesday."
    );
    expect(habit.observations.find((item) => item.kind === "real-habit")?.arithmetic).toMatchObject({
      beforeQuantity: 900,
      afterQuantity: 500,
      quantityChange: -400
    });

    const flattened = snapshot("c".repeat(64), wednesday.capturedAt, tuesday.state.bankItems);
    const flatSeries = series([tuesday, flattened]);
    expect(flatSeries[1].delta?.bank.status).toBe("unchanged");
    expect(buildSyncedBankObservations({
      currentBank: flattened.state.bankItems,
      snapshots: flatSeries
    }).observations).toEqual([]);

    const firstSync = buildSyncedBankObservations({
      currentBank: tuesday.state.bankItems,
      snapshots: series([tuesday])
    });
    expect(firstSync.observations).toEqual([]);
    expect(firstSync).toMatchObject({ state: "series-too-short" });
    expect(firstSync.explanation).toContain("two snapshots");

    const idleStart = snapshot("d".repeat(64), "2026-07-07T10:00:00.000Z", [
      { id: 12934, name: "Zulrah's scales", quantity: 8_000 },
      { id: 207, name: "Ranarr weed", quantity: 900 }
    ]);
    const idleEnd = snapshot("e".repeat(64), "2026-07-28T10:00:00.000Z", [
      { id: 12934, name: "Zulrah's scales", quantity: 8_000 },
      { id: 207, name: "Ranarr weed", quantity: 500 }
    ]);
    const ranked = buildSyncedBankObservations({
      currentBank: idleEnd.state.bankItems,
      snapshots: series([idleStart, idleEnd])
    }).observations;
    expect(ranked.map((item) => item.kind)).toEqual(["dead-stock", "real-habit"]);
    const deadStock = ranked[0];
    expect(deadStock?.sentence).toBe(
      "8,000 Zulrah's scales, untouched for three weeks. That is a blowpipe you have not made."
    );
    expect(deadStock?.arithmetic).toMatchObject({ quantity: 8_000, untouchedDays: 21, untouchedWeeks: 3 });

    const supplyPoints = Array.from({ length: 5 }, (_, index) => snapshot(
      String(index + 1).repeat(64),
      `2026-07-${String(20 + index).padStart(2, "0")}T10:00:00.000Z`,
      [{ id: 2444, name: "Ranging potion(4)", quantity: 10 + index * 4 }],
      { Vorkath: 73 }
    ));
    const boughtUnused = buildSyncedBankObservations({
      currentBank: supplyPoints.at(-1)!.state.bankItems,
      snapshots: series(supplyPoints)
    }).observations.find((item) => item.kind === "bought-unused");
    expect(boughtUnused?.sentence).toBe("You bought Vorkath supplies four times and gained no KC.");
    expect(boughtUnused?.arithmetic).toMatchObject({ purchaseEvents: 4, kcGained: 0 });

    const priceSnapshots: BankSnapshot[] = [
      {
        ts: Date.parse("2026-07-20T10:00:00.000Z"),
        items: Array.from({ length: 40 }, (_, index) => ({
          id: 10_000 + index,
          name: `Priced item ${index + 1}`,
          quantity: 1,
          stackValue: 437_500
        }))
      },
      {
        ts: Date.parse("2026-07-28T10:00:00.000Z"),
        items: Array.from({ length: 40 }, (_, index) => ({
          id: 10_000 + index,
          name: `Priced item ${index + 1}`,
          quantity: 1,
          stackValue: 490_000
        }))
      }
    ];
    const priceMovement = buildLocalBankPriceObservations(priceSnapshots).observations[0];
    expect(priceMovement?.sentence).toBe(
      "40 items in your bank moved up 12% while you were away: 2.1m."
    );
    expect(priceMovement?.arithmetic).toMatchObject({
      itemCount: 40,
      valueBefore: 17_500_000,
      valueAfter: 19_600_000,
      valueChange: 2_100_000,
      percentChange: 12
    });
  });
});
