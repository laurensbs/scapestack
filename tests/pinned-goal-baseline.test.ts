import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { GOAL_KEY_PATTERN } from "@/lib/account-pinned-goals-repo";
import { buildPinnedGoalEvidence } from "@/lib/pinned-goal-evidence";
import {
  COMBAT_ACHIEVEMENT_TIER_POINTS,
  createPinnedGoal,
  mergePinnedGoals,
  parsePinnedGoal,
  PINNED_GOAL_CHOICES,
  pinnedGoalBaselineFrom,
  pinnedGoalProgress,
  primaryPinnedGoal,
  withPrimaryPinnedGoal,
  type PinnedGoal,
  type PinnedGoalProgressEvidence
} from "@/lib/pinned-goals";

const read = (file: string) => readFileSync(join(process.cwd(), file), "utf8");

/** 92 Slayer is 6,517,253 XP; 99 is 13,034,431. Halfway is ~9,775,842. */
const SLAYER_92 = 6_517_253;
const SLAYER_99 = 13_034_431;

function evidence(overrides: Partial<PinnedGoalProgressEvidence> = {}): PinnedGoalProgressEvidence {
  return {
    skills: [{ name: "Slayer", level: 92, xp: SLAYER_92 }],
    ...overrides
  };
}

describe("a percentage is measured from goal start, not from zero (§3.1)", () => {
  it("reads 0% on the day a level-92 player pins 99", () => {
    // The whole reason baselines exist. Measured from zero this is 92% done
    // before the player has swung once — the product taking credit for nine
    // years of someone else's play.
    const goal = createPinnedGoal({
      kind: "level",
      skill: "Slayer",
      targetLevel: 99,
      baseline: { capturedAt: "2026-08-09T00:00:00.000Z", skills: [{ name: "Slayer", level: 92, xp: SLAYER_92 }] }
    })!;
    const progress = pinnedGoalProgress(goal, evidence());
    expect(progress.percent).toBe(0);
    expect(progress.fraction).toBe("92/99");
    expect(progress.done).toBe(false);
  });

  it("counts XP, not levels, between the baseline and the target", () => {
    // 92 → 99 Slayer is 6.5M XP. Counted in levels, the first 100k reads as
    // one seventh of the way there.
    const goal = createPinnedGoal({
      kind: "level",
      skill: "Slayer",
      targetLevel: 99,
      baseline: { capturedAt: "2026-08-09T00:00:00.000Z", skills: [{ name: "Slayer", level: 92, xp: SLAYER_92 }] }
    })!;
    const halfway = SLAYER_92 + Math.round((SLAYER_99 - SLAYER_92) / 2);
    const progress = pinnedGoalProgress(goal, evidence({
      skills: [{ name: "Slayer", level: 96, xp: halfway }]
    }));
    expect(progress.percent).toBeGreaterThan(49);
    expect(progress.percent).toBeLessThan(51);
  });

  it("reports unknown, not zero, when the goal has no baseline", () => {
    // A goal pinned before baselines existed cannot be measured. "0%" would be
    // a number the page invented.
    const goal = createPinnedGoal({ kind: "level", skill: "Slayer", targetLevel: 99 })!;
    expect(pinnedGoalProgress(goal, evidence()).percent).toBeNull();
    expect(pinnedGoalProgress(goal, evidence()).fraction).toBe("92/99");
  });

  it("never reports a negative percentage when a reading regresses", () => {
    const goal = createPinnedGoal({
      kind: "level",
      skill: "Slayer",
      targetLevel: 99,
      baseline: { capturedAt: "2026-08-09T00:00:00.000Z", skills: [{ name: "Slayer", level: 92, xp: SLAYER_92 }] }
    })!;
    expect(pinnedGoalProgress(goal, evidence({
      skills: [{ name: "Slayer", level: 92, xp: SLAYER_92 - 50_000 }]
    })).percent).toBe(0);
  });

  it("reads 100% for a goal already met when it was pinned", () => {
    const goal = createPinnedGoal({
      kind: "boss_kc",
      bossSlug: "zulrah",
      targetKc: 100,
      baseline: { capturedAt: "2026-08-09T00:00:00.000Z", bosses: { zulrah: 400 } }
    })!;
    expect(pinnedGoalProgress(goal, evidence({ bossKc: { zulrah: 400 } })).percent).toBe(100);
  });
});

