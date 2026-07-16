import type { PlannerAccountType } from "./account-type";
import { isIronPlannerAccount, isUltimatePlannerAccount } from "./account-type";
import type { BankedXpEstimate, BankedXpMaterial, BankedXpItem } from "./banked-xp";
import { normalizeBankedXpItems } from "./banked-xp";
import type { HiscoreSkill } from "./hiscores";

export type IronmanSupplyStepKind = "source" | "process" | "stop";

export interface IronmanSupplyRequirement {
  kind: "skill" | "item" | "access";
  label: string;
  met: boolean | null;
}

export interface IronmanSupplyStep {
  kind: IronmanSupplyStepKind;
  text: string;
}

export interface IronmanSupplyRoute {
  id: string;
  skill: string;
  material: string;
  sourceActivity: string;
  processActivity: string;
  requirements: IronmanSupplyRequirement[];
  rateLow: number;
  rateHigh: number;
  rateUnit: "items/hr";
  amountNeededLow: number;
  amountNeededHigh: number;
  amountTargetLow: number;
  amountTargetHigh: number;
  estimatedMinutesLow: number;
  estimatedMinutesHigh: number;
  worthDoingNow: boolean;
  smallerTarget: boolean;
  bankedAlternative: BankedXpMaterial | null;
  bankedXpLow: number;
  bankedXpHigh: number;
  stopPoint: string;
  reason: string;
  steps: IronmanSupplyStep[];
}

interface SourceRequirementDefinition {
  kind: IronmanSupplyRequirement["kind"];
  label: string;
  skill?: string;
  level?: number;
  bankKeywords?: string[];
}

interface SupplySourceDefinition {
  id: string;
  skill: string;
  material: string;
  sourceActivity: string;
  processActivity: string;
  processXpLow: number;
  processXpHigh: number;
  rateLow: number;
  rateHigh: number;
  priority: number;
  bankSignals?: string[];
  sourceFromBank?: string[];
  requirements: SourceRequirementDefinition[];
  risk?: "safe" | "wilderness";
}

export interface BuildIronmanSupplyRouteInput {
  skill: string;
  currentLevel: number;
  targetLevel: number;
  sessionXp: number;
  sessionMinutes: number;
  bank: readonly BankedXpItem[] | undefined;
  bankedXpEstimate: BankedXpEstimate;
  skills?: readonly HiscoreSkill[];
  accountType: PlannerAccountType | null | undefined;
}

const SOURCE_MINUTES_CAP = 45;

