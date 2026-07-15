import { createHash } from "node:crypto";
import type { ImmutableSnapshotState } from "./account-history";

export type SnapshotDataAvailability = "available" | "unavailable" | "unknown";
export type DeltaStatus = "changed" | "unchanged" | "unknown" | "unavailable" | "regressed";
export type DeltaFreshness = "fresh" | "recent" | "stale" | "unknown";

export interface SnapshotAvailability {
  skills: SnapshotDataAvailability;
  quests: SnapshotDataAvailability;
  diaries: SnapshotDataAvailability;
  collectionLog: SnapshotDataAvailability;
  bossKc: SnapshotDataAvailability;
  slayer: SnapshotDataAvailability;
  bank: SnapshotDataAvailability;
}

export interface ComparableAccountSnapshot {
  checksum: string;
  capturedAt: string;
  state: ImmutableSnapshotState;
}

export interface NumericMovement {
  before: number;
  after: number;
  delta: number;
  direction: "increase" | "decrease" | "none";
  confidence: "observed" | "source-regression";
}

export interface SetMovement<T> {
  status: DeltaStatus;
  added: T[];
  removed: T[];
}

export interface SkillMovement {
  name: string;
  status: DeltaStatus;
  level: NumericMovement | null;
  xp: NumericMovement | null;
}

export interface BankItemMovement {
  id: number;
  name: string;
  beforeQuantity: number;
  afterQuantity: number;
  delta: number;
}

export interface AccountDeltaFact {
  kind:
    | "xp"
    | "level"
    | "quest"
    | "diary"
    | "collection-log"
    | "boss-kc"
    | "slayer-points"
    | "slayer-streak"
    | "slayer-task"
    | "bank-added"
    | "bank-removed"
    | "bank-quantity";
  key: string;
  amount?: number;
  before?: number;
  after?: number;
}

export interface AccountSnapshotDelta {
  deltaId: string;
  fromChecksum: string | null;
  toChecksum: string;
  kind: "first-sync" | "unchanged" | "changed" | "partial";
  capturedAt: string;
  elapsedSeconds: number | null;
  freshness: DeltaFreshness;
  availability: SnapshotAvailability;
  totalXp: { status: DeltaStatus; movement: NumericMovement | null };
  skills: SkillMovement[];
  quests: SetMovement<string>;
  diaries: SetMovement<{ region: string; tier: string }>;
  collectionLog: SetMovement<number>;
  bossKc: Array<{ boss: string; status: DeltaStatus; movement: NumericMovement | null }>;
  slayer: {
    status: DeltaStatus;
    taskId: { before: number | null; after: number | null; changed: boolean };
    taskRemaining: NumericMovement | null;
    points: NumericMovement | null;
    streak: NumericMovement | null;
  };
  bank: {
    status: DeltaStatus;
    added: BankItemMovement[];
    removed: BankItemMovement[];
    quantityChanged: BankItemMovement[];
    totalChangedItems: number;
    truncated: boolean;
  };
  facts: AccountDeltaFact[];
}

const BANK_CHANGE_LIMIT = 100;

