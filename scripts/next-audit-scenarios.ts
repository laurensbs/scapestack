import type { CompletionItem } from "../src/lib/goals";
import type { HiscoreSkill } from "../src/lib/hiscores";
import type { NextUpInput } from "../src/lib/next-up";
import type { AuditRule, AuditSelection } from "./next-audit-rules";

export interface NextAuditScenario {
  id: string;
  label: string;
  description: string;
  input: NextUpInput;
  selection?: AuditSelection;
  rules: AuditRule[];
}

const SKILL_NAMES = [
  "Attack", "Defence", "Strength", "Hitpoints", "Ranged", "Prayer", "Magic",
  "Cooking", "Woodcutting", "Fletching", "Fishing", "Firemaking", "Crafting",
  "Smithing", "Mining", "Herblore", "Agility", "Thieving", "Slayer", "Farming",
  "Runecraft", "Hunter", "Construction", "Sailing"
] as const;

function xpAtLevel(level: number): number {
  if (level <= 1) return 0;
  let total = 0;
  for (let current = 1; current < level; current += 1) {
    total += Math.floor(current + 300 * Math.pow(2, current / 7));
  }
  return Math.floor(total / 4);
}

export function auditSkills(
  levels: Partial<Record<(typeof SKILL_NAMES)[number], number>>,
  defaultLevel = 1
): HiscoreSkill[] {
  const skills: HiscoreSkill[] = SKILL_NAMES.map((name, index) => {
    const fallback = name === "Hitpoints" ? Math.max(10, defaultLevel) : defaultLevel;
    const level = levels[name] ?? fallback;
    return { id: index + 1, name, rank: 100_000, level, xp: xpAtLevel(level) };
  });
  const overallLevel = skills.reduce((sum, skill) => sum + skill.level, 0);
  const overallXp = skills.reduce((sum, skill) => sum + skill.xp, 0);
  return [{ id: 0, name: "Overall", rank: 100_000, level: overallLevel, xp: overallXp }, ...skills];
}

const RETURNING_LEVELS = {
  Attack: 70, Strength: 75, Defence: 70, Hitpoints: 75, Ranged: 70,
  Magic: 70, Prayer: 52, Slayer: 50, Cooking: 70, Woodcutting: 65,
  Fletching: 65, Fishing: 65, Firemaking: 60, Crafting: 60, Smithing: 60,
  Mining: 65, Herblore: 55, Agility: 60, Thieving: 60, Farming: 55,
  Runecraft: 50, Hunter: 60, Construction: 50, Sailing: 1
} as const;

const RETURNING_BANK: CompletionItem[] = [
  { id: 4151, name: "Abyssal whip" },
  { id: 1127, name: "Rune platebody" },
  { id: 1079, name: "Rune platelegs" },
  { id: 2503, name: "Black d'hide body" },
  { id: 2497, name: "Black d'hide chaps" },
  { id: 4091, name: "Mystic robe top" },
  { id: 4093, name: "Mystic robe bottom" },
  { id: 1712, name: "Amulet of glory" },
  { id: 12625, name: "Stamina potion(4)" },
  { id: 385, name: "Shark", quantity: 100 }
];

const MIDGAME_PVM_LEVELS = {
  Attack: 90, Strength: 90, Defence: 80, Hitpoints: 85, Ranged: 92,
  Magic: 85, Prayer: 74, Slayer: 80, Cooking: 80, Woodcutting: 70,
  Fletching: 80, Fishing: 70, Firemaking: 70, Crafting: 75, Smithing: 70,
  Mining: 72, Herblore: 78, Agility: 70, Thieving: 80, Farming: 75,
  Runecraft: 70, Hunter: 70, Construction: 75, Sailing: 1
} as const;

