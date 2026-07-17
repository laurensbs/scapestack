import type { PlannerAccountType } from "./account-type";
import { isUltimatePlannerAccount } from "./account-type";

export type BankUnavailableReason =
  | "opt-in-off"
  | "bank-not-opened-this-session"
  | "no-items-captured";

export interface PluginBankStatus {
  enabled: boolean;
  itemCount: number;
  capturedAt: string | null;
  unavailableReason: BankUnavailableReason | null;
}

export const PLUGIN_BANK_STATUS_STALE_AFTER_HOURS = 24;

export function defaultPluginBankStatus(itemCount = 0): PluginBankStatus {
  return itemCount > 0
    ? { enabled: true, itemCount, capturedAt: null, unavailableReason: null }
    : { enabled: false, itemCount: 0, capturedAt: null, unavailableReason: "opt-in-off" };
}

export function normalizePluginBankStatus(input: unknown, itemCount = 0): PluginBankStatus {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return defaultPluginBankStatus(itemCount);
  }
  const row = input as {
    enabled?: unknown;
    itemCount?: unknown;
    capturedAt?: unknown;
    unavailableReason?: unknown;
  };
  const enabled = row.enabled === true;
  const count = typeof row.itemCount === "number" && Number.isFinite(row.itemCount)
    ? Math.max(0, Math.floor(row.itemCount))
    : itemCount;
  const capturedAt = typeof row.capturedAt === "string" && row.capturedAt.trim()
    ? row.capturedAt.trim()
    : null;
  const unavailableReason = row.unavailableReason === "opt-in-off"
    || row.unavailableReason === "bank-not-opened-this-session"
    || row.unavailableReason === "no-items-captured"
      ? row.unavailableReason
      : enabled && count > 0
        ? null
        : enabled
          ? "no-items-captured"
          : "opt-in-off";

  return {
    enabled,
    itemCount: count,
    capturedAt,
    unavailableReason
  };
}

export function pluginBankStatusLabel(
  status: PluginBankStatus | null | undefined,
  accountType?: PlannerAccountType | null,
  nowMs = Date.now()
): string {
  if (isUltimatePlannerAccount(accountType)) return "UIM: bank checks are staging only";
  if (!status) return "Bank status unknown";
  if (isPluginBankStatusStale(status, nowMs)) {
    return "Open bank in RuneLite, then sync again";
  }
  if (status.enabled && status.itemCount > 0) {
    return `Bank ready: ${status.itemCount.toLocaleString()} stack${status.itemCount === 1 ? "" : "s"}`;
  }
  if (!status.enabled || status.unavailableReason === "opt-in-off") {
    return "RuneLite bank off; manual bank is fallback";
  }
  if (status.unavailableReason === "bank-not-opened-this-session") {
    return "Open bank in RuneLite, then sync again";
  }
  if (status.unavailableReason === "no-items-captured") {
    return "Open bank in RuneLite, then sync again";
  }
  return "Bank status unknown";
}

export function isPluginBankStatusStale(
  status: PluginBankStatus | null | undefined,
  nowMs = Date.now(),
  staleAfterHours = PLUGIN_BANK_STATUS_STALE_AFTER_HOURS
): boolean {
  if (!status?.enabled || status.itemCount <= 0 || !status.capturedAt) return false;
  const capturedAtMs = new Date(status.capturedAt).getTime();
  if (!Number.isFinite(capturedAtMs)) return true;
  const hoursOld = (nowMs - capturedAtMs) / (1000 * 60 * 60);
  return hoursOld >= staleAfterHours;
}

export function shouldUsePluginBank(input: {
  status: PluginBankStatus | null | undefined;
  itemCount: number;
  hasManualOverride?: boolean;
  nowMs?: number;
}): boolean {
  if (input.hasManualOverride || input.itemCount <= 0) return false;
  if (!input.status?.enabled || input.status.itemCount <= 0) return false;
  return !isPluginBankStatusStale(input.status, input.nowMs ?? Date.now());
}

export function pluginBankStatusTone(status: PluginBankStatus | null | undefined, nowMs = Date.now()): "good" | "warn" | "muted" {
  if (!status) return "muted";
  if (isPluginBankStatusStale(status, nowMs)) return "warn";
  if (status.enabled && status.itemCount > 0) return "good";
  if (status.enabled) return "warn";
  return "muted";
}
