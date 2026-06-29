import { describe, it, expect, beforeEach } from "vitest";

// The module reads `typeof window === "undefined"` to no-op on SSR. We
// emulate a browser by stubbing `window`, `localStorage`, and `sessionStorage`
// on globalThis before each test. A plain in-memory map is enough — we test
// the module's behaviour, not the browser's storage implementation.

class MemoryStorage {
  private map = new Map<string, string>();
  getItem(k: string) { return this.map.has(k) ? this.map.get(k)! : null; }
  setItem(k: string, v: string) { this.map.set(k, v); }
  removeItem(k: string) { this.map.delete(k); }
  clear() { this.map.clear(); }
  key(i: number) { return Array.from(this.map.keys())[i] ?? null; }
  get length() { return this.map.size; }
}

// Cast through unknown — the test only needs the module to find
// localStorage/sessionStorage on globalThis and `typeof window` to be
// non-undefined. We don't want to satisfy the full Window typing.
type Mutable = Record<string, unknown>;
const g = globalThis as Mutable;

beforeEach(() => {
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

// Tiny helper so tests can read the mocked storage without retyping the cast.
function ls(): MemoryStorage { return g.localStorage as MemoryStorage; }

// Lazy-import so each test sees a fresh module-level read of `window`/storage.
async function loadModule() {
  // Module has no module-level state to reset — the guard runs per call.
  return await import("@/lib/saved-bank");
}

describe("saved-bank: bank round-trip", () => {
  it("saves and reloads the same banktags string", async () => {
    const { saveSavedBank, loadSavedBank } = await loadModule();
    saveSavedBank("Combat\n4151,1\n11804,1\n");
    const got = loadSavedBank();
    expect(got).not.toBeNull();
    expect(got!.banktags).toBe("Combat\n4151,1\n11804,1");
    expect(got!.version).toBe(1);
    expect(typeof got!.savedAt).toBe("number");
  });

  it("keeps setup separate per remembered RSN", async () => {
    const { saveSavedBank, loadSavedBank } = await loadModule();

    saveSavedBank("Main setup\n4151,1", "Main Guy");
    saveSavedBank("Iron setup\n4587,1", "Iron Guy");

    expect(loadSavedBank("Main Guy")?.banktags).toBe("Main setup\n4151,1");
    expect(loadSavedBank("Iron Guy")?.banktags).toBe("Iron setup\n4587,1");
  });

  it("returns null when nothing is saved", async () => {
    const { loadSavedBank } = await loadModule();
    expect(loadSavedBank()).toBeNull();
  });

  it("clearSavedBank() removes the saved bank", async () => {
    const { saveSavedBank, loadSavedBank, clearSavedBank } = await loadModule();
    saveSavedBank("Combat\n4151,1");
    expect(loadSavedBank()).not.toBeNull();
    clearSavedBank();
    expect(loadSavedBank()).toBeNull();
  });

  it("ignores empty / whitespace-only paste", async () => {
    const { saveSavedBank, loadSavedBank } = await loadModule();
    saveSavedBank("   \n\t   ");
    expect(loadSavedBank()).toBeNull();
  });
});

describe("saved-bank: corruption resilience", () => {
  it("returns null and wipes the slot on malformed JSON", async () => {
    ls().setItem("scapestack:saved-bank:v1", "{not valid json");
    const { loadSavedBank } = await loadModule();
    expect(loadSavedBank()).toBeNull();
    // The malformed payload also gets cleaned up so we don't keep parsing it.
    expect(ls().getItem("scapestack:saved-bank:v1")).toBeNull();
  });

  it("returns null on the wrong schema (missing fields, wrong version)", async () => {
    const cases = [
      JSON.stringify({ version: 1, banktags: "" }),                     // empty string
      JSON.stringify({ version: 2, banktags: "x", savedAt: 1 }),        // version mismatch
      JSON.stringify({ version: 1, banktags: "x", savedAt: "no" }),     // bad savedAt
      JSON.stringify(null),                                              // literal null
      JSON.stringify("just a string"),                                   // not an object
    ];
    const { loadSavedBank } = await loadModule();
    for (const payload of cases) {
      ls().setItem("scapestack:saved-bank:v1", payload);
      expect(loadSavedBank()).toBeNull();
    }
  });
});

describe("saved-bank: session opt-out", () => {
  it("disableSaveBankForSession() clears the bank and blocks new saves", async () => {
    const { saveSavedBank, loadSavedBank, disableSaveBankForSession } = await loadModule();
    saveSavedBank("Combat\n4151,1");
    expect(loadSavedBank()).not.toBeNull();

    disableSaveBankForSession();
    expect(loadSavedBank()).toBeNull();

    saveSavedBank("Combat\n4151,1"); // should be ignored
    expect(loadSavedBank()).toBeNull();
  });

  it("opt-out also blocks RSN saving", async () => {
    const { saveSavedRsn, loadSavedRsn, disableSaveBankForSession } = await loadModule();
    disableSaveBankForSession();
    saveSavedRsn("Lynx Titan");
    expect(loadSavedRsn()).toBeNull();
  });
});

describe("saved-bank: RSN round-trip", () => {
  it("saves and reloads RSN, trimming whitespace", async () => {
    const { saveSavedRsn, loadSavedRsn } = await loadModule();
    saveSavedRsn("  Lynx Titan  ");
    expect(loadSavedRsn()).toBe("Lynx Titan");
  });

  it("clearSavedRsn() removes it", async () => {
    const { saveSavedRsn, loadSavedRsn, clearSavedRsn } = await loadModule();
    saveSavedRsn("Zezima");
    clearSavedRsn();
    expect(loadSavedRsn()).toBeNull();
  });

  it("ignores empty saves", async () => {
    const { saveSavedRsn, loadSavedRsn } = await loadModule();
    saveSavedRsn("");
    saveSavedRsn("   ");
    expect(loadSavedRsn()).toBeNull();
  });
});

describe("saved-bank: diffIconicItems", () => {
  it("detects new iconics from canonical Bank Memory TSV item-name column", async () => {
    const { diffIconicItems } = await loadModule();
    const prev = [
      "Item id\tItem name\tItem quantity",
      "4151\tAbyssal whip\t1",
      "4587\tDragon scimitar\t1"
    ].join("\n");
    const next = [
      "Item id\tItem name\tItem quantity",
      "4151\tAbyssal whip\t1",
      "4587\tDragon scimitar\t1",
      "20997\tTwisted bow\t1"
    ].join("\n");

    const fresh = diffIconicItems(prev, next);

    expect(fresh).toHaveLength(1);
    expect(fresh[0].displayName).toBe("Twisted bow");
  });

  it("flags items present in next but not in prev", async () => {
    const { diffIconicItems } = await loadModule();
    const prev = "Abyssal whip\t1\nDragon scimitar\t1\n";
    const next = "Abyssal whip\t1\nDragon scimitar\t1\nTwisted bow\t1\n";
    const fresh = diffIconicItems(prev, next);
    expect(fresh).toHaveLength(1);
    expect(fresh[0].displayName).toBe("Twisted bow");
  });

  it("returns empty when nothing iconic changed", async () => {
    const { diffIconicItems } = await loadModule();
    const prev = "Twisted bow\t1\nScythe of vitur\t1\n";
    const next = "Twisted bow\t1\nScythe of vitur\t1\nRune platebody\t1\n";
    expect(diffIconicItems(prev, next)).toEqual([]);
  });

  it("returns empty when prev or next is empty", async () => {
    const { diffIconicItems } = await loadModule();
    expect(diffIconicItems("", "Twisted bow\t1\n")).toEqual([]);
    expect(diffIconicItems("Twisted bow\t1\n", "")).toEqual([]);
  });

  it("returns empty for Bank Tags format with no item names (id-only)", async () => {
    const { diffIconicItems } = await loadModule();
    const prev = "combat,4151,1127";
    const next = "combat,4151,1127,20997"; // Tbow added but no item-name lines
    // Tag-only format isn't supported — we'd need an id-to-name lookup, and
    // celebrations from a tag paste would be too noisy anyway.
    expect(diffIconicItems(prev, next)).toEqual([]);
  });

  it("matches multiple iconics added in one paste", async () => {
    const { diffIconicItems } = await loadModule();
    const prev = "Whip\t1\n";
    const next = "Whip\t1\nTwisted bow\t1\nScythe of vitur\t1\n";
    const fresh = diffIconicItems(prev, next);
    expect(fresh.map((i) => i.displayName).sort()).toEqual(["Scythe of vitur", "Twisted bow"]);
  });
});

describe("saved-bank: describeSavedAt", () => {
  it("formats common ranges in plain English", async () => {
    const { describeSavedAt } = await loadModule();
    const now = 1_700_000_000_000;
    expect(describeSavedAt(now, now)).toBe("just now");
    expect(describeSavedAt(now - 30 * 1000, now)).toBe("just now");
    expect(describeSavedAt(now - 60 * 1000, now)).toBe("1 minute ago");
    expect(describeSavedAt(now - 5 * 60 * 1000, now)).toBe("5 minutes ago");
    expect(describeSavedAt(now - 60 * 60 * 1000, now)).toBe("1 hour ago");
    expect(describeSavedAt(now - 3 * 24 * 60 * 60 * 1000, now)).toBe("3 days ago");
    expect(describeSavedAt(now - 14 * 24 * 60 * 60 * 1000, now)).toBe("2 weeks ago");
    expect(describeSavedAt(now - 60 * 24 * 60 * 60 * 1000, now)).toBe("2 months ago");
    expect(describeSavedAt(now - 400 * 24 * 60 * 60 * 1000, now)).toBe("1 year ago");
  });

  it("clamps negative diffs (clock skew) to 'just now'", async () => {
    const { describeSavedAt } = await loadModule();
    expect(describeSavedAt(2000, 1000)).toBe("just now");
  });
});
