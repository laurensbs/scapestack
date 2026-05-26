// Path-progress aggregator for /next.
//
// Turns the raw Hiscores + bank into four progress paths the player can
// see at a glance: Skills, Quests, Diaries, Bosses. Each path returns a
// `done / total` count and a list of next steps. No completion data
// from Jagex (their endpoint doesn't expose quest/diary state), so we
// use honest heuristics — flagged as 'likely' rather than certain.
//
// Heuristics:
//   - Quests: marked likely-done when the player has enough QP that
//     they could reasonably have completed it AND meets every skill
//     requirement. Imperfect — a player could have higher QP but
//     skipped a quest — but it's the best signal we have without an
//     auth'd API.
//   - Diaries: marked likely-done per tier when the player's required
//     skills sit comfortably above the cap (>= 12 levels over). Maxed
//     accounts (total >= 2100) suppress everything as done.

import type { HiscoreSkill } from "./hiscores";
import { computeTotalLevel, computeCombatLevel } from "./hiscores";
import type { QuestRecord } from "./quest-db";
import type { DiaryRecord, DiaryTier } from "./diary-db";
import { skillCapeId } from "./skill-capes";

export interface PathStep {
  /** Display title (e.g. "Push Slayer to 70" or "Karamja Diary — Hard"). */
  title: string;
  /** Short reason this is the next step. */
  why: string;
  /** Optional OSRS item id for a tile sprite. */
  iconItemId?: number;
  /** Optional boss slug for the wiki portrait route. */
  bossSlug?: string;
}

export interface PathProgress {
  /** Path identity. */
  kind: "skills" | "quests" | "diaries" | "bosses";
  /** Display name + tagline. */
  label: string;
  tagline: string;
  /** Completion percentage 0-100, integer. Computed from done/total. */
  percent: number;
  /** Items the player has earned / likely-completed. */
  done: number;
  /** Total trackable in this path. */
  total: number;
  /** Next 3 concrete things to do on this path. */
  nextSteps: PathStep[];
  /** All steps for the drill-in modal — done + remaining. */
  allSteps: Array<PathStep & { status: "done" | "open" }>;
}

// ── Skills ──────────────────────────────────────────────────────────

const SKILL_NAMES = [
  "Attack", "Defence", "Strength", "Hitpoints", "Ranged", "Prayer",
  "Magic", "Cooking", "Woodcutting", "Fletching", "Fishing", "Firemaking",
  "Crafting", "Smithing", "Mining", "Herblore", "Agility", "Thieving",
  "Slayer", "Farming", "Runecraft", "Hunter", "Construction"
];

// OSRS XP table — XP needed to reach each level. Standard formula.
// Used by both the skills percentage (XP-weighted instead of level-
// weighted) and the diary XP-evidence check below.
const XP_AT_LEVEL: number[] = (() => {
  const table = [0];
  let total = 0;
  for (let n = 1; n < 99; n++) {
    total += Math.floor(n + 300 * Math.pow(2, n / 7));
    table.push(Math.floor(total / 4));
  }
  return table;
})();

function xpForLevel(level: number): number {
  if (level <= 1) return 0;
  if (level > 99) return XP_AT_LEVEL[99] ?? 13_034_431;
  return XP_AT_LEVEL[level - 1] ?? 0;
}

