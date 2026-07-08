import { describe, expect, it } from "vitest";
import { computeNextUp } from "@/lib/next-up";
import { formatRecommendationActionPlan, formatRecommendationSessionPlan } from "@/lib/action-plan-text";
import type { HiscoreSkill } from "@/lib/hiscores";

const SKILLS = [
  "Attack", "Defence", "Strength", "Hitpoints", "Ranged", "Prayer",
  "Magic", "Cooking", "Woodcutting", "Fletching", "Fishing", "Firemaking",
  "Crafting", "Smithing", "Mining", "Herblore", "Agility", "Thieving",
  "Slayer", "Farming", "Runecraft", "Hunter", "Construction", "Sailing"
];

function skillsAt(level: number): HiscoreSkill[] {
  return [
    { id: 0, name: "Overall", rank: 1, level: level * SKILLS.length, xp: 0 },
    ...SKILLS.map((name, index) => ({ id: index + 1, name, rank: 1, level, xp: level >= 99 ? 13_034_431 : 737_627 }))
  ];
}

function skillsFromLevels(levels: Partial<Record<string, number>>): HiscoreSkill[] {
  const skills = SKILLS.map((name, index) => ({
    id: index + 1,
    name,
    rank: 1,
    level: levels[name] ?? 1,
    xp: 737_627
  }));
  const totalLevel = skills.reduce((sum, skill) => sum + skill.level, 0);
  return [{ id: 0, name: "Overall", rank: 1, level: totalLevel, xp: 0 }, ...skills];
}