const SOURCES: readonly SupplySourceDefinition[] = [
  {
    id: "cook-karambwan",
    skill: "Cooking",
    material: "raw karambwan",
    sourceActivity: "Fish raw karambwan at Karamja",
    processActivity: "Cook the karambwan at your closest banked range",
    processXpLow: 165,
    processXpHigh: 190,
    rateLow: 450,
    rateHigh: 650,
    priority: 90,
    requirements: [
      { kind: "skill", label: "Fishing 65", skill: "Fishing", level: 65 },
      { kind: "access", label: "Tai Bwo Wannai Trio access" },
      { kind: "item", label: "Karambwan vessel and karambwanji", bankKeywords: ["karambwan vessel", "raw karambwanji"] }
    ]
  },
  {
    id: "cook-monkfish",
    skill: "Cooking",
    material: "raw monkfish",
    sourceActivity: "Fish monkfish at the Piscatoris colony",
    processActivity: "Cook the monkfish at your closest banked range",
    processXpLow: 128,
    processXpHigh: 150,
    rateLow: 300,
    rateHigh: 450,
    priority: 80,
    requirements: [
      { kind: "skill", label: "Fishing 62", skill: "Fishing", level: 62 },
      { kind: "access", label: "Swan Song access" },
      { kind: "item", label: "Small fishing net", bankKeywords: ["small fishing net"] }
    ]
  },
  {
    id: "cook-trout-salmon",
    skill: "Cooking",
    material: "raw trout and salmon",
    sourceActivity: "Fly-fish trout and salmon at a nearby river",
    processActivity: "Cook the catch at your closest range",
    processXpLow: 65,
    processXpHigh: 90,
    rateLow: 500,
    rateHigh: 850,
    priority: 40,
    requirements: [
      { kind: "skill", label: "Fishing 20", skill: "Fishing", level: 20 },
      { kind: "item", label: "Fly fishing rod and feathers", bankKeywords: ["fly fishing rod", "feather"] }
    ]
  },
  {
    id: "herblore-snape-grass",
    skill: "Herblore",
    material: "snape grass",
    sourceActivity: "Collect or grow snape grass",
    processActivity: "Finish the ranarr potions in your bank",
    processXpLow: 87.5,
    processXpHigh: 87.5,
    rateLow: 350,
    rateHigh: 650,
    priority: 100,
    bankSignals: ["ranarr potion (unf)", "ranarr weed"],
    requirements: [{ kind: "access", label: "A safe snape grass spawn or Farming patch" }]
  },
  {
    id: "herblore-red-spiders-eggs",
    skill: "Herblore",
    material: "red spiders' eggs",
    sourceActivity: "Collect red spiders' eggs on a safe route",
    processActivity: "Finish the snapdragon potions in your bank",
    processXpLow: 142.5,
    processXpHigh: 142.5,
    rateLow: 300,
    rateHigh: 500,
    priority: 95,
    bankSignals: ["snapdragon potion (unf)", "snapdragon"],
    requirements: [{ kind: "access", label: "A safe egg spawn or creature source" }]
  },
  {
    id: "herblore-eye-of-newt",
    skill: "Herblore",
    material: "eye of newt",
    sourceActivity: "Buy eye of newt packs from an NPC shop",
    processActivity: "Finish the irit potions in your bank",
    processXpLow: 100,
    processXpHigh: 100,
    rateLow: 1_200,
    rateHigh: 2_000,
    priority: 90,
    bankSignals: ["irit potion (unf)", "irit leaf"],
    requirements: [{ kind: "access", label: "Betty, Jatix or another eye of newt shop" }]
  },
  {
    id: "herblore-limpwurt",
    skill: "Herblore",
    material: "limpwurt roots",
    sourceActivity: "Grow limpwurt roots beside your herb runs",
    processActivity: "Finish the kwuarm or tarromin potions in your bank",
    processXpLow: 50,
    processXpHigh: 125,
    rateLow: 180,
    rateHigh: 360,
    priority: 70,
    bankSignals: ["kwuarm potion (unf)", "kwuarm", "tarromin potion (unf)", "tarromin"],
    requirements: [{ kind: "skill", label: "Farming 26", skill: "Farming", level: 26 }]
  },
  {
    id: "construction-convert-teak",
    skill: "Construction",
    material: "teak planks",
    sourceActivity: "Convert your teak logs at a sawmill",
    processActivity: "Build with the teak planks",
    processXpLow: 90,
    processXpHigh: 90,
    rateLow: 1_500,
    rateHigh: 2_400,
    priority: 110,
    bankSignals: ["teak logs"],
    sourceFromBank: ["teak logs"],
    requirements: [
      { kind: "item", label: "Teak logs", bankKeywords: ["teak logs"] },
      { kind: "item", label: "Coins for the sawmill", bankKeywords: ["coins"] }
    ]
  },
  {
    id: "construction-convert-oak",
    skill: "Construction",
    material: "oak planks",
    sourceActivity: "Convert your oak logs at a sawmill",
    processActivity: "Build with the oak planks",
    processXpLow: 60,
    processXpHigh: 60,
    rateLow: 1_600,
    rateHigh: 2_500,
    priority: 105,
    bankSignals: ["oak logs"],
    sourceFromBank: ["oak logs"],
    requirements: [
      { kind: "item", label: "Oak logs", bankKeywords: ["oak logs"] },
      { kind: "item", label: "Coins for the sawmill", bankKeywords: ["coins"] }
    ]
  },
  {
    id: "construction-cut-teak",
    skill: "Construction",
    material: "teak planks",
    sourceActivity: "Cut teak logs, then convert them at a sawmill",
    processActivity: "Build with the teak planks",
    processXpLow: 90,
    processXpHigh: 90,
    rateLow: 550,
    rateHigh: 900,
    priority: 60,
    requirements: [
      { kind: "skill", label: "Woodcutting 35", skill: "Woodcutting", level: 35 },
      { kind: "item", label: "Coins for the sawmill", bankKeywords: ["coins"] }
    ]
  },
  {
    id: "crafting-molten-glass",
    skill: "Crafting",
    material: "molten glass",
    sourceActivity: "Gather giant seaweed and buckets of sand",
    processActivity: "Make molten glass, then glassblow it",
    processXpLow: 46,
    processXpHigh: 52.5,
    rateLow: 450,
    rateHigh: 750,
    priority: 80,
    requirements: [
      { kind: "skill", label: "Farming 23", skill: "Farming", level: 23 },
      { kind: "access", label: "Fossil Island seaweed patches or a seaweed source" }
    ]
  },
  {
    id: "smithing-bars",
    skill: "Smithing",
    material: "bars",
    sourceActivity: "Mine an ore stack your Smithing level supports",
    processActivity: "Smelt the ore, then smith the bars",
    processXpLow: 25,
    processXpHigh: 62.5,
    rateLow: 300,
    rateHigh: 650,
    priority: 65,
    requirements: [{ kind: "item", label: "Your best pickaxe", bankKeywords: ["pickaxe"] }]
  },
  {
    id: "prayer-blue-dragons",
    skill: "Prayer",
    material: "dragon bones",
    sourceActivity: "Kill blue dragons on a safe route",
    processActivity: "Offer the dragon bones at your chosen altar",
    processXpLow: 252,
    processXpHigh: 288,
    rateLow: 70,
    rateHigh: 130,
    priority: 70,
    requirements: [
      { kind: "skill", label: "Protection prayers recommended", skill: "Prayer", level: 43 },
      { kind: "access", label: "A safe blue dragon route" }
    ],
    risk: "safe"
  },
  {
    id: "fletching-logs",
    skill: "Fletching",
    material: "logs",
    sourceActivity: "Cut one useful log stack",
    processActivity: "Fletch the logs into unstrung bows",
    processXpLow: 25,
    processXpHigh: 75,
    rateLow: 300,
    rateHigh: 650,
    priority: 60,
    requirements: [
      { kind: "skill", label: "Woodcutting for the selected tree", skill: "Woodcutting", level: 15 },
      { kind: "item", label: "Axe and knife", bankKeywords: [" axe", "knife"] }
    ]
  },
  {
    id: "firemaking-logs",
    skill: "Firemaking",
    material: "logs",
    sourceActivity: "Cut one useful log stack",
    processActivity: "Burn the logs in one clean line",
    processXpLow: 60,
    processXpHigh: 202.5,
    rateLow: 300,
    rateHigh: 650,
    priority: 60,
    requirements: [
      { kind: "skill", label: "Woodcutting for the selected tree", skill: "Woodcutting", level: 15 },
      { kind: "item", label: "Axe and tinderbox", bankKeywords: [" axe", "tinderbox"] }
    ]
  },
  {
    id: "farming-contracts",
    skill: "Farming",
    material: "useful seeds",
    sourceActivity: "Complete Farming contracts and one herb run",
    processActivity: "Plant the useful seeds from the packs",
    processXpLow: 30,
    processXpHigh: 3_400,
    rateLow: 20,
    rateHigh: 60,
    priority: 55,
    requirements: [{ kind: "skill", label: "Farming Guild access", skill: "Farming", level: 45 }]
  },
  {
    id: "magic-gotr-runes",
    skill: "Magic",
    material: "runes",
    sourceActivity: "Build a rune stack through Guardians of the Rift",
    processActivity: "Cast a spell the resulting rune stack can sustain",
    processXpLow: 35,
    processXpHigh: 65,
    rateLow: 700,
    rateHigh: 1_400,
    priority: 55,
    requirements: [{ kind: "access", label: "Temple of the Eye and Guardians of the Rift access" }]
  },
  {
    id: "runecraft-essence",
    skill: "Runecraft",
    material: "essence",
    sourceActivity: "Mine or collect one essence stack",
    processActivity: "Craft the essence on your best altar route",
    processXpLow: 5,
    processXpHigh: 12,
    rateLow: 900,
    rateHigh: 1_600,
    priority: 55,
    requirements: [{ kind: "access", label: "Essence mine or daeyalt access" }]
  }
] as const;

