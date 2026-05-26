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

  // Honest heuristic: a player's QP total tells us how many quests they
  // *could* have completed at most. We sort all quests easiest-first and
  // accept the cheapest set whose summed QP-cost fits inside the player's
  // QP. Anything past that point is open even if the stats meet it — we
  // don't have the data to say otherwise.
  //
  // The old version (qp >= qpReq + tier-cost) claimed 89% done for a
  // 105 QP account because each Novice quest's bar was tiny in isolation;
  // it ignored that the player only has 105 QP to spend across them all.
  const allSteps: PathProgress["allSteps"] = [];
  let done = 0;

  // 1. Build an easiest-first list of quests the player meets the skills for.
  const difficultyRank: Record<string, number> = {
    Novice: 0, Intermediate: 1, Experienced: 2, Special: 3, Master: 4, Grandmaster: 5
  };
  const sortedQuests = [...quests.values()].sort((a, b) =>
    (difficultyRank[a.difficulty ?? "Intermediate"] ?? 1) -
    (difficultyRank[b.difficulty ?? "Intermediate"] ?? 1)
  );

  // 2. Walk the sorted list spending the player's QP. A quest is 'likely
  //    done' iff its QP fits in the remaining budget AND every skill req
  //    is met. The skill check is what stops us from saying a low-level
  //    player has done DT2 just because they have 200 QP.
  //
  //    Quest-cape threshold: at ~290 QP a player has effectively done
  //    every quest in the game (the Wiki's QP cap was 300 at the time
  //    of writing). Past that point we mark everything done — the
  //    skill-budget walk would still skip a few miniquests because
  //    our dataset has 181 records and they sum past 300 QP.
  const QC_THRESHOLD = 290;
  const likelyDoneNames = new Set<string>();
  if (skills.length > 0) {
    if (qp >= QC_THRESHOLD) {
      for (const q of sortedQuests) likelyDoneNames.add(q.name);
    } else {
      let budget = qp;
      for (const q of sortedQuests) {
        const meetsSkills = q.skillReqs.every((r) => lvl(r.skill) >= r.level);
        const cost = QP_BY_DIFFICULTY[q.difficulty ?? "Intermediate"] ?? 2;
        if (meetsSkills && budget >= cost) {
          likelyDoneNames.add(q.name);
          budget -= cost;
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

  // Per-tier 'likely done' margin. Diaries need active completion (not
  // just skill gates), so just barely meeting the cap doesn't mean it's
  // done. Higher tiers need a bigger margin to credibly say 'you sailed
  // past this.' Maxed-ish accounts (Total >= 2100) suppress everything
  // as done since they realistically have it all.
  const REQUIRED_MARGIN: Record<DiaryTier, number> = {
    Easy: 25,    // anyone with Total > 1000 has crossed Easy gates by accident
    Medium: 25,
    Hard: 30,
    Elite: 30
  };
  for (const [region, d] of diaries) {
    for (const tier of DIARY_TIERS_ORDER) {
      const reqs = d.tiers[tier]?.skills ?? [];
      if (reqs.length === 0) continue; // skip unknown tiers
      const margins = reqs.map((r) => lvl(r.skill) - r.level);
      const allMet = margins.every((m) => m >= 0);
      const minMargin = margins.length > 0 ? Math.min(...margins) : 0;
      const likelyDone = isMaxedish || (allMet && minMargin >= REQUIRED_MARGIN[tier]);
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

function bossesPath(
  bossKc: Record<string, number>,
  skills: HiscoreSkill[],
  womBossKills?: Record<string, number>
): PathProgress {
  // Track the iconic boss roster — same 8 the homepage showcase + KC-recs use.
  // Each entry also carries the WOM snake_case key so we can prefer WOM's
  // KC when it's higher than Hiscores (WOM updates more often).
  const ROSTER: Array<{ slug: string; label: string; hiscoresName: string; womName: string }> = [
    { slug: "vorkath",   label: "Vorkath",            hiscoresName: "Vorkath",           womName: "vorkath" },
    { slug: "zulrah",    label: "Zulrah",             hiscoresName: "Zulrah",            womName: "zulrah" },
    { slug: "cox",       label: "Chambers of Xeric",  hiscoresName: "Chambers of Xeric", womName: "chambers_of_xeric" },
    { slug: "tob",       label: "Theatre of Blood",   hiscoresName: "Theatre of Blood",  womName: "theatre_of_blood" },
    { slug: "toa",       label: "Tombs of Amascut",   hiscoresName: "Tombs of Amascut",  womName: "tombs_of_amascut" },
    { slug: "hydra",     label: "Alchemical Hydra",   hiscoresName: "Alchemical Hydra",  womName: "alchemical_hydra" },
    { slug: "nex",       label: "Nex",                hiscoresName: "Nex",               womName: "nex" },
    { slug: "vardorvis", label: "Vardorvis",          hiscoresName: "Vardorvis",         womName: "vardorvis" }
  ];

  // Prefer WOM's KC when it's higher than Hiscores. WOM updates per
  // RuneLite plugin/group import while Hiscores updates on Jagex's
  // schedule; for a recently-active player WOM is often ahead.
  const kcFor = (boss: typeof ROSTER[number]): number => {
    const hi = bossKc[boss.hiscoresName] ?? 0;
    const wom = womBossKills?.[boss.womName] ?? 0;
    return Math.max(hi, wom);
  };

  const total = ROSTER.length;
  let done = 0;
  const allSteps: PathProgress["allSteps"] = [];
  const combatLevel = skills.length > 0 ? computeCombatLevel(skills) : 0;

  for (const boss of ROSTER) {
    const kc = kcFor(boss);
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
    const kc = kcFor(boss);
    if (kc > 0 && kc < 50) {
      const toGo = 50 - kc;
      nextSteps.push({
        title: `Push ${boss.label} to 50 KC`,
        why: `${kc} KC so far · ${toGo} to go.`,
        bossSlug: boss.slug
      });
      if (nextSteps.length === 3) break;
    }
  }
  // Fill with untouched-but-CL-ready bosses.
  if (nextSteps.length < 3) {
    for (const boss of ROSTER) {
      const kc = kcFor(boss);
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
}

export function computePathProgress(input: ComputePathProgressInput): PathOverview {
  const paths: [PathProgress, PathProgress, PathProgress, PathProgress] = [
    skillsPath(input.skills),
    questsPath(input.quests, input.skills, input.questPoints),
    diariesPath(input.diaries, input.skills),
    bossesPath(input.bossKc, input.skills, input.womBossKills)
  ];
  const overallPercent = Math.round(
    paths.reduce((sum, p) => sum + p.percent, 0) / paths.length
  );
  return {
    paths,
    overallPercent,
    accountMeta: input.accountMeta ?? null
  };
}
