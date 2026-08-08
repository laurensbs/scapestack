import type { DiaryTier } from "@/lib/diary-db";

/**
 * Identity arithmetic shared by /p/[rsn] (one header line) and /u/[rsn] (the
 * full band). Lived in the /p route file until the demolition of 2026-08-08;
 * a route file is the wrong home for anything two routes need.
 */

export function formatSyncAge(syncedAt: string | null, now = Date.now()): string {
  if (!syncedAt) return "not synced";
  const timestamp = new Date(syncedAt).getTime();
  if (!Number.isFinite(timestamp)) return "sync time unknown";
  const minutes = Math.max(0, Math.floor((now - timestamp) / 60_000));
  if (minutes < 1) return "synced just now";
  if (minutes < 60) return `synced ${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `synced ${hours} hr ago`;
  const days = Math.floor(hours / 24);
  return `synced ${days} day${days === 1 ? "" : "s"} ago`;
}

function normalizedCompletionName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}

export function countCompletedQuests(
  quests: ReadonlyMap<string, { name: string }>,
  completed: readonly string[]
): number {
  const completedNames = new Set(completed.map(normalizedCompletionName));
  return [...quests.values()].filter((quest) => completedNames.has(normalizedCompletionName(quest.name))).length;
}

export function countCompletedDiaryTiers(
  diaries: ReadonlyMap<string, { tiers: Record<DiaryTier, unknown> }>,
  completed: ReadonlyArray<{ region: string; tier: DiaryTier }>
): { completed: number; total: number } {
  const completedKeys = new Set(completed.map((entry) => (
    `${normalizedCompletionName(entry.region)}:${entry.tier.toLowerCase()}`
  )));
  let completedCount = 0;
  let total = 0;
  for (const [region, diary] of diaries) {
    for (const tier of Object.keys(diary.tiers) as DiaryTier[]) {
      total += 1;
      if (completedKeys.has(`${normalizedCompletionName(region)}:${tier.toLowerCase()}`)) completedCount += 1;
    }
  }
  return { completed: completedCount, total };
}
