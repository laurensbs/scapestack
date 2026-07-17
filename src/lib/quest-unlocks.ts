import type { QuestRecord } from "./quest-db";

export interface QuestUnlockSignal {
  label: string;
  value: number;
  iconItemId?: number;
}

export const QUEST_UNLOCK_RULES: ReadonlyArray<{ match: RegExp; unlock: string; value: number; iconItemId?: number }> = [
  { match: /^tree gnome village$/i, unlock: "Spirit Trees", value: 92, iconItemId: 772 },
  { match: /^the grand tree$/i, unlock: "Gnome Stronghold route and Monkey Madness chain", value: 84, iconItemId: 9469 },
  { match: /^animal magnetism$/i, unlock: "Ava's device", value: 94, iconItemId: 10499 },
  { match: /^druidic ritual$/i, unlock: "Herblore", value: 96, iconItemId: 255 },
  { match: /fairy/i, unlock: "Fairy ring travel", value: 96, iconItemId: 772 },
  { match: /^horror from the deep$/i, unlock: "God books and dagannoth quest chain", value: 74, iconItemId: 3840 },
  { match: /^priest in peril$/i, unlock: "Morytania access", value: 88, iconItemId: 10499 },
  { match: /^monkey madness/i, unlock: "Dragon scimitar and Ape Atoll route", value: 90, iconItemId: 4587 },
  { match: /^recipe for disaster/i, unlock: "Barrows gloves route", value: 98, iconItemId: 7462 },
  { match: /^king's ransom$/i, unlock: "Piety route", value: 95, iconItemId: 2412 },
  { match: /^dragon slayer/i, unlock: "dragon equipment and major quest progression", value: 86, iconItemId: 11283 },
  { match: /^desert treasure/i, unlock: "Ancient Magicks", value: 92, iconItemId: 4675 },
  { match: /^song of the elves$/i, unlock: "Prifddinas and the Corrupted Gauntlet", value: 99, iconItemId: 23997 }
];

export function isCuratedQuestUnlock(questName: string): boolean {
  return QUEST_UNLOCK_RULES.some((rule) => rule.match.test(questName));
}

export function questUnlockSignal(quest: QuestRecord): QuestUnlockSignal {
  const curated = QUEST_UNLOCK_RULES.find((rule) => rule.match.test(quest.name));
  if (curated) return { label: curated.unlock, value: curated.value, iconItemId: curated.iconItemId };

  const difficultyValue = quest.difficulty === "Grandmaster"
    ? 88
    : quest.difficulty === "Master"
      ? 78
      : quest.difficulty === "Experienced"
        ? 66
        : quest.difficulty === "Intermediate"
          ? 58
          : 46;
  return {
    label: quest.difficulty === "Grandmaster" ? "a Grandmaster quest route" : `${quest.name} progression`,
    value: Math.min(100, difficultyValue + Math.min(12, quest.questReqs.length)),
    iconItemId: 9813
  };
}
