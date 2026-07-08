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
import { diaryTierKey, evaluateDiaryTier } from "./diary-requirements";
import { skillCapeId } from "./skill-capes";
import type { PlannerAccountType } from "./account-type";
import { evaluateItemAvailability } from "./item-availability";
import type { PluginBankStatus } from "./plugin-bank-status";

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
  /** Completion percentage 0-100, integer. Uses path-specific progress heuristics. */
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

export type UnlockRouteId =
  | "barrows-gloves"
  | "fairy-rings"
  | "piety"
  | "avas-assembler"
  | "dragon-defender"
  | "quest-cape"
  | "raids-prep"
  | "slayer-unlocks"
  | "diary-unlocks";

export interface UnlockRouteBlocker {
  type: "quest" | "skill" | "diary" | "item" | "activity" | "qp";
  label: string;
  detail: string;
  nextAction: string;
}

export interface UnlockRoutePlan {
  id: UnlockRouteId;
  title: string;
  payoff: string;
  why: string;
  iconItemId?: number;
  primaryLabel: string;
  nextAction: string;
  nextBlocker: string;
  prepLevel: "Low" | "Medium" | "High";
  stopPoint: string;
  blockersLeft: number;
  progressPercent: number;
  blockers: UnlockRouteBlocker[];
  requiredQuests: string[];
  requiredSkills: Array<{ skill: string; level: number; currentLevel: number; met: boolean }>;
  requiredDiaryTiers: Array<{ region: string; tier: DiaryTier; met: boolean }>;
  requiredItems: Array<{ name: string; quantity: number; availabilityCopy: string }>;
  accountTypeNote?: string;
}

interface UnlockRouteDefinition {
  id: Exclude<UnlockRouteId, "diary-unlocks">;
  title: string;
  payoff: string;
  why: string;
  iconItemId?: number;
  requiredQuests?: string[];
  requiredSkills?: Array<{ skill: string; level: number }>;
  requiredDiaryTiers?: Array<{ region: string; tier: DiaryTier }>;
  requiredItems?: Array<{ name: string; quantity: number }>;
  activityRequirements?: string[];
  minQuestPoints?: number;
  stopPoint: string;
}

// ── Skills ──────────────────────────────────────────────────────────

const SKILL_NAMES = [
  "Attack", "Defence", "Strength", "Hitpoints", "Ranged", "Prayer",
  "Magic", "Cooking", "Woodcutting", "Fletching", "Fishing", "Firemaking",
  "Crafting", "Smithing", "Mining", "Herblore", "Agility", "Thieving",
  "Slayer", "Farming", "Runecraft", "Hunter", "Construction", "Sailing"
];

