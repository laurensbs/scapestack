import { BOSSES } from "./bosses";
import { computeCombatLevel, type HiscoreSkill } from "./hiscores";
import { GOAL_SETS } from "./goals";
import type { PinnedGoalProgressEvidence } from "./pinned-goals";
import type { QuestRecord } from "./quest-db";
import { UNLOCK_GOAL_DEFINITIONS, type UnlockGoalDefinition } from "./unlock-goal-catalog";

interface EvidenceInput {
  skills: readonly HiscoreSkill[];
  quests: ReadonlyMap<string, QuestRecord>;
  questsCompleted?: readonly string[];
  diariesCompleted?: ReadonlyArray<{ region: string; tier: "Easy" | "Medium" | "Hard" | "Elite" }>;
  bankItems?: ReadonlyArray<{ id: number; name: string; quantity: number }>;
  /** Hiscore activity rows, for boss KC goals. Unranked entries read -1. */
  activities?: ReadonlyArray<{ name: string; score: number }>;
  /** Collection log slots filled. Plugin-only; undefined means unread. */
  clogSlots?: number;
  /** Combat achievement points. Plugin contract v4; undefined means unread. */
  caPoints?: number;
}

function normalized(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}

function questByName(quests: ReadonlyMap<string, QuestRecord>, name: string): QuestRecord | null {
  const direct = quests.get(name);
  if (direct) return direct;
  const wanted = normalized(name);
  return [...quests.values()].find((quest) => normalized(quest.name) === wanted) ?? null;
}

function routeQuestRecords(definition: UnlockGoalDefinition, quests: ReadonlyMap<string, QuestRecord>): QuestRecord[] {
  const names = new Set<string>();
  for (const name of definition.requiredQuests ?? []) {
    names.add(normalized(name));
    const record = questByName(quests, name);
    for (const prerequisite of record?.questReqs ?? []) names.add(normalized(prerequisite));
  }
  return [...names].map((name) => questByName(quests, name)).filter((quest): quest is QuestRecord => quest !== null);
}

function routeSkillRequirements(definition: UnlockGoalDefinition, quests: readonly QuestRecord[]): Map<string, number> {
  const requirements = new Map<string, number>();
  const add = (skill: string, level: number) => {
    requirements.set(skill, Math.max(level, requirements.get(skill) ?? 0));
  };
  for (const requirement of definition.requiredSkills ?? []) add(requirement.skill, requirement.level);
  for (const quest of quests) {
    for (const requirement of quest.skillReqs) add(requirement.skill, requirement.level);
  }
  return requirements;
}

function itemGoalIdsOwned(bankItems: EvidenceInput["bankItems"]): string[] | undefined {
  if (!bankItems) return undefined;
  const owned: string[] = [];
  for (const set of GOAL_SETS) {
    for (const goal of set.goals) {
      const found = bankItems.some((item) =>
        (goal.itemIds?.includes(item.id) ?? false)
        || (goal.namePattern?.test(item.name) ?? false));
      if (found) owned.push(goal.id);
    }
  }
  return owned;
}

