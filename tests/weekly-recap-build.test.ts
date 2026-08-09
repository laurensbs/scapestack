import { describe, expect, it } from "vitest";
import type { HiscoreSnapshotRow } from "@/lib/hiscore-snapshot-repo";
import type { PinnedGoal } from "@/lib/pinned-goals";
import { buildRecapWeek, goalRemainder, snapshotEvidence } from "@/lib/weekly-recap-build";

function snapshot(takenAt: string, slayerXp: number, zulrahKc = 100): HiscoreSnapshotRow {
  return {
    takenAt,
    skills: {
      overall: { level: 1500, xp: slayerXp + 50_000_000, rank: 100 },
      slayer: { level: 92, xp: slayerXp, rank: 200 }
    },
    bosses: { zulrah: { kc: zulrahKc, rank: 300 } },
    source: "cron"
  };
}

const SLAYER_99: PinnedGoal = {
  key: "level:slayer-99",
  kind: "level",
  target: "99 Slayer",
  spriteItemId: null,
  pinnedAt: "2026-07-01T00:00:00.000Z",
  skill: "slayer",
  targetLevel: 99,
  baseline: {
    capturedAt: "2026-07-01T00:00:00.000Z",
    skills: [{ name: "slayer", level: 91, xp: 6_500_000 }]
  },
  isPrimary: true
};

const WEEK = "2026-08-03";
const NOW = new Date("2026-08-09T18:00:00.000Z");

describe("the week is built from two readings that are actually a week apart", () => {
  it("reports what moved between them", () => {
    const built = buildRecapWeek({
      rsn: "lauky",
      weekStart: WEEK,
      baseline: snapshot("2026-08-02T05:00:00.000Z", 7_000_000, 100),
      closing: snapshot("2026-08-09T05:00:00.000Z", 8_200_000, 112),
      goal: SLAYER_99,
      nextStepUrl: "https://www.scapestack.org/p/lauky",
      now: NOW
    });
    expect(built.skipped).toBeNull();
    expect(built.week?.xpGained).toBe(1_200_000);
    expect(built.week?.kcGained).toEqual({ zulrah: 12 });
    expect(built.week?.goal?.target).toBe("99 Slayer");
    expect(built.week!.goal!.pctAfter).toBeGreaterThan(built.week!.goal!.pctBefore);
  });

  it("refuses a baseline from weeks ago rather than calling it 'this week'", () => {
    // The delta would still compute — and the message would describe a month
    // of progress as a week, which a player notices at once and never trusts
    // again.
    const built = buildRecapWeek({
      rsn: "lauky",
      weekStart: WEEK,
      baseline: snapshot("2026-07-04T05:00:00.000Z", 3_000_000),
      closing: snapshot("2026-08-09T05:00:00.000Z", 8_200_000),
      goal: null,
      nextStepUrl: "https://www.scapestack.org/p/lauky",
      now: NOW
    });
    expect(built.week).toBeNull();
    expect(built.skipped).toBe("baseline-too-old");
  });

  it("refuses a closing reading that is stale", () => {
    const built = buildRecapWeek({
      rsn: "lauky",
      weekStart: WEEK,
      baseline: snapshot("2026-08-02T05:00:00.000Z", 7_000_000),
      closing: snapshot("2026-08-04T05:00:00.000Z", 7_100_000),
      goal: null,
      nextStepUrl: "https://www.scapestack.org/p/lauky",
      now: NOW
    });
    expect(built.week).toBeNull();
    expect(built.skipped).toBe("closing-too-old");
  });

  it("names the skip instead of returning nothing quietly", () => {
    const built = buildRecapWeek({
      rsn: "lauky", weekStart: WEEK, baseline: null,
      closing: snapshot("2026-08-09T05:00:00.000Z", 8_200_000),
      goal: null, nextStepUrl: "https://www.scapestack.org/p/lauky", now: NOW
    });
    expect(built.skipped).toBe("no-baseline");
  });
});

describe("the collection log is only claimed when both sides were read", () => {
  const base = {
    rsn: "lauky", weekStart: WEEK,
    baseline: snapshot("2026-08-02T05:00:00.000Z", 7_000_000),
    closing: snapshot("2026-08-09T05:00:00.000Z", 7_000_000),
    goal: null, nextStepUrl: "https://www.scapestack.org/p/lauky", now: NOW
  };

  it("counts the difference when both syncs exist", () => {
    expect(buildRecapWeek({ ...base, clogBefore: 812, clogAfter: 815 }).week?.clogSlotsGained).toBe(3);
  });

  it("claims nothing on the first sync a player ever makes", () => {
    // With no earlier reading, 815 − nothing is 815, and a brand-new plugin
    // user would be congratulated on banking their entire collection log.
    expect(buildRecapWeek({ ...base, clogBefore: null, clogAfter: 815 }).week?.clogSlotsGained).toBe(0);
  });

  it("never reports a negative week", () => {
    expect(buildRecapWeek({ ...base, clogBefore: 815, clogAfter: 812 }).week?.clogSlotsGained).toBe(0);
  });
});

describe("the remainder is counted in the goal's own units (§3.1)", () => {
  it("gives XP for a level goal, not levels", () => {
    const evidence = snapshotEvidence(snapshot("2026-08-09T05:00:00.000Z", 12_000_000));
    // 99 Slayer is 13,034,431 XP.
    expect(goalRemainder(SLAYER_99, evidence)).toBe("1M XP");
  });

  it("gives KC for a boss goal", () => {
    const goal: PinnedGoal = {
      key: "boss_kc:zulrah-500", kind: "boss_kc", target: "500 Zulrah",
      spriteItemId: null, pinnedAt: "2026-07-01T00:00:00.000Z",
      bossSlug: "zulrah", bossName: "Zulrah", targetKc: 500
    };
    const evidence = snapshotEvidence(snapshot("2026-08-09T05:00:00.000Z", 7_000_000, 188));
    expect(goalRemainder(goal, evidence)).toBe("312 Zulrah KC");
  });

  it("says nothing about a metric the hiscores never carried", () => {
    const goal: PinnedGoal = {
      key: "clog_slots:1000", kind: "clog_slots", target: "1,000 log slots",
      spriteItemId: null, pinnedAt: "2026-07-01T00:00:00.000Z", targetSlots: 1000
    };
    const evidence = snapshotEvidence(snapshot("2026-08-09T05:00:00.000Z", 7_000_000));
    expect(goalRemainder(goal, evidence)).toBeNull();
  });
});

describe("a goal clause needs both ends measurable", () => {
  it("is dropped when the metric needs RuneLite and no sync exists", () => {
    // "0% to your 1,000 log slots" to a player sitting at 812 is worse than
    // saying nothing at all.
    const goal: PinnedGoal = {
      key: "clog_slots:1000", kind: "clog_slots", target: "1,000 log slots",
      spriteItemId: null, pinnedAt: "2026-07-01T00:00:00.000Z", targetSlots: 1000
    };
    const built = buildRecapWeek({
      rsn: "lauky", weekStart: WEEK,
      baseline: snapshot("2026-08-02T05:00:00.000Z", 7_000_000),
      closing: snapshot("2026-08-09T05:00:00.000Z", 8_200_000),
      goal, nextStepUrl: "https://www.scapestack.org/p/lauky", now: NOW
    });
    expect(built.week?.goal).toBeNull();
  });
});
