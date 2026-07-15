import { beforeEach, describe, expect, it } from "vitest";

class MemoryStorage {
  private data = new Map<string, string>();
  getItem(key: string): string | null { return this.data.get(key) ?? null; }
  setItem(key: string, value: string): void { this.data.set(key, value); }
  removeItem(key: string): void { this.data.delete(key); }
  clear(): void { this.data.clear(); }
  get length(): number { return this.data.size; }
  key(i: number): string | null { return Array.from(this.data.keys())[i] ?? null; }
}

(globalThis as unknown as { localStorage: MemoryStorage }).localStorage = new MemoryStorage();
(globalThis as unknown as { window: { localStorage: MemoryStorage; dispatchEvent: (event: Event) => boolean } }).window = {
  localStorage: (globalThis as unknown as { localStorage: MemoryStorage }).localStorage,
  dispatchEvent: () => true
};
(globalThis as unknown as { CustomEvent: typeof CustomEvent }).CustomEvent = (class CustomEventPolyfill<T = unknown> extends Event {
  detail: T;
  constructor(type: string, init?: CustomEventInit<T>) {
    super(type);
    this.detail = init?.detail as T;
  }
} as unknown) as typeof CustomEvent;

beforeEach(() => {
  localStorage.clear();
});

describe("account storage", () => {
  it("stores one active account and normalizes whitespace", async () => {
    const { getActiveAccount, upsertAccount } = await import("@/lib/account-storage");

    upsertAccount("  Lynx   Titan  ");

    expect(getActiveAccount()).toMatchObject({
      rsn: "Lynx Titan",
      id: "lynx_titan"
    });
  });

  it("keeps recent accounts and lets active removal fall back to no account", async () => {
    const { getActiveAccount, loadAccountStore, removeAccount, setActiveAccount, upsertAccount } = await import("@/lib/account-storage");

    upsertAccount("Main Guy");
    upsertAccount("Iron Guy");
    setActiveAccount("Main Guy");

    expect(getActiveAccount()?.rsn).toBe("Main Guy");
    expect(loadAccountStore().accounts.map((account) => account.rsn)).toEqual(["Main Guy", "Iron Guy"]);

    removeAccount("Main Guy");

    expect(getActiveAccount()).toBeNull();
    expect(loadAccountStore().activeId).toBeNull();
    expect(loadAccountStore().accounts.map((account) => account.rsn)).toEqual(["Iron Guy"]);

    setActiveAccount("Iron Guy");
    expect(getActiveAccount()?.rsn).toBe("Iron Guy");
  });

  it("removes the account bank link when an account is deleted", async () => {
    const { getActiveAccount, removeAccount, upsertAccount } = await import("@/lib/account-storage");
    const { loadSavedBank, saveSavedBank } = await import("@/lib/saved-bank");

    upsertAccount("Main Guy");
    saveSavedBank("Item id\tItem name\tItem quantity\n383\tRaw shark\t312", "Main Guy");

    expect(loadSavedBank("Main Guy")?.banktags).toContain("Raw shark");
    expect(loadSavedBank()?.banktags).toContain("Raw shark");

    removeAccount("Main Guy");

    expect(getActiveAccount()).toBeNull();
    expect(loadSavedBank("Main Guy")).toBeNull();
    expect(loadSavedBank()).toBeNull();
  });

  it("records bank and runelite status on the active account", async () => {
    const { clearRuneliteChecked, getActiveAccount, loadAccountStore, markAccountBankSaved, markAccountMood, markAccountPluginBankStatus, markAccountRuneliteProgress, markActiveAccountBankSaved, markRuneliteChecked, upsertAccount } = await import("@/lib/account-storage");

    upsertAccount("Lynx Titan");
    markActiveAccountBankSaved(1_780_000_000_000);
    markAccountBankSaved("Iron Guy", 1_780_000_005_000);
    markAccountPluginBankStatus("Lynx Titan", { enabled: true, itemCount: 612, capturedAt: "2026-07-15T09:00:00.000Z", unavailableReason: null });
    markRuneliteChecked("Lynx Titan", 1_780_000_010_000);
    markAccountMood("Lynx Titan", "afk", 30, {
      lastHeadlineId: "skill:farming",
      lastHeadlineTitle: "Run herbs + birdhouses",
      savedAt: 1_780_000_012_000
    });
    markAccountRuneliteProgress("Lynx Titan", {
      title: "Finished steps are gone",
      lead: "Pick a maxing lane: Cooking is checked against the latest scan.",
      lines: ["Cooking 97->98: +450k XP", "Karamja Hard finished"],
      syncedAt: "2026-07-15T11:00:00.000Z",
      savedAt: 1_780_000_013_000
    });

    expect(getActiveAccount()).toMatchObject({
      rsn: "Lynx Titan",
      bankSavedAt: 1_780_000_000_000,
      pluginBankItemCount: 612,
      pluginBankCapturedAt: "2026-07-15T09:00:00.000Z",
      runeliteCheckedAt: 1_780_000_010_000,
      preferredMood: "afk",
      preferredMinutes: 30,
      lastHeadlineId: "skill:farming",
      lastHeadlineTitle: "Run herbs + birdhouses",
      lastHeadlineSavedAt: 1_780_000_012_000,
      runeliteProgressTitle: "Finished steps are gone",
      runeliteProgressLead: "Pick a maxing lane: Cooking is checked against the latest scan.",
      runeliteProgressLines: ["Cooking 97->98: +450k XP", "Karamja Hard finished"],
      runeliteProgressSyncedAt: "2026-07-15T11:00:00.000Z",
      runeliteProgressSavedAt: 1_780_000_013_000
    });
    expect(loadAccountStore().accounts.find((account) => account.rsn === "Iron Guy")).toMatchObject({
      bankSavedAt: 1_780_000_005_000
    });

    clearRuneliteChecked("Lynx Titan");

    expect(getActiveAccount()?.runeliteCheckedAt).toBeUndefined();
  });

  it("treats plugin bank status as account bank context", async () => {
    const { accountHasBankContext, getActiveAccount, markAccountPluginBankStatus, upsertAccount } = await import("@/lib/account-storage");

    upsertAccount("Bank Sync");
    expect(accountHasBankContext(getActiveAccount())).toBe(false);

    markAccountPluginBankStatus("Bank Sync", { enabled: true, itemCount: 778, capturedAt: null, unavailableReason: null });
    expect(accountHasBankContext(getActiveAccount())).toBe(true);

    markAccountPluginBankStatus("Bank Sync", { enabled: false, itemCount: 0, capturedAt: null, unavailableReason: "opt-in-off" });
    expect(accountHasBankContext(getActiveAccount())).toBe(false);
  });

  it("keeps first setup completion attached to the RSN", async () => {
    const { hasAccountFirstSetupSeen, loadAccountStore, markAccountFirstSetupSeen, upsertAccount } = await import("@/lib/account-storage");

    upsertAccount("Lauky");
    expect(hasAccountFirstSetupSeen("Lauky")).toBe(false);

    markAccountFirstSetupSeen("Lauky", 1_725_000_000_000);

    expect(hasAccountFirstSetupSeen("Lauky")).toBe(true);
    expect(loadAccountStore().accounts[0]).toMatchObject({
      rsn: "Lauky",
      firstSetupCompletedAt: 1_725_000_000_000
    });
  });
});
