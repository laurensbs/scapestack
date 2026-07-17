import { beforeEach, describe, expect, it } from "vitest";

class MemoryStorage {
  private values = new Map<string, string>();
  getItem(key: string): string | null { return this.values.get(key) ?? null; }
  setItem(key: string, value: string): void { this.values.set(key, value); }
  removeItem(key: string): void { this.values.delete(key); }
  clear(): void { this.values.clear(); }
}

const storage = new MemoryStorage();
const target = new EventTarget();
Object.assign(globalThis, {
  localStorage: storage,
  window: {
    localStorage: storage,
    addEventListener: target.addEventListener.bind(target),
    removeEventListener: target.removeEventListener.bind(target),
    dispatchEvent: target.dispatchEvent.bind(target)
  }
});

import {
  clearDiaryTierChecks,
  loadDiaryTaskChecks,
  setDiaryTaskChecked
} from "@/lib/diary-progress-storage";

describe("diary progress storage", () => {
  beforeEach(() => storage.clear());

  it("survives return visits and stays scoped to the account", () => {
    setDiaryTaskChecked("Lauky", "karamja:easy:1", true);
    expect(loadDiaryTaskChecks("Lauky")).toEqual(new Set(["karamja:easy:1"]));
    expect(loadDiaryTaskChecks("Other player")).toEqual(new Set());
  });

  it("unchecks tasks and can clear one tier without touching another", () => {
    setDiaryTaskChecked("Lauky", "karamja:easy:1", true);
    setDiaryTaskChecked("Lauky", "karamja:easy:2", true);
    setDiaryTaskChecked("Lauky", "karamja:medium:1", true);
    setDiaryTaskChecked("Lauky", "karamja:easy:2", false);

    expect(clearDiaryTierChecks("Lauky", ["karamja:easy:1", "karamja:easy:2"]))
      .toEqual(new Set(["karamja:medium:1"]));
  });
});
