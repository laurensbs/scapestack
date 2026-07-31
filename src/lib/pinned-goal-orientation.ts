import { coinsIn, formatGpExact, type AffordabilityBankItem } from "./bank-affordability";
import { BOSSES } from "./bosses";
import type { BossDropTable } from "./drop-rates-db";
import { GOAL_SETS, type Goal, type GoalSet } from "./goals";
import type { Recommendation } from "./next-up";
import {
  pinnedGoalProgress,
  type PinnedGoal,
  type PinnedGoalProgressEvidence
} from "./pinned-goals";
import { UNLOCK_GOAL_DEFINITIONS, type UnlockGoalDefinition } from "./unlock-goal-catalog";
import type { WikiLatestPrice } from "./wiki";

export interface PinnedGoalBankFact {
  goalKey: string;
  line: string;
  verdict: string;
  gate: "ready" | "test" | "blocked";
  relatedSetId: string | null;
}

export interface PinnedGoalBossSource {
  goalKey: string;
  bossName: string;
  bossSlug: string | null;
  dropName: string;
  rarity: string;
}

interface GoalNoticeStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

type GoalMove =
  | { kind: "quest"; activeQuest: string }
  | { kind: "skill" }
  | { kind: "boss-drop"; source: PinnedGoalBossSource }
  | { kind: "item-route" }
  | { kind: "diary" }
  | { kind: "bank-item" };

function normalized(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}

function itemDefinition(goal: PinnedGoal): { set: GoalSet; item: Goal } | null {
  if (goal.kind !== "item") return null;
  for (const set of GOAL_SETS) {
    const item = set.goals.find((candidate) => candidate.id === goal.goalId);
    if (item) return { set, item };
  }
  return null;
}

function unlockDefinition(goal: PinnedGoal): UnlockGoalDefinition | null {
  if (goal.kind === "unlock") {
    return UNLOCK_GOAL_DEFINITIONS.find((definition) => definition.id === goal.unlockId) ?? null;
  }
  if (goal.kind === "item") {
    return UNLOCK_GOAL_DEFINITIONS.find((definition) => normalized(definition.title) === normalized(goal.target)) ?? null;
  }
  return null;
}

function ownsItem(bank: readonly AffordabilityBankItem[], item: Goal): boolean {
  return bank.some((bankItem) =>
    (item.itemIds?.includes(bankItem.id) ?? false)
    || (item.namePattern?.test(bankItem.name) ?? false));
}

function ownedQuantity(bank: readonly AffordabilityBankItem[], name: string): number {
  const key = normalized(name);
  return bank.reduce((total, item) => normalized(item.name) === key
    ? total + Math.max(0, Math.floor(item.quantity ?? 1))
    : total, 0);
}

function priceForIds(ids: readonly number[], prices: ReadonlyMap<number, WikiLatestPrice>): number | null {
  let best: number | null = null;
  for (const id of ids) {
    const price = prices.get(id)?.high;
    if (!price || price <= 0) continue;
    if (best === null || price < best) best = price;
  }
  return best;
}

function mappingIndex(mapping: ReadonlyMap<number, { id: number; name: string }>): Map<string, number[]> {
  const index = new Map<string, number[]>();
  for (const row of mapping.values()) {
    const key = normalized(row.name);
    index.set(key, [...(index.get(key) ?? []), row.id]);
  }
  return index;
}

function itemPrice(
  item: Goal,
  prices: ReadonlyMap<number, WikiLatestPrice>,
  tradeableIds: ReadonlyMap<string, number[]>
): number | null {
  const ids = item.itemIds?.length ? item.itemIds : tradeableIds.get(normalized(item.name)) ?? [];
  return priceForIds(ids, prices);
}

function verdictForCost(cost: number, gp: number): Pick<PinnedGoalBankFact, "verdict" | "gate"> {
  if (cost <= gp) return { verdict: "Bank covers it", gate: "ready" };
  return { verdict: `Short ${formatGpExact(cost - gp)}`, gate: "test" };
}