const MIDGAME_PVM_BANK: CompletionItem[] = [
  { id: 4151, name: "Abyssal whip" },
  { id: 28688, name: "Blazing blowpipe" },
  { id: 11804, name: "Bandos godsword" },
  { id: 11832, name: "Bandos chestplate" },
  { id: 11834, name: "Bandos tassets" },
  { id: 19553, name: "Amulet of torture" },
  { id: 21295, name: "Infernal cape" },
  { id: 21907, name: "Vorkath's head" },
  { id: 12921, name: "Magic fang" }
];

type AuditRuleDefinition = AuditRule extends infer Candidate
  ? Candidate extends AuditRule
    ? Omit<Candidate, "id" | "description" | "level">
    : never
  : never;

function rule(
  id: string,
  description: string,
  value: AuditRuleDefinition,
  level: AuditRule["level"] = "hard"
): AuditRule {
  return { id, description, level, ...value } as AuditRule;
}

const commonHeadlineRules: AuditRule[] = [
  rule("headline-present", "The engine returns one primary recommendation.", { type: "headline-required" }),
  rule("headline-reason", "The primary recommendation has an account-specific decision reason.", { type: "headline-has-decision-reason" }),
  rule("headline-not-scout", "A 1-4 KC scout read cannot become the primary recommendation.", { type: "headline-is-not-scout-kc" })
];

