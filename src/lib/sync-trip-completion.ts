import type { RecommendationMemoryEntry } from "./recommendation-feedback";
import type { SyncDeltaSummary } from "./sync-repo";

/**
 * Only returns true when the latest RuneLite delta proves the started target
 * itself was reached. Generic XP, bank refreshes and unrelated progress are
 * intentionally insufficient.
 */
export function syncCompletesStartedRecommendation(
  started: RecommendationMemoryEntry,
  summary: SyncDeltaSummary,
  syncedAt: string
): boolean {
  const syncTime = new Date(syncedAt).getTime();
  if (!Number.isFinite(syncTime) || syncTime <= started.savedAt) return false;

  const target = normalize(`${started.id} ${started.title ?? ""}`);
  if (!target) return false;

  if (summary.questsCompleted.some((quest) => target.includes(normalize(quest)))) return true;
  if (summary.diariesCompleted.some((diary) => {
    const region = normalize(diary.region);
    const tier = normalize(diary.tier);
    return target.includes(region) && target.includes(tier);
  })) return true;
  if (summary.collectionLogItems.some((item) => target.includes(normalize(item.name)))) return true;

  const levelTarget = targetLevel(target);
  if (levelTarget === null) return false;
  return summary.skills.some((skill) =>
    target.includes(normalize(skill.name))
      && skill.currentLevel >= levelTarget
      && skill.previousLevel < levelTarget
  );
}

function targetLevel(value: string): number | null {
  const explicit = value.match(/(?:to|level)\s+(\d{1,2})\b/);
  if (explicit) return Number(explicit[1]);
  return /maxing|max cape|skillcape|skill cape/.test(value) ? 99 : null;
}

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}