function skillsPath(skills: HiscoreSkill[]): PathProgress {
  if (skills.length === 0) {
    return {
      kind: "skills",
      label: "Skills",
      tagline: "Add your OSRS name to see skill progress.",
      percent: 0, done: 0, total: 23, nextSteps: [], allSteps: []
    };
  }
  const lvl = (name: string) => skills.find((s) => s.name === name)?.level ?? 1;
  const xp = (name: string) => skills.find((s) => s.name === name)?.xp ?? 0;
  const done = SKILL_NAMES.filter((n) => lvl(n) >= 99).length;
  const total = SKILL_NAMES.length;
  // Percent is XP-based, not level-based. Avg-level/99 said 71% to an
  // all-70 account but that's only ~12% of the XP needed for max.
  // Cap each skill at the 99-XP threshold so 200M skills don't blow
  // the average past max-cape parity.
  const xpAt99 = xpForLevel(99); // 13_034_431
  const targetTotal = xpAt99 * total;
  const actualTotal = SKILL_NAMES.reduce((sum, n) => sum + Math.min(xpAt99, xp(n)), 0);
  const percent = Math.round((actualTotal / targetTotal) * 100);
  const avgLevel = SKILL_NAMES.reduce((sum, n) => sum + Math.min(99, lvl(n)), 0) / total;

  // Next steps: the three skills closest to a milestone (70 / 80 / 90 / 99).
  // Sort by smallest gap; tie-break on highest current level (sunk cost).
  const milestones = [70, 80, 85, 90, 92, 95, 99];
  const candidates: Array<{ name: string; current: number; target: number; gap: number }> = [];
  for (const name of SKILL_NAMES) {
    const cur = lvl(name);
    const target = milestones.find((m) => m > cur);
    if (!target) continue;
    candidates.push({ name, current: cur, target, gap: target - cur });
  }
  candidates.sort((a, b) => (a.gap - b.gap) || (b.current - a.current));
  const nextSteps: PathStep[] = candidates.slice(0, 3).map((c) => ({
    title: `${c.name} ${c.current} → ${c.target}`,
    why: `${c.gap} level${c.gap === 1 ? "" : "s"} to go.`,
    // Per-skill cape so the next-step preview reads as the actual goal
    // (Slayer cape next to 'Slayer 65 → 70' instead of Attack cape).
    iconItemId: skillCapeId(c.name)
  }));

  // allSteps: every skill, marked done when 99.
  const allSteps: PathProgress["allSteps"] = SKILL_NAMES.map((name) => {
    const cur = lvl(name);
    return {
      title: `${name} ${cur}/99`,
      why: cur >= 99 ? "Cape earned." : `${99 - cur} levels to 99.`,
      status: cur >= 99 ? ("done" as const) : ("open" as const),
      iconItemId: skillCapeId(name)
    };
  });

  return {
    kind: "skills",
    label: "Skills",
    tagline: done === total
      ? "Max cape earned."
      : `${done}/${total} at 99, avg level ${Math.round(avgLevel)}.`,
    percent,
    done, total, nextSteps, allSteps
  };
}

// ── Quests ──────────────────────────────────────────────────────────

// Approximate QP per difficulty tier — rough average from Wiki. Used to
// estimate 'is this player likely to have done this quest?' without an
// authed completion-status API.
const QP_BY_DIFFICULTY: Record<string, number> = {
  Novice: 1, Intermediate: 2, Experienced: 3, Master: 4, Grandmaster: 5, Special: 4
};

// Transitive prereq closure. For each quest, returns the FULL set of
// prerequisite quest names (direct + transitive). The Wiki's questReqs
// is direct-only, so we walk the graph once.
//
// Used by the heuristic to chain-check: a quest is only likely-done if
// every quest in its transitive prereq set is also likely-done. Stops
// the QP-budget walk from saying 'DT2 is done' just because skill +
// budget fit, when the player obviously can't have completed the 13
// prerequisite quests in the chain.
function buildTransitivePrereqs(quests: Map<string, QuestRecord>): Map<string, Set<string>> {
  const cache = new Map<string, Set<string>>();
  const visiting = new Set<string>(); // cycle guard
  const resolve = (name: string): Set<string> => {
    if (cache.has(name)) return cache.get(name)!;
    if (visiting.has(name)) return new Set(); // cycle — shouldn't happen with quests but be safe
    visiting.add(name);
    const q = quests.get(name);
    const out = new Set<string>();
    if (q) {
      for (const direct of q.questReqs) {
        out.add(direct);
        for (const indirect of resolve(direct)) out.add(indirect);
      }
    }
    visiting.delete(name);
    cache.set(name, out);
    return out;
  };
  for (const name of quests.keys()) resolve(name);
  return cache;
}