function levelFor(skills: readonly HiscoreSkill[] | undefined, name: string): number | null {
  return skills?.find((skill) => skill.name.toLowerCase() === name.toLowerCase())?.level ?? null;
}

function quantityFor(bank: Map<string, number>, keywords: readonly string[]): number {
  let total = 0;
  for (const [name, quantity] of bank) {
    if (keywords.some((keyword) => name.includes(keyword.toLowerCase()))) total += quantity;
  }
  return total;
}

function requirementsFor(
  source: SupplySourceDefinition,
  skills: readonly HiscoreSkill[] | undefined,
  bank: Map<string, number>
): IronmanSupplyRequirement[] {
  return source.requirements.map((requirement) => {
    if (requirement.skill && requirement.level) {
      const level = levelFor(skills, requirement.skill);
      return { kind: requirement.kind, label: requirement.label, met: level === null ? null : level >= requirement.level };
    }
    if (requirement.bankKeywords) {
      return { kind: requirement.kind, label: requirement.label, met: quantityFor(bank, requirement.bankKeywords) > 0 };
    }
    return { kind: requirement.kind, label: requirement.label, met: null };
  });
}

function sourceScore(source: SupplySourceDefinition, bank: Map<string, number>): number {
  const signalMatches = source.bankSignals ? quantityFor(bank, source.bankSignals) : 0;
  const sourceItems = source.sourceFromBank ? quantityFor(bank, source.sourceFromBank) : 0;
  return source.priority + (signalMatches > 0 ? 1_000 : 0) + (sourceItems > 0 ? 2_000 : 0);
}

