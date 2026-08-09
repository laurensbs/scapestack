import { BOSSES } from "./bosses";
import { GOAL_ICON_IDS, GOAL_SETS } from "./goals";
import { SKILL_CAPE_IDS } from "./skill-capes";
import { XP_TABLE } from "./skill-methods/types";
import { UNLOCK_GOAL_DEFINITIONS } from "./unlock-goal-catalog";

export const PINNED_GOALS_EVENT = "scapestack:pinned-goals-change";
const STORE_VERSION = 1;
const MAX_GOALS = 24;

/**
 * What the account looked like when the goal was pinned (SPEC §3.1).
 *
 * Percentages are measured from goal start, not from zero. Without this a
 * level-92 player who pins 99 reads as 92% done on the day they set it, which
 * is not encouragement — it is the product taking credit for nine years of
 * someone else's play.
 *
 * `skills` is an array of {name, level, xp} because that is the shape
 * sync_snapshot stores and the shape item 1's backfill wrote into this column.
 * Reading it as a keyed object would have silently ignored every backfilled
 * baseline in production.
 */
export interface PinnedGoalBaseline {
  capturedAt: string;
  skills?: ReadonlyArray<{ name: string; level: number; xp: number }>;
  bosses?: Readonly<Record<string, number>>;
  clogSlots?: number;
  caPoints?: number;
  /** Derived from an older snapshot rather than read at pin time. */
  backfilled?: boolean;
}

export type PinnedGoalKind =
  | "item" | "level" | "unlock"
  | "skill_xp" | "boss_kc" | "quest" | "diary" | "clog_slots" | "ca_tier";

interface GoalBase {
  key: string;
  kind: PinnedGoalKind;
  target: string;
  spriteItemId: number | null;
  pinnedAt: string;
  /** Null when the goal predates baselines or nothing could be read. */
  baseline?: PinnedGoalBaseline | null;
  /** Exactly one per account (§3.1), enforced by a partial unique index. */
  isPrimary?: boolean;
}

export interface PinnedItemGoal extends GoalBase {
  kind: "item";
  goalId: string;
}

export interface PinnedLevelGoal extends GoalBase {
  kind: "level";
  skill: string;
  targetLevel: number;
}

export interface PinnedUnlockGoal extends GoalBase {
  kind: "unlock";
  unlockId: string;
}

export interface PinnedSkillXpGoal extends GoalBase {
  kind: "skill_xp";
  skill: string;
  targetXp: number;
}

export interface PinnedBossKcGoal extends GoalBase {
  kind: "boss_kc";
  bossSlug: string;
  bossName: string;
  targetKc: number;
}

export interface PinnedQuestGoal extends GoalBase {
  kind: "quest";
  questId: string;
  questName: string;
}

export type DiaryTier = "Easy" | "Medium" | "Hard" | "Elite";

export interface PinnedDiaryGoal extends GoalBase {
  kind: "diary";
  region: string;
  tier: DiaryTier;
}

export interface PinnedClogSlotsGoal extends GoalBase {
  kind: "clog_slots";
  targetSlots: number;
}

export type CombatAchievementTier = "Easy" | "Medium" | "Hard" | "Elite" | "Master" | "Grandmaster";

export interface PinnedCaTierGoal extends GoalBase {
  kind: "ca_tier";
  tier: CombatAchievementTier;
}

export type PinnedGoal =
  | PinnedItemGoal | PinnedLevelGoal | PinnedUnlockGoal
  | PinnedSkillXpGoal | PinnedBossKcGoal | PinnedQuestGoal
  | PinnedDiaryGoal | PinnedClogSlotsGoal | PinnedCaTierGoal;

interface NewPinnedGoalMeta {
  pinnedAt?: string;
  baseline?: PinnedGoalBaseline | null;
  isPrimary?: boolean;
}

export type NewPinnedGoal =
  | ({ kind: "item"; goalId: string } & NewPinnedGoalMeta)
  | ({ kind: "level"; skill: string; targetLevel: number } & NewPinnedGoalMeta)
  | ({ kind: "unlock"; unlockId: string } & NewPinnedGoalMeta)
  | ({ kind: "skill_xp"; skill: string; targetXp: number } & NewPinnedGoalMeta)
  | ({ kind: "boss_kc"; bossSlug: string; targetKc: number } & NewPinnedGoalMeta)
  | ({ kind: "quest"; questId: string } & NewPinnedGoalMeta)
  | ({ kind: "diary"; region: string; tier: DiaryTier } & NewPinnedGoalMeta)
  | ({ kind: "clog_slots"; targetSlots: number } & NewPinnedGoalMeta)
  | ({ kind: "ca_tier"; tier: CombatAchievementTier } & NewPinnedGoalMeta);

