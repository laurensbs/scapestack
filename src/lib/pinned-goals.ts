import { GOAL_ICON_IDS, GOAL_SETS } from "./goals";
import { SKILL_CAPE_IDS } from "./skill-capes";
import { UNLOCK_GOAL_DEFINITIONS } from "./unlock-goal-catalog";

export const PINNED_GOALS_EVENT = "scapestack:pinned-goals-change";
const STORE_VERSION = 1;
const MAX_GOALS = 24;

interface GoalBase {
  key: string;
  kind: "item" | "level" | "unlock";
  target: string;
  spriteItemId: number | null;
  pinnedAt: string;
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

export type PinnedGoal = PinnedItemGoal | PinnedLevelGoal | PinnedUnlockGoal;

export type NewPinnedGoal =
  | { kind: "item"; goalId: string; pinnedAt?: string }
  | { kind: "level"; skill: string; targetLevel: number; pinnedAt?: string }
  | { kind: "unlock"; unlockId: string; pinnedAt?: string };

export interface PinnedGoalProgressEvidence {
  skills: ReadonlyArray<{ name: string; level: number }>;
  ownedItemGoalIds?: readonly string[];
  unlocks?: Record<string, { completed: number; total: number; note: string | null }>;
}

export interface PinnedGoalProgress {
  fraction: string | null;
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

export const ITEM_GOAL_CHOICES: ItemGoalChoice[] = GOAL_SETS.flatMap((set) =>
  set.goals.map((goal) => ({
    goalId: goal.id,
    target: goal.name,
    spriteItemId: GOAL_ICON_IDS[goal.id] ?? null,
    group: set.name
  }))
);

export const LEVEL_GOAL_SKILLS = Object.keys(SKILL_CAPE_IDS);

function cleanTimestamp(value: string | undefined): string | null {
  const parsed = value ? Date.parse(value) : Date.now();
  if (!Number.isFinite(parsed)) return null;
  return new Date(parsed).toISOString();
}

function normalizedKeyPart(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

export function createPinnedGoal(input: NewPinnedGoal): PinnedGoal | null {
  const pinnedAt = cleanTimestamp(input.pinnedAt);
  if (!pinnedAt) return null;
  if (input.kind === "item") {
    const choice = ITEM_GOAL_CHOICES.find((row) => row.goalId === input.goalId);
    return choice ? {
      key: `item:${choice.goalId}`,
      kind: "item",
      goalId: choice.goalId,
      target: choice.target,
      spriteItemId: choice.spriteItemId,
      pinnedAt
    } : null;
  }
  if (input.kind === "unlock") {
    const choice = UNLOCK_GOAL_DEFINITIONS.find((row) => row.id === input.unlockId);
    return choice ? {
      key: `unlock:${choice.id}`,
      kind: "unlock",
      unlockId: choice.id,
      target: choice.title,
      spriteItemId: choice.iconItemId ?? null,
      pinnedAt
    } : null;
  }
  const skill = LEVEL_GOAL_SKILLS.find((name) => name.toLowerCase() === input.skill.trim().toLowerCase());
  const targetLevel = Math.floor(input.targetLevel);
  if (!skill || !Number.isFinite(targetLevel) || targetLevel < 2 || targetLevel > 99) return null;
  return {
    key: `level:${normalizedKeyPart(skill)}:${targetLevel}`,
    kind: "level",
    skill,
    targetLevel,
    target: `${targetLevel} ${skill}`,
    spriteItemId: SKILL_CAPE_IDS[skill] ?? null,
    pinnedAt
  };
}

export function parsePinnedGoal(value: unknown): PinnedGoal | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  if (row.kind === "item" && typeof row.goalId === "string" && typeof row.pinnedAt === "string") {
    const goal = createPinnedGoal({ kind: "item", goalId: row.goalId, pinnedAt: row.pinnedAt });
    return goal && row.key === goal.key && row.target === goal.target && row.spriteItemId === goal.spriteItemId ? goal : null;
  }
  if (row.kind === "unlock" && typeof row.unlockId === "string" && typeof row.pinnedAt === "string") {
    const goal = createPinnedGoal({ kind: "unlock", unlockId: row.unlockId, pinnedAt: row.pinnedAt });
    return goal && row.key === goal.key && row.target === goal.target && row.spriteItemId === goal.spriteItemId ? goal : null;
  }
  if (row.kind === "level" && typeof row.skill === "string" && typeof row.targetLevel === "number" && typeof row.pinnedAt === "string") {
    const goal = createPinnedGoal({ kind: "level", skill: row.skill, targetLevel: row.targetLevel, pinnedAt: row.pinnedAt });
    return goal && row.key === goal.key && row.target === goal.target && row.spriteItemId === goal.spriteItemId ? goal : null;
  }
  return null;
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
  const saved = [...unique.values()].sort((left, right) => left.pinnedAt.localeCompare(right.pinnedAt));
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

export function mergePinnedGoals(...groups: ReadonlyArray<readonly PinnedGoal[]>): PinnedGoal[] {
  const merged = new Map<string, PinnedGoal>();
  for (const group of groups) {
    for (const candidate of group) {
      const goal = parsePinnedGoal(candidate);
      if (!goal) continue;
      const current = merged.get(goal.key);
      if (!current || goal.pinnedAt < current.pinnedAt) merged.set(goal.key, goal);
    }
  }
  return [...merged.values()].sort((left, right) => left.pinnedAt.localeCompare(right.pinnedAt)).slice(0, MAX_GOALS);
}

export function pinnedGoalProgress(goal: PinnedGoal, evidence: PinnedGoalProgressEvidence): PinnedGoalProgress {
  if (goal.kind === "level") {
    const row = evidence.skills.find((skill) => skill.name.toLowerCase() === goal.skill.toLowerCase());
    if (!row) return { fraction: null, done: false, note: `${goal.skill} is not available from Hiscores` };
    const current = Math.min(goal.targetLevel, Math.max(1, Math.floor(row.level)));
    return { fraction: `${current}/${goal.targetLevel}`, done: current >= goal.targetLevel, note: null };
  }
  if (goal.kind === "item") {
    if (!evidence.ownedItemGoalIds) return { fraction: null, done: false, note: "Needs RuneLite to see your bank" };
    const done = evidence.ownedItemGoalIds.includes(goal.goalId);
    return { fraction: done ? "1/1" : "0/1", done, note: null };
  }
  const progress = evidence.unlocks?.[goal.unlockId];
  if (!progress) return { fraction: null, done: false, note: "Needs RuneLite to see finished quests" };
  if (progress.note) return { fraction: null, done: false, note: progress.note };
  return {
    fraction: `${progress.completed}/${progress.total}`,
    done: progress.total > 0 && progress.completed >= progress.total,
    note: null
  };
}