export const NEXT_AUDIT_SCENARIOS: NextAuditScenario[] = [
  {
    id: "returning-main",
    label: "Returning midgame main",
    description: "Balanced midgame account with a modest three-style bank.",
    input: {
      skills: auditSkills(RETURNING_LEVELS),
      bank: RETURNING_BANK,
      questPoints: 105,
      bossKc: {}
    },
    rules: [
      ...commonHeadlineRules,
      rule("full-basis", "Hiscores and bank are both recognized.", { type: "basis-is", basis: "full" }),
      rule("not-bank-headline", "Bank cleanup is not the answer to what to do next.", { type: "headline-does-not-match", matcher: { kinds: ["bank"] } }),
      rule("progress-choice-visible", "The visible choices contain a quest, diary or skill progression route.", { type: "visible-any", matcher: { kinds: ["quest", "diary", "skill"] } }),
      rule("no-maxing-overclaim", "The account is not presented with a maxing/cape headline.", { type: "headline-does-not-match", matcher: { titleIncludes: ["maxing"] } })
    ]
  },
  {
    id: "maxed-iron",
    label: "Maxed iron on a collection grind",
    description: "All skills 99, endgame gear and established boss history.",
    input: {
      skills: auditSkills(Object.fromEntries(SKILL_NAMES.map((name) => [name, 99]))),
      bank: [
        { id: 20997, name: "Twisted bow" },
        { id: 22325, name: "Scythe of vitur" },
        { id: 27275, name: "Tumeken's shadow" },
        { id: 25865, name: "Bow of faerdhinen (c)" },
        { id: 27226, name: "Masori mask (f)" },
        { id: 27229, name: "Masori body (f)" },
        { id: 27232, name: "Masori chaps (f)" },
        { id: 26382, name: "Torva full helm" },
        { id: 26384, name: "Torva platebody" },
        { id: 26386, name: "Torva platelegs" },
        { id: 13342, name: "Max cape" },
        { id: 9813, name: "Quest point cape" }
      ],
      questPoints: 300,
      bossKc: {
        Vorkath: 1500,
        Zulrah: 800,
        "Chambers of Xeric": 250,
        "Theatre of Blood": 80,
        "Tombs of Amascut": 400,
        "Alchemical Hydra": 600
      },
      accountMeta: {
        displayName: "Maxed Iron",
        accountType: "ironman",
        ehp: 3500,
        ehb: 900,
        lastChangedAt: null
      }
    },
    rules: [
      ...commonHeadlineRules,
      rule("skills-complete", "The skills path recognizes a maxed account.", { type: "path-percent-range", path: "Skills", min: 100, max: 100 }),
      rule("no-skill-grind", "No sub-99 skill route is shown to a maxed account.", { type: "visible-none", matcher: { kinds: ["skill"] } }),
      rule("endgame-choice", "A collection, goal or established KC route remains visible.", { type: "visible-any", matcher: { kinds: ["goal", "kc"] } })
    ]
  },
  {
    id: "bank-only-early",
    label: "Early account without RSN",
    description: "Tutorial-style bank with no public stats.",
    input: {
      bank: [
        { id: 1277, name: "Bronze sword" },
        { id: 1095, name: "Leather chaps" },
        { id: 379, name: "Lobster" },
        { id: 315, name: "Shrimps" },
        { id: 556, name: "Air rune" },
        { id: 558, name: "Mind rune" }
      ],
      questPoints: 0,
      bossKc: {}
    },
    rules: [
      ...commonHeadlineRules,
      rule("bank-only-basis", "The engine is honest that it only has a bank.", { type: "basis-is", basis: "bank-only" }),
      rule("ask-for-rsn", "The primary recommendation asks for an RSN instead of inventing account progress.", { type: "headline-matches", matcher: { ids: ["meta:add-rsn"] } }),
      rule("starter-quest", "At least one safe starter quest is visible.", { type: "visible-any", matcher: { ids: ["quest:Cook's Assistant", "quest:Sheep Shearer", "quest:Romeo & Juliet"] } }),
      rule("no-boss-without-stats", "No boss or KC route is shown without stats.", { type: "visible-none", matcher: { kinds: ["boss", "kc"] } })
    ]
  },
  {
    id: "early-rsn-main",
    label: "Early main with public stats",
    description: "Low-level account with starter gear and a valid RSN-shaped stat profile.",
    input: {
      skills: auditSkills({
        Attack: 20, Strength: 25, Defence: 20, Hitpoints: 24, Ranged: 15,
        Magic: 20, Prayer: 15, Cooking: 30, Woodcutting: 30, Fishing: 30,
        Firemaking: 30, Mining: 25, Smithing: 20, Agility: 20
      }),
      bank: [
        { id: 1323, name: "Iron scimitar" },
        { id: 1115, name: "Iron platebody" },
        { id: 379, name: "Lobster", quantity: 40 },
        { id: 554, name: "Fire rune", quantity: 300 }
      ],
      questPoints: 12,
      bossKc: {}
    },
    rules: [
      ...commonHeadlineRules,
      rule("early-full-basis", "The early account uses its stats and starter bank.", { type: "basis-is", basis: "full" }),
      rule("early-no-boss", "An early account is not pushed into bossing.", { type: "visible-none", matcher: { kinds: ["boss", "kc"] } }),
      rule("early-progress", "A quest, skill or beginner route remains visible.", { type: "visible-any", matcher: { kinds: ["quest", "skill", "milestone"] } })
    ]
  },
  {
    id: "midgame-iron",
    label: "Midgame ironman",
    description: "A self-sufficient account with modest gear and no endgame assumptions.",
    input: {
      skills: auditSkills(RETURNING_LEVELS),
      bank: [
        { id: 4151, name: "Abyssal whip" },
        { id: 1127, name: "Rune platebody" },
        { id: 2503, name: "Black d'hide body" },
        { id: 4091, name: "Mystic robe top" },
        { id: 385, name: "Shark", quantity: 60 }
      ],
      questPoints: 105,
      bossKc: {},
      accountMeta: {
        displayName: "Midgame Iron",
        accountType: "ironman",
        ehp: 450,
        ehb: 20,
        lastChangedAt: null
      }
    },
    rules: [
      ...commonHeadlineRules,
      rule("iron-detected", "The recommendation engine preserves ironman account type.", { type: "account-type-is", accountType: "ironman" }),
      rule("iron-not-cash-headline", "A midgame ironman is not given a GE-profit headline.", { type: "headline-does-not-match", matcher: { kinds: ["money"] } }),
      rule("iron-progress-visible", "An iron-appropriate quest, diary, skill or Slayer route remains visible.", { type: "visible-any", matcher: { kinds: ["quest", "diary", "skill", "slayer"] } })
    ]
  },
  {
    id: "midgame-pvm",
    label: "Midgame PvM account",
    description: "Established Vorkath/Zulrah account with 15 Vardorvis KC.",
    input: {
      skills: auditSkills(MIDGAME_PVM_LEVELS),
      bank: MIDGAME_PVM_BANK,
      questPoints: 180,
      bossKc: { Vorkath: 250, Zulrah: 180, Vardorvis: 15, "Alchemical Hydra": 30 }
    },
    rules: [
      ...commonHeadlineRules,
      rule("committed-boss-wins", "An established 15 KC boss block can become the primary trip.", { type: "headline-matches", matcher: { ids: ["kc:Vardorvis:first-50"] } }),
      rule("boss-path-grounded", "Known Vorkath and Zulrah experience registers in boss progress.", { type: "path-percent-range", path: "Bosses", min: 20, max: 100 })
    ]
  },
  {
    id: "skiller",
    label: "Combat-3 skiller",
    description: "Strong non-combat skills and no meaningful combat progression.",
    input: {
      skills: auditSkills({
        Attack: 1, Strength: 1, Defence: 1, Hitpoints: 10, Ranged: 1,
        Magic: 1, Prayer: 1, Slayer: 1, Cooking: 90, Woodcutting: 99,
        Fletching: 90, Fishing: 90, Firemaking: 99, Crafting: 85,
        Smithing: 80, Mining: 90, Herblore: 80, Agility: 80, Thieving: 80,
        Farming: 85, Runecraft: 80, Hunter: 80, Construction: 80, Sailing: 1
      }),
      bank: [{ id: 1351, name: "Bronze axe" }, { id: 1712, name: "Amulet of glory" }],
      questPoints: 60,
      bossKc: {}
    },
    rules: [
      ...commonHeadlineRules,
      rule("no-combat-headline", "A skiller does not receive a combat headline.", { type: "headline-does-not-match", matcher: { kinds: ["boss", "kc", "slayer"] } }),
      rule("no-combat-visible", "The visible route set contains no boss or KC recommendation.", { type: "visible-none", matcher: { kinds: ["boss", "kc"] } }),
      rule("skiller-progress", "The skills path reflects substantial non-combat progress.", { type: "path-percent-range", path: "Skills", min: 45, max: 60 })
    ]
  },
  {
    id: "one-kc-callisto",
    label: "One-KC wilderness scout",
    description: "Midgame account has tried Callisto once but has no commitment signal.",
    input: {
      skills: auditSkills(MIDGAME_PVM_LEVELS),
      bank: MIDGAME_PVM_BANK,
      questPoints: 180,
      bossKc: { Callisto: 1 }
    },
    rules: [
      ...commonHeadlineRules,
      rule("callisto-not-headline", "One Callisto KC stays context rather than the primary plan.", { type: "headline-does-not-match", matcher: { ids: ["kc:Callisto:first-50"] } }),
      rule("callisto-scout-visible", "The scout read can remain as a lower-priority option.", { type: "visible-any", matcher: { ids: ["kc:Callisto:first-50"] } }, "editorial")
    ]
  },
  {
    id: "active-slayer",
    label: "Active RuneLite Slayer task",
    description: "A capable account has 47 dust devils remaining in the live plugin state.",
    input: {
      skills: auditSkills({ ...MIDGAME_PVM_LEVELS, Slayer: 85 }),
      bank: MIDGAME_PVM_BANK,
      questPoints: 180,
      scapestackSync: {
        displayName: "Task Player",
        accountType: "normal",
        questsCompleted: ["Desert Treasure I"],
        diariesCompleted: [],
        collectionLogItemIds: [],
        slayer: {
          points: 132,
          streak: 51,
          taskRemaining: 47,
          currentTaskId: 19,
          blocks: ["spiritual_creature"]
        }
      }
    },
    rules: [
      ...commonHeadlineRules,
      rule("slayer-primary", "A live, executable Slayer task becomes the primary trip.", { type: "headline-matches", matcher: { kinds: ["slayer"] } }),
      rule("runelite-reason", "The primary reason proves RuneLite task context was used.", { type: "headline-matches", matcher: { titleIncludes: ["Dust"] } })
    ]
  },
  {
    id: "hiscores-only-main",
    label: "Main without bank",
    description: "Public stats are available, but gear and supplies are unknown.",
    input: {
      skills: auditSkills(RETURNING_LEVELS),
      questPoints: 105,
      bossKc: {}
    },
    rules: [
      ...commonHeadlineRules,
      rule("hiscores-basis", "The engine recognizes Hiscores-only context.", { type: "basis-is", basis: "hiscores-only" }),
      rule("no-bank-cleanup", "Bank cleanup cannot appear without a bank.", { type: "visible-none", matcher: { kinds: ["bank"] } })
    ]
  },
  {
    id: "rich-bank-main",
    label: "Rich main with broad gear",
    description: "Strong stats and a bank that supports all three combat styles.",
    input: {
      skills: auditSkills(MIDGAME_PVM_LEVELS),
      bank: [
        ...MIDGAME_PVM_BANK,
        { id: 20997, name: "Twisted bow" },
        { id: 22325, name: "Scythe of vitur" },
        { id: 27275, name: "Tumeken's shadow" },
        { id: 26219, name: "Osmumten's fang" }
      ],
      questPoints: 200,
      bossKc: { Vorkath: 80, Zulrah: 75, "Tombs of Amascut": 25 }
    },
    rules: [
      ...commonHeadlineRules,
      rule("rich-full-basis", "Strong stats and bank produce full context.", { type: "basis-is", basis: "full" }),
      rule("no-input-nudge", "A known account never receives the Add RSN nudge.", { type: "visible-none", matcher: { ids: ["meta:add-rsn"] } })
    ]
  },
  {
    id: "stale-runelite",
    label: "Stale RuneLite snapshot",
    description: "Plugin data exists but the recorded scan is intentionally old.",
    input: {
      skills: auditSkills(RETURNING_LEVELS),
      bank: RETURNING_BANK,
      questPoints: 105,
      scapestackSync: {
        displayName: "Stale Player",
        accountType: "normal",
        questsCompleted: ["Cook's Assistant", "Animal Magnetism"],
        diariesCompleted: [{ region: "Lumbridge & Draynor", tier: "Easy" }],
        collectionLogItemIds: [],
        slayer: null
      },
      syncedSources: {
        wom: false,
        temple: false,
        collectionLog: false,
        scapestack: {
          syncedAt: "2025-01-01T00:00:00.000Z",
          quests: 2,
          diaries: 1,
          clItems: 0,
          pluginVersion: "0.2.0"
        }
      }
    },
    rules: [
      ...commonHeadlineRules,
      rule("stale-full-basis", "Stale plugin context does not erase the valid bank and Hiscores basis.", { type: "basis-is", basis: "full" }),
      rule("finished-quest-skipped", "A quest marked complete by RuneLite is not recommended again.", { type: "visible-none", matcher: { ids: ["quest:Animal Magnetism"] } })
    ]
  },
  {
    id: "chill-selection",
    label: "Chill mood selection",
    description: "Returning main asks for a low-pressure one-hour session.",
    input: {
      skills: auditSkills(RETURNING_LEVELS),
      bank: RETURNING_BANK,
      questPoints: 105,
      bossKc: { Vorkath: 20 }
    },
    selection: { mood: "chill", minutes: 60, routeLens: "smart" },
    rules: [
      ...commonHeadlineRules,
      rule("chill-safe", "Chill cannot produce a boss or KC headline.", { type: "mood-headline-safe" }),
      rule("chill-low-pressure", "Chill selects a low-pressure recommendation family.", { type: "headline-matches", matcher: { kinds: ["skill", "bank", "minigame", "money", "diary", "goal", "milestone", "quest", "slayer"] } })
    ]
  }
];