export interface PinnedGoalProgressEvidence {
  /**
   * XP is carried, not just the level. A percentage between two levels needs
   * it: 92 → 99 Slayer is 6.5M XP of work, and counting it in levels reports
   * a player one seventh of the way there on their first 100k.
   */
  skills: ReadonlyArray<{ name: string; level: number; xp?: number }>;
  ownedItemGoalIds?: readonly string[];
  unlocks?: Record<string, { completed: number; total: number; note: string | null }>;
  /** Boss slug → kill count. Absent means unread, which is never zero. */
  bossKc?: Readonly<Record<string, number>>;
  questsCompleted?: readonly string[];
  diariesCompleted?: ReadonlyArray<{ region: string; tier: DiaryTier }>;
  clogSlots?: number;
  caPoints?: number;
}

export interface PinnedGoalProgress {
  fraction: string | null;
  /**
   * 0–100, measured from the baseline (§3.1). Null when it cannot be known —
   * no baseline, or the metric needs RuneLite and has not been read. Null is
   * not 0: "you have made no progress" is a claim, and an unread metric does
   * not support it.
   */
  percent: number | null;
  done: boolean;
  note: string | null;
}

interface StoredGoals {
  version: 1;
  goals: PinnedGoal[];
}

export interface ItemGoalChoice {
  goalId: string;
  target: string;
  spriteItemId: number | null;
  group: string;
}

export type PinnedGoalKindLabel =
  | "Item" | "Level" | "Unlock" | "XP" | "KC" | "Quest" | "Diary" | "Log" | "CA";

export interface PinnedGoalChoice {
  key: string;
  kind: PinnedGoal["kind"];
  kindLabel: PinnedGoalKindLabel;
  target: string;
  group: string;
  spriteItemId: number | null;
  input: NewPinnedGoal;
}

/**
 * The XP totals players actually name. 13,034,431 is level 99; the rest are
 * the round numbers the game's own community counts in. Not every million:
 * a picker with 200 rows per skill is a worse picker.
 */
export const SKILL_XP_TARGETS = [13_034_431, 25_000_000, 50_000_000, 100_000_000, 200_000_000] as const;

/** The same round numbers the milestone thresholds use, minus the small ones. */
export const BOSS_KC_TARGETS = [100, 500, 1_000] as const;

export const CLOG_SLOT_TARGETS = [500, 1_000, 1_500] as const;

export const COMBAT_ACHIEVEMENT_TIERS: readonly CombatAchievementTier[] =
  ["Easy", "Medium", "Hard", "Elite", "Master", "Grandmaster"] as const;

/**
 * Points needed for each Combat Achievement tier cape, cumulative.
 * Source: oldschool.runescape.wiki/w/Combat_Achievements.
 */
export const COMBAT_ACHIEVEMENT_TIER_POINTS: Record<CombatAchievementTier, number> = {
  Easy: 33,
  Medium: 115,
  Hard: 304,
  Elite: 820,
  Master: 1_465,
  Grandmaster: 2_005
};

export const DIARY_TIERS: readonly DiaryTier[] = ["Easy", "Medium", "Hard", "Elite"] as const;

function formatXpTarget(xp: number): string {
  if (xp >= 1_000_000) {
    const millions = xp / 1_000_000;
    return `${Number.isInteger(millions) ? millions : millions.toFixed(1)}M`;
  }
  return xp.toLocaleString("en-GB");
}

export const ITEM_GOAL_CHOICES: ItemGoalChoice[] = GOAL_SETS.flatMap((set) =>
  set.goals.map((goal) => ({
    goalId: goal.id,
    target: goal.name,
    spriteItemId: GOAL_ICON_IDS[goal.id] ?? null,
    group: set.name
  }))
);

export const LEVEL_GOAL_SKILLS = Object.keys(SKILL_CAPE_IDS);

function normalizeGoalSearch(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}

function searchAliases(value: string): string[] {
  const words = normalizeGoalSearch(value).split(" ").filter(Boolean);
  if (words.length === 0) return [];
  const compact = words.join("");
  const initials = words.map((word) => word[0]).join("");
  const playerShorthand = words.length > 1
    ? `${words.slice(0, -1).map((word) => word[0]).join("")}${words.at(-1)}`
    : compact;
  return [compact, initials, playerShorthand];
}

const unlockTargets = new Set(UNLOCK_GOAL_DEFINITIONS.map((definition) => normalizeGoalSearch(definition.title)));

