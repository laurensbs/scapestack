import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  hiscoreDelta,
  snapshotBossesFrom,
  snapshotSkillsFrom,
  type HiscoreSnapshotRow
} from "@/lib/hiscore-snapshot-repo";
import { milestonesFromDelta } from "@/lib/milestone-thresholds";

const read = (file: string) => readFileSync(join(process.cwd(), file), "utf8");

function snapshot(
  skills: Record<string, [level: number, xp: number]>,
  bosses: Record<string, number> = {},
  takenAt = "2026-08-01T00:00:00.000Z"
): HiscoreSnapshotRow {
  return {
    takenAt,
    skills: Object.fromEntries(Object.entries(skills).map(([k, [level, xp]]) => [k, { level, xp, rank: 1 }])),
    bosses: Object.fromEntries(Object.entries(bosses).map(([k, kc]) => [k, { kc, rank: 1 }])),
    source: "cron"
  };
}

describe("the hiscores time series", () => {
  it("drops unranked bosses instead of storing them as zero KC", () => {
    // Jagex reads -1 for unranked. Storing that as 0 would later read as
    // "killed it zero times", a claim the hiscores never made — the same
    // false zero this repo already paid for with the collection log.
    const bosses = snapshotBossesFrom([
      { id: 1, name: "Zulrah", rank: 4000, score: 812 },
      { id: 2, name: "Vorkath", rank: -1, score: -1 }
    ]);
    expect(bosses.zulrah).toEqual({ kc: 812, rank: 4000 });
    expect(bosses).not.toHaveProperty("vorkath");
  });

  it("keeps skill names lowercased so two readings can be compared at all", () => {
    const skills = snapshotSkillsFrom([{ id: 18, name: "Slayer", level: 92, xp: 6_800_000, rank: 50_000 }]);
    expect(skills.slayer).toEqual({ level: 92, xp: 6_800_000, rank: 50_000 });
  });
});

describe("deltas", () => {
  it("reports unknown, not zero, when there is no earlier reading", () => {
    const delta = hiscoreDelta(null, snapshot({ slayer: [92, 6_800_000] }));
    expect(delta.since).toBeNull();
    expect(delta.moved).toBe(false);
  });

  it("counts XP, levels and KC that actually moved", () => {
    const before = snapshot({ slayer: [92, 6_800_000], cooking: [97, 11_000_000] }, { zulrah: 800 });
    const after = snapshot({ slayer: [93, 7_100_000], cooking: [97, 11_000_000] }, { zulrah: 812 });
    const delta = hiscoreDelta(before, after);
    expect(delta.xpGained).toBe(300_000);
    expect(delta.levelsGained).toBe(1);
    expect(delta.levelUps).toEqual([{ skill: "slayer", from: 92, to: 93 }]);
    expect(delta.kcGained).toEqual({ zulrah: 12 });
    expect(delta.moved).toBe(true);
  });

  it("does not count a metric appearing for the first time as a gain", () => {
    // Crossing onto the hiscores is not a 13M XP week. Counting a
    // newly-present skill from zero would report exactly that, and the
    // weekly recap would tell the player something plainly untrue.
    const before = snapshot({ slayer: [92, 6_800_000] });
    const after = snapshot({ slayer: [92, 6_800_000], sailing: [40, 13_000_000] }, { araxxor: 44 });
    const delta = hiscoreDelta(before, after);
    expect(delta.xpGained).toBe(0);
    expect(delta.levelsGained).toBe(0);
    expect(delta.kcGained).toEqual({});
    expect(delta.moved).toBe(false);
  });

  it("never reports a negative gain when a rank or reading regresses", () => {
    const before = snapshot({ slayer: [92, 6_800_000] }, { zulrah: 812 });
    const after = snapshot({ slayer: [92, 6_700_000] }, { zulrah: 800 });
    const delta = hiscoreDelta(before, after);
    expect(delta.xpGained).toBe(0);
    expect(delta.kcGained).toEqual({});
  });
});

describe("milestones are crossings, and only of real in-game things", () => {
  it("fires on the thresholds the spec names, once per crossing", () => {
    const before = snapshot({ slayer: [89, 5_000_000] }, { zulrah: 240 });
    const after = snapshot({ slayer: [92, 6_800_000] }, { zulrah: 260 });
    const found = milestonesFromDelta(before, after, hiscoreDelta(before, after));
    expect(found).toContainEqual({ kind: "level", payload: { skill: "slayer", level: 90 } });
    expect(found).toContainEqual({ kind: "kc_threshold", payload: { boss: "zulrah", kc: 250 } });
    // 60/70/80 were already passed before this window; they are not crossings.
    expect(found.filter((m) => m.kind === "level")).toHaveLength(1);
  });

  it("stays silent without a before — an existing level is not an achievement", () => {
    // The player already had 99 when Scapestack first looked. Announcing it
    // would be the product congratulating someone for its own first read.
    //
    // The delta here is deliberately NON-empty. Passing hiscoreDelta(null, …)
    // made this guard vacuous: that delta is empty by construction, so the
    // assertion held even with the no-before check deleted. The dangerous
    // input is a filled delta arriving with no baseline — a caller that
    // computed gains some other way — and that is what this now feeds it.
    const after = snapshot({ slayer: [99, 13_034_431] }, { zulrah: 1200 });
    const filled = {
      since: null,
      xpGained: 13_034_431,
      levelsGained: 99,
      levelUps: [{ skill: "slayer", from: 1, to: 99 }],
      kcGained: { zulrah: 1200 },
      moved: true
    };
    expect(milestonesFromDelta(null, after, filled)).toEqual([]);
  });

  it("emits no kind the database would reject (PRINCIPLE 1)", () => {
    const before = snapshot({ slayer: [89, 5_000_000] }, { zulrah: 240 });
    const after = snapshot({ slayer: [99, 13_034_431] }, { zulrah: 1100 });
    const allowed = new Set(["level", "kc_threshold", "clog_slot", "ca_tier", "gear_tier_unlocked", "goal_completed", "adventurer_rank_up"]);
    for (const candidate of milestonesFromDelta(before, after, hiscoreDelta(before, after))) {
      expect(allowed.has(candidate.kind), `${candidate.kind} is not an allowed milestone kind`).toBe(true);
    }
  });
});

