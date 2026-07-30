import { describe, expect, it } from "vitest";
import {
  loadQuestCompletionAnswers,
  saveQuestCompletionAnswer
} from "@/lib/quest-completion-answers";

class MemoryStorage {
  private readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }

  replaceAllValues(value: string): void {
    for (const key of this.values.keys()) this.values.set(key, value);
  }
}

describe("local quest completion answers", () => {
  it("persists yes/no answers per RSN and replaces the previous answer", () => {
    const storage = new MemoryStorage();

    saveQuestCompletionAnswer("Lynx Titan", { quest: "Dragon Slayer II", completed: true }, storage);
    saveQuestCompletionAnswer("Lynx Titan", { quest: "Dragon Slayer II", completed: false }, storage);
    saveQuestCompletionAnswer("Another account", { quest: "Animal Magnetism", completed: true }, storage);

    expect(loadQuestCompletionAnswers("Lynx Titan", storage)).toEqual([
      { quest: "Dragon Slayer II", completed: false }
    ]);
    expect(loadQuestCompletionAnswers("Another account", storage)).toEqual([
      { quest: "Animal Magnetism", completed: true }
    ]);
  });

  it("treats corrupt local data as no answers", () => {
    const storage = new MemoryStorage();
    saveQuestCompletionAnswer("Lynx Titan", { quest: "Dragon Slayer II", completed: true }, storage);
    storage.replaceAllValues("{not json");

    expect(loadQuestCompletionAnswers("Lynx Titan", storage)).toEqual([]);
  });
});
