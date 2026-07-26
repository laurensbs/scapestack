import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { detectAccountStage } from "@/lib/account-stage";
import { GAME_UPDATES, QUEST_RELEASES, updatesSince } from "@/lib/game-updates";
import { getQuests } from "@/lib/quest-db";
import { classifyAbsence, describeAbsenceLength, latestActivity } from "@/lib/returning-player";
import type { HiscoreSkill } from "@/lib/hiscores";

const source = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

const NOW = Date.parse("2026-07-25T12:00:00Z");
const daysAgo = (days: number) => new Date(NOW - days * 86_400_000).toISOString();

const SKILL_NAMES = [
  "Attack", "Defence", "Strength", "Hitpoints", "Ranged", "Prayer", "Magic",
  "Cooking", "Woodcutting", "Fletching", "Fishing", "Firemaking", "Crafting",
  "Smithing", "Mining", "Herblore", "Agility", "Thieving", "Slayer", "Farming",
  "Runecraft", "Hunter", "Construction"
];

function skillsAt(level: number): HiscoreSkill[] {
  return SKILL_NAMES.map((name, id) => ({ id, name, level, xp: 737_627, rank: 1 }));
}

describe("absence bands", () => {
  it("returns unknown rather than guessing when WOM has no timestamp", () => {
    expect(classifyAbsence(null, NOW).band).toBe("unknown");
    expect(classifyAbsence("not a date", NOW).band).toBe("unknown");
    expect(classifyAbsence(undefined, NOW).days).toBeNull();
  });

  it("separates a quiet week from a real absence", () => {
    expect(classifyAbsence(daysAgo(2), NOW).band).toBe("active");
    expect(classifyAbsence(daysAgo(10), NOW).band).toBe("brief");
    expect(classifyAbsence(daysAgo(45), NOW).band).toBe("lapsed");
    expect(classifyAbsence(daysAgo(150), NOW).band).toBe("long");
    expect(classifyAbsence(daysAgo(800), NOW).band).toBe("dormant");
  });

  it("reads a timestamp from the future as playing right now", () => {
    // WOM's clock can land ahead of ours. A negative gap must never wrap into
    // an enormous absence somewhere downstream.
    const ahead = new Date(NOW + 60_000).toISOString();
    expect(classifyAbsence(ahead, NOW).days).toBe(0);
    expect(classifyAbsence(ahead, NOW).band).toBe("active");
  });

  it("rounds the length down so it never overstates the gap", () => {
    expect(describeAbsenceLength(1)).toBe("1 day");
    expect(describeAbsenceLength(20)).toBe("2 weeks");
    expect(describeAbsenceLength(179)).toBe("5 months");
    expect(describeAbsenceLength(365)).toBe("1 year");
    expect(describeAbsenceLength(400)).toBe("1 year and 1 month");
    expect(describeAbsenceLength(null)).toBeNull();
  });

  it("never prints a month count of twelve or more", () => {
    // Regression: years were carved off in 365-day units and the remainder in
    // 30-day ones, so the remainder hit 12 whenever it reached 360. The result
    // was "1 year and 12 months" — self-contradictory, and it fired for five
    // days out of every year.
    for (let days = 0; days <= 4_000; days += 1) {
      const label = describeAbsenceLength(days);
      expect(label, `${days} days`).not.toMatch(/\b(?:1[2-9]|[2-9]\d) months?\b/);
    }
    expect(describeAbsenceLength(725)).toBe("1 year and 11 months");
    expect(describeAbsenceLength(360)).toBe("11 months");
  });
});

describe("a stale Wise Old Man record cannot outvote a real sync", () => {
  // WOM only advances lastChangedAt when something triggers an update of that
  // profile, and Scapestack only ever GETs. A player who logs in daily but whom
  // nobody tracks carries a months-old timestamp; telling them they had been
  // gone since spring is the worst kind of wrong, because they know better.
  it("takes the freshest signal across sources", () => {
    expect(latestActivity(daysAgo(150), daysAgo(2))).toBe(daysAgo(2));
    expect(latestActivity(daysAgo(2), daysAgo(150))).toBe(daysAgo(2));
    expect(latestActivity(null, undefined)).toBeNull();
    expect(latestActivity(null, daysAgo(9))).toBe(daysAgo(9));
    expect(latestActivity("nonsense", daysAgo(9))).toBe(daysAgo(9));
  });

  it("combines both signals on /next rather than trusting WOM alone", () => {
    const page = source("src/app/next/page.tsx");
    expect(page).toContain("latestActivity(");
    expect(page).toContain("scapestackSync?.syncedAt");
  });
});

