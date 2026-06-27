import type { Recommendation } from "./next-up";
import { bankOrganizerHref } from "./bank-handoff-url";
import { pluginVerifyUrlForSyncedRsn } from "./plugin-sync-actions";

export type RecommendationDataActionKind = "rsn" | "bank" | "plugin-sync";

export interface RecommendationDataAction {
  kind: RecommendationDataActionKind;
  label: string;
  helper: string;
  href?: string;
}

export interface RecommendationDataActionContext {
  rsn?: string | null;
  hasBankContext?: boolean;
}

export function missingDataActionForRecommendation(
  rec: Recommendation,
  context: RecommendationDataActionContext = {}
): RecommendationDataAction | null {
  const caveat = rec.actionPlan?.caveat ?? "";
  const normalized = caveat.toLowerCase();

  if (normalized.includes("add your rsn")) {
    return {
      kind: "rsn",
      label: "Add RSN",
      helper: "Adds combat, skills, quest points and diary gates so this stops being bank-only advice."
    };
  }

  if (normalized.includes("paste a bank") || normalized.includes("gear and item checks")) {
    return {
      kind: "bank",
      label: context.hasBankContext ? "Refresh bank" : "Paste bank",
      helper: "Lets Scapestack use owned gear, supplies and missing set pieces instead of guessing.",
      href: bankOrganizerHref(context.rsn)
    };
  }

  if (
    normalized.includes("runelite plugin")
    || normalized.includes("plugin has synced")
    || normalized.includes("runelite sync is connected")
    || normalized.includes("refresh or update")
    || normalized.includes("completed quests")
    || normalized.includes("finished quests")
    || normalized.includes("scapestack sync has this rsn")
    || normalized.includes("quest and diary completion is inferred")
    || normalized.includes("collection log or slayer")
    || normalized.includes("treating this as exact")
  ) {
    const hasConnectedSync = normalized.includes("runelite sync is connected")
      || normalized.includes("refresh or update")
      || normalized.includes("before relying on quests")
      || normalized.includes("treating this as exact");
    return {
      kind: "plugin-sync",
      label: hasConnectedSync ? "Refresh sync" : "Use Scapestack Sync",
      helper: hasConnectedSync
        ? "Refresh or update Scapestack Sync before relying on quests, diaries, collection log or Slayer for this pick."
        : "Use Scapestack Sync when you want finished quests, diaries, collection log and Slayer kept out of suggestions.",
      href: pluginVerifyUrlForSyncedRsn(context.rsn ?? "", "next", {
        hasBankContext: context.hasBankContext
      })
    };
  }

  return null;
}