export const PINNED_GOAL_CHOICES: PinnedGoalChoice[] = [
  ...ITEM_GOAL_CHOICES
    .filter((choice) => !unlockTargets.has(normalizeGoalSearch(choice.target)) && !/skill capes/i.test(choice.group))
    .map((choice) => ({
      key: `item:${choice.goalId}`,
      kind: "item" as const,
      kindLabel: "Item" as const,
      target: choice.target,
      group: choice.group,
      spriteItemId: choice.spriteItemId,
      input: { kind: "item" as const, goalId: choice.goalId }
    })),
  ...LEVEL_GOAL_SKILLS.map((skill) => ({
    key: `level:${normalizedKeyPart(skill)}:99`,
    kind: "level" as const,
    kindLabel: "Level" as const,
    target: `99 ${skill}`,
    group: "Skill cape",
    spriteItemId: SKILL_CAPE_IDS[skill] ?? null,
    input: { kind: "level" as const, skill, targetLevel: 99 }
  })),
  ...UNLOCK_GOAL_DEFINITIONS.map((definition) => ({
    key: `unlock:${definition.id}`,
    kind: "unlock" as const,
    kindLabel: "Unlock" as const,
    target: definition.title,
    group: "Account unlock",
    spriteItemId: definition.iconItemId ?? null,
    input: { kind: "unlock" as const, unlockId: definition.id }
  })),
  // Quest and diary goals are deliberately absent from this static list.
  // quest-db and diary-db read from disk with node:fs and are server-only, and
  // this module is client code — importing them would not build. Both kinds
  // are fully pinnable through createPinnedGoal; their choices arrive from the
  // server via pinnedGoalSuggestionsFromPlan, which already runs where that
  // data lives.
  ...LEVEL_GOAL_SKILLS.flatMap((skill) => SKILL_XP_TARGETS.map((targetXp) => ({
    key: `skill_xp:${normalizedKeyPart(skill)}:${targetXp}`,
    kind: "skill_xp" as const,
    kindLabel: "XP" as const,
    target: `${formatXpTarget(targetXp)} ${skill} XP`,
    group: "Skill XP",
    spriteItemId: SKILL_CAPE_IDS[skill] ?? null,
    input: { kind: "skill_xp" as const, skill, targetXp }
  }))),
  ...BOSSES.flatMap((boss) => BOSS_KC_TARGETS.map((targetKc) => ({
    key: `boss_kc:${normalizedKeyPart(boss.slug)}:${targetKc}`,
    kind: "boss_kc" as const,
    kindLabel: "KC" as const,
    target: `${targetKc} ${boss.name} KC`,
    group: "Boss KC",
    spriteItemId: null,
    input: { kind: "boss_kc" as const, bossSlug: boss.slug, targetKc }
  }))),
  ...CLOG_SLOT_TARGETS.map((targetSlots) => ({
    key: `clog_slots:${targetSlots}`,
    kind: "clog_slots" as const,
    kindLabel: "Log" as const,
    target: `${targetSlots} collection log slots`,
    group: "Collection log",
    spriteItemId: null,
    input: { kind: "clog_slots" as const, targetSlots }
  })),
  ...COMBAT_ACHIEVEMENT_TIERS.map((tier) => ({
    key: `ca_tier:${tier.toLowerCase()}`,
    kind: "ca_tier" as const,
    kindLabel: "CA" as const,
    target: `${tier} combat achievements`,
    group: "Combat achievements",
    spriteItemId: null,
    input: { kind: "ca_tier" as const, tier }
  }))
];

const KIND_LABELS: Record<PinnedGoalKind, PinnedGoalKindLabel> = {
  item: "Item",
  level: "Level",
  unlock: "Unlock",
  skill_xp: "XP",
  boss_kc: "KC",
  quest: "Quest",
  diary: "Diary",
  clog_slots: "Log",
  ca_tier: "CA"
};

const KIND_GROUPS: Record<PinnedGoalKind, string> = {
  item: "Item",
  level: "Skill milestone",
  unlock: "Account unlock",
  skill_xp: "Skill XP",
  boss_kc: "Boss KC",
  quest: "Quest",
  diary: "Achievement diary",
  clog_slots: "Collection log",
  ca_tier: "Combat achievements"
};

/**
 * A pickable row for any valid goal, catalogued or not.
 *
 * Falls back to building the row from the goal itself rather than returning
 * null when the static list has no entry. It has to: a level goal at an
 * arbitrary target, and every quest and diary goal, are legitimate and
 * un-catalogued — quest-db and diary-db are server-only. Returning null for
 * those made `pinnedGoalSuggestionsFromPlan` silently drop them, since it
 * filters on exactly this function.
 */
export function pinnedGoalChoiceFromInput(input: NewPinnedGoal): PinnedGoalChoice | null {
  const goal = createPinnedGoal({ ...input, pinnedAt: "1970-01-01T00:00:00.000Z" } as NewPinnedGoal);
  if (!goal) return null;
  const catalogued = PINNED_GOAL_CHOICES.find((choice) => choice.key === goal.key);
  if (catalogued) return catalogued;
  return {
    key: goal.key,
    kind: goal.kind,
    kindLabel: KIND_LABELS[goal.kind],
    target: goal.target,
    group: goal.kind === "level" && goal.targetLevel === 99 ? "Skill cape" : KIND_GROUPS[goal.kind],
    spriteItemId: goal.spriteItemId,
    input
  };
}