describe("next-up action plans", () => {
  it("adds an executable session plan to recommendations", async () => {
    const result = await computeNextUp({ bank: [{ id: 995, name: "Coins" }] });

    expect(result.headline).toBeTruthy();
    expect(result.headline?.actionPlan).toBeTruthy();
    expect(result.headline?.actionPlan?.steps.length).toBeGreaterThanOrEqual(2);
    expect(result.headline?.actionPlan?.timebox).toBeTruthy();
    expect("planSeed" in result.headline!).toBe(false);
  });

  it("formats action plans as copyable session checklists", async () => {
    const result = await computeNextUp({ bank: [{ id: 995, name: "Coins" }] });
    const text = formatRecommendationActionPlan(result.headline!, {
      from: "next",
      rsn: "Lynx Titan",
      hasBankContext: true
    });

    expect(text).toContain(result.headline!.title);
    expect(text).toContain("Goal:");
    expect(text).toContain("Why:");
    expect(text).toContain("Time:");
    expect(text).toContain("Gear/supplies:");
    expect(text).toMatch(/\n1\. /);
    expect(text).toContain("Find unlock");
    expect(text).toContain("https://www.scapestack.org/");
    expect(text).toContain("rsn=Lynx+Titan");
    expect(text).toContain("from=next");
    expect(text).toContain("Optional:");
  });

  it("formats the top recommendations as one copyable session plan", async () => {
    const result = await computeNextUp({
      skills: skillsFromLevels({ Attack: 70, Strength: 70, Defence: 70, Hitpoints: 70, Ranged: 70, Magic: 70, Slayer: 55 }),
      bank: [{ id: 995, name: "Coins" }]
    });
    const recs = [result.headline, ...result.rest].filter((rec): rec is NonNullable<typeof rec> => Boolean(rec));
    const text = formatRecommendationSessionPlan(recs, {
      from: "next",
      rsn: "Lynx Titan",
      hasBankContext: true
    });

    expect(text).toContain("Tonight:");
    expect(text).toContain("Do the first step. Stop at the stop point.");
    expect(text).toContain("Do this first");
    expect(text).toContain("Backup 1");
    expect(text).toContain("Backup 2");
    expect(text).toMatch(/Goal: (GP|Bossing|Slayer|AFK|Chill|Unlock) - /);
    expect(text).toContain("Why:");
    expect(text).toContain("Time:");
    expect(text).toContain("Bring:");
    expect(text).toContain("Start:");
    expect(text).toContain("Stop:");
    expect(text).toContain("https://www.scapestack.org/");
    expect(text).toContain("rsn=Lynx+Titan");
  });

  it("marks bank-only advice as a likely fit with an RSN caveat", async () => {
    const result = await computeNextUp({ bank: [{ id: 995, name: "Coins" }] });
    const recs = [result.headline, ...result.rest].filter(Boolean);
    const addRsnSteps = result.headline?.actionPlan?.steps.join(" ") ?? "";
    const romeo = recs.find((rec) => rec?.id === "quest:Romeo & Juliet");
    const romeoSteps = romeo?.actionPlan?.steps.join(" ") ?? "";

    expect(result.summary.basis).toBe("bank-only");
    expect(result.headline?.id).toBe("meta:add-rsn");
    expect(result.headline?.actionPlan?.confidence).toBe("likely");
    expect(result.headline?.actionPlan?.caveat).toContain("Add your RSN");
    expect(result.headline?.actionPlan?.timebox).toBe("2 min");
    expect(result.headline?.actionPlan?.steps[0]).toContain("Enter your OSRS name");
    expect(addRsnSteps).toContain("suggests quests, diary tiers, collection-log slots or Slayer tasks");
    expect(addRsnSteps).not.toContain("exact quest/diary");
    expect(recs.some((rec) => rec?.id === "quest:Cook's Assistant")).toBe(true);
    expect(romeo).toBeTruthy();
    expect(romeoSteps).toContain("Scapestack can use Hiscores instead of a starter-account default");
    expect(romeoSteps).not.toContain("stops guessing");
  });

  it("uses goal-specific missing pieces when a set is close", async () => {
    const result = await computeNextUp({
      bank: [
        { id: 1, name: "Pyromancer hood" },
        { id: 2, name: "Pyromancer garb" },
        { id: 3, name: "Pyromancer robe" }
      ]
    });
    const recs = [result.headline, ...result.rest].filter(Boolean);
    const pyro = recs.find((rec) => rec?.id === "goal:pyromancer");

    expect(pyro?.actionPlan?.prep).toContain("Pyromancer boots");
    expect(pyro?.actionPlan?.steps[1]).toContain("Pyromancer boots");
  });

  it("does not recommend quests to quest-cape-range accounts", async () => {
    const result = await computeNextUp({
      skills: skillsAt(99),
      questPoints: 300
    });
    const recs = [result.headline, ...result.rest].filter(Boolean);

    expect(recs.some((rec) => rec?.kind === "quest")).toBe(false);
  });

  it("does not recommend quests that exact sync data marks complete", async () => {
    const result = await computeNextUp({
      skills: skillsAt(99),
      questPoints: 180,
      templeQuestsCompleted: ["monkey madness ii"]
    });
    const recs = [result.headline, ...result.rest].filter(Boolean);

    expect(recs.some((rec) => rec?.id === "quest:Monkey Madness II")).toBe(false);
  });

  it("does not show regular GP/hour money-makers for iron accounts", async () => {
    const result = await computeNextUp({
      skills: skillsAt(99),
      accountMeta: {
        displayName: "Iron Test",
        accountType: "ironman",
        ehp: 1000,
        ehb: 100,
        lastChangedAt: null
      }
    });
    const recs = [result.headline, ...result.rest].filter(Boolean);

    expect(recs.some((rec) => rec?.kind === "money")).toBe(false);
  });

  it("uses Scapestack sync account type when WOM account metadata is absent", async () => {
    const result = await computeNextUp({
      skills: skillsAt(99),
      questPoints: 180,
      scapestackSync: {
        displayName: "Group Test",
        accountType: "group_ironman",
        questsCompleted: [],
        diariesCompleted: [],
        collectionLogItemIds: []
      }
    });
    const recs = [result.headline, ...result.rest].filter(Boolean);

    expect(result.summary.accountType).toBe("group");
    expect(result.summary.accountMode).toMatchObject({
      type: "group",
      confidence: "detected",
      source: "scapestack-sync",
      badgeLabel: "Group Ironman detected"
    });
    expect(result.summary.accountMode.planningNote).toContain("group storage is not assumed");
    expect(recs.some((rec) => rec?.kind === "money")).toBe(false);
  });

  it("lets RuneLite account type override WOM account type for planning", async () => {
    const result = await computeNextUp({
      skills: skillsAt(99),
      questPoints: 180,
      accountMeta: {
        displayName: "WOM Main",
        accountType: "regular",
        ehp: 100,
        ehb: 20,
        lastChangedAt: null
      },
      scapestackSync: {
        displayName: "Plugin Iron",
        accountType: "ironman",
        questsCompleted: [],
        diariesCompleted: [],
        collectionLogItemIds: []
      }
    });
    const recs = [result.headline, ...result.rest].filter(Boolean);

    expect(result.summary.accountType).toBe("ironman");
    expect(result.summary.accountMode.badgeLabel).toBe("Ironman detected");
    expect(result.summary.accountMode.planningNote).toContain("Self-source");
    expect(recs.some((rec) => rec?.kind === "money")).toBe(false);
  });

  it("degrades safely when account mode is unknown", async () => {
    const result = await computeNextUp({
      skills: skillsFromLevels({ Attack: 40, Strength: 40, Defence: 40, Hitpoints: 40, Ranged: 30, Magic: 30 })
    });

    expect(result.summary.accountType).toBeNull();
    expect(result.summary.accountMode).toMatchObject({
      type: null,
      confidence: "unknown",
      source: "unknown",
      badgeLabel: "Account mode unknown"
    });
    expect(result.summary.accountMode.planningNote).toContain("bank readiness only counts");
  });

  it("treats Ultimate Ironman from Scapestack sync as an iron route", async () => {
    const result = await computeNextUp({
      skills: skillsFromLevels({
        Attack: 60, Strength: 60, Defence: 60, Hitpoints: 60, Ranged: 60,
        Magic: 60, Prayer: 50, Slayer: 50,
        Cooking: 60, Woodcutting: 60, Fletching: 60, Fishing: 60,
        Firemaking: 60, Crafting: 60, Smithing: 60, Mining: 60,
        Herblore: 45, Agility: 50, Thieving: 50, Farming: 62,
        Runecraft: 45, Hunter: 55, Construction: 45
      }),
      questPoints: 95,
      scapestackSync: {
        displayName: "Uim Test",
        accountType: "ultimate_ironman",
        questsCompleted: [],
        diariesCompleted: [],
        collectionLogItemIds: []
      }
    });
    const recs = [result.headline, ...result.rest].filter(Boolean);

    expect(result.summary.accountType).toBe("ultimate");
    expect(result.summary.accountMode.badgeLabel).toBe("Ultimate Ironman detected");
    expect(result.summary.accountMode.planningNote).toContain("bank-ready is not normal readiness");
    expect(result.summary.accountStage.id).toBe("iron-route");
    expect(recs.some((rec) => rec?.id === "skill:iron-herb-birdhouse-loop")).toBe(true);
    expect(recs.some((rec) => rec?.kind === "money")).toBe(false);
  });

  it("does not show boss onboarding for bosses with established KC", async () => {
    const result = await computeNextUp({
      skills: skillsAt(99),
      questPoints: 300,
      bossKc: { Vardorvis: 350 },
      bank: [{ id: 22325, name: "Scythe of vitur" }]
    });
    const recs = [result.headline, ...result.rest].filter(Boolean);

    expect(recs.some((rec) => rec?.id === "boss:vardorvis")).toBe(false);
  });

  it("does not show boss onboarding when a signature drop proves experience", async () => {
    const result = await computeNextUp({
      skills: skillsAt(99),
      questPoints: 300,
      bank: [
        { id: 20997, name: "Twisted bow" },
        { id: 26384, name: "Torva platebody" }
      ]
    });
    const recs = [result.headline, ...result.rest].filter(Boolean);

    expect(recs.some((rec) => rec?.id === "boss:nex")).toBe(false);
  });

  it("does not show generic boss onboarding for accounts with substantial boss history", async () => {
    const result = await computeNextUp({
      skills: skillsAt(99),
      questPoints: 300,
      bossKc: { Vorkath: 1_500 },
      bank: [
        { id: 11832, name: "Bandos chestplate" },
        { id: 11834, name: "Bandos tassets" },
        { id: 22325, name: "Scythe of vitur" }
      ]
    });
    const recs = [result.headline, ...result.rest].filter(Boolean);

    expect(recs.some((rec) => rec?.kind === "boss")).toBe(false);
  });

  it("prioritizes pushing an active low-KC boss to 50 before generic diary cleanup", async () => {
    const result = await computeNextUp({
      skills: skillsFromLevels({
        Attack: 90, Strength: 90, Defence: 80, Hitpoints: 85, Ranged: 92,
        Magic: 85, Prayer: 74, Slayer: 80,
        Cooking: 80, Woodcutting: 70, Fletching: 80, Fishing: 70,
        Firemaking: 70, Crafting: 75, Smithing: 70, Mining: 72,
        Herblore: 78, Agility: 70, Thieving: 80, Farming: 75,
        Runecraft: 70, Hunter: 70, Construction: 75
      }),
      questPoints: 180,
      bossKc: { Vardorvis: 15 },
      bank: [
        { id: 4151, name: "Abyssal whip" },
        { id: 11832, name: "Bandos chestplate" },
        { id: 11834, name: "Bandos tassets" },
        { id: 19553, name: "Amulet of torture" },
        { id: 7462, name: "Barrows gloves" },
        { id: 12954, name: "Dragon defender" }
      ]
    });

    expect(result.headline?.id).toBe("kc:Vardorvis:first-50");
    expect(result.headline?.title).toBe("Push Vardorvis to 50 KC");
    expect(result.headline?.decisionReason).toBe("You already have 15 Vardorvis KC, so 50 KC is a clean stop point.");
    expect(result.headline?.actionPlan?.prep).toContain("Best owned setup: Abyssal whip");
    expect(result.headline?.actionPlan?.prep).toContain("Keep it short");
    expect(result.headline?.needs?.join(" ")).toContain("Abyssal whip setup");
  });

  it("does not headline an active boss when the bank cannot support it", async () => {
    const result = await computeNextUp({
      skills: skillsFromLevels({
        Attack: 90, Strength: 90, Defence: 80, Hitpoints: 85, Ranged: 92,
        Magic: 85, Prayer: 74, Slayer: 80,
        Cooking: 80, Woodcutting: 70, Fletching: 80, Fishing: 70,
        Firemaking: 70, Crafting: 75, Smithing: 70, Mining: 72,
        Herblore: 78, Agility: 70, Thieving: 80, Farming: 75,
        Runecraft: 70, Hunter: 70, Construction: 75
      }),
      questPoints: 180,
      bossKc: { Vardorvis: 15 },
      bank: [
        { id: 12926, name: "Toxic blowpipe" },
        { id: 12002, name: "Necklace of anguish" }
      ]
    });
    const recs = [result.headline, ...result.rest].filter(Boolean);

    expect(result.headline?.id).not.toBe("kc:Vardorvis:first-50");
    expect(recs.some((rec) => rec?.id === "kc:Vardorvis:first-50")).toBe(false);
  });

  it("does not let one scout KC outrank stronger account progress", async () => {
    const result = await computeNextUp({
      skills: skillsFromLevels({
        Attack: 90, Strength: 90, Defence: 80, Hitpoints: 85, Ranged: 92,
        Magic: 85, Prayer: 74, Slayer: 80,
        Cooking: 80, Woodcutting: 70, Fletching: 80, Fishing: 70,
        Firemaking: 70, Crafting: 75, Smithing: 70, Mining: 72,
        Herblore: 78, Agility: 70, Thieving: 80, Farming: 96,
        Runecraft: 70, Hunter: 70, Construction: 75
      }),
      questPoints: 180,
      bossKc: { Callisto: 1 }
    });
    const recs = [result.headline, ...result.rest].filter(Boolean);
    const callisto = recs.find((rec) => rec?.id === "kc:Callisto:first-50");

    expect(callisto).toBeTruthy();
    expect(result.headline?.id).not.toBe("kc:Callisto:first-50");
    expect(callisto?.why).toContain("scout read");
    expect(callisto?.decisionReason).toContain("only 1 KC");
    expect(callisto?.decisionReason).toContain("scout read");
    expect(callisto!.score).toBeLessThan(result.headline!.score);
  });

  it("adds a short decision reason to the headline", async () => {
    const result = await computeNextUp({
      skills: skillsFromLevels({
        Attack: 85, Strength: 85, Defence: 80, Hitpoints: 85, Ranged: 85,
        Magic: 85, Prayer: 70, Slayer: 85,
        Cooking: 80, Woodcutting: 80, Fletching: 80, Fishing: 80,
        Firemaking: 80, Crafting: 80, Smithing: 80, Mining: 80,
        Herblore: 80, Agility: 80, Thieving: 80, Farming: 80,
        Runecraft: 80, Hunter: 80, Construction: 80
      }),
      questPoints: 180,
      scapestackSync: {
        displayName: "Lynx Titan",
        questsCompleted: ["Dragon Slayer II"],
        diariesCompleted: [{ region: "Karamja", tier: "Hard" }],
        collectionLogItemIds: [21907],
        slayer: {
          points: 132,
          streak: 51,
          taskRemaining: 47,
          currentTaskId: 19,
          blocks: ["spiritual_creature"]
        }
      }
    });

    expect(result.headline?.decisionReason).toBeTruthy();
    expect(result.headline?.decisionReason).toContain("RuneLite");
    expect(result.headline?.decisionReason).not.toContain("signals");
    expect(result.headline?.decisionReason).not.toContain("payload");
  });

  it("keeps returning-player recommendations diverse instead of filling the checklist with diaries", async () => {
    const result = await computeNextUp({
      skills: skillsFromLevels({
        Attack: 70, Strength: 75, Defence: 70, Hitpoints: 75, Ranged: 70,
        Magic: 70, Prayer: 52, Slayer: 50,
        Cooking: 70, Woodcutting: 65, Fletching: 65, Fishing: 65,
        Firemaking: 60, Crafting: 60, Smithing: 60, Mining: 65,
        Herblore: 55, Agility: 60, Thieving: 60, Farming: 55,
        Runecraft: 50, Hunter: 60, Construction: 50
      }),
      questPoints: 105,
      bank: [
        { id: 4151, name: "Abyssal whip" },
        { id: 1127, name: "Rune platebody" },
        { id: 2503, name: "Black d'hide body" },
        { id: 4091, name: "Mystic robe top" }
      ]
    });

    const visible = [result.headline, ...result.rest.slice(0, 7)].filter(Boolean);
    const topThree = [result.headline, ...result.rest.slice(0, 2)].filter(Boolean);
    const diaryCount = visible.filter((rec) => rec?.kind === "diary").length;

    expect(diaryCount).toBeLessThanOrEqual(2);
    expect(topThree.filter((rec) => rec?.kind === "diary")).toHaveLength(1);
    expect(topThree.some((rec) => rec?.id === "skill:Slayer:70")).toBe(true);
    expect(visible.some((rec) => rec?.id === "skill:Slayer:70")).toBe(true);
    expect(visible.some((rec) => rec?.kind === "boss")).toBe(true);
    expect(visible.some((rec) => rec?.id === "quest:Animal Magnetism")).toBe(true);
    expect(visible.some((rec) => rec?.kind === "quest")).toBe(true);
  });

  it("adds practical account routes beyond generic boss and diary picks", async () => {
    const result = await computeNextUp({
      skills: skillsFromLevels({
        Attack: 55, Strength: 55, Defence: 50, Hitpoints: 55, Ranged: 45,
        Magic: 45, Prayer: 40, Slayer: 35,
        Cooking: 50, Woodcutting: 50, Fletching: 45, Fishing: 45,
        Firemaking: 45, Crafting: 35, Smithing: 35, Mining: 45,
        Herblore: 20, Agility: 35, Thieving: 35, Farming: 38,
        Runecraft: 30, Hunter: 20, Construction: 30
      }),
      questPoints: 45
    });
    const recs = [result.headline, ...result.rest].filter(Boolean);

    expect(recs.some((rec) => rec?.id === "skill:Prayer:43-protection")).toBe(true);
    expect(recs.some((rec) => rec?.id === "quest:fairy-rings-route")).toBe(true);
    expect(recs.some((rec) => rec?.id === "skill:Agility:graceful-route")).toBe(true);
    expect("quality" in result.headline!).toBe(false);
    expect("gearConfidence" in result.headline!).toBe(false);
  });

  it("skips account routes that exact RuneLite quest data already finished", async () => {
    const result = await computeNextUp({
      skills: skillsFromLevels({
        Attack: 70, Strength: 70, Defence: 70, Hitpoints: 70, Ranged: 70,
        Magic: 70, Prayer: 60, Slayer: 60,
        Cooking: 70, Woodcutting: 70, Fletching: 70, Fishing: 70,
        Firemaking: 70, Crafting: 70, Smithing: 70, Mining: 70,
        Herblore: 60, Agility: 55, Thieving: 60, Farming: 62,
        Runecraft: 50, Hunter: 60, Construction: 50
      }),
      questPoints: 130,
      scapestackSync: {
        questsCompleted: ["Fairytale II - Cure a Queen", "Animal Magnetism"],
        diariesCompleted: [],
        collectionLogItemIds: [],
        slayer: null
      }
    });
    const recs = [result.headline, ...result.rest].filter(Boolean);

    expect(recs.some((rec) => rec?.id === "quest:fairy-rings-route")).toBe(false);
    expect(recs.some((rec) => rec?.id === "quest:Animal Magnetism")).toBe(false);
  });

  it("gives ironmen supply loops without regular GP money-maker cards", async () => {
    const result = await computeNextUp({
      skills: skillsFromLevels({
        Attack: 60, Strength: 60, Defence: 60, Hitpoints: 60, Ranged: 60,
        Magic: 60, Prayer: 50, Slayer: 50,
        Cooking: 60, Woodcutting: 60, Fletching: 60, Fishing: 60,
        Firemaking: 60, Crafting: 60, Smithing: 60, Mining: 60,
        Herblore: 45, Agility: 50, Thieving: 50, Farming: 62,
        Runecraft: 45, Hunter: 55, Construction: 45
      }),
      questPoints: 95,
      accountMeta: {
        displayName: "Iron Test",
        accountType: "ironman",
        ehp: 250,
        ehb: 10,
        lastChangedAt: null
      }
    });
    const recs = [result.headline, ...result.rest].filter(Boolean);

    expect(recs.some((rec) => rec?.id === "skill:iron-herb-birdhouse-loop")).toBe(true);
    expect(recs.some((rec) => rec?.kind === "money")).toBe(false);
  });

  it("prioritizes the live RuneLite Slayer task when plugin sync has one", async () => {
    const result = await computeNextUp({
      skills: skillsFromLevels({
        Attack: 85, Strength: 85, Defence: 80, Hitpoints: 85, Ranged: 85,
        Magic: 85, Prayer: 70, Slayer: 85,
        Cooking: 80, Woodcutting: 80, Fletching: 80, Fishing: 80,
        Firemaking: 80, Crafting: 80, Smithing: 80, Mining: 80,
        Herblore: 80, Agility: 80, Thieving: 80, Farming: 80,
        Runecraft: 80, Hunter: 80, Construction: 80
      }),
      questPoints: 180,
      scapestackSync: {
        displayName: "Lynx Titan",
        questsCompleted: [],
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
    });

    expect(result.headline?.id).toBe("slayer:current-task:dust_devil");
    expect(result.headline?.title).toBe("Finish your Dust devil task");
    expect(result.headline?.kind).toBe("slayer");
    expect(result.headline?.link).toBe("/slayer?rsn=Lynx+Titan&source=plugin-sync&bank=none");
    expect(result.headline?.actionPlan?.confidence).toBe("exact");
    expect(result.headline?.actionPlan?.confidenceLabel).toBe("Synced");
    expect(result.headline?.actionPlan?.confidenceLabel).not.toBe("Exact sync");
    expect(result.headline?.actionPlan?.steps.join(" ")).toContain("synced /slayer");
    expect(result.headline?.actionPlan?.steps.join(" ")).not.toContain("exact /slayer");
  });

  it("does not mark outdated plugin sync recommendations as exact", async () => {
    const result = await computeNextUp({
      skills: skillsAt(85),
      questPoints: 180,
      scapestackSync: {
        displayName: "Lynx Titan",
        questsCompleted: ["Dragon Slayer II"],
        diariesCompleted: [{ region: "Karamja", tier: "Hard" }],
        collectionLogItemIds: [21295],
        slayer: {
          points: 132,
          streak: 51,
          taskRemaining: 47,
          currentTaskId: 19,
          blocks: ["spiritual_creature"]
        }
      },
      syncedSources: {
        wom: false,
        temple: false,
        collectionLog: false,
        scapestack: {
          syncedAt: new Date().toISOString(),
          quests: 1,
          diaries: 1,
          clItems: 1,
          pluginVersion: "0.1.0",
          slayerTaskRemaining: 47,
          slayerBlocks: 1
        }
      }
    });

    expect(result.headline?.kind).toBe("slayer");
    expect(result.headline?.actionPlan?.confidence).not.toBe("exact");
    expect(result.headline?.actionPlan?.caveat).toContain("refresh or update it");

    const text = formatRecommendationActionPlan(result.headline!, {
      from: "next",
      rsn: "Lynx Titan",
      hasBankContext: false
    });
    expect(text).toContain("Optional: Press Sync again");
    expect(text).toContain("https://www.scapestack.org/plugin?rsn=Lynx+Titan&from=next&bank=none#verify-sync");
  });

  it("surfaces plugin version and Slayer sync metadata in path progress", async () => {
    const result = await computeNextUp({
      skills: skillsAt(85),
      questPoints: 180,
      scapestackSync: {
        questsCompleted: ["Dragon Slayer II"],
        diariesCompleted: [{ region: "Karamja", tier: "Hard" }],
        collectionLogItemIds: [21295],
        slayer: {
          points: 132,
          streak: 51,
          taskRemaining: 47,
          currentTaskId: 19,
          blocks: ["spiritual_creature", "steel_dragon"]
        }
      },
      syncedSources: {
        wom: false,
        temple: false,
        collectionLog: false,
        scapestack: {
          syncedAt: "2026-06-03T08:00:00.000Z",
          quests: 1,
          diaries: 1,
          clItems: 1,
          pluginVersion: "0.2.0",
          slayerTaskRemaining: 47,
          slayerBlocks: 2
        }
      }
    });

    expect(result.pathProgress.syncedSources?.scapestack).toMatchObject({
      pluginVersion: "0.2.0",
      slayerTaskRemaining: 47,
      slayerBlocks: 2
    });
  });

  it("does not invent a Slayer task when plugin sync has no mapped current task", async () => {
    const result = await computeNextUp({
      skills: skillsAt(85),
      questPoints: 180,
      scapestackSync: {
        questsCompleted: [],
        diariesCompleted: [],
        collectionLogItemIds: [],
        slayer: {
          points: 0,
          streak: 0,
          taskRemaining: 80,
          currentTaskId: 999_999,
          blocks: []
        }
      }
    });
    const recs = [result.headline, ...result.rest].filter(Boolean);

    expect(recs.some((rec) => rec?.kind === "slayer")).toBe(false);
  });

  it("does not push low-combat skillers into grandmaster combat quests", async () => {
    const result = await computeNextUp({
      skills: skillsFromLevels({
        Attack: 1, Strength: 1, Defence: 1, Hitpoints: 10, Ranged: 1,
        Magic: 1, Prayer: 1, Slayer: 1,
        Cooking: 90, Woodcutting: 99, Fletching: 90, Fishing: 90,
        Firemaking: 99, Crafting: 85, Smithing: 80, Mining: 90,
        Herblore: 80, Agility: 80, Thieving: 80, Farming: 85,
        Runecraft: 80, Hunter: 80, Construction: 80
      }),
      questPoints: 120
    });
    const recs = [result.headline, ...result.rest].filter(Boolean);

    expect(recs.some((rec) => rec?.id === "quest:The Blood Moon Rises")).toBe(false);
    expect(recs.some((rec) => rec?.id === "quest:Song of the Elves")).toBe(false);
  });
});