function unlockProgress(
  definition: UnlockGoalDefinition,
  input: EvidenceInput,
  ownedItemGoalIds: readonly string[] | undefined
): { completed: number; total: number; note: string | null } {
  if (definition.id === "quest-cape") {
    if (input.questsCompleted === undefined) {
      return { completed: 0, total: 0, note: "Needs RuneLite to see finished quests" };
    }
    const completedQuests = new Set(input.questsCompleted.map(normalized));
    const knownQuests = new Set([...input.quests.values()].map((quest) => normalized(quest.name)));
    return {
      completed: [...knownQuests].filter((name) => completedQuests.has(name)).length,
      total: knownQuests.size,
      note: knownQuests.size > 0 ? null : "The Wiki quest list is unavailable"
    };
  }
  const questRecords = routeQuestRecords(definition, input.quests);
  const questNames = new Set<string>();
  for (const name of definition.requiredQuests ?? []) {
    questNames.add(normalized(name));
    const record = questByName(input.quests, name);
    for (const prerequisite of record?.questReqs ?? []) questNames.add(normalized(prerequisite));
  }
  const skillRequirements = routeSkillRequirements(definition, questRecords);
  const diaryRequirements = definition.requiredDiaryTiers ?? [];
  const targetItemGoal = GOAL_SETS.flatMap((set) => set.goals)
    .find((goal) => normalized(goal.name) === normalized(definition.title));

  if (questNames.size > 0 && input.questsCompleted === undefined) {
    return { completed: 0, total: 0, note: "Needs RuneLite to see finished quests" };
  }
  if (targetItemGoal && ownedItemGoalIds === undefined) {
    return { completed: 0, total: 0, note: "Needs RuneLite to see your bank" };
  }
  if (diaryRequirements.length > 0 && input.diariesCompleted === undefined) {
    return { completed: 0, total: 0, note: "Needs RuneLite to see finished diaries" };
  }
  if (definition.activityRequirements?.length) {
    return { completed: 0, total: 0, note: `Cannot measure ${definition.activityRequirements[0]} yet` };
  }
  const completedQuests = new Set((input.questsCompleted ?? []).map(normalized));
  const completedDiaries = new Set((input.diariesCompleted ?? []).map((row) => `${normalized(row.region)}:${row.tier.toLowerCase()}`));
  const skillLevels = new Map(input.skills.map((skill) => [skill.name.toLowerCase(), skill.level] as const));
  let completed = [...questNames].filter((name) => completedQuests.has(name)).length;

  for (const [skill, target] of skillRequirements) {
    const current = skill === "Combat"
      ? computeCombatLevel([...input.skills])
      : skillLevels.get(skill.toLowerCase()) ?? 1;
    if (current >= target) completed += 1;
  }
  if (targetItemGoal && ownedItemGoalIds?.includes(targetItemGoal.id)) completed += 1;
  for (const requirement of diaryRequirements) {
    if (completedDiaries.has(`${normalized(requirement.region)}:${requirement.tier.toLowerCase()}`)) completed += 1;
  }

  return {
    completed,
    total: questNames.size + skillRequirements.size + (targetItemGoal ? 1 : 0) + diaryRequirements.length,
    note: null
  };
}

/**
 * Hiscore activity rows keyed by boss slug.
 *
 * An unranked activity reads -1 from Jagex and is dropped, not stored as 0.
 * Zero would later read as "killed it zero times", a claim the hiscores never
 * made — the same false zero the collection log work already paid for.
 */
function bossKcFrom(activities: EvidenceInput["activities"]): Record<string, number> | undefined {
  if (!activities) return undefined;
  const bySlug = new Map(BOSSES.map((boss) => [normalized(boss.name), boss.slug] as const));
  const kc: Record<string, number> = {};
  for (const activity of activities) {
    if (!activity?.name || !Number.isFinite(activity.score) || activity.score < 0) continue;
    const slug = bySlug.get(normalized(activity.name));
    if (slug) kc[slug] = activity.score;
  }
  return kc;
}

export function buildPinnedGoalEvidence(input: EvidenceInput): PinnedGoalProgressEvidence {
  const ownedItemGoalIds = itemGoalIdsOwned(input.bankItems);
  return {
    // XP travels with the level now. A percentage between two levels cannot be
    // computed without it, and dropping it here is what made every level goal
    // measurable only in whole levels.
    skills: input.skills.map((skill) => ({ name: skill.name, level: skill.level, xp: skill.xp })),
    ownedItemGoalIds,
    bossKc: bossKcFrom(input.activities),
    questsCompleted: input.questsCompleted,
    diariesCompleted: input.diariesCompleted,
    clogSlots: input.clogSlots,
    caPoints: input.caPoints,
    unlocks: Object.fromEntries(UNLOCK_GOAL_DEFINITIONS.map((definition) => [
      definition.id,
      unlockProgress(definition, input, ownedItemGoalIds)
    ]))
  };
}
