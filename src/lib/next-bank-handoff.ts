import type { OrganizedItem, OrganizedTab } from "./organizer";
import { formatGp } from "./utils";

export const NEXT_BANK_HANDOFF_KEY = "scapestack:next:bank";
export const NEXT_BANK_HANDOFF_TTL_MS = 30 * 60 * 1000;

export interface BankHandoffItem {
  id: number;
  name: string;
  quantity: number;
  unitPrice: number;
  stackValue: number;
  highalch?: number;
  geLimit?: number;
  subtab: string;
  slot: OrganizedItem["slot"];
  weight: number;
}

export interface NextUpBankItem {
  id: number;
  name: string;
}

export interface BankHandoffPayload {
  v: 1;
  createdAt: number;
  items: BankHandoffItem[];
}

export interface BankHandoffSummary {
  itemCount: number;
  totalValue: number;
  pricedItems: number;
  label: string;
  topItems: Array<{ id: number; name: string; stackValue: number }>;
}

interface BankHandoffStorage {
  getItem?(key: string): string | null;
  setItem?(key: string, value: string): void;
  removeItem?(key: string): void;
}

export interface BankHandoffStorageTarget {
  sessionStorage?: BankHandoffStorage | null;
  localStorage?: BankHandoffStorage | null;
}

export function bankHandoffItemsFromBankItems(
  items: NextUpBankItem[],
  subtab = "Bank handoff"
): BankHandoffItem[] {
  return items.map((item, index) => ({
    id: item.id,
    name: item.name,
    quantity: 1,
    unitPrice: 0,
    stackValue: 0,
    subtab,
    slot: null,
    weight: index
  }));
}

export function bankHandoffItemsFromTabs(tabs: OrganizedTab[]): BankHandoffItem[] {
  return tabs.flatMap((tab) =>
    tab.items.map((item) => ({
      id: item.id,
      name: item.name,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      stackValue: item.stackValue,
      highalch: item.highalch,
      geLimit: item.geLimit,
      subtab: item.subtab || String(tab.name),
      slot: item.slot,
      weight: item.weight
    }))
  );
}

export function createBankHandoffPayload(tabs: OrganizedTab[], now = Date.now()): BankHandoffPayload {
  return createBankHandoffPayloadFromItems(bankHandoffItemsFromTabs(tabs), now);
}

export function serializeBankHandoffPayload(tabs: OrganizedTab[], now = Date.now()): string {
  return JSON.stringify(createBankHandoffPayload(tabs, now));
}

export function persistBankHandoffPayload(
  tabs: OrganizedTab[],
  target: BankHandoffStorageTarget | undefined,
  now = Date.now()
): boolean {
  return persistSerializedBankHandoff(serializeBankHandoffPayload(tabs, now), target);
}

export function createBankHandoffPayloadFromItems(
  items: BankHandoffItem[],
  now = Date.now()
): BankHandoffPayload {
  return {
    v: 1,
    createdAt: now,
    items: normalizeBankHandoffItems(items)
  };
}

export function serializeBankHandoffPayloadFromItems(
  items: BankHandoffItem[],
  now = Date.now()
): string {
  return JSON.stringify(createBankHandoffPayloadFromItems(items, now));
}

export function persistBankHandoffPayloadFromItems(
  items: BankHandoffItem[],
  target: BankHandoffStorageTarget | undefined,
  now = Date.now()
): boolean {
  return persistSerializedBankHandoff(serializeBankHandoffPayloadFromItems(items, now), target);
}

export function persistSerializedBankHandoff(
  raw: string,
  target: BankHandoffStorageTarget | undefined
): boolean {
  if (!raw || !target) return false;
  let stored = false;
  for (const storage of [target.sessionStorage, target.localStorage]) {
    if (!storage?.setItem) continue;
    try {
      storage.setItem(NEXT_BANK_HANDOFF_KEY, raw);
      stored = true;
    } catch {
      // One storage layer failing should not prevent the other from working.
    }
  }
  return stored;
}

export function clearBankHandoffPayload(target: BankHandoffStorageTarget | undefined): boolean {
  if (!target) return false;
  let cleared = false;
  for (const storage of [target.sessionStorage, target.localStorage]) {
    if (!storage?.removeItem) continue;
    try {
      storage.removeItem(NEXT_BANK_HANDOFF_KEY);
      cleared = true;
    } catch {
    }
  }
  return cleared;
}

