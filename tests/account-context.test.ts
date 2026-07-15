import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

class MemoryStorage {
  private data = new Map<string, string>();
  getItem(key: string): string | null { return this.data.get(key) ?? null; }
  setItem(key: string, value: string): void { this.data.set(key, value); }
  removeItem(key: string): void { this.data.delete(key); }
  clear(): void { this.data.clear(); }
  get length(): number { return this.data.size; }
  key(i: number): string | null { return Array.from(this.data.keys())[i] ?? null; }
}

type Mutable = Record<string, unknown>;
const g = globalThis as Mutable;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-07-15T12:00:00.000Z"));
  g.localStorage = new MemoryStorage();
  g.sessionStorage = new MemoryStorage();
  g.window = {
    localStorage: g.localStorage,
    sessionStorage: g.sessionStorage,
    dispatchEvent: () => true
  };
  g.CustomEvent = class CustomEventPolyfill<T = unknown> extends Event {
    detail: T | undefined;
    constructor(type: string, init?: CustomEventInit<T>) {
      super(type);
      this.detail = init?.detail;
    }
  };
});

afterEach(() => {
  vi.useRealTimers();
});

describe("account context", () => {
  it("builds one account snapshot for RSN, bank, RuneLite and mood", async () => {
    const { markAccountMood, markAccountPluginBankStatus, markRuneliteChecked, upsertAccount } = await import("@/lib/account-storage");
    const { saveSavedBank } = await import("@/lib/saved-bank");
    const { loadAccountSnapshot } = await import("@/lib/account-context");

    upsertAccount("Lauky");
    markRuneliteChecked("Lauky", Date.now() - 2 * 60 * 60 * 1000);
    markAccountPluginBankStatus("Lauky", {
      enabled: true,
      itemCount: 778,
      capturedAt: "2026-07-15T11:00:00.000Z",
      unavailableReason: null
    });
    markAccountMood("Lauky", "afk", 30);
    saveSavedBank("Item id\tItem name\tItem quantity\n377\tRaw lobster\t1400", "Lauky");

    const snapshot = loadAccountSnapshot("Lauky");

    expect(snapshot.rsn).toBe("Lauky");
    expect(snapshot.hasBankContext).toBe(true);
    expect(snapshot.bankLabel).toBe("Bank added");
    expect(snapshot.bankDetail).toBe("Bank saved just now");
    expect(snapshot.hasRunelite).toBe(true);
    expect(snapshot.runeliteLabel).toBe("Refresh RuneLite");
    expect(snapshot.runeliteDetail).toBe("Last scan 2h ago");
    expect(snapshot.runeliteNeedsRefresh).toBe(false);
    expect(snapshot.pluginBankItemCount).toBe(778);
    expect(snapshot.moodLabel).toBe("AFK");
    expect(snapshot.planHref).toBe("/next?rsn=Lauky&intent=afk&time=30");
    expect(snapshot.bankHref).toBe("/bank?rsn=Lauky&from=account");
    expect(snapshot.pluginHref).toBe("/plugin?rsn=Lauky&from=account#verify-sync");
    expect(snapshot.dpsHref).toBe("/dps?rsn=Lauky&from=account");
  });

  it("marks RuneLite refresh when the last check is old", async () => {
    const { markRuneliteChecked, upsertAccount } = await import("@/lib/account-storage");
    const { loadAccountSnapshot } = await import("@/lib/account-context");

    upsertAccount("Old Scan");
    markRuneliteChecked("Old Scan", Date.now() - 25 * 60 * 60 * 1000);

    const snapshot = loadAccountSnapshot("Old Scan");

    expect(snapshot.runeliteDetail).toBe("Last scan 1d ago");
    expect(snapshot.runeliteNeedsRefresh).toBe(true);
  });
});