describe("capturing the baseline", () => {
  it("takes the reading the page is already showing", () => {
    const captured = pinnedGoalBaselineFrom(
      evidence({ bossKc: { zulrah: 812 }, clogSlots: 640, caPoints: 900 }),
      "2026-08-09T00:00:00.000Z"
    );
    expect(captured).toEqual({
      capturedAt: "2026-08-09T00:00:00.000Z",
      skills: [{ name: "Slayer", level: 92, xp: SLAYER_92 }],
      bosses: { zulrah: 812 },
      clogSlots: 640,
      caPoints: 900
    });
  });

  it("returns null rather than a baseline of zeroes when nothing was readable", () => {
    // A zeroed baseline is worse than none: every metric would then read as
    // full progress from nothing.
    expect(pinnedGoalBaselineFrom({ skills: [] }, "2026-08-09T00:00:00.000Z")).toBeNull();
  });

  it("drops a baseline whose timestamp is not a timestamp", () => {
    const goal = createPinnedGoal({
      kind: "level",
      skill: "Slayer",
      targetLevel: 99,
      baseline: { capturedAt: "whenever", skills: [{ name: "Slayer", level: 92, xp: 1 }] } as never
    })!;
    expect(goal.baseline).toBeNull();
  });

  it("survives a round trip through storage", () => {
    const goal = createPinnedGoal({
      kind: "level",
      skill: "Slayer",
      targetLevel: 99,
      baseline: { capturedAt: "2026-08-09T00:00:00.000Z", skills: [{ name: "Slayer", level: 92, xp: SLAYER_92 }] }
    })!;
    const reparsed = parsePinnedGoal(JSON.parse(JSON.stringify(goal)));
    expect(reparsed?.baseline?.skills?.[0]).toEqual({ name: "Slayer", level: 92, xp: SLAYER_92 });
  });

  it("is never reset by re-pinning the same goal", () => {
    // The baseline is the moment the player committed. A second click on the
    // same row is not a second commitment, and overwriting it would silently
    // reset the percentage to 0% every time.
    const repo = read("src/lib/account-pinned-goals-repo.ts");
    expect(repo).toContain("ON CONFLICT (account_id, goal_key) DO NOTHING");
    expect(repo).not.toMatch(/DO UPDATE SET[\s\S]{0,120}baseline/);
  });
});

describe("exactly one primary goal (§3.1)", () => {
  const slayer = createPinnedGoal({ kind: "level", skill: "Slayer", targetLevel: 99, pinnedAt: "2026-01-01T00:00:00.000Z" })!;
  const cooking = createPinnedGoal({ kind: "level", skill: "Cooking", targetLevel: 99, pinnedAt: "2026-06-01T00:00:00.000Z" })!;

  it("prefers the marked goal over the oldest pin", () => {
    // The goal bar read goals[0] — the oldest pin, by accident of the sort
    // order — so a goal set months ago outranked the one set this morning.
    const goals = withPrimaryPinnedGoal([slayer, cooking], cooking.key);
    expect(primaryPinnedGoal(goals)?.key).toBe(cooking.key);
  });

  it("falls back to the oldest pin when nothing is marked", () => {
    expect(primaryPinnedGoal([slayer, cooking])?.key).toBe(slayer.key);
  });

  it("clears the previous primary rather than adding a second", () => {
    const goals = withPrimaryPinnedGoal(withPrimaryPinnedGoal([slayer, cooking], slayer.key), cooking.key);
    expect(goals.filter((goal) => goal.isPrimary)).toHaveLength(1);
  });

  it("collapses two primaries when local and server state disagree", () => {
    // The database enforces one per account with a partial unique index, so a
    // set with two is not untidy — the second write fails outright.
    const merged = mergePinnedGoals(
      [{ ...slayer, isPrimary: true } as PinnedGoal],
      [{ ...cooking, isPrimary: true } as PinnedGoal]
    );
    expect(merged.filter((goal) => goal.isPrimary)).toHaveLength(1);
  });

  it("keeps a baseline that only one side of the merge has", () => {
    // One side is often the server and the other localStorage, and only one of
    // them was around when the goal was set.
    const withBaseline = {
      ...slayer,
      baseline: { capturedAt: "2026-01-01T00:00:00.000Z", skills: [{ name: "Slayer", level: 92, xp: SLAYER_92 }] }
    } as PinnedGoal;
    const merged = mergePinnedGoals([{ ...slayer, baseline: null } as PinnedGoal], [withBaseline]);
    expect(merged[0]?.baseline?.capturedAt).toBe("2026-01-01T00:00:00.000Z");
  });
});