export function buildPinnedGoalBankFacts(
  bank: readonly AffordabilityBankItem[],
  prices: ReadonlyMap<number, WikiLatestPrice>,
  mapping: ReadonlyMap<number, { id: number; name: string }>,
  cannotBuy = false
): Record<string, PinnedGoalBankFact> {
  const facts: Record<string, PinnedGoalBankFact> = {};
  const tradeableIds = mappingIndex(mapping);
  const gp = coinsIn(bank);
  const seenItems = new Set<string>();

  for (const set of GOAL_SETS) {
    for (const item of set.goals) {
      if (seenItems.has(item.id)) continue;
      seenItems.add(item.id);
      const goalKey = `item:${item.id}`;
      const relatedSet = GOAL_SETS.find((candidate) => candidate.goals.some((row) => row.id === item.id)) ?? set;
      const owned = ownsItem(bank, item);
      if (owned) {
        facts[goalKey] = {
          goalKey,
          line: `${item.name} is already in this bank.`,
          verdict: "Bank ready",
          gate: "ready",
          relatedSetId: relatedSet.id
        };
        continue;
      }
      const price = itemPrice(item, prices, tradeableIds);
      if (cannotBuy && price !== null) {
        facts[goalKey] = {
          goalKey,
          line: `${item.name} has to come from its source.`,
          verdict: "Source it",
          gate: "blocked",
          relatedSetId: relatedSet.id
        };
        continue;
      }
      if (price === null) {
        facts[goalKey] = {
          goalKey,
          line: `${item.name} has no Grand Exchange price. It has to be earned.`,
          verdict: "Earn",
          gate: "blocked",
          relatedSetId: relatedSet.id
        };
        continue;
      }
      const ownedInSet = relatedSet.goals.filter((row) => ownsItem(bank, row)).length;
      const after = Math.min(relatedSet.goals.length, ownedInSet + 1);
      const outcome = after === relatedSet.goals.length
        ? `That finishes ${relatedSet.name}.`
        : `That moves ${relatedSet.name} to ${after}/${relatedSet.goals.length}.`;
      facts[goalKey] = {
        goalKey,
        line: `${item.name} — ${formatGpExact(price)}. ${outcome}`,
        ...verdictForCost(price, gp),
        relatedSetId: relatedSet.id
      };
    }
  }

  for (const definition of UNLOCK_GOAL_DEFINITIONS) {
    const goalKey = `unlock:${definition.id}`;
    const missing = (definition.requiredItems ?? []).map((requirement) => ({
      ...requirement,
      missing: Math.max(0, requirement.quantity - ownedQuantity(bank, requirement.name))
    })).filter((requirement) => requirement.missing > 0);
    if (missing.length === 0) {
      facts[goalKey] = {
        goalKey,
        line: definition.requiredItems?.length
          ? `The recorded bank items for ${definition.title} are ready.`
          : `No exact bank item is recorded for ${definition.title}.`,
        verdict: definition.requiredItems?.length ? "Bank ready" : "No bank gate",
        gate: "ready",
        relatedSetId: null
      };
      continue;
    }
    if (cannotBuy) {
      facts[goalKey] = {
        goalKey,
        line: `Get the missing items directly for ${definition.title}.`,
        verdict: "Source items",
        gate: "blocked",
        relatedSetId: null
      };
      continue;
    }
    const priced = missing.map((requirement) => {
      const ids = tradeableIds.get(normalized(requirement.name)) ?? [];
      const unitPrice = priceForIds(ids, prices);
      return { ...requirement, cost: unitPrice === null ? null : unitPrice * requirement.missing };
    });
    const unpriced = priced.find((requirement) => requirement.cost === null);
    if (unpriced) {
      facts[goalKey] = {
        goalKey,
        line: `${unpriced.name} has no Grand Exchange price. It has to be earned for ${definition.title}.`,
        verdict: "Earn",
        gate: "blocked",
        relatedSetId: null
      };
      continue;
    }
    const cost = priced.reduce((total, requirement) => total + (requirement.cost ?? 0), 0);
    const names = priced.map((requirement) => `${requirement.missing > 1 ? `${requirement.missing}x ` : ""}${requirement.name}`);
    facts[goalKey] = {
      goalKey,
      line: `${names.join(names.length === 2 ? " and " : ", ")} — ${formatGpExact(cost)}. These are the recorded bank items for ${definition.title}.`,
      ...verdictForCost(cost, gp),
      relatedSetId: null
    };
  }

  return facts;
}

