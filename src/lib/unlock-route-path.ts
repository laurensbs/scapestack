export type UnlockRouteNodeState = "done" | "current" | "future" | "unknown";

export interface UnlockRouteNode {
  id: string;
  title: string;
  requirement: string;
  state: UnlockRouteNodeState;
  iconItemId?: number;
  href?: string;
}

export interface RfdRouteChapter {
  id: string;
  title: string;
  questName: string;
  gate: string;
  iconItemId: number;
}

/**
 * Recipe for Disaster chapters from the checked-in OSRS Wiki quest bucket,
 * using RuneLite 1.12.33's exact Quest#getName values for completion evidence.
 * The Wiki has an introduction, eight council subquests and a finale. Council
 * subquests can be completed in any order; this stable Wiki order only chooses
 * which unfinished chapter the UI marks as the next step.
 */
export const RFD_ROUTE_CHAPTERS: readonly RfdRouteChapter[] = [
  {
    id: "another-cooks-quest",
    title: "Another Cook's Quest",
    questName: "Recipe for Disaster - Another Cook's Quest",
    gate: "Cook's Assistant and Cooking 10.",
    iconItemId: 7497
  },
  {
    id: "mountain-dwarf",
    title: "Freeing the Mountain Dwarf",
    questName: "Recipe for Disaster - Mountain Dwarf",
    gate: "Another Cook's Quest and Fishing Contest.",
    iconItemId: 7509
  },
  {
    id: "goblin-generals",
    title: "Freeing the Goblin generals",
    questName: "Recipe for Disaster - Wartface & Bentnoze",
    gate: "Another Cook's Quest and Goblin Diplomacy.",
    iconItemId: 7511
  },
  {
    id: "pirate-pete",
    title: "Freeing Pirate Pete",
    questName: "Recipe for Disaster - Pirate Pete",
    gate: "Another Cook's Quest and Cooking 31.",
    iconItemId: 7530
  },
  {
    id: "lumbridge-guide",
    title: "Freeing the Lumbridge Guide",
    questName: "Recipe for Disaster - Lumbridge Guide",
    gate: "Cooking 40 and the six prerequisite quest lines named by the Wiki.",
    iconItemId: 7477
  },
  {
    id: "evil-dave",
    title: "Freeing Evil Dave",
    questName: "Recipe for Disaster - Evil Dave",
    gate: "Gertrude's Cat and Shadow of the Storm.",
    iconItemId: 7479
  },
  {
    id: "skrach-uglogwee",
    title: "Freeing Skrach Uglogwee",
    questName: "Recipe for Disaster - Skrach Uglogwee",
    gate: "Big Chompy Bird Hunting, Cooking 41 and Firemaking 20.",
    iconItemId: 7230
  },
  {
    id: "sir-amik-varze",
    title: "Freeing Sir Amik Varze",
    questName: "Recipe for Disaster - Sir Amik Varze",
    gate: "107 Quest points, started Legends' Quest and its prerequisite quest chain.",
    iconItemId: 7476
  },
  {
    id: "king-awowogei",
    title: "Freeing King Awowogei",
    questName: "Recipe for Disaster - King Awowogei",
    gate: "Monkey Madness I, Cooking 70 and Agility 48.",
    iconItemId: 7579
  },
  {
    id: "culinaromancer",
    title: "Defeating the Culinaromancer",
    questName: "Recipe for Disaster - Culinaromancer",
    gate: "All eight council subquests, 175 Quest points, Desert Treasure I and Horror from the Deep.",
    iconItemId: 7462
  }
];

function normalizeQuestName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}

export interface UnlockRouteNodeEvidence {
  id: string;
  title: string;
  requirement: string;
  evidence: "done" | "open" | "unknown";
  iconItemId?: number;
}

export function assignUnlockRouteNodeStates(evidence: readonly UnlockRouteNodeEvidence[]): UnlockRouteNode[] {
  const currentIndex = evidence.findIndex((node) => node.evidence === "open");
  return evidence.map((node, index) => ({
    id: node.id,
    title: node.title,
    requirement: node.requirement,
    iconItemId: node.iconItemId,
    href: undefined,
    state: node.evidence === "done"
      ? "done"
      : node.evidence === "unknown"
        ? "unknown"
        : index === currentIndex
          ? "current"
          : "future"
  }));
}

export function buildRfdRouteNodes(completedQuests: ReadonlySet<string> | null): UnlockRouteNode[] {
  if (completedQuests === null) {
    return RFD_ROUTE_CHAPTERS.map((chapter) => ({
      id: chapter.id,
      title: chapter.title,
      requirement: `Needs RuneLite to verify this chapter. Wiki gate: ${chapter.gate}`,
      iconItemId: chapter.iconItemId,
      state: "unknown"
    }));
  }

  const completed = new Set([...completedQuests].map(normalizeQuestName));
  const wholeQuestDone = completed.has(normalizeQuestName("Recipe for Disaster"));
  return assignUnlockRouteNodeStates(RFD_ROUTE_CHAPTERS.map((chapter) => {
    const done = wholeQuestDone || completed.has(normalizeQuestName(chapter.questName));
    return {
      id: chapter.id,
      title: chapter.title,
      requirement: done ? "Completed — verified by RuneLite." : `Wiki gate: ${chapter.gate}`,
      evidence: done ? "done" as const : "open" as const,
      iconItemId: chapter.iconItemId
    };
  }));
}