export function searchPinnedGoalChoices(query: string, limit = 12): PinnedGoalChoice[] {
  const normalizedQuery = normalizeGoalSearch(query);
  if (!normalizedQuery) return [];
  const requestedLevel = normalizedQuery.match(/(?:^|\s)([2-9]|[1-9][0-9])(?:\s|$)/)?.[1];
  const targetLevel = requestedLevel ? Number(requestedLevel) : null;
  const choices = targetLevel
    ? PINNED_GOAL_CHOICES.map((choice) => choice.kind === "level" && choice.input.kind === "level"
      ? pinnedGoalChoiceFromInput({ ...choice.input, targetLevel }) ?? choice
      : choice)
    : PINNED_GOAL_CHOICES;
  const queryTerms = normalizedQuery.split(" ");
  const compactQuery = queryTerms.join("");
  return choices.filter((choice) => {
    const searchable = normalizeGoalSearch(`${choice.target} ${choice.group} ${choice.kindLabel}`);
    const aliases = [
      ...searchAliases(choice.target),
      ...searchAliases(choice.group),
      ...searchAliases(`${choice.target} ${choice.group}`)
    ];
    return queryTerms.every((term) => searchable.includes(term))
      || aliases.some((alias) => alias.includes(compactQuery));
  }).slice(0, limit);
}

function cleanTimestamp(value: string | undefined): string | null {
  const parsed = value ? Date.parse(value) : Date.now();
  if (!Number.isFinite(parsed)) return null;
  return new Date(parsed).toISOString();
}

function normalizedKeyPart(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

/**
 * Accepts a baseline only in the shape §3.1 can measure against.
 *
 * A malformed baseline must become null rather than a partly-read object: a
 * goal that thinks it has a baseline reports a percentage from whatever it
 * managed to parse, and a wrong percentage is worse than an honest "unknown".
 */
export function parsePinnedGoalBaseline(value: unknown): PinnedGoalBaseline | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  const capturedAt = typeof row.capturedAt === "string" ? cleanTimestamp(row.capturedAt) : null;
  if (!capturedAt) return null;
  const baseline: PinnedGoalBaseline = { capturedAt };

  if (Array.isArray(row.skills)) {
    const skills = row.skills
      .map((entry) => {
        if (!entry || typeof entry !== "object") return null;
        const skill = entry as Record<string, unknown>;
        return typeof skill.name === "string"
          && Number.isFinite(skill.level)
          && Number.isFinite(skill.xp)
          ? { name: skill.name, level: Number(skill.level), xp: Number(skill.xp) }
          : null;
      })
      .filter((entry): entry is { name: string; level: number; xp: number } => entry !== null);
    if (skills.length > 0) baseline.skills = skills;
  }
  if (row.bosses && typeof row.bosses === "object" && !Array.isArray(row.bosses)) {
    const bosses: Record<string, number> = {};
    for (const [name, kc] of Object.entries(row.bosses as Record<string, unknown>)) {
      if (Number.isFinite(kc)) bosses[name] = Number(kc);
    }
    if (Object.keys(bosses).length > 0) baseline.bosses = bosses;
  }
  if (Number.isFinite(row.clogSlots)) baseline.clogSlots = Number(row.clogSlots);
  if (Number.isFinite(row.caPoints)) baseline.caPoints = Number(row.caPoints);
  if (row.backfilled === true) baseline.backfilled = true;
  return baseline;
}

/**
 * The reading to measure this goal's progress against, taken now.
 *
 * Captured from the same evidence the page is already rendering, at the moment
 * the player pins — that is what "from goal start" means, and there is no
 * second chance to take it. A goal pinned without one can never report a
 * percentage, only a raw fraction.
 *
 * Returns null when nothing measurable was available, so the caller stores
 * null rather than a baseline of zeroes. A zeroed baseline is worse than none:
 * it would make every metric read as full progress from nothing.
 */
export function pinnedGoalBaselineFrom(
  evidence: PinnedGoalProgressEvidence,
  capturedAt: string
): PinnedGoalBaseline | null {
  const baseline: PinnedGoalBaseline = { capturedAt };
  const skills = evidence.skills
    .filter((skill) => Number.isFinite(skill.xp))
    .map((skill) => ({ name: skill.name, level: skill.level, xp: Number(skill.xp) }));
  if (skills.length > 0) baseline.skills = skills;
  if (evidence.bossKc && Object.keys(evidence.bossKc).length > 0) baseline.bosses = { ...evidence.bossKc };
  if (evidence.clogSlots !== undefined) baseline.clogSlots = evidence.clogSlots;
  if (evidence.caPoints !== undefined) baseline.caPoints = evidence.caPoints;
  const measured = baseline.skills || baseline.bosses
    || baseline.clogSlots !== undefined || baseline.caPoints !== undefined;
  return measured ? baseline : null;
}