export function orderAffordableSetsForGoal<T extends { setId: string }>(rows: readonly T[], goal: PinnedGoal | null): T[] {
  if (!goal) return [...rows];
  const relatedSetId = itemDefinition(goal)?.set.id
    ?? GOAL_SETS.find((set) => set.goals.some((item) => normalized(item.name) === normalized(goal.target)))?.id
    ?? null;
  if (!relatedSetId) return [...rows];
  return [...rows].sort((left, right) => Number(right.setId === relatedSetId) - Number(left.setId === relatedSetId));
}

export function buildPinnedGoalBossSources(dropTables: ReadonlyMap<string, BossDropTable>): PinnedGoalBossSource[] {
  const targets = new Map<string, Array<{ key: string; name: string }>>();
  const add = (name: string, target: { key: string; name: string }) => {
    const key = normalized(name);
    targets.set(key, [...(targets.get(key) ?? []), target]);
  };
  const itemKeys = new Set<string>();
  for (const set of GOAL_SETS) {
    for (const item of set.goals) {
      const key = `item:${item.id}`;
      if (itemKeys.has(key)) continue;
      itemKeys.add(key);
      add(item.name, { key, name: item.name });
    }
  }
  for (const definition of UNLOCK_GOAL_DEFINITIONS) {
    for (const item of definition.requiredItems ?? []) {
      add(item.name, { key: `unlock:${definition.id}`, name: item.name });
    }
  }

  const sources: PinnedGoalBossSource[] = [];
  const seen = new Set<string>();
  for (const [tableName, table] of dropTables) {
    const bossName = table.hiscoresName || tableName;
    const bossSlug = BOSSES.find((boss) => normalized(boss.name) === normalized(bossName))?.slug ?? null;
    for (const drop of table.drops) {
      for (const target of targets.get(normalized(drop.name)) ?? []) {
        const identity = `${target.key}:${normalized(bossName)}:${normalized(drop.name)}`;
        if (seen.has(identity)) continue;
        seen.add(identity);
        sources.push({
          goalKey: target.key,
          bossName,
          bossSlug,
          dropName: target.name,
          rarity: drop.rarity
        });
      }
    }
  }
  return sources;
}

function sourceForRecommendation(
  rec: Recommendation,
  goal: PinnedGoal,
  sources: readonly PinnedGoalBossSource[]
): PinnedGoalBossSource | null {
  const bossKey = rec.bossSlug
    ?? (rec.completionTarget?.kind === "boss_kc_at_least" ? rec.completionTarget.boss : null);
  if (!bossKey) return null;
  return sources.find((source) => source.goalKey === goal.key && (
    source.bossSlug === bossKey
    || normalized(source.bossName) === normalized(bossKey)
  )) ?? null;
}

function moveForRecommendation(
  rec: Recommendation,
  goal: PinnedGoal,
  sources: readonly PinnedGoalBossSource[]
): GoalMove | null {
  const target = rec.completionTarget;
  const definition = unlockDefinition(goal);
  if (goal.kind === "level" && target?.kind === "skill_level_at_least"
      && normalized(target.skill) === normalized(goal.skill)) {
    return { kind: "skill" };
  }
  if (definition) {
    if (target?.kind === "quest_completed") {
      const targetQuest = rec.questRoute?.targetQuestName ?? target.quest;
      if (definition.requiredQuests?.some((quest) => normalized(quest) === normalized(targetQuest))) {
        return { kind: "quest", activeQuest: rec.questRoute?.activeQuestName ?? target.quest };
      }
    }
    if (target?.kind === "skill_level_at_least"
        && definition.requiredSkills?.some((requirement) => normalized(requirement.skill) === normalized(target.skill))) {
      return { kind: "skill" };
    }
    if (target?.kind === "diary_completed" && definition.requiredDiaryTiers?.some((requirement) =>
      normalized(requirement.region) === normalized(target.region)
      && normalized(requirement.tier) === normalized(target.tier))) {
      return { kind: "diary" };
    }
    if ((target?.kind === "bank_quantity_at_least" || target?.kind === "collection_log_item_obtained")
        && definition.requiredItems?.some((item) => normalized(item.name) === normalized(target.item))) {
      return { kind: "bank-item" };
    }
  }
  if (goal.kind === "item") {
    if ((target?.kind === "bank_quantity_at_least" || target?.kind === "collection_log_item_obtained")
        && normalized(target.item) === normalized(goal.target)) {
      return { kind: "bank-item" };
    }
    const set = itemDefinition(goal)?.set;
    if (set && rec.kind === "goal" && rec.id === `goal:${set.id}`) return { kind: "item-route" };
  }
  const source = sourceForRecommendation(rec, goal, sources);
  return source ? { kind: "boss-drop", source } : null;
}

