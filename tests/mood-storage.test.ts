// Mood-storage tests — roundtrips door een in-memory localStorage shim.
// Verifieert dat oude versies (v0) terugvallen op null in plaats van
// crashen wanneer we het schema bumpen.
//
// Default test-env is "node" — geen window/localStorage. We shimmen
// een minimale Storage-implementatie zelf zodat de file geen jsdom
// dependency vereist.

import { describe, it, expect, beforeEach } from "vitest";

// Minimal Storage-shim die alleen de methodes biedt die mood-storage.ts
// gebruikt. Globaal aangehecht via `globalThis` zodat de module-onder-
// test (die `localStorage` rauw refereert) hem vindt.
class MemoryStorage {
  private data = new Map<string, string>();
  getItem(key: string): string | null { return this.data.get(key) ?? null; }
  setItem(key: string, value: string): void { this.data.set(key, value); }
  removeItem(key: string): void { this.data.delete(key); }
  clear(): void { this.data.clear(); }
  get length(): number { return this.data.size; }
  key(i: number): string | null { return Array.from(this.data.keys())[i] ?? null; }
}

(globalThis as unknown as { window: object }).window = globalThis;
(globalThis as unknown as { localStorage: MemoryStorage }).localStorage = new MemoryStorage();

beforeEach(() => {
  (globalThis as unknown as { localStorage: MemoryStorage }).localStorage.clear();
});

describe("mood-storage", () => {
  it("loadMood() = null wanneer niets opgeslagen", async () => {
    const { loadMood } = await import("@/lib/mood-storage");
    expect(loadMood()).toBeNull();
  });

  it("saveMood + loadMood roundtrip", async () => {
    const { saveMood, loadMood } = await import("@/lib/mood-storage");
    saveMood({
      mood: "focused",
      minutes: 60,
      lastHeadlineId: "vorkath-kc",
      lastHeadlineTitle: "Vorkath visage chase"
    });
    const back = loadMood();
    expect(back).not.toBeNull();
    expect(back!.mood).toBe("focused");
    expect(back!.minutes).toBe(60);
    expect(back!.lastHeadlineTitle).toBe("Vorkath visage chase");
    expect(back!.version).toBe(1);
    expect(back!.savedAt).toBeGreaterThan(0);
  });

  it("prefers the active account mood when one is saved", async () => {
    const { upsertAccount, markAccountMood } = await import("@/lib/account-storage");
    const { loadMood } = await import("@/lib/mood-storage");

    upsertAccount("Lynx Titan");
    markAccountMood("Lynx Titan", "afk", 30);

    expect(loadMood()).toMatchObject({
      mood: "afk",
      minutes: 30
    });
    expect(loadMood("Lynx Titan")).toMatchObject({
      mood: "afk",
      minutes: 30
    });
  });

  it("oude versie (v0) wordt genegeerd", async () => {
    const { loadMood } = await import("@/lib/mood-storage");
    localStorage.setItem(
      "scapestack:mood-last:v1",
      JSON.stringify({ version: 0, mood: "chill", minutes: 30 })
    );
    expect(loadMood()).toBeNull();
  });

  it("corrupt JSON wordt netjes afgehandeld", async () => {
    const { loadMood } = await import("@/lib/mood-storage");
    localStorage.setItem("scapestack:mood-last:v1", "{ not valid json");
    expect(loadMood()).toBeNull();
  });
});

describe("relativeSince", () => {
  it("'just now' under 90 sec", async () => {
    const { relativeSince } = await import("@/lib/mood-storage");
    expect(relativeSince(Date.now() - 30_000)).toBe("just now");
  });

  it("'X min ago' between 90s and 1h", async () => {
    const { relativeSince } = await import("@/lib/mood-storage");
    expect(relativeSince(Date.now() - 5 * 60 * 1000)).toMatch(/min ago/);
  });

  it("'X hours ago' between 1h and 24h", async () => {
    const { relativeSince } = await import("@/lib/mood-storage");
    expect(relativeSince(Date.now() - 3 * 3600 * 1000)).toMatch(/hour.* ago/);
  });

  it("'X days ago' over 24h", async () => {
    const { relativeSince } = await import("@/lib/mood-storage");
    expect(relativeSince(Date.now() - 3 * 86400 * 1000)).toMatch(/day.* ago/);
  });
});