export function createPinnedGoal(input: NewPinnedGoal): PinnedGoal | null {
  const pinnedAt = cleanTimestamp(input.pinnedAt);
  if (!pinnedAt) return null;
  const baseline = input.baseline === undefined || input.baseline === null
    ? null
    : parsePinnedGoalBaseline(input.baseline);
  const base = { pinnedAt, baseline, isPrimary: input.isPrimary === true };

  if (input.kind === "item") {
    const choice = ITEM_GOAL_CHOICES.find((row) => row.goalId === input.goalId);
    return choice ? {
      ...base,
      key: `item:${choice.goalId}`,
      kind: "item",
      goalId: choice.goalId,
      target: choice.target,
      spriteItemId: choice.spriteItemId
    } : null;
  }
  if (input.kind === "unlock") {
    const choice = UNLOCK_GOAL_DEFINITIONS.find((row) => row.id === input.unlockId);
    return choice ? {
      ...base,
      key: `unlock:${choice.id}`,
      kind: "unlock",
      unlockId: choice.id,
      target: choice.title,
      spriteItemId: choice.iconItemId ?? null
    } : null;
  }
  if (input.kind === "level") {
    const skill = matchSkill(input.skill);
    const targetLevel = Math.floor(input.targetLevel);
    if (!skill || !Number.isFinite(targetLevel) || targetLevel < 2 || targetLevel > 99) return null;
    return {
      ...base,
      key: `level:${normalizedKeyPart(skill)}:${targetLevel}`,
      kind: "level",
      skill,
      targetLevel,
      target: `${targetLevel} ${skill}`,
      spriteItemId: SKILL_CAPE_IDS[skill] ?? null
    };
  }
  if (input.kind === "skill_xp") {
    const skill = matchSkill(input.skill);
    const targetXp = Math.floor(input.targetXp);
    // 200M is the game's own ceiling. A goal above it can never complete.
    if (!skill || !Number.isFinite(targetXp) || targetXp < 1 || targetXp > 200_000_000) return null;
    return {
      ...base,
      key: `skill_xp:${normalizedKeyPart(skill)}:${targetXp}`,
      kind: "skill_xp",
      skill,
      targetXp,
      target: `${formatXpTarget(targetXp)} ${skill} XP`,
      spriteItemId: SKILL_CAPE_IDS[skill] ?? null
    };
  }
  if (input.kind === "boss_kc") {
    const boss = BOSSES.find((row) => row.slug === input.bossSlug);
    const targetKc = Math.floor(input.targetKc);
    if (!boss || !Number.isFinite(targetKc) || targetKc < 1 || targetKc > 100_000) return null;
    return {
      ...base,
      key: `boss_kc:${normalizedKeyPart(boss.slug)}:${targetKc}`,
      kind: "boss_kc",
      bossSlug: boss.slug,
      bossName: boss.name,
      targetKc,
      target: `${targetKc} ${boss.name} KC`,
      spriteItemId: null
    };
  }
  if (input.kind === "quest") {
    // No catalogue to check against: quest-db is server-only. The name is
    // carried as given, cleaned, and the key is its slug.
    const questName = input.questId.trim().slice(0, 60);
    const questId = normalizedKeyPart(questName);
    if (!questId) return null;
    return {
      ...base,
      key: `quest:${questId}`,
      kind: "quest",
      questId,
      questName,
      target: questName,
      spriteItemId: null
    };
  }
  if (input.kind === "diary") {
    const region = input.region.trim().slice(0, 40);
    const tier = DIARY_TIERS.find((candidate) => candidate === input.tier);
    if (!region || !tier) return null;
    return {
      ...base,
      key: `diary:${normalizedKeyPart(region)}:${tier.toLowerCase()}`,
      kind: "diary",
      region,
      tier,
      target: `${region} ${tier} diary`,
      spriteItemId: null
    };
  }
  if (input.kind === "clog_slots") {
    const targetSlots = Math.floor(input.targetSlots);
    if (!Number.isFinite(targetSlots) || targetSlots < 1 || targetSlots > 2_000) return null;
    return {
      ...base,
      key: `clog_slots:${targetSlots}`,
      kind: "clog_slots",
      targetSlots,
      target: `${targetSlots} collection log slots`,
      spriteItemId: null
    };
  }
  const tier = COMBAT_ACHIEVEMENT_TIERS.find((candidate) => candidate === input.tier);
  if (!tier) return null;
  return {
    ...base,
    key: `ca_tier:${tier.toLowerCase()}`,
    kind: "ca_tier",
    tier,
    target: `${tier} combat achievements`,
    spriteItemId: null
  };
}