export function recommendationMovesPinnedGoal(
  rec: Recommendation,
  goal: PinnedGoal,
  sources: readonly PinnedGoalBossSource[]
): boolean {
  return moveForRecommendation(rec, goal, sources) !== null;
}

export function goalTripWhy(
  rec: Recommendation,
  goal: PinnedGoal,
  sources: readonly PinnedGoalBossSource[]
): string {
  const move = moveForRecommendation(rec, goal, sources);
  if (!move) return `Nothing in this 60-minute list moves ${goal.target}. Here is something else worth doing.`;
  if (move.kind === "quest") return `${move.activeQuest} — the next gate to ${goal.target}.`;
  if (move.kind === "boss-drop") {
    return `${rec.title} — ${move.source.dropName} is ${move.source.rarity} from ${move.source.bossName} for ${goal.target}.`;
  }
  if (move.kind === "skill") return `${rec.title} — the next level block toward ${goal.target}.`;
  if (move.kind === "diary") return `${rec.title} — the next diary gate to ${goal.target}.`;
  if (move.kind === "bank-item") return `${rec.title} — the next item gate to ${goal.target}.`;
  return `${rec.title} — this route contains ${goal.target}.`;
}

export function orderRecommendationsForGoal(
  recommendations: readonly Recommendation[],
  goal: PinnedGoal | null,
  sources: readonly PinnedGoalBossSource[]
): Recommendation[] {
  if (!goal) return [...recommendations];
  return [...recommendations].sort((left, right) =>
    Number(Boolean(moveForRecommendation(right, goal, sources)))
    - Number(Boolean(moveForRecommendation(left, goal, sources))));
}

export function orderBossesForGoal<T extends { boss: { name: string; slug?: string } }>(
  bosses: readonly T[],
  goal: PinnedGoal | null,
  sources: readonly PinnedGoalBossSource[]
): T[] {
  if (!goal) return [...bosses];
  const matching = new Set(sources.filter((source) => source.goalKey === goal.key).flatMap((source) => [
    normalized(source.bossName),
    ...(source.bossSlug ? [normalized(source.bossSlug)] : [])
  ]));
  return [...bosses].sort((left, right) => {
    const leftMoves = matching.has(normalized(left.boss.name)) || (left.boss.slug ? matching.has(normalized(left.boss.slug)) : false);
    const rightMoves = matching.has(normalized(right.boss.name)) || (right.boss.slug ? matching.has(normalized(right.boss.slug)) : false);
    return Number(rightMoves) - Number(leftMoves);
  });
}

export function activePinnedGoal(
  goals: readonly PinnedGoal[],
  evidence: PinnedGoalProgressEvidence
): PinnedGoal | null {
  return goals.find((goal) => !pinnedGoalProgress(goal, evidence).done) ?? null;
}

export function pinnedGoalCompletionNoticeStorageKey(rsn: string): string {
  const account = rsn.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "guest";
  return `scapestack:pinned-goals:completion-notices:v1:${account}`;
}

export function claimPinnedGoalCompletionNotice(
  storage: GoalNoticeStorage,
  rsn: string,
  goals: readonly PinnedGoal[],
  evidence: PinnedGoalProgressEvidence
): PinnedGoal | null {
  const storageKey = pinnedGoalCompletionNoticeStorageKey(rsn);
  try {
    const raw = storage.getItem(storageKey);
    const parsed = raw ? JSON.parse(raw) as unknown : [];
    const claimed = new Set(Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === "string") : []);
    const completed = goals.find((goal) => pinnedGoalProgress(goal, evidence).done && !claimed.has(`${goal.key}@${goal.pinnedAt}`));
    if (!completed) return null;
    claimed.add(`${completed.key}@${completed.pinnedAt}`);
    storage.setItem(storageKey, JSON.stringify([...claimed]));
    return completed;
  } catch {
    return null;
  }
}