function hash(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function validDate(value: string): number | null {
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : null;
}

export function resolveSnapshotAvailability(state: ImmutableSnapshotState): SnapshotAvailability {
  const explicit = state.availability ?? {};
  const bankAvailability: SnapshotDataAvailability = state.bankStatus.enabled
    ? state.bankStatus.unavailableReason === null ? "available" : "unavailable"
    : state.bankStatus.unavailableReason ? "unavailable" : "unknown";
  return {
    skills: explicit.skills ?? (state.skills.length > 0 ? "available" : "unknown"),
    quests: explicit.quests ?? "available",
    diaries: explicit.diaries ?? "available",
    collectionLog: explicit.collectionLog ?? "available",
    bossKc: explicit.bossKc ?? (state.bossKc ? "available" : "unknown"),
    slayer: explicit.slayer ?? (state.slayer ? "available" : "unknown"),
    bank: explicit.bank ?? bankAvailability
  };
}

function fieldStatus(
  before: SnapshotDataAvailability,
  after: SnapshotDataAvailability,
  changed: boolean,
  regressed = false
): DeltaStatus {
  if (before === "unavailable" || after === "unavailable") return "unavailable";
  if (before === "unknown" || after === "unknown") return "unknown";
  if (regressed) return "regressed";
  return changed ? "changed" : "unchanged";
}

function movement(before: number, after: number, decreaseIsRegression = false): NumericMovement {
  const delta = after - before;
  return {
    before,
    after,
    delta,
    direction: delta > 0 ? "increase" : delta < 0 ? "decrease" : "none",
    confidence: decreaseIsRegression && delta < 0 ? "source-regression" : "observed"
  };
}

function stringSetMovement(
  previous: string[],
  current: string[],
  beforeAvailability: SnapshotDataAvailability,
  afterAvailability: SnapshotDataAvailability
): SetMovement<string> {
  const before = new Map(previous.map((value) => [value.toLowerCase(), value]));
  const after = new Map(current.map((value) => [value.toLowerCase(), value]));
  const added = [...after].filter(([key]) => !before.has(key)).map(([, value]) => value).sort();
  const removed = [...before].filter(([key]) => !after.has(key)).map(([, value]) => value).sort();
  return {
    status: fieldStatus(beforeAvailability, afterAvailability, added.length > 0, removed.length > 0),
    added,
    removed
  };
}

function numberSetMovement(
  previous: number[],
  current: number[],
  beforeAvailability: SnapshotDataAvailability,
  afterAvailability: SnapshotDataAvailability
): SetMovement<number> {
  const before = new Set(previous);
  const after = new Set(current);
  const added = [...after].filter((value) => !before.has(value)).sort((a, b) => a - b);
  const removed = [...before].filter((value) => !after.has(value)).sort((a, b) => a - b);
  return {
    status: fieldStatus(beforeAvailability, afterAvailability, added.length > 0, removed.length > 0),
    added,
    removed
  };
}

function diaryMovement(
  previous: ImmutableSnapshotState["diariesCompleted"],
  current: ImmutableSnapshotState["diariesCompleted"],
  beforeAvailability: SnapshotDataAvailability,
  afterAvailability: SnapshotDataAvailability
): SetMovement<{ region: string; tier: string }> {
  const key = (diary: { region: string; tier: string }) => `${diary.region.toLowerCase()}:${diary.tier.toLowerCase()}`;
  const before = new Map(previous.map((diary) => [key(diary), diary]));
  const after = new Map(current.map((diary) => [key(diary), diary]));
  const added = [...after].filter(([id]) => !before.has(id)).map(([, value]) => value);
  const removed = [...before].filter(([id]) => !after.has(id)).map(([, value]) => value);
  return {
    status: fieldStatus(beforeAvailability, afterAvailability, added.length > 0, removed.length > 0),
    added,
    removed
  };
}

function skillMovement(
  previous: ImmutableSnapshotState,
  current: ImmutableSnapshotState,
  beforeAvailability: SnapshotDataAvailability,
  afterAvailability: SnapshotDataAvailability
): SkillMovement[] {
  if (beforeAvailability !== "available" || afterAvailability !== "available") return [];
  const before = new Map(previous.skills.map((skill) => [skill.name.toLowerCase(), skill]));
  const after = new Map(current.skills.map((skill) => [skill.name.toLowerCase(), skill]));
  const names = [...new Set([...before.keys(), ...after.keys()])].sort();
  return names.map((name) => {
    const oldSkill = before.get(name);
    const newSkill = after.get(name);
    if (!oldSkill || !newSkill) {
      return { name: newSkill?.name ?? oldSkill?.name ?? name, status: "unknown", level: null, xp: null };
    }
    const level = movement(oldSkill.level, newSkill.level, true);
    const xp = typeof oldSkill.xp === "number" && typeof newSkill.xp === "number"
      ? movement(oldSkill.xp, newSkill.xp, true)
      : null;
    const regressed = level.confidence === "source-regression" || xp?.confidence === "source-regression";
    return {
      name: newSkill.name,
      status: regressed ? "regressed" : level.delta !== 0 || (xp?.delta ?? 0) !== 0 ? "changed" : xp ? "unchanged" : "unknown",
      level,
      xp
    };
  });
}

function totalXpMovement(
  previous: ImmutableSnapshotState,
  current: ImmutableSnapshotState,
  skills: SkillMovement[],
  beforeAvailability: SnapshotDataAvailability,
  afterAvailability: SnapshotDataAvailability
): AccountSnapshotDelta["totalXp"] {
  if (beforeAvailability === "unavailable" || afterAvailability === "unavailable") return { status: "unavailable", movement: null };
  if (beforeAvailability !== "available" || afterAvailability !== "available" || skills.some((skill) => !skill.xp)) {
    return { status: "unknown", movement: null };
  }
  const before = previous.skills.reduce((sum, skill) => sum + (skill.xp ?? 0), 0);
  const after = current.skills.reduce((sum, skill) => sum + (skill.xp ?? 0), 0);
  const result = movement(before, after, true);
  return {
    status: result.confidence === "source-regression" ? "regressed" : result.delta === 0 ? "unchanged" : "changed",
    movement: result
  };
}

function bossMovement(
  previous: ImmutableSnapshotState,
  current: ImmutableSnapshotState,
  beforeAvailability: SnapshotDataAvailability,
  afterAvailability: SnapshotDataAvailability
): AccountSnapshotDelta["bossKc"] {
  if (beforeAvailability !== "available" || afterAvailability !== "available") return [];
  const before = new Map(Object.entries(previous.bossKc ?? {}).map(([name, kc]) => [name.toLowerCase(), { name, kc }]));
  const after = new Map(Object.entries(current.bossKc ?? {}).map(([name, kc]) => [name.toLowerCase(), { name, kc }]));
  return [...new Set([...before.keys(), ...after.keys()])].sort().map((key) => {
    const oldBoss = before.get(key);
    const newBoss = after.get(key);
    const result = movement(oldBoss?.kc ?? 0, newBoss?.kc ?? 0, true);
    return {
      boss: newBoss?.name ?? oldBoss?.name ?? key,
      status: result.confidence === "source-regression" ? "regressed" : result.delta === 0 ? "unchanged" : "changed",
      movement: result
    };
  });
}

function bankMovement(
  previous: ImmutableSnapshotState,
  current: ImmutableSnapshotState,
  beforeAvailability: SnapshotDataAvailability,
  afterAvailability: SnapshotDataAvailability
): AccountSnapshotDelta["bank"] {
  if (beforeAvailability === "unavailable" || afterAvailability === "unavailable") {
    return { status: "unavailable", added: [], removed: [], quantityChanged: [], totalChangedItems: 0, truncated: false };
  }
  if (beforeAvailability !== "available" || afterAvailability !== "available") {
    return { status: "unknown", added: [], removed: [], quantityChanged: [], totalChangedItems: 0, truncated: false };
  }
  const before = new Map(previous.bankItems.map((item) => [item.id, item]));
  const after = new Map(current.bankItems.map((item) => [item.id, item]));
  const allIds = [...new Set([...before.keys(), ...after.keys()])].sort((a, b) => a - b);
  const added: BankItemMovement[] = [];
  const removed: BankItemMovement[] = [];
  const quantityChanged: BankItemMovement[] = [];
  for (const id of allIds) {
    const oldItem = before.get(id);
    const newItem = after.get(id);
    const beforeQuantity = oldItem?.quantity ?? 0;
    const afterQuantity = newItem?.quantity ?? 0;
    if (beforeQuantity === afterQuantity) continue;
    const entry = {
      id,
      name: newItem?.name ?? oldItem?.name ?? `Item ${id}`,
      beforeQuantity,
      afterQuantity,
      delta: afterQuantity - beforeQuantity
    };
    if (!oldItem) added.push(entry);
    else if (!newItem) removed.push(entry);
    else quantityChanged.push(entry);
  }
  const totalChangedItems = added.length + removed.length + quantityChanged.length;
  const retained = [
    ...added.map((entry) => ({ kind: "added" as const, entry })),
    ...removed.map((entry) => ({ kind: "removed" as const, entry })),
    ...quantityChanged.map((entry) => ({ kind: "quantity" as const, entry }))
  ].sort((left, right) => Math.abs(right.entry.delta) - Math.abs(left.entry.delta)).slice(0, BANK_CHANGE_LIMIT);
  return {
    status: totalChangedItems > 0 ? "changed" : "unchanged",
    added: retained.filter((item) => item.kind === "added").map((item) => item.entry),
    removed: retained.filter((item) => item.kind === "removed").map((item) => item.entry),
    quantityChanged: retained.filter((item) => item.kind === "quantity").map((item) => item.entry),
    totalChangedItems,
    truncated: totalChangedItems > BANK_CHANGE_LIMIT
  };
}

function slayerMovement(
  previous: ImmutableSnapshotState,
  current: ImmutableSnapshotState,
  beforeAvailability: SnapshotDataAvailability,
  afterAvailability: SnapshotDataAvailability
): AccountSnapshotDelta["slayer"] {
  const unavailable = beforeAvailability === "unavailable" || afterAvailability === "unavailable";
  if (unavailable || beforeAvailability !== "available" || afterAvailability !== "available" || !previous.slayer || !current.slayer) {
    return {
      status: unavailable ? "unavailable" : "unknown",
      taskId: { before: previous.slayer?.currentTaskId ?? null, after: current.slayer?.currentTaskId ?? null, changed: false },
      taskRemaining: null,
      points: null,
      streak: null
    };
  }
  const beforeSlayer = previous.slayer;
  const afterSlayer = current.slayer;
  const points = movement(beforeSlayer.points, afterSlayer.points);
  const streak = movement(beforeSlayer.streak, afterSlayer.streak);
  const taskRemaining = movement(beforeSlayer.taskRemaining, afterSlayer.taskRemaining);
  const taskChanged = beforeSlayer.currentTaskId !== afterSlayer.currentTaskId;
  const changed = taskChanged || points.delta !== 0 || streak.delta !== 0 || taskRemaining.delta !== 0;
  return {
    status: changed ? "changed" : "unchanged",
    taskId: { before: beforeSlayer.currentTaskId, after: afterSlayer.currentTaskId, changed: taskChanged },
    taskRemaining,
    points,
    streak
  };
}

export function snapshotDeltaFreshness(capturedAt: string, now = Date.now()): DeltaFreshness {
  const captured = validDate(capturedAt);
  if (captured === null || captured > now + 60_000) return "unknown";
  const age = now - captured;
  if (age <= 6 * 60 * 60 * 1000) return "fresh";
  if (age <= 7 * 24 * 60 * 60 * 1000) return "recent";
  return "stale";
}

function makeFacts(delta: Omit<AccountSnapshotDelta, "facts">): AccountDeltaFact[] {
  const facts: AccountDeltaFact[] = [];
  for (const skill of delta.skills) {
    if (skill.xp && skill.xp.delta > 0) facts.push({ kind: "xp", key: skill.name, amount: skill.xp.delta, before: skill.xp.before, after: skill.xp.after });
    if (skill.level && skill.level.delta > 0) facts.push({ kind: "level", key: skill.name, amount: skill.level.delta, before: skill.level.before, after: skill.level.after });
  }
  for (const quest of delta.quests.added) facts.push({ kind: "quest", key: quest });
  for (const diary of delta.diaries.added) facts.push({ kind: "diary", key: `${diary.region}:${diary.tier}` });
  for (const id of delta.collectionLog.added) facts.push({ kind: "collection-log", key: String(id) });
  for (const boss of delta.bossKc) if (boss.movement && boss.movement.delta > 0) {
    facts.push({ kind: "boss-kc", key: boss.boss, amount: boss.movement.delta, before: boss.movement.before, after: boss.movement.after });
  }
  if (delta.slayer.points && delta.slayer.points.delta !== 0) facts.push({ kind: "slayer-points", key: "points", amount: delta.slayer.points.delta });
  if (delta.slayer.streak && delta.slayer.streak.delta !== 0) facts.push({ kind: "slayer-streak", key: "streak", amount: delta.slayer.streak.delta });
  if (delta.slayer.taskId.changed) facts.push({ kind: "slayer-task", key: `${delta.slayer.taskId.before ?? "unknown"}:${delta.slayer.taskId.after ?? "unknown"}` });
  for (const item of delta.bank.added) facts.push({ kind: "bank-added", key: String(item.id), amount: item.delta });
  for (const item of delta.bank.removed) facts.push({ kind: "bank-removed", key: String(item.id), amount: item.delta });
  for (const item of delta.bank.quantityChanged) facts.push({ kind: "bank-quantity", key: String(item.id), amount: item.delta });
  return facts;
}

function firstSync(current: ComparableAccountSnapshot, now: number): AccountSnapshotDelta {
  const availability = resolveSnapshotAvailability(current.state);
  const unknownSet = <T>(): SetMovement<T> => ({ status: "unknown", added: [], removed: [] });
  const base: Omit<AccountSnapshotDelta, "facts"> = {
    deltaId: hash(`first:${current.checksum}`),
    fromChecksum: null,
    toChecksum: current.checksum,
    kind: "first-sync",
    capturedAt: current.capturedAt,
    elapsedSeconds: null,
    freshness: snapshotDeltaFreshness(current.capturedAt, now),
    availability,
    totalXp: { status: "unknown", movement: null },
    skills: [],
    quests: unknownSet(),
    diaries: unknownSet(),
    collectionLog: unknownSet(),
    bossKc: [],
    slayer: { status: "unknown", taskId: { before: null, after: current.state.slayer?.currentTaskId ?? null, changed: false }, taskRemaining: null, points: null, streak: null },
    bank: { status: "unknown", added: [], removed: [], quantityChanged: [], totalChangedItems: 0, truncated: false }
  };
  return { ...base, facts: [] };
}

export function compareAccountSnapshots(
  previous: ComparableAccountSnapshot | null,
  current: ComparableAccountSnapshot,
  options: { now?: number } = {}
): AccountSnapshotDelta {
  const now = options.now ?? Date.now();
  if (!previous) return firstSync(current, now);
  const beforeAvailability = resolveSnapshotAvailability(previous.state);
  const availability = resolveSnapshotAvailability(current.state);
  const skills = skillMovement(previous.state, current.state, beforeAvailability.skills, availability.skills);
  const quests = stringSetMovement(previous.state.questsCompleted, current.state.questsCompleted, beforeAvailability.quests, availability.quests);
  const diaries = diaryMovement(previous.state.diariesCompleted, current.state.diariesCompleted, beforeAvailability.diaries, availability.diaries);
  const collectionLog = numberSetMovement(previous.state.collectionLogItemIds, current.state.collectionLogItemIds, beforeAvailability.collectionLog, availability.collectionLog);
  const bossKc = bossMovement(previous.state, current.state, beforeAvailability.bossKc, availability.bossKc);
  const slayer = slayerMovement(previous.state, current.state, beforeAvailability.slayer, availability.slayer);
  const bank = bankMovement(previous.state, current.state, beforeAvailability.bank, availability.bank);
  const totalXp = totalXpMovement(previous.state, current.state, skills, beforeAvailability.skills, availability.skills);
  const beforeTime = validDate(previous.capturedAt);
  const afterTime = validDate(current.capturedAt);
  const elapsedSeconds = beforeTime !== null && afterTime !== null && afterTime >= beforeTime
    ? Math.floor((afterTime - beforeTime) / 1000)
    : null;
  const statuses: DeltaStatus[] = [
    totalXp.status, quests.status, diaries.status, collectionLog.status,
    ...skills.map((skill) => skill.status), ...bossKc.map((boss) => boss.status), slayer.status, bank.status
  ];
  const hasObservedChange = statuses.includes("changed") || statuses.includes("regressed");
  const hasPartial = statuses.includes("unknown") || statuses.includes("unavailable");
  const base: Omit<AccountSnapshotDelta, "facts"> = {
    deltaId: hash(`${previous.checksum}:${current.checksum}`),
    fromChecksum: previous.checksum,
    toChecksum: current.checksum,
    kind: hasObservedChange ? "changed" : hasPartial ? "partial" : "unchanged",
    capturedAt: current.capturedAt,
    elapsedSeconds,
    freshness: snapshotDeltaFreshness(current.capturedAt, now),
    availability,
    totalXp,
    skills,
    quests,
    diaries,
    collectionLog,
    bossKc,
    slayer,
    bank
  };
  return { ...base, facts: makeFacts(base) };
}