function formatAmount(low: number, high: number, material: string): string {
  const amount = low === high
    ? low.toLocaleString("en-US")
    : `${low.toLocaleString("en-US")}-${high.toLocaleString("en-US")}`;
  return `${amount} ${material}`;
}

function pickSource(
  input: BuildIronmanSupplyRouteInput,
  bank: Map<string, number>
): { source: SupplySourceDefinition; requirements: IronmanSupplyRequirement[] } | null {
  const candidates = SOURCES
    .filter((source) => source.skill === input.skill)
    .filter((source) => !(input.accountType === "hardcore" && source.risk === "wilderness"))
    .filter((source) => !source.bankSignals || quantityFor(bank, source.bankSignals) > 0)
    .map((source) => ({ source, requirements: requirementsFor(source, input.skills, bank) }))
    .filter(({ requirements }) => requirements.every((requirement) => requirement.kind !== "skill" || requirement.met !== false))
    .sort((a, b) => sourceScore(b.source, bank) - sourceScore(a.source, bank));
  return candidates[0] ?? null;
}

export function buildIronmanSupplyRoute(input: BuildIronmanSupplyRouteInput): IronmanSupplyRoute | null {
  if (!isIronPlannerAccount(input.accountType) || input.bank === undefined || input.sessionXp <= 0) return null;
  if (input.bankedXpEstimate.coveredXpLow >= input.sessionXp) return null;

  const bank = normalizeBankedXpItems(input.bank);
  const picked = pickSource(input, bank);
  if (!picked) return null;
  const { source, requirements } = picked;
  const deficitLow = Math.max(0, input.sessionXp - input.bankedXpEstimate.coveredXpHigh);
  const deficitHigh = Math.max(0, input.sessionXp - input.bankedXpEstimate.coveredXpLow);
  const amountNeededLow = Math.max(1, Math.ceil(deficitLow / source.processXpHigh));
  const amountNeededHigh = Math.max(amountNeededLow, Math.ceil(deficitHigh / source.processXpLow));
  const sourceAvailable = source.sourceFromBank ? quantityFor(bank, source.sourceFromBank) : null;
  const capLow = Math.max(1, Math.floor(source.rateLow * SOURCE_MINUTES_CAP / 60));
  const amountTargetLow = Math.min(amountNeededLow, capLow, sourceAvailable ?? Number.MAX_SAFE_INTEGER);
  const amountTargetHigh = Math.max(
    amountTargetLow,
    Math.min(amountNeededHigh, capLow, sourceAvailable ?? Number.MAX_SAFE_INTEGER)
  );
  if (amountTargetHigh <= 0) return null;
  const estimatedMinutesLow = Math.max(1, Math.ceil(amountTargetLow / source.rateHigh * 60));
  const estimatedMinutesHigh = Math.max(estimatedMinutesLow, Math.ceil(amountTargetHigh / source.rateLow * 60));
  const smallerTarget = amountTargetHigh < amountNeededHigh;
  const bankedAlternative = input.bankedXpEstimate.materials[0] ?? null;
  const targetXpLow = Math.round(input.bankedXpEstimate.coveredXpLow + amountTargetLow * source.processXpLow);
  const targetXpHigh = Math.round(input.bankedXpEstimate.coveredXpHigh + amountTargetHigh * source.processXpHigh);
  const sourceAmount = formatAmount(amountTargetLow, amountTargetHigh, source.material);
  const accountVerb = isUltimatePlannerAccount(input.accountType) ? "Carry or stage" : "Gather";
  const stopPoint = smallerTarget
    ? `Stop after ${targetXpLow.toLocaleString("en-US")}-${targetXpHigh.toLocaleString("en-US")} ${input.skill} XP; source another block later.`
    : `Stop after the ${input.sessionMinutes}-minute ${input.skill} block or level ${input.targetLevel}, whichever comes first.`;
  const alternativeCopy = bankedAlternative
    ? `Use ${bankedAlternative.quantity.toLocaleString("en-US")} banked ${bankedAlternative.name} first; only source the remaining gap.`
    : "The bank does not cover this stop point, so one small source block comes first.";

  return {
    id: source.id,
    skill: input.skill,
    material: source.material,
    sourceActivity: source.sourceActivity,
    processActivity: source.processActivity,
    requirements,
    rateLow: source.rateLow,
    rateHigh: source.rateHigh,
    rateUnit: "items/hr",
    amountNeededLow,
    amountNeededHigh,
    amountTargetLow,
    amountTargetHigh,
    estimatedMinutesLow,
    estimatedMinutesHigh,
    worthDoingNow: !smallerTarget && estimatedMinutesHigh <= Math.max(input.sessionMinutes, SOURCE_MINUTES_CAP),
    smallerTarget,
    bankedAlternative,
    bankedXpLow: input.bankedXpEstimate.coveredXpLow,
    bankedXpHigh: input.bankedXpEstimate.coveredXpHigh,
    stopPoint,
    reason: alternativeCopy,
    steps: [
      { kind: "source", text: `${accountVerb} ${sourceAmount}: ${source.sourceActivity.toLowerCase()} (${source.rateLow.toLocaleString("en-US")}-${source.rateHigh.toLocaleString("en-US")} per hour).` },
      { kind: "process", text: `${source.processActivity} using the sourced stack${bankedAlternative ? " after the banked alternative" : ""}.` },
      { kind: "stop", text: stopPoint }
    ]
  };
}
