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

  it("keeps recent accounts and switches active account", async () => {
    const { getActiveAccount, loadAccountStore, setActiveAccount, upsertAccount } = await import("@/lib/account-storage");

    upsertAccount("Main Guy");
    upsertAccount("Iron Guy");
    setActiveAccount("Main Guy");

    expect(getActiveAccount()?.rsn).toBe("Main Guy");
    expect(loadAccountStore().accounts.map((account) => account.rsn)).toEqual(["Main Guy", "Iron Guy"]);
  });

  it("records bank and runelite status on the active account", async () => {
    const { getActiveAccount, markActiveAccountBankSaved, markRuneliteChecked, upsertAccount } = await import("@/lib/account-storage");

    upsertAccount("Lynx Titan");
    markActiveAccountBankSaved(1_780_000_000_000);
    markRuneliteChecked("Lynx Titan", 1_780_000_010_000);

    expect(getActiveAccount()).toMatchObject({
      rsn: "Lynx Titan",
      bankSavedAt: 1_780_000_000_000,
      runeliteCheckedAt: 1_780_000_010_000
    });
  });
});
