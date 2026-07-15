import { describe, expect, it } from "vitest";
import {
  accountTimelineMoment,
  accountTimelineMoments,
  type AccountTimelineRecord
} from "@/lib/account-timeline";

function record(overrides: Partial<AccountTimelineRecord> = {}): AccountTimelineRecord {
  return {
    sourceKind: "snapshot",
    sourceKey: "snapshot:1",
    occurredAt: "2026-07-16T10:00:00.000Z",
    data: {},
    ...overrides
  };
}

describe("player-facing account timeline", () => {
  it("turns a mixed snapshot into one concise highest-value moment", () => {
    const moment = accountTimelineMoment(record({
      data: {
        delta: {
          kind: "changed",
          quests: { added: ["Dragon Slayer II"] },
          diaries: { added: [{ region: "Falador", tier: "Hard" }] },
          skills: [],
          bossKc: [],
          collectionLog: { added: [] },
          slayer: { taskId: { changed: false } },
          bank: { status: "unchanged" }
        }
      }
    }));

    expect(moment).toMatchObject({ kind: "quest", title: "Finished Dragon Slayer II" });
    expect(JSON.stringify(moment)).not.toMatch(/payload|signal|data source|reconciliation/i);
  });

  it("uses exact account progress for levels, boss KC and XP without exposing IDs", () => {
    const level = accountTimelineMoment(record({
      data: { delta: changedDelta({ skills: [{ name: "Slayer", level: { before: 89, after: 90, delta: 1 } }] }) }
    }));
    const boss = accountTimelineMoment(record({
      sourceKey: "snapshot:2",
      data: { delta: changedDelta({ bossKc: [{ boss: "Vorkath", movement: { before: 48, after: 50, delta: 2 } }] }) }
    }));
    const xp = accountTimelineMoment(record({
      sourceKey: "snapshot:3",
      data: { delta: changedDelta({ skills: [{ name: "Slayer", level: { before: 90, after: 90, delta: 0 }, xp: { before: 5_000_000, after: 5_180_000, delta: 180_000 } }] }) }
    }));

    expect(level?.title).toBe("Slayer reached 90");
    expect(boss).toMatchObject({ title: "Vorkath: 50 KC", detail: "+2 since the previous RuneLite check" });
    expect(xp?.title).toBe("Gained 180k Slayer XP");
    expect(JSON.stringify([level, boss, xp])).not.toContain("snapshot:");
  });

  it("collapses repeated route skips and ignores unchanged snapshots", () => {
    const skipped = [0, 1, 2].map((minute) => record({
      sourceKind: "trip",
      sourceKey: `trip:${minute}`,
      occurredAt: `2026-07-16T10:0${minute}:00.000Z`,
      data: { eventType: "skipped", title: "Chambers of Xeric" }
    }));
    const unchanged = record({
      sourceKey: "snapshot:unchanged",
      data: { delta: { kind: "unchanged" } }
    });

    expect(accountTimelineMoments([...skipped, unchanged])).toEqual([
      expect.objectContaining({ title: "Skipped Chambers of Xeric 3 times", count: 3 })
    ]);
  });

  it("explains a changed next pick with the concrete reason", () => {
    const moment = accountTimelineMoment(record({
      sourceKind: "decision",
      sourceKey: "decision:8",
      data: { action: "Finish your Dust devil task", reason: "RuneLite found 84 kills left." }
    }));
    expect(moment).toMatchObject({
      kind: "plan",
      title: "Next pick changed to Finish your Dust devil task",
      detail: "RuneLite found 84 kills left."
    });
  });

  it("never falls back to internal recommendation IDs or technical reasons", () => {
    const oldTrip = accountTimelineMoment(record({
      sourceKind: "trip",
      sourceKey: "trip:old",
      data: { eventType: "done", recommendationId: "boss:vorkath:50kc" }
    }));
    const technicalDecision = accountTimelineMoment(record({
      sourceKind: "decision",
      sourceKey: "decision:technical",
      data: { action: "Try Vorkath", reason: "The payload signal changed after data source reconciliation." }
    }));

    expect(oldTrip?.title).toBe("Finished your trip");
    expect(technicalDecision).toMatchObject({ title: "Next pick changed to Try Vorkath" });
    expect(technicalDecision?.detail).toBeUndefined();
    expect(JSON.stringify([oldTrip, technicalDecision])).not.toMatch(/boss:vorkath|payload|signal|data source|reconciliation/i);
  });
});

function changedDelta(overrides: Record<string, unknown>) {
  return {
    kind: "changed",
    quests: { added: [] },
    diaries: { added: [] },
    skills: [],
    bossKc: [],
    collectionLog: { added: [] },
    slayer: { taskId: { changed: false } },
    bank: { status: "unchanged" },
    ...overrides
  };
}
