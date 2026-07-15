import { createHash } from "node:crypto";
import type { AccountSnapshotDelta } from "./account-snapshot-delta";

export type AccountTimelineMomentKind =
  | "xp"
  | "level"
  | "quest"
  | "diary"
  | "collection-log"
  | "boss"
  | "slayer"
  | "bank"
  | "trip"
  | "plan";

export interface AccountTimelineMoment {
  id: string;
  kind: AccountTimelineMomentKind;
  occurredAt: string;
  title: string;
  detail?: string;
  count?: number;
}

export interface AccountTimelinePage {
  moments: AccountTimelineMoment[];
  nextCursor: string | null;
}

export interface AccountTimelineRecord {
  sourceKind: "snapshot" | "trip" | "decision";
  sourceKey: string;
  occurredAt: string;
  data: Record<string, unknown>;
}

const COMPACT = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 });

function momentId(sourceKey: string): string {
  return `moment_${createHash("sha256").update(sourceKey).digest("hex").slice(0, 20)}`;
}

function object(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function playerDetail(value: unknown): string | null {
  const detail = text(value);
  return detail && !/(payload|signals?|data source|reconciliation)/i.test(detail) ? detail : null;
}

function formatCount(value: number): string {
  return COMPACT.format(Math.max(0, Math.round(value))).replace("K", "k");
}

function snapshotMoment(record: AccountTimelineRecord): AccountTimelineMoment | null {
  const delta = object(record.data.delta) as unknown as AccountSnapshotDelta | null;
  if (!delta || delta.kind !== "changed") return null;
  const base = { id: momentId(record.sourceKey), occurredAt: record.occurredAt };

  const quest = delta.quests?.added?.[0];
  if (quest) {
    return { ...base, kind: "quest", title: `Finished ${quest}` };
  }

  const diary = delta.diaries?.added?.[0];
  if (diary) {
    return { ...base, kind: "diary", title: `Finished ${diary.region} ${diary.tier}` };
  }

  const level = delta.skills?.find((skill) => (skill.level?.delta ?? 0) > 0 && skill.level);
  if (level?.level) {
    return {
      ...base,
      kind: "level",
      title: `${level.name} reached ${level.level.after}`,
      detail: level.level.delta > 1 ? `${level.level.delta} levels gained` : undefined
    };
  }

  const boss = delta.bossKc?.find((entry) => (entry.movement?.delta ?? 0) > 0 && entry.movement);
  if (boss?.movement) {
    return {
      ...base,
      kind: "boss",
      title: `${boss.boss}: ${boss.movement.after.toLocaleString("en-US")} KC`,
      detail: `+${boss.movement.delta.toLocaleString("en-US")} since the previous RuneLite check`
    };
  }

  const xp = delta.skills?.find((skill) => (skill.xp?.delta ?? 0) > 0 && skill.xp);
  if (xp?.xp) {
    return {
      ...base,
      kind: "xp",
      title: `Gained ${formatCount(xp.xp.delta)} ${xp.name} XP`
    };
  }

  const clogCount = delta.collectionLog?.added?.length ?? 0;
  if (clogCount > 0) {
    return {
      ...base,
      kind: "collection-log",
      title: `Added ${clogCount} collection log slot${clogCount === 1 ? "" : "s"}`
    };
  }

  const slayerPoints = delta.slayer?.points?.delta ?? 0;
  const slayerStreak = delta.slayer?.streak?.delta ?? 0;
  if (slayerPoints > 0 || slayerStreak > 0 || delta.slayer?.taskId?.changed) {
    const detail = [
      slayerPoints > 0 ? `+${slayerPoints} points` : null,
      slayerStreak > 0 ? `streak +${slayerStreak}` : null
    ].filter(Boolean).join(" · ");
    return { ...base, kind: "slayer", title: "Slayer moved forward", detail: detail || undefined };
  }

  if (delta.bank?.status === "changed") {
    const count = delta.bank.totalChangedItems;
    return {
      ...base,
      kind: "bank",
      title: "Your bank changed",
      detail: `${count.toLocaleString("en-US")} item stack${count === 1 ? "" : "s"} moved`
    };
  }

  return null;
}

function tripMoment(record: AccountTimelineRecord): AccountTimelineMoment | null {
  const action = text(record.data.eventType);
  const title = text(record.data.title) ?? "your trip";
  const stopPoint = text(record.data.stopPoint);
  if (!action || !["planned", "started", "done", "skipped", "shared"].includes(action)) return null;
  if (action === "done") {
    return { id: momentId(record.sourceKey), kind: "trip", occurredAt: record.occurredAt, title: `Finished ${title}`, detail: stopPoint ?? undefined };
  }
  if (action === "skipped") {
    return { id: momentId(record.sourceKey), kind: "trip", occurredAt: record.occurredAt, title: `Skipped ${title}`, count: 1 };
  }
  const verb = action === "started" ? "Started" : action === "shared" ? "Shared" : "Planned";
  return { id: momentId(record.sourceKey), kind: "trip", occurredAt: record.occurredAt, title: `${verb} ${title}`, detail: stopPoint ?? undefined };
}

function decisionMoment(record: AccountTimelineRecord): AccountTimelineMoment | null {
  const action = text(record.data.action);
  if (!action) return null;
  return {
    id: momentId(record.sourceKey),
    kind: "plan",
    occurredAt: record.occurredAt,
    title: `Next pick changed to ${action}`,
    detail: playerDetail(record.data.reason) ?? undefined
  };
}

export function accountTimelineMoment(record: AccountTimelineRecord): AccountTimelineMoment | null {
  if (record.sourceKind === "snapshot") return snapshotMoment(record);
  if (record.sourceKind === "trip") return tripMoment(record);
  return decisionMoment(record);
}

export function accountTimelineMoments(records: AccountTimelineRecord[]): AccountTimelineMoment[] {
  const sorted = [...records].sort((left, right) => {
    const byTime = Date.parse(right.occurredAt) - Date.parse(left.occurredAt);
    return byTime || right.sourceKey.localeCompare(left.sourceKey);
  });
  const moments: AccountTimelineMoment[] = [];
  const recentByFingerprint = new Map<string, AccountTimelineMoment>();
  for (const record of sorted) {
    const moment = accountTimelineMoment(record);
    if (!moment) continue;
    const fingerprint = `${moment.kind}:${moment.title.toLowerCase()}`;
    const candidate = recentByFingerprint.get(fingerprint);
    const duplicate = candidate
      && Math.abs(Date.parse(candidate.occurredAt) - Date.parse(moment.occurredAt)) <= 10 * 60 * 1000
      ? candidate
      : null;
    if (!duplicate) {
      moments.push(moment);
      recentByFingerprint.set(fingerprint, moment);
      continue;
    }
    if (moment.title.startsWith("Skipped ")) {
      duplicate.count = (duplicate.count ?? 1) + 1;
      duplicate.title = `Skipped ${moment.title.slice(8)} ${duplicate.count === 2 ? "twice" : `${duplicate.count} times`}`;
    }
  }
  return moments;
}