function matchSkill(value: string): string | null {
  return LEVEL_GOAL_SKILLS.find((name) => name.toLowerCase() === value.trim().toLowerCase()) ?? null;
}

/**
 * Rebuilds the stored row through createPinnedGoal and rejects it unless the
 * result matches.
 *
 * The round-trip is the validation: a row whose key, label or sprite disagrees
 * with what this build would generate is either tampered with or written by a
 * version whose catalogue has since changed, and either way rendering it would
 * show a player a goal this build cannot measure.
 */
export function parsePinnedGoal(value: unknown): PinnedGoal | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  if (typeof row.pinnedAt !== "string") return null;
  const pinnedAt = row.pinnedAt;
  const baseline = row.baseline === undefined ? null : parsePinnedGoalBaseline(row.baseline);

  const input = ((): NewPinnedGoal | null => {
    switch (row.kind) {
      case "item":
        return typeof row.goalId === "string" ? { kind: "item", goalId: row.goalId } : null;
      case "unlock":
        return typeof row.unlockId === "string" ? { kind: "unlock", unlockId: row.unlockId } : null;
      case "level":
        return typeof row.skill === "string" && typeof row.targetLevel === "number"
          ? { kind: "level", skill: row.skill, targetLevel: row.targetLevel } : null;
      case "skill_xp":
        return typeof row.skill === "string" && typeof row.targetXp === "number"
          ? { kind: "skill_xp", skill: row.skill, targetXp: row.targetXp } : null;
      case "boss_kc":
        return typeof row.bossSlug === "string" && typeof row.targetKc === "number"
          ? { kind: "boss_kc", bossSlug: row.bossSlug, targetKc: row.targetKc } : null;
      case "quest":
        return typeof row.questName === "string" ? { kind: "quest", questId: row.questName } : null;
      case "diary":
        return typeof row.region === "string" && typeof row.tier === "string"
          ? { kind: "diary", region: row.region, tier: row.tier as DiaryTier } : null;
      case "clog_slots":
        return typeof row.targetSlots === "number" ? { kind: "clog_slots", targetSlots: row.targetSlots } : null;
      case "ca_tier":
        return typeof row.tier === "string"
          ? { kind: "ca_tier", tier: row.tier as CombatAchievementTier } : null;
      default:
        return null;
    }
  })();
  if (!input) return null;

  const goal = createPinnedGoal({
    ...input,
    pinnedAt,
    baseline,
    isPrimary: row.isPrimary === true
  } as NewPinnedGoal);
  if (!goal) return null;
  return row.key === goal.key && row.target === goal.target && row.spriteItemId === goal.spriteItemId
    ? goal
    : null;
}

export function pinnedGoalsStorageKey(rsn: string): string {
  const account = normalizedKeyPart(rsn.trim()) || "guest";
  return `scapestack:pinned-goals:v1:${account}`;
}

function notify(): void {
  if (typeof window === "undefined") return;
  try { window.dispatchEvent(new CustomEvent(PINNED_GOALS_EVENT)); } catch {}
}

export function loadPinnedGoals(rsn: string): PinnedGoal[] {
  if (typeof window === "undefined") return [];
  const key = pinnedGoalsStorageKey(rsn);
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Partial<StoredGoals>;
    if (parsed.version !== STORE_VERSION || !Array.isArray(parsed.goals)) throw new Error("invalid goal store");
    const goals = parsed.goals.map(parsePinnedGoal).filter((goal): goal is PinnedGoal => goal !== null).slice(0, MAX_GOALS);
    if (goals.length !== parsed.goals.length) throw new Error("invalid pinned goal");
    return goals;
  } catch {
    try { localStorage.removeItem(key); } catch {}
    return [];
  }
}

export function replacePinnedGoalsLocally(rsn: string, goals: readonly PinnedGoal[]): PinnedGoal[] {
  if (typeof window === "undefined") return [];
  const unique = new Map<string, PinnedGoal>();
  for (const candidate of goals) {
    const goal = parsePinnedGoal(candidate);
    if (goal && !unique.has(goal.key)) unique.set(goal.key, goal);
    if (unique.size === MAX_GOALS) break;
  }
  const saved = withSinglePrimary(
    [...unique.values()].sort((left, right) => left.pinnedAt.localeCompare(right.pinnedAt))
  );
  try {
    localStorage.setItem(pinnedGoalsStorageKey(rsn), JSON.stringify({ version: STORE_VERSION, goals: saved } satisfies StoredGoals));
    notify();
  } catch {}
  return saved;
}

