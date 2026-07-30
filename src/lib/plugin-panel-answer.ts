import { affordabilityLine, affordabilityReport } from "./bank-affordability";
import { computeNextUp, type NextUpInput, type Recommendation } from "./next-up";
import { buildNextUpInputFromSources } from "./planning-input";
import type { SyncedPlayer } from "./sync-repo";

export interface PluginPanelAnswer {
  title: string;
  detail: string;
  stopAt: string;
  current: string;
  left: string;
}

export interface PluginPanelReceipt {
  answers: PluginPanelAnswer[];
  bankInsight: string | null;
}

const BANK_INSIGHT_DEADLINE_MS = 1_200;

function beforeDeadline<T>(promise: Promise<T>, fallback: T): Promise<T> {
  return new Promise<T>((resolve) => {
    const timeout = setTimeout(() => resolve(fallback), BANK_INSIGHT_DEADLINE_MS);
    promise.then(
      (value) => {
        clearTimeout(timeout);
        resolve(value);
      },
      () => {
        clearTimeout(timeout);
        resolve(fallback);
      }
    );
  });
}

function compact(value: string | undefined, fallback: string, max = 150): string {
  const shown = value?.replace(/\s+/g, " ").trim() || fallback;
  return shown.length <= max ? shown : `${shown.slice(0, max - 1).trimEnd()}…`;
}

function normalized(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function bossKc(input: NextUpInput, boss: string): number {
  const wanted = normalized(boss);
  for (const [name, kc] of Object.entries(input.bossKc ?? {})) {
    if (normalized(name) === wanted && Number.isFinite(kc)) return Math.max(0, Math.floor(kc));
  }
  return 0;
}

function skillLevel(input: NextUpInput, skill: string): number {
  const row = input.skills?.find((candidate) => normalized(candidate.name) === normalized(skill));
  return Math.max(1, Math.floor(row?.level ?? 1));
}

function bankQuantity(input: NextUpInput, itemId: number | undefined, itemName: string): number {
  return (input.bank ?? []).reduce((sum, item) => {
    const same = itemId !== undefined ? item.id === itemId : normalized(item.name) === normalized(itemName);
    return same ? sum + Math.max(0, Math.floor(item.quantity ?? 1)) : sum;
  }, 0);
}

function stopAndCurrent(rec: Recommendation, input: NextUpInput): { stopAt: string; current: string } {
  const target = rec.completionTarget;
  if (!target) {
    const stop = rec.routeChain?.steps.find((step) => step.label === "Stop")?.text;
    return { stopAt: compact(stop, "Finish this trip", 80), current: "Ready" };
  }
  switch (target.kind) {
    case "boss_kc_at_least": {
      const current = bossKc(input, target.boss);
      return { stopAt: `${target.target} kills`, current: `${current} / ${target.target}` };
    }
    case "skill_level_at_least": {
      const current = skillLevel(input, target.skill);
      return { stopAt: `${target.skill} ${target.target}`, current: `${current} / ${target.target}` };
    }
    case "quest_completed":
      return { stopAt: `Finish ${target.quest}`, current: "Not done" };
    case "diary_completed":
      return { stopAt: `${target.region} ${target.tier}`, current: "Not done" };
    case "collection_log_item_obtained":
      return { stopAt: `Get ${target.item}`, current: "Not owned" };
    case "slayer_task_finished":
      return { stopAt: `Finish ${target.taskName}`, current: `${target.startingRemaining} left` };
    case "bank_quantity_at_least": {
      const current = bankQuantity(input, target.itemId, target.item);
      return { stopAt: `${target.target} ${target.item}`, current: `${current} / ${target.target}` };
    }
    case "bank_changed":
      return { stopAt: "Finish the bank change", current: "Ready" };
  }
}

export function recommendationToPluginPanelAnswer(
  rec: Recommendation,
  input: NextUpInput
): PluginPanelAnswer {
  const progress = stopAndCurrent(rec, input);
  return {
    title: compact(rec.title, "Your next trip", 70),
    detail: compact(rec.decisionReason ?? rec.why, "This is the cleanest useful stop from the data RuneLite just read."),
    stopAt: progress.stopAt,
    current: progress.current,
    left: compact(rec.actionPlan?.timebox, "One trip", 40)
  };
}

/**
 * Builds the small receipt the plugin can render without opening the website.
 * It changes only the sync response: the contract-4 request remains byte-for-byte
 * the same, and old plugins ignore this additional response member.
 */
export async function buildPluginPanelReceipt(player: SyncedPlayer): Promise<PluginPanelReceipt | null> {
  const input = buildNextUpInputFromSources({
    rsn: player.rsn,
    hiscores: null,
    wom: null,
    collectionLogOwnedItemIds: player.availability?.collectionLog === "available"
      ? player.collectionLogItemIds
      : undefined,
    scapestackSync: player
  });
  if (!input) return null;

  const [result, bankInsight] = await Promise.all([
    computeNextUp(input),
    player.accountType === "normal" && player.bankItems.length > 0
      ? beforeDeadline(affordabilityReport(player.bankItems).then(affordabilityLine).catch(() => null), null)
      : Promise.resolve(null)
  ]);
  const recommendations = [result.headline, ...result.rest]
    .filter((rec): rec is Recommendation => rec !== null)
    .slice(0, 3);
  if (recommendations.length === 0 && bankInsight === null) return null;
  return {
    answers: recommendations.map((rec) => recommendationToPluginPanelAnswer(rec, input)),
    bankInsight
  };
}
