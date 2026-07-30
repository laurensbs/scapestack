import { accountIdForRsn } from "./account-storage";
import type { QuestCompletionAnswer } from "./next-up-types";

const KEY = (rsn: string) => `scapestack:quest-answers:${accountIdForRsn(rsn)}:v1`;
const MAX_ANSWERS = 250;

interface QuestAnswerStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

interface StoredQuestAnswers {
  version: 1;
  answers: QuestCompletionAnswer[];
}

function browserStorage(storage?: QuestAnswerStorage): QuestAnswerStorage | null {
  if (storage) return storage;
  if (typeof window === "undefined" || !window.localStorage) return null;
  return window.localStorage;
}

function validAnswer(value: unknown): value is QuestCompletionAnswer {
  if (!value || typeof value !== "object") return false;
  const answer = value as Partial<QuestCompletionAnswer>;
  return typeof answer.quest === "string"
    && answer.quest.trim().length > 0
    && answer.quest.length <= 300
    && typeof answer.completed === "boolean";
}

export function loadQuestCompletionAnswers(
  rsn: string,
  storage?: QuestAnswerStorage
): QuestCompletionAnswer[] {
  const cleanRsn = rsn.trim();
  const target = browserStorage(storage);
  if (!cleanRsn || !target) return [];
  try {
    const raw = target.getItem(KEY(cleanRsn));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Partial<StoredQuestAnswers>;
    if (parsed.version !== 1 || !Array.isArray(parsed.answers)) return [];
    return parsed.answers
      .filter(validAnswer)
      .slice(-MAX_ANSWERS)
      .map((answer) => ({ quest: answer.quest.trim(), completed: answer.completed }));
  } catch {
    return [];
  }
}

export function saveQuestCompletionAnswer(
  rsn: string,
  answer: QuestCompletionAnswer,
  storage?: QuestAnswerStorage
): QuestCompletionAnswer[] {
  const cleanRsn = rsn.trim();
  const cleanQuest = answer.quest.trim();
  const target = browserStorage(storage);
  if (!cleanRsn || !cleanQuest || cleanQuest.length > 300 || !target) {
    return loadQuestCompletionAnswers(cleanRsn, storage);
  }
  const normalized = cleanQuest.toLowerCase();
  const next = loadQuestCompletionAnswers(cleanRsn, target)
    .filter((entry) => entry.quest.toLowerCase() !== normalized);
  next.push({ quest: cleanQuest, completed: answer.completed });
  const bounded = next.slice(-MAX_ANSWERS);
  try {
    target.setItem(KEY(cleanRsn), JSON.stringify({ version: 1, answers: bounded } satisfies StoredQuestAnswers));
  } catch {
  }
  return bounded;
}