function questsPath(
  quests: Map<string, QuestRecord>,
  skills: HiscoreSkill[],
  qp: number,
  templeQuestsCompleted?: Set<string>
): PathProgress {
  if (quests.size === 0) {
    return {
      kind: "quests",
      label: "Quests",
      tagline: "Quest data unavailable.",
      percent: 0, done: 0, total: 0, nextSteps: [], allSteps: []
    };
  }
  const lvl = (name: string) => skills.find((s) => s.name === name)?.level ?? 1;
  const total = quests.size;

  // When Temple has real per-quest completion state we use it directly
  // — exact, not a guess. Falls through to the QP-budget heuristic
  // below when Temple has no record for this player.
  if (templeQuestsCompleted && templeQuestsCompleted.size > 0) {
    return questsPathFromTemple(quests, skills, qp, templeQuestsCompleted);
  }

  // Dependency-aware heuristic. The old version sorted quests by
  // difficulty and spent QP greedily — at 200 QP it would tick off
  // every Novice quest and then move up, but it didn't track the
  // dependency chain. A 200 QP account doesn't necessarily have DT2
  // done; it might have done 50 quick quests and skipped the chain.
  //
  // New approach: build the transitive prereq closure. A quest is
  // 'likely done' iff:
  //   (1) skills meet every requirement
  //   (2) every transitive prereq is also likely-done
  //   (3) sum of QP-costs for this quest + all prereqs fits in the
  //       player's actual QP total
  // We iterate until the set stabilises. Past the 290 QP quest-cape
  // threshold we short-circuit to 'all done.'
  const allSteps: PathProgress["allSteps"] = [];
  let done = 0;

  const difficultyRank: Record<string, number> = {
    Novice: 0, Intermediate: 1, Experienced: 2, Special: 3, Master: 4, Grandmaster: 5
  };
  const QC_THRESHOLD = 290;

  const transitivePrereqs = buildTransitivePrereqs(quests);

  // Cost per quest using its difficulty tier.
  const costOf = (q: QuestRecord) => QP_BY_DIFFICULTY[q.difficulty ?? "Intermediate"] ?? 2;

  const likelyDoneNames = new Set<string>();
  if (skills.length > 0) {
    if (qp >= QC_THRESHOLD) {
      for (const q of quests.values()) likelyDoneNames.add(q.name);
    } else {
      // Sort easiest-first so we resolve prereqs before their consumers.
      const sortedQuests = [...quests.values()].sort((a, b) =>
        (difficultyRank[a.difficulty ?? "Intermediate"] ?? 1) -
        (difficultyRank[b.difficulty ?? "Intermediate"] ?? 1)
      );

      // Fixed-point iteration: keep adding eligible quests until nothing
      // changes. Each pass: a quest is eligible iff skills + every
      // prereq already-done + sum-of-QP fits in budget.
      let changed = true;
      while (changed) {
        changed = false;
        // Reset budget each pass — we re-walk the full ordering, not
        // an incremental tally.
        let budget = qp;
        const newDone = new Set<string>();
        for (const q of sortedQuests) {
          if (newDone.has(q.name)) continue;
          const cost = costOf(q);
          if (cost > budget) continue;
          // Skill check.
          const meetsSkills = q.skillReqs.every((r) => lvl(r.skill) >= r.level);
          if (!meetsSkills) continue;
          // Prereq check: every transitive prereq must already be in
          // either newDone or the running set.
          const prereqs = transitivePrereqs.get(q.name) ?? new Set();
          let prereqsDone = true;
          for (const pr of prereqs) {
            if (!quests.has(pr)) continue; // out-of-dataset prereq, skip
            if (!newDone.has(pr) && !likelyDoneNames.has(pr)) {
              prereqsDone = false;
              break;
            }
          }
          if (!prereqsDone) continue;
          newDone.add(q.name);
          budget -= cost;
        }
        // If this pass found more quests than the previous, keep going.
        for (const n of newDone) {
          if (!likelyDoneNames.has(n)) {
            likelyDoneNames.add(n);
            changed = true;
          }
        }
      }
    }
  }

  for (const q of quests.values()) {
    const likelyDone = likelyDoneNames.has(q.name);
    if (likelyDone) done++;
    allSteps.push({
      title: q.name,
      why: q.difficulty
        ? `${q.difficulty}${q.length ? ` · ${q.length}` : ""}${q.qpReq > 0 ? ` · ${q.qpReq} QP` : ""}`
        : (q.length ?? ""),
      status: likelyDone ? "done" : "open",
      iconItemId: 9813 // quest point cape
    });
  }

  // Next steps: quests the player can attempt now (meets every skill
  // req, QP gate satisfied) but aren't in the likely-done set. Sorted
  // hardest-first so the suggestion is something with weight, not 'do
  // Cook's Assistant.'
  const openSteps = [...quests.values()]
    .filter((q) => {
      if (skills.length === 0) return false;
      const meets = q.skillReqs.every((r) => lvl(r.skill) >= r.level);
      const qpGate = q.qpReq === 0 || qp >= q.qpReq;
      return meets && qpGate && !likelyDoneNames.has(q.name);
    })
    .sort((a, b) => (difficultyRank[b.difficulty ?? "Intermediate"] ?? 1) -
                     (difficultyRank[a.difficulty ?? "Intermediate"] ?? 1));

  const nextSteps: PathStep[] = openSteps.slice(0, 3).map((q) => ({
    title: q.name,
    why: q.difficulty
      ? `${q.difficulty}${q.qpReq > 0 ? ` · needs ${q.qpReq} QP` : " · no QP gate"}`
      : (q.length ?? ""),
    iconItemId: 9813
  }));

  return {
    kind: "quests",
    label: "Quests",
    tagline: done === total
      ? "Quest cape earned."
      : `${total - done} quest${total - done === 1 ? "" : "s"} likely open.`,
    percent: Math.round((done / total) * 100),
    done, total, nextSteps, allSteps
  };
}