describe("the returning stage is a detection, not the bottom of the ladder", () => {
  // detectAccountStage calls classifyAbsence without a clock, so it reads real
  // wall time while daysAgo() is anchored to a fixed NOW. Left alone, the
  // six-day case below silently becomes a thirty-day case on 2026-08-18 and the
  // suite starts failing for reasons unrelated to any commit. Freeze it.
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  function stage(overrides: Partial<Parameters<typeof detectAccountStage>[0]> = {}) {
    return detectAccountStage({
      skills: skillsAt(70),
      combatLevel: 90,
      totalLevel: 1_583,
      questPoints: null,
      bossKc: {},
      hasBankContext: false,
      hasPluginSync: false,
      ...overrides
    });
  }

  const away = (lastChangedAt: string | null) => ({
    displayName: "Test",
    accountType: "regular" as const,
    ehp: 300,
    ehb: 10,
    lastChangedAt
  });

  it("labels a mid-level account that has been gone for months as returning", () => {
    // Regression: this exact account read "Midgame main" — the same label as
    // someone who logged out an hour ago — because `returning` sat at the end
    // of the ladder behind a 1900 total-level gate it could never pass.
    expect(stage({ accountMeta: away(daysAgo(150)) }).id).toBe("returning");
  });

  it("does not call a player who was away a week returning", () => {
    expect(stage({ accountMeta: away(daysAgo(6)) }).id).toBe("midgame-main");
  });

  it("does not fall back to returning when the absence is unknown", () => {
    expect(stage({ accountMeta: away(null) }).id).toBe("midgame-main");
    expect(stage({ accountMeta: null }).id).toBe("midgame-main");
    // The old fallback fired on total level alone, so a 1900+ account with no
    // absence signal at all was called "returning".
    expect(stage({ totalLevel: 2_100, accountMeta: null }).id).toBe("midgame-main");
  });

  it("calls an abandoned starter account new, not returning", () => {
    expect(stage({
      skills: skillsAt(25),
      combatLevel: 40,
      totalLevel: 400,
      accountMeta: away(daysAgo(400))
    }).id).toBe("new-account");
  });

  it("lets a day-old snapshot outrank a stale WOM record", () => {
    // hasPluginSync is not enough of a guard on its own: next-up.ts passes
    // `pluginSyncState === "live"`, which is false for any snapshot over 24
    // hours old. That is exactly the case where a WOM timestamp nobody
    // refreshed would otherwise win and call an active player returning.
    expect(stage({
      hasPluginSync: false,
      lastActiveAt: daysAgo(2),
      accountMeta: away(daysAgo(400))
    }).id).toBe("midgame-main");

    // And it must still detect a real absence when both sources agree.
    expect(stage({
      hasPluginSync: false,
      lastActiveAt: daysAgo(400),
      accountMeta: away(daysAgo(400))
    }).id).toBe("returning");
  });

  it("lets build types and a live sync keep their stage", () => {
    // Skiller and ironman decide which content applies at all; that does not
    // stop being true because the player took a break.
    expect(stage({
      totalLevel: 2_300,
      accountMeta: away(daysAgo(400))
    }).id).toBe("maxed-grinder");
    expect(stage({
      accountMeta: { ...away(daysAgo(400)), accountType: "ironman" }
    }).id).toBe("iron-route");
    // A plugin snapshot is proof the client was open. It must win over a WOM
    // record that may simply have gone stale.
    expect(stage({
      hasPluginSync: true,
      accountMeta: away(daysAgo(400))
    }).id).toBe("runelite-aware");
  });
});