export function readBankHandoffPayload(
  target: BankHandoffStorageTarget | undefined,
  now = Date.now(),
  ttlMs = NEXT_BANK_HANDOFF_TTL_MS
): BankHandoffItem[] {
  if (!target) return [];
  for (const storage of [target.sessionStorage, target.localStorage]) {
    if (!storage?.getItem) continue;
    try {
      const items = parseBankHandoffPayload(storage.getItem(NEXT_BANK_HANDOFF_KEY), now, ttlMs);
      if (items.length > 0) return items;
    } catch {
      // Keep trying the next storage layer.
    }
  }
  return [];
}

export function parseBankHandoffPayload(
  raw: string | null,
  now = Date.now(),
  ttlMs = NEXT_BANK_HANDOFF_TTL_MS
): BankHandoffItem[] {
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) return normalizeBankHandoffItems(parsed);
    if (!parsed || typeof parsed !== "object") return [];

    const record = parsed as Record<string, unknown>;
    const createdAt = Number(record.createdAt);
    if (!Number.isFinite(createdAt) || createdAt <= 0) return [];
    if (ttlMs > 0 && now - createdAt > ttlMs) return [];

    return normalizeBankHandoffItems(record.items);
  } catch {
    return [];
  }
}

export function normalizeBankHandoffItems(raw: unknown): BankHandoffItem[] {
  if (!Array.isArray(raw)) return [];
  const items: BankHandoffItem[] = [];

  for (const [index, entry] of raw.entries()) {
    if (!entry || typeof entry !== "object") continue;
    const record = entry as Record<string, unknown>;
    const id = cleanPositiveInt(record.id);
    if (!id) continue;
    const name = typeof record.name === "string" && record.name.trim()
      ? record.name.trim()
      : `#${id}`;

    items.push({
      id,
      name,
      quantity: cleanPositiveInt(record.quantity) || 1,
      unitPrice: cleanNonNegativeInt(record.unitPrice),
      stackValue: cleanNonNegativeInt(record.stackValue),
      highalch: cleanNonNegativeInt(record.highalch) || undefined,
      geLimit: cleanNonNegativeInt(record.geLimit) || undefined,
      subtab: typeof record.subtab === "string" && record.subtab.trim()
        ? record.subtab.trim()
        : "Bank handoff",
      slot: normalizeSlot(record.slot),
      weight: cleanNonNegativeInt(record.weight) || index
    });
  }

  return items;
}

export function organizedItemsFromHandoff(items: BankHandoffItem[]): OrganizedItem[] {
  return items.map((item, index) => ({
    id: item.id,
    name: item.name,
    subtab: item.subtab,
    slot: item.slot,
    weight: item.weight || index,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    stackValue: item.stackValue,
    highalch: item.highalch,
    geLimit: item.geLimit
  }));
}

export function nextUpBankFromHandoff(items: BankHandoffItem[]): NextUpBankItem[] {
  const seen = new Set<number>();
  const out: NextUpBankItem[] = [];
  for (const item of items) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    out.push({ id: item.id, name: item.name });
  }
  return out;
}

export function summarizeBankHandoff(items: BankHandoffItem[]): BankHandoffSummary {
  const totalValue = items.reduce((sum, item) => sum + item.stackValue, 0);
  const pricedItems = items.filter((item) => item.stackValue > 0 || item.unitPrice > 0).length;
  const itemCountLabel = `${items.length} item${items.length === 1 ? "" : "s"}`;
  const label = totalValue > 0
    ? `${itemCountLabel} · ${formatGp(totalValue)} gp`
    : itemCountLabel;

  return {
    itemCount: items.length,
    totalValue,
    pricedItems,
    label,
    topItems: items
      .filter((item) => item.stackValue > 0)
      .sort((a, b) => b.stackValue - a.stackValue)
      .slice(0, 3)
      .map((item) => ({ id: item.id, name: item.name, stackValue: item.stackValue }))
  };
}

function cleanPositiveInt(value: unknown): number {
  const number = Math.abs(Math.trunc(Number(value)));
  return Number.isFinite(number) && number > 0 ? number : 0;
}

function cleanNonNegativeInt(value: unknown): number {
  const number = Math.max(0, Math.trunc(Number(value)));
  return Number.isFinite(number) ? number : 0;
}

function normalizeSlot(value: unknown): OrganizedItem["slot"] {
  return typeof value === "string" && value.trim() ? value as OrganizedItem["slot"] : null;
}