describe("the daily index Postgres will actually accept", () => {
  const schema = read("src/lib/sync-schema.ts");

  it("never casts a timestamptz to date inside an index expression", () => {
    // `taken_at::date` is STABLE, not IMMUTABLE — it depends on the session
    // TimeZone — and Postgres rejects it in an index outright. This shipped,
    // and because ensureSyncSchema runs statements in order and caches the
    // resulting promise, every statement after it never ran and every later
    // call rejected from the cache. AT TIME ZONE 'UTC' is what makes it
    // immutable, and the day boundary explicit rather than accidental.
    const indexes = schema.match(/CREATE (?:UNIQUE )?INDEX[\s\S]*?;/g) ?? [];
    expect(indexes.length).toBeGreaterThan(0);
    for (const statement of indexes) {
      const casts = statement.match(/\w+::date/g) ?? [];
      for (const cast of casts) {
        expect(statement, `${cast} in an index expression must go through AT TIME ZONE`)
          .toContain("AT TIME ZONE");
      }
    }
  });

  it("upserts against the expression the index is actually built on", () => {
    // ON CONFLICT infers the target by matching the expression textually. A
    // clause that does not match raises "no unique or exclusion constraint
    // matching" at WRITE time — the schema applies fine and the cron dies on
    // its first duplicate day.
    const index = /CREATE UNIQUE INDEX IF NOT EXISTS hiscore_snapshot_daily_idx\s*\n\s*ON hiscore_snapshot\((.*?)\) WHERE source = 'cron';/
      .exec(schema)?.[1];
    expect(index, "the daily index is missing").toBeTruthy();
    const repo = read("src/lib/hiscore-snapshot-repo.ts");
    const conflict = /ON CONFLICT \((.*?)\) WHERE source = 'cron'/.exec(repo)?.[1];
    expect(conflict, "the daily upsert is missing").toBeTruthy();
    expect(conflict).toBe(index);
  });
});

describe("the cron is a good citizen and a closed door", () => {
  const route = read("src/app/api/cron/hiscores/route.ts");

  it("refuses to run without CRON_SECRET rather than running open", () => {
    // An unguarded endpoint that fans out requests to Jagex on demand is an
    // abuse vector. Failing closed is the only option that does not depend on
    // trusting the caller.
    expect(route).toContain("const secret = process.env.CRON_SECRET;");
    expect(route).toContain("if (!secret) return false;");
    expect(route).toContain("Bearer ${secret}");
  });

  it("paces itself: a bounded queue, a wall clock, and a jittered pause", () => {
    expect(route).toMatch(/const QUEUE = \d+;/);
    expect(route).toMatch(/const BUDGET_MS = [\d_]+;/);
    expect(route).toContain("PAUSE_MS + Math.random() * JITTER_MS");
    // Serial. Fanning the queue out in parallel is the one change here that
    // would turn a courteous job into a burst against an unmetered public
    // endpoint, and it is easy to make by accident.
    expect(route).not.toMatch(/Promise\.all|Promise\.allSettled/);
  });

  it("skips a silent Jagex instead of writing a flat day", () => {
    // Writing yesterday's numbers again would make the next delta read as
    // "no progress" for a player who may well have played. The rule lives in
    // hiscore-refresh now, because the on-demand path has to obey it too.
    const refresh = read("src/lib/hiscore-refresh.ts");
    expect(refresh).toMatch(/if \(!reachable\) return \{ status: "unreachable" \};/);
    expect(refresh.indexOf('if (!reachable) return { status: "unreachable" };'))
      .toBeLessThan(refresh.indexOf("recordHiscoreSnapshot({"));
  });

  it("has a check that applies the schema to a database", () => {
    // Every schema test in this repo asserts on the SQL as TEXT, and text
    // cannot tell you whether Postgres will accept it. It did not: the daily
    // index was rejected on every apply, which stopped every statement after
    // it from running, and 1,797 green tests said nothing.
    const pkg = JSON.parse(read("package.json")) as { scripts: Record<string, string> };
    expect(pkg.scripts["db:verify"]).toBeTruthy();
    const script = read("scripts/verify-schema-applies.mts");
    // And it must not pass when it verified nothing.
    expect(script).toContain("process.exit(2)");
  });

  it("is scheduled once a day in vercel.json", () => {
    const vercel = JSON.parse(read("vercel.json")) as { crons?: Array<{ path: string; schedule: string }> };
    const cron = vercel.crons?.find((entry) => entry.path === "/api/cron/hiscores");
    expect(cron, "the hiscores cron is not scheduled").toBeTruthy();
    expect(cron!.schedule.split(" ")).toHaveLength(5);
  });
});