describe("the six goal types the picker was missing", () => {
  it("round-trips every one of them", () => {
    const inputs = [
      { kind: "skill_xp", skill: "Slayer", targetXp: 50_000_000 },
      { kind: "boss_kc", bossSlug: "zulrah", targetKc: 500 },
      { kind: "quest", questId: "Monkey Madness I" },
      { kind: "diary", region: "Karamja", tier: "Elite" },
      { kind: "clog_slots", targetSlots: 1_000 },
      { kind: "ca_tier", tier: "Grandmaster" }
    ] as const;
    for (const input of inputs) {
      const goal = createPinnedGoal(input)!;
      expect(goal, `${input.kind} did not build`).toBeTruthy();
      expect(parsePinnedGoal(JSON.parse(JSON.stringify(goal))), `${input.kind} did not survive storage`)
        .toEqual(goal);
    }
  });

  it("measures each of them against its own metric", () => {
    const xp = createPinnedGoal({
      kind: "skill_xp", skill: "Slayer", targetXp: 20_000_000,
      baseline: { capturedAt: "2026-08-09T00:00:00.000Z", skills: [{ name: "Slayer", level: 92, xp: 10_000_000 }] }
    })!;
    expect(pinnedGoalProgress(xp, evidence({ skills: [{ name: "Slayer", level: 95, xp: 15_000_000 }] })).percent).toBe(50);

    const kc = createPinnedGoal({
      kind: "boss_kc", bossSlug: "zulrah", targetKc: 200,
      baseline: { capturedAt: "2026-08-09T00:00:00.000Z", bosses: { zulrah: 100 } }
    })!;
    expect(pinnedGoalProgress(kc, evidence({ bossKc: { zulrah: 150 } })).percent).toBe(50);

    const clog = createPinnedGoal({
      kind: "clog_slots", targetSlots: 1_000,
      baseline: { capturedAt: "2026-08-09T00:00:00.000Z", clogSlots: 500 }
    })!;
    expect(pinnedGoalProgress(clog, evidence({ clogSlots: 750 })).percent).toBe(50);

    const ca = createPinnedGoal({ kind: "ca_tier", tier: "Hard" })!;
    expect(pinnedGoalProgress(ca, evidence({ caPoints: COMBAT_ACHIEVEMENT_TIER_POINTS.Hard })).done).toBe(true);

    const quest = createPinnedGoal({ kind: "quest", questId: "Monkey Madness I" })!;
    expect(pinnedGoalProgress(quest, evidence({ questsCompleted: ["Monkey Madness I"] })).done).toBe(true);

    const diary = createPinnedGoal({ kind: "diary", region: "Karamja", tier: "Elite" })!;
    expect(pinnedGoalProgress(diary, evidence({ diariesCompleted: [{ region: "Karamja", tier: "Elite" }] })).done).toBe(true);
  });

  it("says a metric is unread rather than reporting it as zero", () => {
    // An absent reading is not "you have killed it zero times" — the false
    // zero this repo already paid for with the collection log.
    const kc = createPinnedGoal({ kind: "boss_kc", bossSlug: "zulrah", targetKc: 200 })!;
    expect(pinnedGoalProgress(kc, evidence()).percent).toBeNull();
    expect(pinnedGoalProgress(kc, evidence()).done).toBe(false);

    const clog = createPinnedGoal({ kind: "clog_slots", targetSlots: 1_000 })!;
    expect(pinnedGoalProgress(clog, evidence()).note).toContain("RuneLite");
  });

  it("refuses targets the game cannot reach", () => {
    expect(createPinnedGoal({ kind: "skill_xp", skill: "Slayer", targetXp: 300_000_000 })).toBeNull();
    expect(createPinnedGoal({ kind: "boss_kc", bossSlug: "not-a-boss", targetKc: 100 })).toBeNull();
    expect(createPinnedGoal({ kind: "ca_tier", tier: "Impossible" as never })).toBeNull();
    expect(createPinnedGoal({ kind: "diary", region: "Karamja", tier: "Legendary" as never })).toBeNull();
  });
});

