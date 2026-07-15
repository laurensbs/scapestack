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

function hasFinishedStep(summary: SyncDeltaSummary): boolean {
  return summary.questsCompleted.length > 0 || summary.diariesCompleted.length > 0;
}

export function runeliteProgressFromSyncSummary(
  summary: SyncDeltaSummary | null | undefined,
  options: { syncedAt?: string | null; headlineTitle?: string | null; savedAt?: number } = {}
): RuneliteProgressMemory | null {
  if (!summary) return null;
  const skill = topSkill(summary);
  const xp = summary.skills.reduce((sum, entry) => sum + Math.max(0, entry.xpGained), 0);
  const hasClog = summary.collectionLogItems.length > 0 || summary.collectionLogItemIds.length > 0;
  const hasBank = Boolean(summary.bank?.currentItemCount);
  const changed = hasFinishedStep(summary) || xp > 0 || hasClog || hasBank || summary.accountType.changed;
  if (!changed) return null;

  const lines: string[] = [];
  if (skill && skill.xpGained > 0) {
    const level = skill.currentLevel > skill.previousLevel
      ? ` ${skill.previousLevel}->${skill.currentLevel}`
      : "";
    lines.push(`${skill.name}${level}: +${compactXp(skill.xpGained)} XP`);
  }
  if (summary.questsCompleted[0]) lines.push(`${summary.questsCompleted[0]} finished`);
  if (summary.diariesCompleted[0]) {
    const diary = summary.diariesCompleted[0];
    lines.push(`${diary.region} ${diary.tier} finished`);
  }
  if (summary.collectionLogItems[0]) {
    lines.push(`${summary.collectionLogItems[0].name} added`);
  } else if (summary.collectionLogItemIds.length > 0) {
    lines.push(`${summary.collectionLogItemIds.length} clog slot${summary.collectionLogItemIds.length === 1 ? "" : "s"} added`);
  }
  if (summary.bank?.currentItemCount) {
    lines.push(`Bank: ${summary.bank.currentItemCount.toLocaleString()} stacks`);
  }
  if (summary.accountType.changed) {
    lines.push("Account mode updated");
  }

  const title = hasFinishedStep(summary)
    ? "Finished steps are gone"
    : xp > 0
      ? `+${compactXp(xp)} XP since last scan`
      : hasClog
        ? "New clog progress counted"
        : hasBank
          ? "RuneLite bank updated"
          : "RuneLite changed the route";
  const lead = options.headlineTitle
    ? `${options.headlineTitle} is checked against the latest scan.`
    : "Open the next trip to use the latest scan.";

  return {
    title,
    lead,
    lines: lines.slice(0, 4),
    syncedAt: options.syncedAt ?? null,
    savedAt: options.savedAt ?? Date.now()
  };
}