// Temple-driven quest path. When TempleOSRS has a record we use the
// exact 'completed' flag per quest instead of guessing from QP. The
// tagline says 'Synced via Temple' so the user knows this number is
// real, not a heuristic.
function questsPathFromTemple(
  quests: Map<string, QuestRecord>,
  skills: HiscoreSkill[],
  qp: number,
  templeQuests: Set<string>
): PathProgress {
  const lvl = (name: string) => skills.find((s) => s.name === name)?.level ?? 1;
  const total = quests.size;
  const allSteps: PathProgress["allSteps"] = [];
  let done = 0;

  for (const q of quests.values()) {
    const isDone = templeQuests.has(q.name.toLowerCase());
    if (isDone) done++;
    allSteps.push({
      title: q.name,
      why: q.difficulty
        ? `${q.difficulty}${q.length ? ` · ${q.length}` : ""}${q.qpReq > 0 ? ` · ${q.qpReq} QP` : ""}`
        : (q.length ?? ""),
      status: isDone ? "done" : "open",
      iconItemId: 9813
    });
  }

  // Next steps: open quests at the highest difficulty the player meets
  // every skill req for AND has the QP gate satisfied. Identical sort
  // as the heuristic path so the UI is consistent.
  const difficultyRank: Record<string, number> = {
    Novice: 0, Intermediate: 1, Experienced: 2, Special: 3, Master: 4, Grandmaster: 5
  };
  const openSteps = [...quests.values()]
    .filter((q) => {
      if (skills.length === 0) return false;
      const meets = q.skillReqs.every((r) => lvl(r.skill) >= r.level);
      const qpGate = q.qpReq === 0 || qp >= q.qpReq;
      return meets && qpGate && !templeQuests.has(q.name.toLowerCase());
    })
    .sort((a, b) => (difficultyRank[b.difficulty ?? "Intermediate"] ?? 1) -
                     (difficultyRank[a.difficulty ?? "Intermediate"] ?? 1));
  const nextSteps: PathStep[] = openSteps.slice(0, 3).map((q) => ({
    title: q.name,
    why: q.difficulty
      ? `${q.difficulty}${q.qpReq > 0 ? ` · needs ${q.qpReq} QP` : " · no QP gate"}`
      : (q.length ?? ""),
    iconItemId: 9813
  }));

  return {
    kind: "quests",
    label: "Quests",
    tagline: done === total
      ? "Quest cape earned · synced from Temple."
      : `${total - done} open · synced from Temple.`,
    percent: Math.round((done / total) * 100),
    done, total, nextSteps, allSteps
  };
}

