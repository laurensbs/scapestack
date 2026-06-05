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
      helper: "Adds stat, combat, quest-point and diary gates so this stops being bank-only advice."
    };
  }

  if (normalized.includes("paste a bank") || normalized.includes("gear and item checks")) {
    return {
      kind: "bank",
      label: context.hasBankContext ? "Refresh bank" : "Paste bank",
      helper: "Lets Scapestack verify owned gear, supplies and missing set pieces instead of guessing.",
      href: bankOrganizerHref(context.rsn)
    };
  }

  if (
    normalized.includes("runelite plugin")
    || normalized.includes("plugin has synced")
    || normalized.includes("runelite sync is connected")
    || normalized.includes("refresh or update")
    || normalized.includes("verified coverage labels")
    || normalized.includes("treating this as exact")
  ) {
    const hasConnectedSync = normalized.includes("runelite sync is connected")
      || normalized.includes("refresh or update")
      || normalized.includes("verified coverage labels")
      || normalized.includes("treating this as exact");
    return {
      kind: "plugin-sync",
      label: hasConnectedSync ? "Refresh sync payload" : "Verify RuneLite sync",
      helper: hasConnectedSync
        ? "Refresh or update the RuneLite plugin payload before trusting quest, diary, collection-log and Slayer coverage labels."
        : "Verify a RuneLite payload before labeling quest, diary, collection-log and Slayer coverage as verified, partial or missing.",
      href: pluginVerifyUrlForSyncedRsn(context.rsn ?? "", "next", {
        hasBankContext: context.hasBankContext
      })
    };
  }

  return null;
}
