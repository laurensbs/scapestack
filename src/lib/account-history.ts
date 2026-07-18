import { createHash } from "node:crypto";
import type { ScapestackAccountType } from "./account-type";
import type { PluginBankStatus } from "./plugin-bank-status";
import type { SnapshotAvailability } from "./account-snapshot-delta";
import type { PluginSnapshotCoverage } from "./plugin-snapshot-contract";

export interface ImmutableSnapshotState {
  accountType: ScapestackAccountType;
  skills: Array<{ name: string; level: number; xp?: number }>;
  questsCompleted: string[];
  diariesCompleted: Array<{ region: string; tier: "Easy" | "Medium" | "Hard" | "Elite" }>;
  collectionLogItemIds: number[];
  bossKc?: Record<string, number> | null;
  bankItems: Array<{ id: number; name: string; quantity: number }>;
  bankStatus: PluginBankStatus;
  slayer: {
    points: number;
    streak: number;
    taskRemaining: number;
    currentTaskId: number;
    blocks: string[];
  } | null;
  availability?: Partial<SnapshotAvailability>;
  snapshotCoverage?: PluginSnapshotCoverage | null;
}

export interface SnapshotSummary {
  totalLevel: number;
  totalXp: number;
  questsCompleted: number;
  diariesCompleted: number;
  collectionLogItems: number;
  bossesTracked: number | null;
  bankItems: number;
  bankAvailable: boolean;
  slayerTaskRemaining: number | null;
}

export interface HistoricalBankSummary {
  available: boolean;
  itemCount: number;
  unavailableReason: PluginBankStatus["unavailableReason"];
  checksum: string;
}

function sha256(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function sortedStrings(values: string[]): string[] {
  return [...values].sort((a, b) => a.localeCompare(b, "en", { sensitivity: "base" }));
}

function canonicalState(state: ImmutableSnapshotState) {
  const skills = [...state.skills]
    .map((skill) => ({ name: skill.name.toLowerCase(), level: skill.level, xp: skill.xp ?? null }))
    .sort((a, b) => a.name.localeCompare(b.name));
  const diaries = [...state.diariesCompleted]
    .map((diary) => ({ region: diary.region.toLowerCase(), tier: diary.tier }))
    .sort((a, b) => `${a.region}:${a.tier}`.localeCompare(`${b.region}:${b.tier}`));
  const bank = [...state.bankItems]
    .map((item) => ({ id: item.id, quantity: item.quantity }))
    .sort((a, b) => a.id - b.id || a.quantity - b.quantity);

  return {
    accountType: state.accountType,
    skills,
    questsCompleted: sortedStrings(state.questsCompleted.map((quest) => quest.toLowerCase())),
    diariesCompleted: diaries,
    collectionLogItemIds: [...state.collectionLogItemIds].sort((a, b) => a - b),
    bossKc: state.bossKc
      ? Object.fromEntries(Object.entries(state.bossKc).sort(([a], [b]) => a.localeCompare(b)))
      : null,
    bank,
    bankStatus: {
      enabled: state.bankStatus.enabled,
      itemCount: state.bankStatus.itemCount,
      unavailableReason: state.bankStatus.unavailableReason
    },
    slayer: state.slayer
      ? {
          points: state.slayer.points,
          streak: state.slayer.streak,
          taskRemaining: state.slayer.taskRemaining,
          currentTaskId: state.slayer.currentTaskId,
          blocks: sortedStrings(state.slayer.blocks)
        }
      : null,
    availability: state.availability
      ? {
          skills: state.availability.skills ?? null,
          quests: state.availability.quests ?? null,
          diaries: state.availability.diaries ?? null,
          collectionLog: state.availability.collectionLog ?? null,
          bossKc: state.availability.bossKc ?? null,
          slayer: state.availability.slayer ?? null,
          bank: state.availability.bank ?? null
        }
      : null,
    snapshotCoverage: state.snapshotCoverage
      ? Object.fromEntries(Object.entries(state.snapshotCoverage).map(([domain, value]) => [domain, {
          state: value.state,
          reason: value.reason
        }]))
      : null
  };
}

export function buildSnapshotSummary(state: ImmutableSnapshotState): SnapshotSummary {
  return {
    totalLevel: state.skills.reduce((total, skill) => total + skill.level, 0),
    totalXp: state.skills.reduce((total, skill) => total + (skill.xp ?? 0), 0),
    questsCompleted: state.questsCompleted.length,
    diariesCompleted: state.diariesCompleted.length,
    collectionLogItems: state.collectionLogItemIds.length,
    bossesTracked: state.bossKc ? Object.keys(state.bossKc).length : null,
    bankItems: state.bankStatus.itemCount,
    bankAvailable: state.bankStatus.enabled && state.bankStatus.unavailableReason === null,
    slayerTaskRemaining: state.slayer?.taskRemaining ?? null
  };
}

export function buildHistoricalBankSummary(state: ImmutableSnapshotState): HistoricalBankSummary {
  const canonicalBank = [...state.bankItems]
    .map((item) => ({ id: item.id, quantity: item.quantity }))
    .sort((a, b) => a.id - b.id || a.quantity - b.quantity);
  return {
    available: state.bankStatus.enabled && state.bankStatus.unavailableReason === null,
    itemCount: state.bankStatus.itemCount,
    unavailableReason: state.bankStatus.unavailableReason,
    checksum: sha256(canonicalBank)
  };
}

/** The checksum excludes display name, timestamps and plugin version. */
export function buildSnapshotChecksum(state: ImmutableSnapshotState): string {
  return sha256(canonicalState(state));
}