describe("boss KC comes off the hiscores without inventing zeroes", () => {
  it("drops an unranked boss instead of recording it as zero kills", () => {
    // Jagex reads -1 for unranked. Stored as 0 it later reads as "killed it
    // zero times", a claim the hiscores never made — and a goal measured
    // against it would report real progress from a number nobody has.
    const built = buildPinnedGoalEvidence({
      skills: [],
      quests: new Map(),
      activities: [
        { name: "Zulrah", score: 812 },
        { name: "Vorkath", score: -1 }
      ]
    });
    expect(built.bossKc?.zulrah).toBe(812);
    expect(built.bossKc).not.toHaveProperty("vorkath");
  });

  it("leaves boss KC undefined when the hiscores were never read", () => {
    const built = buildPinnedGoalEvidence({ skills: [], quests: new Map() });
    expect(built.bossKc).toBeUndefined();
  });

  it("carries XP alongside the level, or no percentage is computable", () => {
    const built = buildPinnedGoalEvidence({
      skills: [{ id: 1, name: "Slayer", rank: 1, level: 92, xp: SLAYER_92 }],
      quests: new Map()
    });
    expect(built.skills[0]).toEqual({ name: "Slayer", level: 92, xp: SLAYER_92 });
  });
});

describe("a key the database will accept", () => {
  it("guards deletes with the same shape the CHECK allows", () => {
    // Item 1 widened the constraint to the spec's types and left the delete
    // guard on the original three, so every new kind could be pinned and then
    // never removed. The two must be one rule.
    const schema = read("src/lib/sync-schema.ts");
    // The last one wins: the CREATE TABLE still carries the original narrow
    // CHECK, which is dropped and replaced by the widened constraint below it.
    const checks = [...schema.matchAll(/CHECK \(goal_key ~ '(\^.*?\$)'\)/g)].map((match) => match[1]);
    expect(checks.length, "the goal_key CHECK is missing").toBeGreaterThan(0);
    expect(GOAL_KEY_PATTERN.source).toBe(checks.at(-1));
  });

  it("generates no catalogue key the database would reject", () => {
    for (const choice of PINNED_GOAL_CHOICES) {
      expect(GOAL_KEY_PATTERN.test(choice.key), `${choice.key} would be rejected`).toBe(true);
    }
  });

  it("covers every kind the picker can produce", () => {
    const kinds = new Set(PINNED_GOAL_CHOICES.map((choice) => choice.kind));
    for (const kind of ["item", "level", "unlock", "skill_xp", "boss_kc", "clog_slots", "ca_tier"]) {
      expect(kinds.has(kind as never), `${kind} is not offered anywhere in the picker`).toBe(true);
    }
  });
});