// ── Diaries ─────────────────────────────────────────────────────────

const DIARY_TIERS_ORDER: DiaryTier[] = ["Easy", "Medium", "Hard", "Elite"];

function diariesPath(diaries: Map<string, DiaryRecord>, skills: HiscoreSkill[]): PathProgress {
  if (diaries.size === 0) {
    return {
      kind: "diaries",
      label: "Diaries",
      tagline: "Diary data unavailable.",
      percent: 0, done: 0, total: 0, nextSteps: [], allSteps: []
    };
  }
  const lvl = (name: string) => skills.find((s) => s.name === name)?.level ?? 1;
  const xp = (name: string) => skills.find((s) => s.name === name)?.xp ?? 0;
  const totalLevel = skills.length > 0 ? computeTotalLevel(skills) : 0;
  const isMaxedish = totalLevel >= 2100;

  const total = diaries.size * 4; // 4 tiers per region
  const allSteps: PathProgress["allSteps"] = [];
  let done = 0;

  // Diary completion has two signals:
  //   1. Skill-margin: how many levels above the cap is the player?
  //   2. XP-evidence: a player with 5× the XP needed for the cap has
  //      almost certainly cleared the diary — they kept training past
  //      the threshold, which means the threshold was already met long
  //      ago. This catches the 'capped at the cap' false-positive that
  //      the margin-only heuristic missed.
  // 'likely done' = either signal is strong enough. Maxed-ish suppress
  // suppresses everything as done.
  const REQUIRED_MARGIN: Record<DiaryTier, number> = {
    Easy: 18,    // anyone with Total > 1200 typically crosses Easy gates
    Medium: 22,
    Hard: 26,
    Elite: 28
  };
  // XP-overshoot multiplier per tier — how many times the cap's XP
  // the player should have to count as 'sailed past.' Elite needs a
  // smaller multiplier because Elite caps are already near 99-XP
  // territory and 1.2x of that is huge.
  const XP_OVERSHOOT: Record<DiaryTier, number> = {
    Easy: 8,
    Medium: 4,
    Hard: 2,
    Elite: 1.5
  };

  for (const [region, d] of diaries) {
    for (const tier of DIARY_TIERS_ORDER) {
      const reqs = d.tiers[tier]?.skills ?? [];
      if (reqs.length === 0) continue;
      const allMet = reqs.every((r) => lvl(r.skill) >= r.level);
      const margins = reqs.map((r) => lvl(r.skill) - r.level);
      const minMargin = margins.length > 0 ? Math.min(...margins) : 0;
      const marginEvidence = allMet && minMargin >= REQUIRED_MARGIN[tier];

      // XP-evidence: every required skill's XP must overshoot the cap
      // XP by the tier's multiplier. Strong signal when true — proves
      // training continued past the threshold.
      const xpEvidence = allMet && reqs.every((r) => {
        const reqXp = xpForLevel(r.level);
        if (reqXp === 0) return false; // level 1 reqs don't have XP-evidence
        return xp(r.skill) >= reqXp * XP_OVERSHOOT[tier];
      });

      const likelyDone = isMaxedish || marginEvidence || xpEvidence;
      if (likelyDone) done++;

      const whyMissing = reqs.filter((r) => lvl(r.skill) < r.level)
        .map((r) => `${r.skill} ${r.level}`).join(", ");
      allSteps.push({
        title: `${region} — ${tier}`,
        why: !allMet ? `Need: ${whyMissing}`
          : xpEvidence ? `XP shows you've trained past every cap`
          : marginEvidence ? `Skill cap met (margin ${minMargin}+)`
          : `Stats meet the cap — bring proof if you've done it`,
        status: likelyDone ? "done" : "open",
        iconItemId: 11140
      });
    }
  }

  // Next steps: the three highest-tier diaries the player JUST meets
  // (allMet but margin < 12). Maxed accounts get an empty list.
  const tierRank: Record<DiaryTier, number> = { Easy: 1, Medium: 2, Hard: 3, Elite: 4 };
  type Candidate = { region: string; tier: DiaryTier; margin: number };
  const candidates: Candidate[] = [];
  if (!isMaxedish) {
    for (const [region, d] of diaries) {
      for (const tier of DIARY_TIERS_ORDER) {
        const reqs = d.tiers[tier]?.skills ?? [];
        if (reqs.length === 0) continue;
        const margins = reqs.map((r) => lvl(r.skill) - r.level);
        const allMet = margins.every((m) => m >= 0);
        const minMargin = margins.length > 0 ? Math.min(...margins) : 0;
        if (allMet && minMargin < 12) {
          candidates.push({ region, tier, margin: minMargin });
        }
      }
    }
  }
  candidates.sort((a, b) =>
    (tierRank[b.tier] - tierRank[a.tier]) || (a.margin - b.margin)
  );
  const nextSteps: PathStep[] = candidates.slice(0, 3).map((c) => ({
    title: `${c.region} Diary — ${c.tier}`,
    why: `Your skills now clear every task in this tier.`,
    iconItemId: 11140
  }));

  return {
    kind: "diaries",
    label: "Diaries",
    tagline: done === total
      ? "All diary tiers complete."
      : `${total - done} diary tier${total - done === 1 ? "" : "s"} open.`,
    percent: Math.round((done / total) * 100),
    done, total, nextSteps, allSteps
  };
}