const SKILLER_PROGRESS_SKILLS = [
  "Cooking", "Woodcutting", "Fletching", "Fishing", "Firemaking",
  "Crafting", "Smithing", "Mining", "Herblore", "Agility", "Thieving",
  "Farming", "Runecraft", "Hunter", "Construction", "Sailing"
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

function inferSkillerProgressMode(
  skills: HiscoreSkill[],
  accountType?: PlannerAccountType
): boolean {
  if (accountType === "skiller") return true;
  if (skills.length === 0) return false;
  const level = (name: string) => skills.find((s) => s.name === name)?.level ?? 1;
  const combatLevel = computeCombatLevel(skills);
  const nonCombatTotal = SKILLER_PROGRESS_SKILLS.reduce((sum, name) => sum + level(name), 0);
  return combatLevel < 50 && nonCombatTotal >= 800;
}

function skillsPath(
  skills: HiscoreSkill[],
  accountType?: PlannerAccountType
): PathProgress {
  if (skills.length === 0) {
    return {
      kind: "skills",
      label: "Skills",
      tagline: "Add your OSRS name to see skill progress.",
      percent: 0, done: 0, total: SKILL_NAMES.length, nextSteps: [], allSteps: []
    };
  }
  const lvl = (name: string) => skills.find((s) => s.name === name)?.level ?? 1;
  const xp = (name: string) => skills.find((s) => s.name === name)?.xp ?? 0;
  const done = SKILL_NAMES.filter((n) => lvl(n) >= 99).length;
  const total = SKILL_NAMES.length;
  // Percent is a hybrid progress score, not done/total. Pure level-based
  // progress badly overstates all-70 accounts; pure XP-based progress
  // badly understates accounts with broad, useful investment. We keep XP as
  // the dominant signal and add a level floor. Level-3 skillers are scored
  // against non-combat skills so the path reflects the account they are
  // intentionally building, not a main they are avoiding.
  const progressSkills = inferSkillerProgressMode(skills, accountType)
    ? SKILLER_PROGRESS_SKILLS
    : SKILL_NAMES;
  const xpAt99 = xpForLevel(99); // 13_034_431
  const xpPercent = progressSkills.reduce((sum, n) => sum + Math.min(xpAt99, xp(n)), 0)
    / (xpAt99 * progressSkills.length) * 100;
  const levelPercent = progressSkills.reduce((sum, n) => sum + Math.min(99, lvl(n)), 0)
    / (99 * progressSkills.length) * 100;
  const percent = Math.min(100, Math.round(xpPercent * 0.65 + levelPercent * 0.35));
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
      : progressSkills === SKILLER_PROGRESS_SKILLS
        ? `${done}/${total} at 99, skiller-weighted progress.`
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

/** Exact-data variant of diariesPath driven by scapestack-plugin sync.
 *  Each completed key is 'Region:Tier' (e.g. 'Karamja:Hard'). */
function diariesPathFromSync(
  diaries: Map<string, DiaryRecord>,
  skills: HiscoreSkill[],
  exactCompleted: Set<string>
): PathProgress {
  const lvl = (name: string) => skills.find((s) => s.name === name)?.level ?? 1;
  const total = diaries.size * 4;
  const allSteps: PathProgress["allSteps"] = [];
  let done = 0;

  for (const [region, d] of diaries) {
    for (const tier of DIARY_TIERS_ORDER) {
      const reqs = d.tiers[tier]?.skills ?? [];
      if (reqs.length === 0) continue;
      const isDone = exactCompleted.has(`${region}:${tier}`);
      if (isDone) done++;
      const whyMissing = reqs.filter((r) => lvl(r.skill) < r.level)
        .map((r) => `${r.skill} ${r.level}`).join(", ");
      allSteps.push({
        title: `${region} — ${tier}`,
        why: isDone ? "Synced from your game" : whyMissing ? `Need: ${whyMissing}` : "Open",
        status: isDone ? "done" : "open",
        iconItemId: 11140
      });
    }
  }

  // Next steps: the three highest-tier diaries the player meets stats
  // for but hasn't completed yet (according to scapestack sync).
  const tierRank: Record<DiaryTier, number> = { Easy: 1, Medium: 2, Hard: 3, Elite: 4 };
  const candidates: Array<{ region: string; tier: DiaryTier; margin: number }> = [];
  for (const [region, d] of diaries) {
    for (const tier of DIARY_TIERS_ORDER) {
      if (exactCompleted.has(`${region}:${tier}`)) continue;
      const reqs = d.tiers[tier]?.skills ?? [];
      if (reqs.length === 0) continue;
      const margins = reqs.map((r) => lvl(r.skill) - r.level);
      const allMet = margins.every((m) => m >= 0);
      const minMargin = margins.length > 0 ? Math.min(...margins) : 0;
      if (allMet) candidates.push({ region, tier, margin: minMargin });
    }
  }
  candidates.sort((a, b) =>
    (tierRank[b.tier] - tierRank[a.tier]) || (a.margin - b.margin)
  );
  const nextSteps: PathStep[] = candidates.slice(0, 3).map((c) => ({
    title: `${c.region} Diary — ${c.tier}`,
    why: `Your visible stats clear this tier's skill gates.`,
    iconItemId: 11140
  }));

  return {
    kind: "diaries",
    label: "Diaries",
    tagline: done === total
      ? "All diary tiers complete · synced from your game."
      : `${total - done} open · synced from your game.`,
    percent: Math.round((done / total) * 100),
    done, total, nextSteps, allSteps
  };
}

function diariesPath(
  diaries: Map<string, DiaryRecord>,
  skills: HiscoreSkill[],
  exactCompleted?: Set<string>
): PathProgress {
  if (diaries.size === 0) {
    return {
      kind: "diaries",
      label: "Diaries",
      tagline: "Diary data unavailable.",
      percent: 0, done: 0, total: 0, nextSteps: [], allSteps: []
    };
  }
  // Scapestack-sync path — exact data per region+tier. Skip the
  // heuristics entirely when we have it.
  if (exactCompleted && exactCompleted.size > 0) {
    return diariesPathFromSync(diaries, skills, exactCompleted);
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
    why: `Your visible stats clear this tier's skill gates.`,
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

// ── Unlock Route Planner ────────────────────────────────────────────

const UNLOCK_ROUTE_DEFINITIONS: UnlockRouteDefinition[] = [
  {
    id: "barrows-gloves",
    title: "Barrows gloves",
    payoff: "Best-in-slot hybrid gloves and a clean midgame quest spine.",
    why: "Recipe for Disaster pulls together the account routes that matter before serious PvM.",
    iconItemId: 7462,
    requiredQuests: ["Recipe for Disaster"],
    requiredSkills: [
      { skill: "Cooking", level: 70 },
      { skill: "Agility", level: 48 },
      { skill: "Herblore", level: 25 },
      { skill: "Magic", level: 59 }
    ],
    requiredItems: [
      { name: "Eye of newt", quantity: 1 },
      { name: "Rope", quantity: 1 }
    ],
    stopPoint: "Finish the next RFD subquest or clear one prerequisite quest."
  },
  {
    id: "fairy-rings",
    title: "Fairy rings",
    payoff: "Fast travel for quests, clues, Slayer and farming loops.",
    why: "Fairy rings cut travel friction from almost every future session.",
    iconItemId: 772,
    requiredQuests: ["Priest in Peril", "Fairytale I - Growing Pains", "Fairytale II - Cure a Queen"],
    requiredItems: [{ name: "Dramen staff", quantity: 1 }],
    stopPoint: "Unlock fairy ring access, then re-sync before planning the next quest chain."
  },
  {
    id: "piety",
    title: "Piety",
    payoff: "Major melee DPS and defence prayer for Slayer and bossing.",
    why: "Piety changes combat efficiency more than another unfocused melee level.",
    iconItemId: 2413,
    requiredQuests: ["King's Ransom"],
    requiredSkills: [
      { skill: "Prayer", level: 70 },
      { skill: "Defence", level: 65 }
    ],
    activityRequirements: ["Knight Waves training ground"],
    stopPoint: "Finish King's Ransom, hit 70 Prayer, or complete Knight Waves."
  },
  {
    id: "avas-assembler",
    title: "Ava's assembler",
    payoff: "Ranged cape-slot upgrade and better ranged trips.",
    why: "Assembler prep turns ranged PvM sessions into cleaner supply loops.",
    iconItemId: 22109,
    requiredQuests: ["Animal Magnetism", "Dragon Slayer II"],
    requiredSkills: [{ skill: "Ranged", level: 70 }],
    requiredItems: [
      { name: "Ava's accumulator", quantity: 1 },
      { name: "Vorkath's head", quantity: 1 }
    ],
    stopPoint: "Kill Vorkath for the head or bank the assembler materials."
  },
  {
    id: "dragon-defender",
    title: "Dragon defender",
    payoff: "Core melee offhand for Slayer, quests and boss entry.",
    why: "The defender is a permanent melee upgrade with a bounded grind.",
    iconItemId: 12954,
    requiredSkills: [
      { skill: "Attack", level: 60 },
      { skill: "Strength", level: 60 }
    ],
    requiredItems: [{ name: "Warrior guild tokens", quantity: 100 }],
    stopPoint: "Reach dragon defender or stop after one token stack is spent."
  },
  {
    id: "quest-cape",
    title: "Quest cape",
    payoff: "All quest unlocks, teleports and a finished account spine.",
    why: "Quest cape progress is the clearest long-term unlock route.",
    iconItemId: 9813,
    minQuestPoints: 290,
    requiredSkills: [
      { skill: "Agility", level: 70 },
      { skill: "Herblore", level: 70 },
      { skill: "Thieving", level: 70 },
      { skill: "Magic", level: 75 }
    ],
    stopPoint: "Finish one high-value quest or clear the nearest quest-cape skill gate."
  },
  {
    id: "raids-prep",
    title: "Raids prep",
    payoff: "Account becomes ready for CoX/ToA learning groups.",
    why: "Raids prep bundles combat, prayer and potion gates into one practical route.",
    iconItemId: 21012,
    requiredQuests: ["A Kingdom Divided", "Beneath Cursed Sands"],
    requiredSkills: [
      { skill: "Attack", level: 85 },
      { skill: "Strength", level: 85 },
      { skill: "Defence", level: 80 },
      { skill: "Ranged", level: 85 },
      { skill: "Magic", level: 85 },
      { skill: "Prayer", level: 70 },
      { skill: "Herblore", level: 78 }
    ],
    requiredItems: [
      { name: "Trident of the seas", quantity: 1 },
      { name: "Blowpipe", quantity: 1 }
    ],
    stopPoint: "Clear the nearest combat/prayer gate or finish one raid unlock quest."
  },
  {
    id: "slayer-unlocks",
    title: "Slayer unlocks",
    payoff: "Better tasks, bosses and long-term combat money routes.",
    why: "Slayer unlocks decide what tasks are worth doing next.",
    iconItemId: 11864,
    requiredQuests: ["Smoking Kills"],
    requiredSkills: [
      { skill: "Slayer", level: 75 },
      { skill: "Combat", level: 85 }
    ],
    activityRequirements: ["Useful block list and task unlocks reviewed"],
    stopPoint: "Hit the next Slayer gate, unlock a task, or fix the block list."
  }
];

function normalizeRouteName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}

function skillLevelForRoute(skills: HiscoreSkill[], skill: string): number {
  if (skill === "Combat") return skills.length > 0 ? computeCombatLevel(skills) : 0;
  return skills.find((row) => row.name.toLowerCase() === skill.toLowerCase())?.level ?? 1;
}

function completedQuestNamesFromPath(path: PathProgress): Set<string> {
  return new Set(path.allSteps
    .filter((step) => step.status === "done")
    .map((step) => normalizeRouteName(step.title)));
}

function questRecordByName(quests: Map<string, QuestRecord>, name: string): QuestRecord | null {
  const direct = quests.get(name);
  if (direct) return direct;
  const normalized = normalizeRouteName(name);
  return [...quests.values()].find((quest) => normalizeRouteName(quest.name) === normalized) ?? null;
}

function routePrepLevel(blockers: UnlockRouteBlocker[]): UnlockRoutePlan["prepLevel"] {
  if (blockers.length >= 5) return "High";
  if (blockers.length >= 2) return "Medium";
  return "Low";
}

function routePrimaryLabel(blockers: UnlockRouteBlocker[]): string {
  if (blockers.length === 0) return "Ready";
  const first = blockers[0];
  if (first.type === "skill") return first.nextAction;
  if (first.type === "quest") return first.nextAction;
  return `${blockers.length} blocker${blockers.length === 1 ? "" : "s"} left`;
}

function accountRouteNote(accountType: PlannerAccountType | null | undefined, hasItems: boolean): string | undefined {
  if (!hasItems) return undefined;
  if (accountType === "ultimate") return "UIM: item prep is staging/carrying, not bank-ready.";
  if (accountType === "group") return "GIM: own bank counts; group storage is not assumed.";
  if (accountType === "hardcore") return "HCIM: avoid risky item sources unless the payoff is worth it.";
  if (accountType === "ironman") return "Ironman: item blockers assume self-sourcing, not GE buying.";
  return undefined;
}

function buildStaticUnlockRoute(input: {
  definition: UnlockRouteDefinition;
  quests: Map<string, QuestRecord>;
  skills: HiscoreSkill[];
  questPath: PathProgress;
  completedDiaryTiers: Set<string>;
  questPoints: number;
  accountType: PlannerAccountType | null | undefined;
}): UnlockRoutePlan {
  const def = input.definition;
  const completedQuests = completedQuestNamesFromPath(input.questPath);
  const blockers: UnlockRouteBlocker[] = [];

  for (const questName of def.requiredQuests ?? []) {
    const questDone = completedQuests.has(normalizeRouteName(questName));
    if (questDone) continue;
    const quest = questRecordByName(input.quests, questName);
    const missingPrereq = quest?.questReqs.find((name) => !completedQuests.has(normalizeRouteName(name)));
    if (missingPrereq) {
      blockers.push({
        type: "quest",
        label: missingPrereq,
        detail: `${questName} needs this prerequisite first.`,
        nextAction: `Complete ${missingPrereq} for ${questName}`
      });
    }
    blockers.push({
      type: "quest",
      label: questName,
      detail: quest ? `${quest.difficulty}${quest.length ? ` · ${quest.length}` : ""}` : "Required quest",
      nextAction: `Complete ${questName}`
    });
  }

  const requiredSkills = (def.requiredSkills ?? []).map((req) => {
    const currentLevel = skillLevelForRoute(input.skills, req.skill);
    const met = currentLevel >= req.level;
    if (!met) {
      blockers.push({
        type: "skill",
        label: `${req.skill} ${currentLevel}/${req.level}`,
        detail: `${req.level - currentLevel} level${req.level - currentLevel === 1 ? "" : "s"} short.`,
        nextAction: `Train ${req.skill} to ${req.level}`
      });
    }
    return { ...req, currentLevel, met };
  });

  const requiredDiaryTiers = (def.requiredDiaryTiers ?? []).map((req) => {
    const met = input.completedDiaryTiers.has(diaryTierKey(req.region, req.tier));
    if (!met) {
      blockers.push({
        type: "diary",
        label: `${req.region} ${req.tier} diary`,
        detail: "Diary tier is required for this route.",
        nextAction: `Complete ${req.region} ${req.tier} diary`
      });
    }
    return { ...req, met };
  });

  if (def.minQuestPoints && input.questPoints < def.minQuestPoints) {
    blockers.push({
      type: "qp",
      label: `${input.questPoints}/${def.minQuestPoints} quest points`,
      detail: `${def.minQuestPoints - input.questPoints} quest points short.`,
      nextAction: `Earn ${def.minQuestPoints - input.questPoints} more quest points`
    });
  }

  const requiredItems = (def.requiredItems ?? []).map((item) => {
    const availability = evaluateItemAvailability({
      name: item.name,
      quantity: item.quantity,
      ownedInBank: false,
      accountType: input.accountType ?? null
    });
    return { ...item, availabilityCopy: availability.copy };
  });

  if (blockers.length === 0) {
    for (const item of requiredItems.slice(0, 2)) {
      blockers.push({
        type: "item",
        label: `${item.quantity}x ${item.name}`,
        detail: item.availabilityCopy,
        nextAction: item.availabilityCopy.replace(/\.$/, "")
      });
    }
  }

  if (blockers.length === 0) {
    for (const activity of def.activityRequirements ?? []) {
      blockers.push({
        type: "activity",
        label: activity,
        detail: "Manual activity check; RuneLite cannot prove this yet.",
        nextAction: activity
      });
    }
  } else {
    for (const activity of def.activityRequirements ?? []) {
      blockers.push({
        type: "activity",
        label: activity,
        detail: "Manual activity check after the quest/skill gates.",
        nextAction: activity
      });
    }
  }

  const totalTrackable =
    (def.requiredQuests?.length ?? 0)
    + requiredSkills.length
    + requiredDiaryTiers.length
    + (def.minQuestPoints ? 1 : 0)
    + (def.activityRequirements?.length ?? 0);
  const completedTrackable =
    (def.requiredQuests ?? []).filter((name) => completedQuests.has(normalizeRouteName(name))).length
    + requiredSkills.filter((req) => req.met).length
    + requiredDiaryTiers.filter((req) => req.met).length
    + (def.minQuestPoints ? input.questPoints >= def.minQuestPoints ? 1 : 0 : 0);
  const progressPercent = totalTrackable > 0
    ? Math.round((completedTrackable / totalTrackable) * 100)
    : blockers.length === 0 ? 100 : 0;

  const first = blockers[0];
  return {
    id: def.id,
    title: def.title,
    payoff: def.payoff,
    why: def.why,
    iconItemId: def.iconItemId,
    primaryLabel: routePrimaryLabel(blockers),
    nextAction: first?.nextAction ?? `Start ${def.title}`,
    nextBlocker: first?.label ?? "Ready",
    prepLevel: routePrepLevel(blockers),
    stopPoint: def.stopPoint,
    blockersLeft: blockers.length,
    progressPercent,
    blockers,
    requiredQuests: def.requiredQuests ?? [],
    requiredSkills,
    requiredDiaryTiers,
    requiredItems,
    accountTypeNote: accountRouteNote(input.accountType, requiredItems.length > 0)
  };
}

function buildDiaryUnlockRoute(input: {
  diaries: Map<string, DiaryRecord>;
  skills: HiscoreSkill[];
  questPath: PathProgress;
  completedDiaryTiers: Set<string>;
  accountType: PlannerAccountType | null | undefined;
}): UnlockRoutePlan {
  const completedQuests = [...completedQuestNamesFromPath(input.questPath)];
  let best:
    | { region: string; tier: DiaryTier; blockers: UnlockRouteBlocker[]; progressPercent: number; payoff: string; stopPoint: string; items: UnlockRoutePlan["requiredItems"] }
    | null = null;

  for (const [region, diary] of input.diaries) {
    for (const tier of DIARY_TIERS_ORDER) {
      if (input.completedDiaryTiers.has(diaryTierKey(region, tier))) continue;
      const evaluation = evaluateDiaryTier(region, tier, diary, {
        skills: input.skills,
        completedQuests,
        completedDiaryTiers: input.completedDiaryTiers,
        accountType: input.accountType ?? null
      });
      if (evaluation.readinessStatus === "completed") continue;
      const blockers: UnlockRouteBlocker[] = [
        ...evaluation.skillRequirements.filter((req) => !req.met).map((req) => ({
          type: "skill" as const,
          label: `${req.skill} ${req.currentLevel}/${req.level}`,
          detail: `${req.level - req.currentLevel} level${req.level - req.currentLevel === 1 ? "" : "s"} short.`,
          nextAction: `Train ${req.skill} to ${req.level}`
        })),
        ...evaluation.questRequirements.filter((req) => !req.met).map((req) => ({
          type: "quest" as const,
          label: req.name,
          detail: `${region} ${tier} diary needs this quest.`,
          nextAction: `Complete ${req.name} for ${region} ${tier}`
        })),
        ...evaluation.tierDependencies.filter((req) => !req.met).map((req) => ({
          type: "diary" as const,
          label: `${region} ${req.tier} diary`,
          detail: `${region} ${tier} needs the previous diary tier first.`,
          nextAction: `Complete ${region} ${req.tier} diary`
        })),
        ...evaluation.itemRequirements.filter((req) => !req.ownedInBank).map((req) => ({
          type: "item" as const,
          label: `${req.quantity}x ${req.name}`,
          detail: req.availabilityCopy,
          nextAction: req.availability.shortCopy
        })),
        ...evaluation.tasksLeft.slice(0, 2).map((task) => ({
          type: "activity" as const,
          label: task,
          detail: "Diary task still needs an in-game check.",
          nextAction: task
        }))
      ];
      const total = evaluation.skillRequirements.length + evaluation.questRequirements.length + evaluation.itemRequirements.length + evaluation.tasksLeft.length;
      const done = evaluation.completedRequirements.length;
      const progressPercent = total > 0 ? Math.min(99, Math.round((done / total) * 100)) : 0;
      const candidate = {
        region,
        tier,
        blockers,
        progressPercent,
        payoff: evaluation.payoff,
        stopPoint: evaluation.stopPoint,
        items: evaluation.itemRequirements.map((req) => ({
          name: req.name,
          quantity: req.quantity,
          availabilityCopy: req.availabilityCopy
        }))
      };
      if (!best || blockers.length < best.blockers.length || (blockers.length === best.blockers.length && progressPercent > best.progressPercent)) {
        best = candidate;
      }
      break;
    }
  }

  const blockers = best?.blockers ?? [];
  const first = blockers[0];
  return {
    id: "diary-unlocks",
    title: "Diary unlocks",
    payoff: best?.payoff ?? "Diary teleports, quality-of-life perks and route shortcuts.",
    why: best ? `${best.region} ${best.tier} is the closest visible diary tier.` : "Diary tiers turn scattered requirements into concrete regional unlocks.",
    iconItemId: 11140,
    primaryLabel: best ? routePrimaryLabel(blockers) : "Add diary data",
    nextAction: first?.nextAction ?? "Open the closest diary tier",
    nextBlocker: first?.label ?? "No diary route available",
    prepLevel: routePrepLevel(blockers),
    stopPoint: best?.stopPoint ?? "Clear one diary blocker, then re-sync.",
    blockersLeft: blockers.length,
    progressPercent: best?.progressPercent ?? 0,
    blockers,
    requiredQuests: [],
    requiredSkills: [],
    requiredDiaryTiers: best ? [{ region: best.region, tier: best.tier, met: false }] : [],
    requiredItems: best?.items ?? [],
    accountTypeNote: accountRouteNote(input.accountType, (best?.items.length ?? 0) > 0)
  };
}

function buildUnlockRoutes(input: {
  quests: Map<string, QuestRecord>;
  diaries: Map<string, DiaryRecord>;
  skills: HiscoreSkill[];
  questPath: PathProgress;
  completedDiaryTiers: Set<string>;
  questPoints: number;
  accountType: PlannerAccountType | null | undefined;
}): UnlockRoutePlan[] {
  const staticRoutes = UNLOCK_ROUTE_DEFINITIONS.map((definition) => buildStaticUnlockRoute({
    definition,
    quests: input.quests,
    skills: input.skills,
    questPath: input.questPath,
    completedDiaryTiers: input.completedDiaryTiers,
    questPoints: input.questPoints,
    accountType: input.accountType
  }));
  return [
    ...staticRoutes,
    buildDiaryUnlockRoute(input)
  ].sort((a, b) => {
    const aReady = a.blockersLeft === 0 ? 20 : 0;
    const bReady = b.blockersLeft === 0 ? 20 : 0;
    return (bReady + b.progressPercent - b.blockersLeft * 4) - (aReady + a.progressPercent - a.blockersLeft * 4);
  });
}

// ── Public API ──────────────────────────────────────────────────────

/** Account-level metadata pulled from WOM (best-effort enrichment).
 *  Drives the 'Synced via Wise Old Man' badge + account-type-aware
 *  recommendations. Always null when the player isn't on WOM. */
export interface AccountMeta {
  displayName: string;
  /** Normalised account type from WOM or Scapestack Sync. */
  accountType: PlannerAccountType;
  /** Efficient Hours Played — sum of optimal time invested. */
  ehp: number;
  /** Efficient Hours Bossed. */
  ehb: number;
  /** When the player last gained XP, per WOM. */
  lastChangedAt: string | null;
}

export interface PathOverview {
  paths: [PathProgress, PathProgress, PathProgress, PathProgress];
  /** Player-facing unlock planners. Percent remains secondary; each
   *  card leads with the blocker/action/stop-point instead. */
  unlockRoutes: UnlockRoutePlan[];
  /** Overall % across all four paths, averaged. */
  overallPercent: number;
  /** Set when WOM had a player record; null otherwise. UI checks this
   *  to render the 'Synced via Wise Old Man' badge. */
  accountMeta: AccountMeta | null;
  /** Which external trackers returned data for this player. Drives the
   *  'Synced via WOM/Temple/CL/Scapestack' badge.
   *  scapestack is the live plugin sync — when present we also surface
   *  freshness + counts in the badge ("Synced 2 min ago · N quests…")
   *  so the user knows the plugin is actually working. */
  syncedSources?: {
    wom: boolean;
    temple: boolean;
    collectionLog: boolean;
    scapestack: {
      syncedAt: string;
      quests: number;
      diaries: number;
      clItems: number;
      pluginVersion?: string;
      slayerTaskRemaining?: number | null;
      slayerBlocks?: number;
      bankStatus?: PluginBankStatus;
    } | null;
  };
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
  /** Our own scapestack-plugin sync data. Highest-priority signal —
   *  exact quest + diary + CL state straight from the game client.
   *  When present, overrides Temple/cl.net and bypasses heuristics. */
  scapestackSync?: {
    questsCompleted: Set<string>;
    diariesCompleted: Set<string>; // 'Region:Tier' keys
    collectionLogItemIds: Set<number>;
  };
  /** Tracks which external sources had data, drives the synced-badge
   *  copy. */
  syncedSources?: {
    wom: boolean;
    temple: boolean;
    collectionLog: boolean;
    scapestack: {
      syncedAt: string;
      quests: number;
      diaries: number;
      clItems: number;
      pluginVersion?: string;
      slayerTaskRemaining?: number | null;
      slayerBlocks?: number;
      bankStatus?: PluginBankStatus;
    } | null;
  };
}

export function computePathProgress(input: ComputePathProgressInput): PathOverview {
  // Scapestack-plugin sync has priority — when it's present, the player
  // installed our plugin and the data is authoritative. We merge into
  // the existing maps:
  //   - quests: scapestack-sync overrides Temple
  //   - CL items: scapestack-sync merges into the cl.net set
  //   - diaries: only scapestack-sync provides this; otherwise we fall
  //     back to the skill-margin + XP-evidence heuristics
  const effectiveQuests = input.scapestackSync?.questsCompleted ?? input.templeQuestsCompleted;
  const effectiveClItems = input.scapestackSync
    ? new Set([
        ...Array.from(input.collectionLogOwnedItemIds ?? []),
        ...Array.from(input.scapestackSync.collectionLogItemIds)
      ])
    : input.collectionLogOwnedItemIds;
  const paths: [PathProgress, PathProgress, PathProgress, PathProgress] = [
    skillsPath(input.skills, input.accountMeta?.accountType),
    questsPath(input.quests, input.skills, input.questPoints, effectiveQuests),
    diariesPath(input.diaries, input.skills, input.scapestackSync?.diariesCompleted),
    bossesPath(input.bossKc, input.skills, input.womBossKills, effectiveClItems)
  ];
  const unlockRoutes = buildUnlockRoutes({
    quests: input.quests,
    diaries: input.diaries,
    skills: input.skills,
    questPath: paths[1],
    completedDiaryTiers: input.scapestackSync?.diariesCompleted ?? new Set(),
    questPoints: input.questPoints,
    accountType: input.accountMeta?.accountType ?? null
  });
  const overallPercent = Math.round(
    paths.reduce((sum, p) => sum + p.percent, 0) / paths.length
  );
  return {
    paths,
    unlockRoutes,
    overallPercent,
    accountMeta: input.accountMeta ?? null,
    syncedSources: input.syncedSources
  };
}