export function pinGoalLocally(rsn: string, goal: PinnedGoal): PinnedGoal[] {
  return replacePinnedGoalsLocally(rsn, [...loadPinnedGoals(rsn), goal]);
}

export function removePinnedGoalLocally(rsn: string, key: string): PinnedGoal[] {
  return replacePinnedGoalsLocally(rsn, loadPinnedGoals(rsn).filter((goal) => goal.key !== key));
}

/**
 * The one goal the page speaks for (SPEC §3.1).
 *
 * The goal bar rendered `goals[0]` — the oldest pin, by accident of the sort
 * order. That meant the goal a player set two months ago outranked the one
 * they set this morning, and there was no way to say which one they meant.
 * `is_primary` is the answer, and the database allows exactly one per account.
 *
 * Falls back to the oldest pin when nothing is marked, so an account that
 * predates the column still has a primary rather than none.
 */
export function primaryPinnedGoal(goals: readonly PinnedGoal[]): PinnedGoal | null {
  return goals.find((goal) => goal.isPrimary) ?? goals[0] ?? null;
}

/**
 * Marks one goal primary and clears the rest.
 *
 * Done here rather than left to each caller because "exactly one" is a rule
 * about the set, and a caller that sets a flag without clearing the others
 * produces two primaries locally and a constraint violation on the server.
 */
export function withPrimaryPinnedGoal(goals: readonly PinnedGoal[], key: string): PinnedGoal[] {
  if (!goals.some((goal) => goal.key === key)) return [...goals];
  return goals.map((goal) => ({ ...goal, isPrimary: goal.key === key }));
}

/**
 * At most one goal carries the primary flag.
 *
 * The database enforces this with a partial unique index, so a set with two
 * primaries is not merely untidy — the second write fails. Local state and the
 * server have to agree on the rule, and the cheapest way to agree is for the
 * client never to produce a set the server would reject.
 */
function withSinglePrimary(goals: readonly PinnedGoal[]): PinnedGoal[] {
  let seen = false;
  return goals.map((goal) => {
    if (!goal.isPrimary) return goal;
    if (seen) return { ...goal, isPrimary: false };
    seen = true;
    return goal;
  });
}

export function mergePinnedGoals(...groups: ReadonlyArray<readonly PinnedGoal[]>): PinnedGoal[] {
  const merged = new Map<string, PinnedGoal>();
  for (const group of groups) {
    for (const candidate of group) {
      const goal = parsePinnedGoal(candidate);
      if (!goal) continue;
      const current = merged.get(goal.key);
      if (!current) {
        merged.set(goal.key, goal);
        continue;
      }
      // Earliest pin wins the timestamp — that is when the player actually
      // committed — but a baseline is never thrown away for being on the
      // later copy. One side is often the server and the other localStorage,
      // and only one of them was around when the goal was set.
      const winner = goal.pinnedAt < current.pinnedAt ? goal : current;
      const loser = winner === goal ? current : goal;
      merged.set(goal.key, {
        ...winner,
        baseline: winner.baseline ?? loser.baseline ?? null,
        isPrimary: winner.isPrimary || loser.isPrimary
      } as PinnedGoal);
    }
  }
  const ordered = [...merged.values()]
    .sort((left, right) => left.pinnedAt.localeCompare(right.pinnedAt))
    .slice(0, MAX_GOALS);
  return withSinglePrimary(ordered);
}

/**
 * A percentage of the distance actually travelled since the goal was set.
 *
 * `start` is the baseline reading. Null start means no baseline, and that has
 * to read as unknown: measuring from zero instead is what turns a level-92
 * player pinning 99 into "92% done" on day one.
 *
 * A target at or below the start means the goal was already met when it was
 * pinned; there is no distance to travel and 100 is the only honest answer.
 */
function percentFromBaseline(start: number | null, current: number | null, target: number): number | null {
  if (start === null || current === null || !Number.isFinite(target)) return null;
  if (target <= start) return 100;
  const travelled = (current - start) / (target - start);
  return Math.max(0, Math.min(100, Math.round(travelled * 1000) / 10));
}

function baselineSkillXp(goal: PinnedGoal, skill: string): number | null {
  const row = goal.baseline?.skills?.find((entry) => entry.name.toLowerCase() === skill.toLowerCase());
  return row && Number.isFinite(row.xp) ? row.xp : null;
}

function currentSkillXp(evidence: PinnedGoalProgressEvidence, skill: string): number | null {
  const row = evidence.skills.find((entry) => entry.name.toLowerCase() === skill.toLowerCase());
  return row && Number.isFinite(row.xp) ? Number(row.xp) : null;
}

