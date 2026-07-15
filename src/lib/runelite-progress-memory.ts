import type { SyncDeltaSummary } from "./sync-repo";

export interface RuneliteProgressMemory {
  title: string;
  lead: string;
  lines: string[];
  syncedAt: string | null;
  savedAt: number;
}

function compactXp(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(value >= 10_000_000 ? 0 : 1)}M`;
  if (value >= 1_000) return `${Math.round(value / 1_000).toLocaleString()}k`;
  return value.toLocaleString();
}

function topSkill(summary: SyncDeltaSummary): SyncDeltaSummary["skills"][number] | null {
  return [...summary.skills].sort((a, b) => b.xpGained - a.xpGained)[0] ?? null;
}

function countLabel(count: number, singular: string, plural = `${singular}s`): string | null {
  if (count <= 0) return null;
  return `${count.toLocaleString()} ${count === 1 ? singular : plural}`;
}

function movementTitle(summary: SyncDeltaSummary, xp: number): string {
  const parts = [
    countLabel(summary.questsCompleted.length, "quest"),
    countLabel(summary.diariesCompleted.length, "diary", "diaries"),
    countLabel(summary.collectionLogItems.length || summary.collectionLogItemIds.length, "clog slot")
  ].filter(Boolean);
  if (parts.length > 0) return `Since last scan: ${parts.join(", ")}`;
  if (xp > 0) return `Since last scan: +${compactXp(xp)} XP`;
  if (summary.bank?.currentItemCount) return "Since last scan: bank refreshed";
  if (summary.accountType.changed) return "Since last scan: account mode updated";
  return "Since last scan: route updated";
}

export function runeliteProgressFromSyncSummary(
  summary: SyncDeltaSummary | null | undefined,
  options: { syncedAt?: string | null; headlineTitle?: string | null; savedAt?: number } = {}
): RuneliteProgressMemory | null {
  if (!summary) return null;
  const skill = topSkill(summary);
  const xp = summary.skills.reduce((sum, entry) => sum + Math.max(0, entry.xpGained), 0);
  const hasFinished = summary.questsCompleted.length > 0 || summary.diariesCompleted.length > 0;
  const hasClog = summary.collectionLogItems.length > 0 || summary.collectionLogItemIds.length > 0;
  const hasBank = Boolean(summary.bank?.currentItemCount);
  const changed = hasFinished || xp > 0 || hasClog || hasBank || summary.accountType.changed;
  if (!changed) return null;

  const lines: string[] = [];
  if (skill && skill.xpGained > 0) {
    const level = skill.currentLevel > skill.previousLevel
      ? ` ${skill.previousLevel}->${skill.currentLevel}`
      : "";
    lines.push(`${skill.name}${level}: +${compactXp(skill.xpGained)} XP`);
  }
  if (summary.questsCompleted.length > 1) {
    lines.push(`${summary.questsCompleted.length} quests finished: ${summary.questsCompleted.slice(0, 2).join(", ")}`);
  } else if (summary.questsCompleted[0]) {
    lines.push(`${summary.questsCompleted[0]} finished`);
  }
  if (summary.diariesCompleted[0]) {
    const diary = summary.diariesCompleted[0];
    const extra = summary.diariesCompleted.length > 1
      ? ` +${summary.diariesCompleted.length - 1} more`
      : "";
    lines.push(`${diary.region} ${diary.tier} finished${extra}`);
  }
  if (summary.collectionLogItems[0]) {
    const extra = summary.collectionLogItems.length > 1
      ? ` +${summary.collectionLogItems.length - 1} more`
      : "";
    lines.push(`${summary.collectionLogItems[0].name} added${extra}`);
  } else if (summary.collectionLogItemIds.length > 0) {
    lines.push(`${summary.collectionLogItemIds.length} clog slot${summary.collectionLogItemIds.length === 1 ? "" : "s"} added`);
  }
  if (summary.bank?.currentItemCount) {
    lines.push(`Bank ready: ${summary.bank.currentItemCount.toLocaleString()} stacks`);
  }
  if (summary.accountType.changed) {
    lines.push("Account mode updated");
  }

  const title = movementTitle(summary, xp);
  const lead = options.headlineTitle
    ? `${options.headlineTitle} now uses this progress.`
    : "Plan from this scan, then sync again after the stop point.";

  return {
    title,
    lead,
    lines: lines.slice(0, 4),
    syncedAt: options.syncedAt ?? null,
    savedAt: options.savedAt ?? Date.now()
  };
}