describe("what changed while you were away", () => {
  it("names quests exactly as the quest database does", async () => {
    // The join is the point: it lets a synced player's finished quests drop out
    // of the list. A typo here would silently stop matching instead of failing.
    const quests = await getQuests();
    const known = new Set(quests.keys());
    for (const name of Object.keys(QUEST_RELEASES)) {
      expect(known.has(name), `"${name}" is not in data/quests.json`).toBe(true);
    }
  });

  it("carries a date for every entry, in a form that sorts", () => {
    for (const entry of [...GAME_UPDATES.map((u) => u.releasedOn), ...Object.values(QUEST_RELEASES)]) {
      expect(entry, entry).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(Number.isFinite(Date.parse(`${entry}T00:00:00Z`))).toBe(true);
    }
  });

  it("shows only what landed after the player stopped", () => {
    const result = updatesSince(daysAgo(400), { now: NOW });
    const names = result.headline.map((update) => update.name);
    // Sailing released 19 November 2025, inside a 400-day window ending
    // 25 July 2026. Tombs of Amascut released in 2022 and must not appear.
    expect(names).toContain("Sailing");
    expect(names).not.toContain("Tombs of Amascut");
    expect(result.quests.map((quest) => quest.name)).toContain("The Red Reef");
    expect(result.quests.map((quest) => quest.name)).not.toContain("Secrets of the North");
  });

  it("dates the region by the region, not by the quest that opens it", () => {
    // Regression: Varlamore carried 2024-01-10, which is Children of the Sun's
    // date — Jagex shipped that quest ten weeks early. The region itself landed
    // 2024-03-20, so anyone who left in between was never shown the single
    // biggest thing that happened while they were gone.
    const between = updatesSince("2024-02-15T00:00:00Z", { now: NOW });
    expect(between.headline.map((update) => update.name)).toContain("Varlamore");
    const after = updatesSince("2024-03-21T00:00:00Z", { now: NOW });
    expect(after.headline.map((update) => update.name)).not.toContain("Varlamore");
  });

  it("does not tell a player the Colosseum takes no supplies", () => {
    // It is a dangerous instance you bring brews and restores into; the
    // no-supplies rule belongs to The Gauntlet. Acting on the old line cost
    // gear.
    const colosseum = GAME_UPDATES.find((update) => update.id === "fortis-colosseum");
    expect(colosseum?.blurb).not.toMatch(/no supplies/i);
  });

  it("leads with the new skill rather than the newest thing", () => {
    const result = updatesSince("2019-01-01T00:00:00Z", { now: NOW });
    expect(result.headline[0]?.name).toBe("Sailing");
    expect(result.total).toBeGreaterThan(30);
  });

  it("says nothing when there is nothing to say", () => {
    expect(updatesSince(null, { now: NOW }).total).toBe(0);
    expect(updatesSince("not a date", { now: NOW }).total).toBe(0);
    // A gap with no releases in it is a real case and must produce an empty
    // list, not a banner announcing that nothing happened.
    expect(updatesSince(daysAgo(2), { now: NOW }).total).toBe(0);
  });

  it("drops quests a synced player already finished", () => {
    const before = updatesSince(daysAgo(400), { now: NOW });
    const after = updatesSince(daysAgo(400), {
      now: NOW,
      completedQuestNames: new Set(["The Red Reef"])
    });
    expect(before.quests.map((q) => q.name)).toContain("The Red Reef");
    expect(after.quests.map((q) => q.name)).not.toContain("The Red Reef");
    expect(after.quests.length).toBe(before.quests.length - 1);
  });

  it("matches those names through punctuation and case differences", () => {
    // RuneLite's labels and the wiki's do not always agree on hyphens or caps.
    // An exact compare would match nothing and show a synced player every quest
    // as new — the failure would look exactly like the feature working.
    const after = updatesSince(daysAgo(400), {
      now: NOW,
      completedQuestNames: new Set(["the red reef", "THE BLOOD MOON RISES"])
    });
    const names = after.quests.map((quest) => quest.name);
    expect(names).not.toContain("The Red Reef");
    expect(names).not.toContain("The Blood Moon Rises");
  });
});

describe("the briefing reaches a browser that does not run JavaScript", () => {
  it("renders on the server, outside the client component", () => {
    // /dps lost its boss roster this way once: inside a client component the
    // markup never reaches the prerendered HTML. Nothing here needs the
    // browser, so nothing here belongs in it.
    const component = source("src/components/returning-briefing.tsx");
    expect(component).not.toContain('"use client"');

    const page = source("src/app/next/page.tsx");
    expect(page).toContain("<ReturningBriefing");
    const client = source("src/app/next/next-client.tsx");
    expect(client).not.toContain("ReturningBriefing");
  });

  it("states what was observed instead of asserting where the player was", () => {
    const component = source("src/components/returning-briefing.tsx");
    expect(component).toContain("No XP recorded on this account");
    expect(component).not.toContain("You have been away about");
  });
});
