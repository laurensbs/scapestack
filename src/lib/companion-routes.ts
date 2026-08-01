import type { BossDropTable } from "./drop-rates-db";
import type { PinnedGoal } from "./pinned-goals";
import { skillCapeId } from "./skill-capes";
import type { UnlockRouteNode, UnlockRouteNodeState } from "./unlock-route-path";

export type CompanionRouteKind = "pinned-goal" | "max" | "collection-log";

export interface CompanionRouteNode {
  id: string;
  title: string;
  detail: string;
  metric: string;
  state: UnlockRouteNodeState;
  iconItemId: number;
}

export interface CompanionRoute {
  id: string;
  kind: CompanionRouteKind;
  title: string;
  summary: string;
  nodes: CompanionRouteNode[];
}

export interface UnlockRouteSource {
  id: string;
  title: string;
  payoff: string;
  iconItemId?: number;
  pathNodes: readonly UnlockRouteNode[];
}

export interface MaxRouteSkill {
  skill: string;
  currentLevel: number;
  targetLevel: number;
  xpRemaining: number;
}

function normalized(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}

function integer(value: number): number {
  return Math.max(0, Math.floor(Number.isFinite(value) ? value : 0));
}

export function buildPinnedGoalRoute(
  goal: PinnedGoal,
  unlockRoutes: readonly UnlockRouteSource[]
): CompanionRoute | null {
  const route = unlockRoutes.find((candidate) => (
    goal.kind === "unlock"
      ? candidate.id === goal.unlockId
      : normalized(candidate.title) === normalized(goal.target)
  ));
  if (!route) return null;
  const iconItemId = route.iconItemId ?? goal.spriteItemId;
  if (!iconItemId) return null;
  return {
    id: `pinned:${route.id}`,
    kind: "pinned-goal",
    title: `Route to ${route.title}`,
    summary: route.payoff,
    nodes: route.pathNodes.map((node) => ({
      id: node.id,
      title: node.title,
      detail: node.requirement,
      metric: node.state === "done"
        ? "Done"
        : node.state === "current"
          ? "Current"
          : node.state === "unknown"
            ? "Not verified"
            : "Later",
      state: node.state,
      iconItemId
    }))
  };
}

export function buildMaxRoute(skills: readonly MaxRouteSkill[]): CompanionRoute {
  const remaining = skills
    .filter((skill) => integer(skill.currentLevel) < integer(skill.targetLevel) && integer(skill.xpRemaining) > 0)
    .map((skill) => ({ ...skill, xpRemaining: integer(skill.xpRemaining) }))
    .sort((a, b) => a.xpRemaining - b.xpRemaining
      || b.currentLevel - a.currentLevel
      || a.skill.localeCompare(b.skill));
  return {
    id: "max",
    kind: "max",
    title: "Route to max",
    summary: remaining.length === 0
      ? "Max cape earned."
      : `${remaining.length} skill${remaining.length === 1 ? "" : "s"} remain. The nearest three come first.`,
    nodes: remaining.length === 0
      ? [{
          id: "max-cape",
          title: "Max cape",
          detail: "Every skill is 99.",
          metric: "23/23",
          state: "done",
          iconItemId: 13342
        }]
      : remaining.map((skill, index) => ({
          id: `max:${normalized(skill.skill).replace(/ /g, "-")}`,
          title: skill.skill,
          detail: `${skill.xpRemaining.toLocaleString("en-GB")} XP left.`,
          metric: `${integer(skill.currentLevel)}/${integer(skill.targetLevel)}`,
          state: index === 0 ? "current" : "future",
          iconItemId: skillCapeId(skill.skill) ?? 13342
        }))
  };
}

function idsByItemName(items: ReadonlyMap<number, string>): Map<string, number[]> {
  const byName = new Map<string, number[]>();
  for (const [id, name] of items) {
    const key = normalized(name);
    if (!key) continue;
    const ids = byName.get(key) ?? [];
    ids.push(id);
    byName.set(key, ids);
  }
  return byName;
}

export function buildCollectionLogRoute(input: {
  dropRates: ReadonlyMap<string, BossDropTable>;
  items: ReadonlyMap<number, string>;
  bosses: ReadonlyArray<{ slug: string; name: string; iconItemId?: number }>;
  /** null means the account's collection log cannot be verified. */
  ownedItemIds: ReadonlySet<number> | null;
}): CompanionRoute {
  const itemIds = idsByItemName(input.items);
  const verified = input.ownedItemIds !== null;
  const bosses = [...input.dropRates.values()].flatMap((table) => {
    const boss = input.bosses.find((candidate) => normalized(candidate.name) === normalized(table.hiscoresName));
    if (!boss?.iconItemId) return [];
    const seen = new Set<string>();
    const slots = table.drops.flatMap((drop) => {
      const key = normalized(drop.name);
      const ids = itemIds.get(key) ?? [];
      if (seen.has(key) || ids.length === 0) return [];
      seen.add(key);
      return [{ ...drop, ids }];
    });
    if (slots.length === 0) return [];
    const missing = verified
      ? slots.filter((slot) => !slot.ids.some((id) => input.ownedItemIds!.has(id)))
      : null;
    const rarest = (missing ?? slots)
      .slice()
      .sort((a, b) => (a.num / a.denom) - (b.num / b.denom))[0];
    return [{ boss, slots, missing, rarest }];
  }).filter((entry) => !verified || (entry.missing?.length ?? 0) > 0)
    .sort((a, b) => verified
      ? (b.missing?.length ?? 0) - (a.missing?.length ?? 0) || a.boss.name.localeCompare(b.boss.name)
      : b.slots.length - a.slots.length || a.boss.name.localeCompare(b.boss.name))
    .slice(0, 3);

  return {
    id: "collection-log",
    kind: "collection-log",
    title: "Route to the collection log",
    summary: verified
      ? "Bosses with the most tracked rare slots still missing, ranked by missing count."
      : "RuneLite is needed before Scapestack can rank this account's missing boss slots.",
    nodes: bosses.map((entry, index) => {
      const missingCount = entry.missing?.length;
      return {
        id: `collection:${entry.boss.slug}`,
        title: entry.boss.name,
        detail: verified
          ? `Rarest missing: ${entry.rarest.name} · ${entry.rarest.rarity}.`
          : `Needs RuneLite to count this boss's missing slots. Rarest tracked: ${entry.rarest.name} · ${entry.rarest.rarity}.`,
        metric: verified
          ? `${missingCount} slot${missingCount === 1 ? "" : "s"} missing`
          : "— slots missing",
        state: verified ? index === 0 ? "current" : "future" : "unknown",
        iconItemId: entry.boss.iconItemId!
      };
    })
  };
}
