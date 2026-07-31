import type { DiaryTier } from "./diary-db";

/** Existing /next unlock routes, shared with the player-chosen goal picker. */
export type UnlockGoalId =
  | "barrows-gloves"
  | "fairy-rings"
  | "piety"
  | "avas-assembler"
  | "dragon-defender"
  | "quest-cape"
  | "raids-prep"
  | "slayer-unlocks";

export interface UnlockGoalDefinition {
  id: UnlockGoalId;
  title: string;
  payoff: string;
  why: string;
  iconItemId?: number;
  requiredQuests?: string[];
  requiredSkills?: Array<{ skill: string; level: number }>;
  requiredDiaryTiers?: Array<{ region: string; tier: DiaryTier }>;
  requiredItems?: Array<{ name: string; quantity: number }>;
  activityRequirements?: string[];
  minQuestPoints?: number;
  stopPoint: string;
}

export const UNLOCK_GOAL_DEFINITIONS: UnlockGoalDefinition[] = [
  {
    id: "barrows-gloves",
    title: "Barrows gloves",
    payoff: "Best-in-slot hybrid gloves and a clean midgame quest spine.",
    why: "Recipe for Disaster pulls together the account routes that matter before serious PvM.",
    iconItemId: 7462,
    requiredQuests: ["Recipe for Disaster"],
    requiredSkills: [
      { skill: "Cooking", level: 70 },
      { skill: "Agility", level: 48 },
      { skill: "Herblore", level: 25 },
      { skill: "Magic", level: 59 }
    ],
    requiredItems: [
      { name: "Eye of newt", quantity: 1 },
      { name: "Rope", quantity: 1 }
    ],
    stopPoint: "Finish the next RFD subquest or clear one prerequisite quest."
  },
  {
    id: "fairy-rings",
    title: "Fairy rings",
    payoff: "Fast travel for quests, clues, Slayer and farming loops.",
    why: "Fairy rings cut travel friction from almost every future trip.",
    iconItemId: 772,
    requiredQuests: ["Priest in Peril", "Fairytale I - Growing Pains", "Fairytale II - Cure a Queen"],
    requiredItems: [{ name: "Dramen staff", quantity: 1 }],
    stopPoint: "Unlock fairy ring access, then re-sync before planning the next quest chain."
  },
  {
    id: "piety",
    title: "Piety",
    payoff: "Major melee DPS and defence prayer for Slayer and bossing.",
    why: "Piety changes combat efficiency more than another unfocused melee level.",
    iconItemId: 2413,
    requiredQuests: ["King's Ransom"],
    requiredSkills: [
      { skill: "Prayer", level: 70 },
      { skill: "Defence", level: 65 }
    ],
    activityRequirements: ["Knight Waves training ground"],
    stopPoint: "Finish King's Ransom, hit 70 Prayer, or complete Knight Waves."
  },
  {
    id: "avas-assembler",
    title: "Ava's assembler",
    payoff: "Ranged cape-slot upgrade and better ranged trips.",
    why: "Assembler prep turns ranged PvM trips into cleaner supply loops.",
    iconItemId: 22109,
    requiredQuests: ["Animal Magnetism", "Dragon Slayer II"],
    requiredSkills: [{ skill: "Ranged", level: 70 }],
    requiredItems: [
      { name: "Ava's accumulator", quantity: 1 },
      { name: "Vorkath's head", quantity: 1 }
    ],
    stopPoint: "Kill Vorkath for the head or bank the assembler materials."
  },
  {
    id: "dragon-defender",
    title: "Dragon defender",
    payoff: "Core melee offhand for Slayer, quests and boss entry.",
    why: "The defender is a permanent melee upgrade with a bounded grind.",
    iconItemId: 12954,
    requiredSkills: [
      { skill: "Attack", level: 60 },
      { skill: "Strength", level: 60 }
    ],
    requiredItems: [{ name: "Warrior guild tokens", quantity: 100 }],
    stopPoint: "Reach dragon defender or stop after one token stack is spent."
  },
  {
    id: "quest-cape",
    title: "Quest cape",
    payoff: "All quest unlocks, teleports and a finished account spine.",
    why: "Quest cape progress is the clearest long-term unlock route.",
    iconItemId: 9813,
    minQuestPoints: 290,
    requiredSkills: [
      { skill: "Agility", level: 70 },
      { skill: "Herblore", level: 70 },
      { skill: "Thieving", level: 70 },
      { skill: "Magic", level: 75 }
    ],
    stopPoint: "Finish one high-value quest or clear the nearest quest-cape skill gate."
  },
  {
    id: "raids-prep",
    title: "Raids prep",
    payoff: "Account becomes ready for CoX/ToA learning groups.",
    why: "Raids prep bundles combat, prayer and potion gates into one practical route.",
    iconItemId: 21012,
    requiredQuests: ["A Kingdom Divided", "Beneath Cursed Sands"],
    requiredSkills: [
      { skill: "Attack", level: 85 },
      { skill: "Strength", level: 85 },
      { skill: "Defence", level: 80 },
      { skill: "Ranged", level: 85 },
      { skill: "Magic", level: 85 },
      { skill: "Prayer", level: 70 },
      { skill: "Herblore", level: 78 }
    ],
    requiredItems: [
      { name: "Trident of the seas", quantity: 1 },
      { name: "Blowpipe", quantity: 1 }
    ],
    stopPoint: "Clear the nearest combat/prayer gate or finish one raid unlock quest."
  },
  {
    id: "slayer-unlocks",
    title: "Slayer unlocks",
    payoff: "Better tasks, bosses and long-term combat money routes.",
    why: "Slayer unlocks decide what tasks are worth doing next.",
    iconItemId: 11864,
    requiredQuests: ["Smoking Kills"],
    requiredSkills: [
      { skill: "Slayer", level: 75 },
      { skill: "Combat", level: 85 }
    ],
    activityRequirements: ["Useful block list and task unlocks reviewed"],
    stopPoint: "Hit the next Slayer gate, unlock a task, or fix the block list."
  }
];