// ── Bosses ──────────────────────────────────────────────────────────

function bossesPath(
  bossKc: Record<string, number>,
  skills: HiscoreSkill[],
  womBossKills?: Record<string, number>,
  clOwnedItemIds?: Set<number>
): PathProgress {
  // Each entry carries the iconic-drop item-ids the cl.net plugin uses
  // to mark this boss as 'visited.' If the player has ANY of them they
  // have real evidence of having committed, even if KC is low (Tbow on
  // an obvious 50 CoX KC = the player just got lucky).
  const ROSTER: Array<{
    slug: string;
    label: string;
    hiscoresName: string;
    womName: string;
    iconicItemIds: number[]; // any unique drop from this boss/raid
  }> = [
    { slug: "vorkath",   label: "Vorkath",            hiscoresName: "Vorkath",           womName: "vorkath",
      iconicItemIds: [21907, 22006, 21748] /* head, gloves, jaw */ },
    { slug: "zulrah",    label: "Zulrah",             hiscoresName: "Zulrah",            womName: "zulrah",
      iconicItemIds: [12921, 12932, 12937, 12934] /* magic/tanzanite/serp/onyx fang */ },
    { slug: "cox",       label: "Chambers of Xeric",  hiscoresName: "Chambers of Xeric", womName: "chambers_of_xeric",
      iconicItemIds: [20997, 21043, 21003, 22324, 13652, 21000] /* Tbow, kodai, maul, etc */ },
    { slug: "tob",       label: "Theatre of Blood",   hiscoresName: "Theatre of Blood",  womName: "theatre_of_blood",
      iconicItemIds: [22325, 22324, 22323, 22326] /* scythe, rapier, sang, justi */ },
    { slug: "toa",       label: "Tombs of Amascut",   hiscoresName: "Tombs of Amascut",  womName: "tombs_of_amascut",
      iconicItemIds: [27275, 26219, 25985, 25975, 27226] /* shadow, fang, ward, lightbearer, masori */ },
    { slug: "hydra",     label: "Alchemical Hydra",   hiscoresName: "Alchemical Hydra",  womName: "alchemical_hydra",
      iconicItemIds: [22746, 22731, 22944, 23139] /* tail, hydra leather, claw, ring */ },
    { slug: "nex",       label: "Nex",                hiscoresName: "Nex",               womName: "nex",
      iconicItemIds: [26382, 26384, 26386, 26235, 26370] /* torva pieces, zaryte vambs, ancient hilt */ },
    { slug: "vardorvis", label: "Vardorvis",          hiscoresName: "Vardorvis",         womName: "vardorvis",
      iconicItemIds: [28997, 28307, 28316] /* soulreaper axe, ultor ring, ultor vestige */ }
  ];

  // Prefer WOM's KC when it's higher than Hiscores. WOM updates per
  // RuneLite plugin/group import while Hiscores updates on Jagex's
  // schedule; for a recently-active player WOM is often ahead.
  const kcFor = (boss: typeof ROSTER[number]): number => {
    const hi = bossKc[boss.hiscoresName] ?? 0;
    const wom = womBossKills?.[boss.womName] ?? 0;
    return Math.max(hi, wom);
  };
  // 'Has a unique drop from this boss in their collection log.'
  const ownsAnyUnique = (boss: typeof ROSTER[number]): boolean => {
    if (!clOwnedItemIds || clOwnedItemIds.size === 0) return false;
    return boss.iconicItemIds.some((id) => clOwnedItemIds.has(id));
  };

  const total = ROSTER.length;
  let done = 0;
  const allSteps: PathProgress["allSteps"] = [];
  const combatLevel = skills.length > 0 ? computeCombatLevel(skills) : 0;

  for (const boss of ROSTER) {
    const kc = kcFor(boss);
    const hasUnique = ownsAnyUnique(boss);
    // Tiered 'committed' signal:
    //   - hasUnique = best signal. They have a drop, they're committed.
    //   - kc >= 50 = strong KC signal, was the old threshold.
    //   - kc >= 10 + (no plugin so we can't verify) = 'in progress',
    //     still counts as open but the next-steps logic prefers it.
    const isDone = hasUnique || kc >= 50;
    if (isDone) done++;
    allSteps.push({
      title: boss.label,
      why: hasUnique && kc > 0
        ? `${kc.toLocaleString()} KC · unique drop logged`
        : hasUnique
          ? `Unique drop in your collection log`
          : kc > 0
            ? `${kc.toLocaleString()} KC`
            : "Never killed",
      status: isDone ? "done" : "open",
      bossSlug: boss.slug
    });
  }

  // Next steps prefer 'in progress' bosses (10 ≤ KC < 50) over 'never
  // touched but eligible' ones — the player has shown interest and
  // we're nudging them past the commit-threshold.
  const nextSteps: PathStep[] = [];
  for (const boss of ROSTER) {
    const kc = kcFor(boss);
    if (kc > 0 && kc < 50 && !ownsAnyUnique(boss)) {
      const toGo = 50 - kc;
      nextSteps.push({
        title: `Push ${boss.label} to 50 KC`,
        why: `${kc} KC so far · ${toGo} to go.`,
        bossSlug: boss.slug
      });
      if (nextSteps.length === 3) break;
    }
  }
  if (nextSteps.length < 3) {
    for (const boss of ROSTER) {
      const kc = kcFor(boss);
      if (kc === 0 && combatLevel >= 100 && !ownsAnyUnique(boss)) {
        nextSteps.push({
          title: `Try ${boss.label}`,
          why: `New chase; you've got the combat level for it.`,
          bossSlug: boss.slug
        });
        if (nextSteps.length === 3) break;
      }
    }
  }

  return {
    kind: "bosses",
    label: "Bosses",
    tagline: skills.length === 0
      ? "Add your OSRS name to see boss progress."
      : `${done}/${total} bosses committed.`,
    percent: Math.round((done / total) * 100),
    done, total, nextSteps, allSteps
  };
}