/** A checklist goal is done or it is not; there is no distance to measure. */
function binary(done: boolean, note: string | null = null): PinnedGoalProgress {
  return { fraction: done ? "1/1" : "0/1", percent: done ? 100 : 0, done, note };
}

function unknown(note: string): PinnedGoalProgress {
  return { fraction: null, percent: null, done: false, note };
}

export function pinnedGoalProgress(goal: PinnedGoal, evidence: PinnedGoalProgressEvidence): PinnedGoalProgress {
  if (goal.kind === "level") {
    const row = evidence.skills.find((skill) => skill.name.toLowerCase() === goal.skill.toLowerCase());
    if (!row) return unknown(`${goal.skill} is not available from Hiscores`);
    const current = Math.min(goal.targetLevel, Math.max(1, Math.floor(row.level)));
    return {
      fraction: `${current}/${goal.targetLevel}`,
      // Levels are counted, XP is measured. 92 → 99 Slayer is 6.5M XP, and a
      // level-counted percentage calls the first 100k of it one seventh done.
      percent: percentFromBaseline(
        baselineSkillXp(goal, goal.skill),
        currentSkillXp(evidence, goal.skill),
        XP_TABLE[goal.targetLevel] ?? Number.NaN
      ),
      done: current >= goal.targetLevel,
      note: null
    };
  }

  if (goal.kind === "skill_xp") {
    const current = currentSkillXp(evidence, goal.skill);
    if (current === null) return unknown(`${goal.skill} XP is not available from Hiscores`);
    return {
      fraction: `${formatXpTarget(current)}/${formatXpTarget(goal.targetXp)}`,
      percent: percentFromBaseline(baselineSkillXp(goal, goal.skill), current, goal.targetXp),
      done: current >= goal.targetXp,
      note: null
    };
  }

  if (goal.kind === "boss_kc") {
    const current = evidence.bossKc?.[goal.bossSlug];
    // Absent is unread, never zero — the false zero this repo already paid for
    // once with the collection log.
    if (current === undefined) return unknown(`No ${goal.bossName} kills on the hiscores yet`);
    return {
      fraction: `${current}/${goal.targetKc}`,
      percent: percentFromBaseline(goal.baseline?.bosses?.[goal.bossSlug] ?? null, current, goal.targetKc),
      done: current >= goal.targetKc,
      note: null
    };
  }

  if (goal.kind === "clog_slots") {
    if (evidence.clogSlots === undefined) return unknown("Needs RuneLite to see your collection log");
    return {
      fraction: `${evidence.clogSlots}/${goal.targetSlots}`,
      percent: percentFromBaseline(goal.baseline?.clogSlots ?? null, evidence.clogSlots, goal.targetSlots),
      done: evidence.clogSlots >= goal.targetSlots,
      note: null
    };
  }

  if (goal.kind === "ca_tier") {
    if (evidence.caPoints === undefined) return unknown("Needs RuneLite to see combat achievements");
    const target = COMBAT_ACHIEVEMENT_TIER_POINTS[goal.tier];
    return {
      fraction: `${evidence.caPoints}/${target}`,
      percent: percentFromBaseline(goal.baseline?.caPoints ?? null, evidence.caPoints, target),
      done: evidence.caPoints >= target,
      note: null
    };
  }

  if (goal.kind === "quest") {
    if (evidence.questsCompleted === undefined) return unknown("Needs RuneLite to see finished quests");
    const wanted = normalizeGoalSearch(goal.questName);
    return binary(evidence.questsCompleted.some((name) => normalizeGoalSearch(name) === wanted));
  }

  if (goal.kind === "diary") {
    if (evidence.diariesCompleted === undefined) return unknown("Needs RuneLite to see finished diaries");
    const wanted = normalizeGoalSearch(goal.region);
    return binary(evidence.diariesCompleted.some(
      (row) => normalizeGoalSearch(row.region) === wanted && row.tier === goal.tier
    ));
  }

  if (goal.kind === "item") {
    if (!evidence.ownedItemGoalIds) return unknown("Needs RuneLite to see your bank");
    return binary(evidence.ownedItemGoalIds.includes(goal.goalId));
  }

  const progress = evidence.unlocks?.[goal.unlockId];
  if (!progress) return unknown("Needs RuneLite to see finished quests");
  if (progress.note) return unknown(progress.note);
  return {
    fraction: `${progress.completed}/${progress.total}`,
    // Requirements met out of requirements needed. This is the shape §3.1's
    // own example takes — "82% to your Fire cape" is a checklist, not a curve.
    percent: progress.total > 0
      ? Math.max(0, Math.min(100, Math.round((progress.completed / progress.total) * 1000) / 10))
      : null,
    done: progress.total > 0 && progress.completed >= progress.total,
    note: null
  };
}
