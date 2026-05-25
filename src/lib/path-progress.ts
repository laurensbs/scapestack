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
  const done = SKILL_NAMES.filter((n) => lvl(n) >= 99).length;
  const total = SKILL_NAMES.length;
  // The overall percentage isn't done/total — that would say 0% to a
  // CB-100 player with no 99s, which reads as wrong. Use the average
  // skill level / 99 instead, so the bar moves visibly with progress
  // and only hits 100% on a max cape.
  const avgLevel = SKILL_NAMES.reduce((sum, n) => sum + Math.min(99, lvl(n)), 0) / total;
  const percent = Math.round((avgLevel / 99) * 100);

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
    iconItemId: 9747 // generic skill cape icon
  }));

  // allSteps: every skill, marked done when 99.
  const allSteps: PathProgress["allSteps"] = SKILL_NAMES.map((name) => {
    const cur = lvl(name);
    return {
      title: `${name} ${cur}/99`,
      why: cur >= 99 ? "Cape earned." : `${99 - cur} levels to 99.`,
      status: cur >= 99 ? ("done" as const) : ("open" as const),
      iconItemId: 9747
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

function questsPath(quests: Map<string, QuestRecord>, skills: HiscoreSkill[], qp: number): PathProgress {
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

  // Heuristic: a quest is 'likely done' when the player meets every skill
  // req AND has more QP than what was theoretically needed to reach this
  // one in difficulty-order. We compute an estimated 'sufficient QP' per
  // quest based on its own QP gate plus the difficulty tier itself.
  const allSteps: PathProgress["allSteps"] = [];
  let done = 0;

  for (const q of quests.values()) {
    const meetsSkills = q.skillReqs.every((r) => lvl(r.skill) >= r.level);
    const qpThreshold = q.qpReq + (QP_BY_DIFFICULTY[q.difficulty ?? "Intermediate"] ?? 2);
    // 'Likely done' = stat gate met AND the player has spent enough QP to
    // have plausibly reached this one. Conservative — won't claim quests
    // the player can't have done, but will over-count for non-completionists.
    const likelyDone = skills.length > 0 && meetsSkills && qp >= qpThreshold;
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

  // Next steps: open quests at higher difficulties the player meets the
  // skills for, sorted by difficulty descending (Grandmaster first).
  const difficultyRank: Record<string, number> = {
    Grandmaster: 5, Master: 4, Special: 3, Experienced: 2, Intermediate: 1, Novice: 0
  };
  const openSteps = [...quests.values()]
    .filter((q) => {
      if (skills.length === 0) return false;
      const meets = q.skillReqs.every((r) => lvl(r.skill) >= r.level);
      const qpThreshold = q.qpReq + (QP_BY_DIFFICULTY[q.difficulty ?? "Intermediate"] ?? 2);
      const likelyDone = meets && qp >= qpThreshold;
      return meets && !likelyDone;
    })
    .sort((a, b) => (difficultyRank[b.difficulty ?? ""] ?? 0) - (difficultyRank[a.difficulty ?? ""] ?? 0));

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
  const totalLevel = skills.length > 0 ? computeTotalLevel(skills) : 0;
  const isMaxedish = totalLevel >= 2100;

  const total = diaries.size * 4; // 4 tiers per region
  const allSteps: PathProgress["allSteps"] = [];
  let done = 0;

  // For each region+tier: 'likely done' if the player's skill margin over
  // every requirement is >= 12 levels. Maxed-ish accounts likely have done
  // every diary; we flag everything as done above 2100 total.
  for (const [region, d] of diaries) {
    for (const tier of DIARY_TIERS_ORDER) {
      const reqs = d.tiers[tier]?.skills ?? [];
      if (reqs.length === 0) continue; // skip unknown tiers
      const margins = reqs.map((r) => lvl(r.skill) - r.level);
      const allMet = margins.every((m) => m >= 0);
      const minMargin = margins.length > 0 ? Math.min(...margins) : 0;
      const likelyDone = isMaxedish || (allMet && minMargin >= 12);
      if (likelyDone) done++;
      allSteps.push({
        title: `${region} — ${tier}`,
        why: allMet
          ? `Skill cap met (margin ${minMargin}+)`
          : `Need: ${reqs.filter((r) => lvl(r.skill) < r.level).map((r) => `${r.skill} ${r.level}`).join(", ")}`,
        status: likelyDone ? "done" : "open",
        iconItemId: 11140 // karamja gloves 4
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

function bossesPath(bossKc: Record<string, number>, skills: HiscoreSkill[]): PathProgress {
  // Track the iconic boss roster — same 8 the homepage showcase + KC-recs use.
  const ROSTER: Array<{ slug: string; label: string; hiscoresName: string }> = [
    { slug: "vorkath",   label: "Vorkath",            hiscoresName: "Vorkath" },
    { slug: "zulrah",    label: "Zulrah",             hiscoresName: "Zulrah" },
    { slug: "cox",       label: "Chambers of Xeric",  hiscoresName: "Chambers of Xeric" },
    { slug: "tob",       label: "Theatre of Blood",   hiscoresName: "Theatre of Blood" },
    { slug: "toa",       label: "Tombs of Amascut",   hiscoresName: "Tombs of Amascut" },
    { slug: "hydra",     label: "Alchemical Hydra",   hiscoresName: "Alchemical Hydra" },
    { slug: "nex",       label: "Nex",                hiscoresName: "Nex" },
    { slug: "vardorvis", label: "Vardorvis",          hiscoresName: "Vardorvis" }
  ];

  const total = ROSTER.length;
  let done = 0;
  const allSteps: PathProgress["allSteps"] = [];
  const combatLevel = skills.length > 0 ? computeCombatLevel(skills) : 0;

  for (const boss of ROSTER) {
    const kc = bossKc[boss.hiscoresName] ?? 0;
    // 'Done' = ≥ 50 KC. Arbitrary threshold — under that the player is
    // experimenting; over it they've actually committed.
    const isDone = kc >= 50;
    if (isDone) done++;
    allSteps.push({
      title: boss.label,
      why: kc > 0
        ? `${kc.toLocaleString()} KC`
        : "Never killed",
      status: isDone ? "done" : "open",
      bossSlug: boss.slug
    });
  }

  // Next steps: bosses with positive but low KC (they've tried, push to
  // commit) + bosses they haven't tried but combat level supports.
  const nextSteps: PathStep[] = [];
  for (const boss of ROSTER) {
    const kc = bossKc[boss.hiscoresName] ?? 0;
    if (kc > 0 && kc < 50) {
      nextSteps.push({
        title: `Push ${boss.label} to 50 KC`,
        why: `${kc} KC so far — half a Tbow's drop chance from there.`,
        bossSlug: boss.slug
      });
      if (nextSteps.length === 3) break;
    }
  }
  // Fill with untouched-but-CL-ready bosses.
  if (nextSteps.length < 3) {
    for (const boss of ROSTER) {
      const kc = bossKc[boss.hiscoresName] ?? 0;
      if (kc === 0 && combatLevel >= 100) {
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

export interface PathOverview {
  paths: [PathProgress, PathProgress, PathProgress, PathProgress];
  /** Overall % across all four paths, averaged. */
  overallPercent: number;
}

export function computePathProgress(
  skills: HiscoreSkill[],
  quests: Map<string, QuestRecord>,
  diaries: Map<string, DiaryRecord>,
  bossKc: Record<string, number>,
  questPoints: number
): PathOverview {
  const paths: [PathProgress, PathProgress, PathProgress, PathProgress] = [
    skillsPath(skills),
    questsPath(quests, skills, questPoints),
    diariesPath(diaries, skills),
    bossesPath(bossKc, skills)
  ];
  const overallPercent = Math.round(
    paths.reduce((sum, p) => sum + p.percent, 0) / paths.length
  );
  return { paths, overallPercent };
}