// ── Public API ──────────────────────────────────────────────────────

/** Account-level metadata pulled from WOM (best-effort enrichment).
 *  Drives the 'Synced via Wise Old Man' badge + account-type-aware
 *  recommendations. Always null when the player isn't on WOM. */
export interface AccountMeta {
  displayName: string;
  /** WOM's normalised account type: regular / ironman / hardcore / ultimate / skiller / pure. */
  accountType: "regular" | "ironman" | "hardcore" | "ultimate" | "skiller" | "pure";
  /** Efficient Hours Played — sum of optimal time invested. */
  ehp: number;
  /** Efficient Hours Bossed. */
  ehb: number;
  /** When the player last gained XP, per WOM. */
  lastChangedAt: string | null;
}

export interface PathOverview {
  paths: [PathProgress, PathProgress, PathProgress, PathProgress];
  /** Overall % across all four paths, averaged. */
  overallPercent: number;
  /** Set when WOM had a player record; null otherwise. UI checks this
   *  to render the 'Synced via Wise Old Man' badge. */
  accountMeta: AccountMeta | null;
  /** Which external trackers returned data for this player. Drives the
   *  'Synced via WOM/Temple/CL' badge. */
  syncedSources?: { wom: boolean; temple: boolean; collectionLog: boolean };
}

export interface ComputePathProgressInput {
  skills: HiscoreSkill[];
  quests: Map<string, QuestRecord>;
  diaries: Map<string, DiaryRecord>;
  bossKc: Record<string, number>;
  questPoints: number;
  /** WOM-derived enrichment. Optional — when missing we fall back to
   *  Hiscores-only data and don't surface the synced badge. */
  womBossKills?: Record<string, number>;
  accountMeta?: AccountMeta | null;
  /** Lowercased quest-names from TempleOSRS — exact completion data
   *  for players who use the Temple plugin. When present, questsPath
   *  uses these instead of the QP-budget heuristic. */
  templeQuestsCompleted?: Set<string>;
  /** collectionlog.net owned item-IDs. Used by bossesPath to mark a
   *  boss as 'committed' when the player has any unique drop from it,
   *  even when KC is low. Beats the 50-KC threshold for accuracy. */
  collectionLogOwnedItemIds?: Set<number>;
  /** Tracks which external sources had data, drives the synced-badge
   *  copy. */
  syncedSources?: { wom: boolean; temple: boolean; collectionLog: boolean };
}

export function computePathProgress(input: ComputePathProgressInput): PathOverview {
  const paths: [PathProgress, PathProgress, PathProgress, PathProgress] = [
    skillsPath(input.skills),
    questsPath(input.quests, input.skills, input.questPoints, input.templeQuestsCompleted),
    diariesPath(input.diaries, input.skills),
    bossesPath(input.bossKc, input.skills, input.womBossKills, input.collectionLogOwnedItemIds)
  ];
  const overallPercent = Math.round(
    paths.reduce((sum, p) => sum + p.percent, 0) / paths.length
  );
  return {
    paths,
    overallPercent,
    accountMeta: input.accountMeta ?? null,
    syncedSources: input.syncedSources
  };
}
