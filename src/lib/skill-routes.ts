import type { PlannerAccountType } from "./account-type";
import { isIronPlannerAccount } from "./account-type";
import type { CompletionItem } from "./goals";
import type { HiscoreSkill } from "./hiscores";
import { formatXp } from "./hiscores";
import { FISHING_METHODS } from "./skill-methods/fishing";
import { XP_TABLE } from "./skill-methods/types";

export const ROUTABLE_SKILLS = [
  "Attack", "Strength", "Defence", "Hitpoints", "Ranged", "Magic", "Prayer",
  "Slayer", "Mining", "Smithing", "Fishing", "Cooking", "Firemaking",
  "Woodcutting", "Crafting", "Fletching", "Herblore", "Agility", "Thieving",
  "Farming", "Hunter", "Construction", "Runecraft", "Sailing"
] as const;

export type RoutableSkill = typeof ROUTABLE_SKILLS[number];
export type SkillSupplyState = "banked" | "buyable" | "source-yourself" | "unknown";
export type SkillMethodAttention = "afk" | "steady" | "active" | "focused";

export interface SkillMethodRequirement {
  name: string;
  bankKeywords?: string[];
  tradeable: boolean;
}

export interface SkillRouteMethod {
  id: string;
  skill: RoutableSkill;
  name: string;
  levelReq: number;
  xpPerHour: number;
  gpPerHour: number | null;
  attention: SkillMethodAttention;
  requirements: SkillMethodRequirement[];
  location?: string;
  unlock?: string;
  xpPerAction: number | null;
}

export interface SkillRouteSupply {
  name: string;
  state: SkillSupplyState;
  bankedQuantity: number | null;
}

export interface SkillRouteMethodPlan {
  method: SkillRouteMethod;
  xpRemaining: number;
  hours: number;
  quantityRequired: number | null;
  bankedQuantity: number | null;
  bankedXp: number | null;
  netGp: number | null;
  supplies: SkillRouteSupply[];
}

export interface SkillRoute {
  skill: RoutableSkill;
  currentLevel: number;
  currentXp: number;
  targetLevel: number;
  targetXp: number;
  xpRemaining: number;
  maxed: boolean;
  methods: SkillRouteMethodPlan[];
  recommended: SkillRouteMethodPlan | null;
  shortSession: {
    minutes: number;
    xp: number;
    endXp: number;
    label: string;
  };
  unlock: string;
  sourcing: SkillSupplyState[];
}

const DEFAULT_METHODS: Record<RoutableSkill, Omit<SkillRouteMethod, "skill">> = {
  Attack: method("steady-melee-attack", "Train Attack with your best melee weapon", 1, 80_000, "active", [tool("Melee weapon", ["sword", "scimitar", "whip", "rapier", "fang"])]),
  Strength: method("steady-melee-strength", "Train Strength with your best melee weapon", 1, 80_000, "active", [tool("Strength weapon", ["scimitar", "whip", "bludgeon", "rapier", "fang"])]),
  Defence: method("steady-melee-defence", "Train Defence with your best melee weapon", 1, 80_000, "active", [tool("Melee weapon", ["sword", "scimitar", "whip", "rapier", "fang"])]),
  Hitpoints: method("train-through-combat", "Train Hitpoints through your current combat route", 1, 65_000, "active", []),
  Ranged: method("steady-ranged", "Train Ranged with your best owned weapon", 1, 90_000, "active", [tool("Ranged weapon", ["bow", "crossbow", "blowpipe"]), supply("Ammo", ["arrow", "bolt", "dart", "scale"])]),
  Magic: method("steady-magic", "Train Magic with a spell you can sustain", 1, 85_000, "active", [supply("Runes for the spell", ["rune"])]),
  Prayer: method("banked-prayer", "Use your best banked Prayer offering", 1, 300_000, "active", [supply("Bones or ashes", ["bone", "ashes"])]),
  Slayer: method("current-slayer-task", "Finish one Slayer task block", 1, 40_000, "active", [unknown("Current Slayer task")]),
  Mining: method("best-rock", "Mine the best comfortable rock or activity", 1, 55_000, "steady", [tool("Pickaxe", ["pickaxe"])]),
  Smithing: method("banked-smithing", "Use a Smithing method your materials support", 1, 90_000, "active", [supply("Bars or ore", [" bar", " ore"])]),
  Fishing: method("steady-fishing", "Fish at your best comfortable spot", 1, 50_000, "afk", [tool("Fishing tool", ["fishing rod", "harpoon", "lobster pot", "fishing net"])]),
  Cooking: method("banked-cooking", "Cook the best raw food already available", 1, 400_000, "steady", [supply("Raw food", ["raw "])]),
  Firemaking: method("banked-firemaking", "Burn or use the best logs you can sustain", 1, 160_000, "steady", [tool("Tinderbox", ["tinderbox"]), supply("Logs", [" logs"])]),
  Woodcutting: method("best-tree", "Cut the best comfortable tree", 1, 60_000, "afk", [tool("Axe", [" axe"])]),
  Crafting: method("banked-crafting", "Craft the best banked material", 1, 300_000, "steady", [supply("Crafting materials", ["gem", "hide", "glass", "battlestaff"])]),
  Fletching: method("banked-fletching", "Fletch the best banked material", 1, 250_000, "steady", [tool("Knife", ["knife"]), supply("Logs or ammo parts", [" logs", "dart tip", "bolt"])]),
  Herblore: method("banked-herblore", "Make the best potion your bank supports", 3, 300_000, "steady", [supply("Herbs and secondaries", ["grimy", "clean ", "unfinished", "vial of water"])]),
  Agility: method("best-agility-course", "Run the best comfortable Agility course", 1, 55_000, "active", []),
  Thieving: method("steady-thieving", "Use the best comfortable Thieving target", 1, 200_000, "active", []),
  Farming: method("farming-run", "Do one tree, herb or contract run", 1, 400_000, "steady", [supply("Seeds and compost", [" seed", "compost"])]),
  Hunter: method("best-hunter-method", "Set up one Hunter loop", 1, 80_000, "active", [tool("Hunter tools", ["box trap", "bird snare", "butterfly net"])]),
  Construction: method("banked-construction", "Build with the planks you can sustain", 1, 600_000, "focused", [supply("Planks", [" plank"]), tool("Hammer and saw", ["hammer", "saw"])]),
  Runecraft: method("steady-runecraft", "Run the best rune route you can access", 1, 30_000, "active", [supply("Essence", ["essence"]), tool("Talisman, tiara or outfit", ["talisman", "tiara", "raiment"])]),
  Sailing: method("current-voyage", "Complete one voyage or contract block", 1, 60_000, "active", [unknown("Current voyage access")])
};

function method(
  id: string,
  name: string,
  levelReq: number,
  xpPerHour: number,
  attention: SkillMethodAttention,
  requirements: SkillMethodRequirement[]
): Omit<SkillRouteMethod, "skill"> {
  return { id, name, levelReq, xpPerHour, gpPerHour: null, attention, requirements, xpPerAction: null };
}

function tool(name: string, bankKeywords: string[]): SkillMethodRequirement {
  return { name, bankKeywords, tradeable: true };
}

function supply(name: string, bankKeywords: string[]): SkillMethodRequirement {
  return { name, bankKeywords, tradeable: true };
}

function unknown(name: string): SkillMethodRequirement {
  return { name, tradeable: false };
}

function normalizeSkill(name: string): RoutableSkill | null {
  return ROUTABLE_SKILLS.find((skill) => skill.toLowerCase() === name.toLowerCase()) ?? null;
}

function levelForXp(xp: number): number {
  for (let level = 99; level >= 1; level -= 1) {
    if (xp >= XP_TABLE[level]) return level;
  }
  return 1;
}

function requirementQuantity(requirement: SkillMethodRequirement, bank: CompletionItem[] | undefined): number | null {
  if (!bank || !requirement.bankKeywords?.length) return null;
  return bank.reduce((total, item) => {
    const name = item.name.toLowerCase();
    return requirement.bankKeywords!.some((keyword) => name.includes(keyword.toLowerCase()))
      ? total + Math.max(0, item.quantity ?? 1)
      : total;
  }, 0);
}

function supplyState(
  requirement: SkillMethodRequirement,
  quantity: number | null,
  accountType: PlannerAccountType | null
): SkillSupplyState {
  if (quantity !== null && quantity > 0) return "banked";
  if (!requirement.tradeable) return "unknown";
  return isIronPlannerAccount(accountType) ? "source-yourself" : "buyable";
}

function fishingMethods(): SkillRouteMethod[] {
  return FISHING_METHODS.map((entry) => ({
    id: entry.id,
    skill: "Fishing",
    name: entry.name,
    levelReq: entry.levelReq,
    xpPerHour: entry.xpPerHour,
    gpPerHour: entry.gpPerHour,
    attention: entry.tags.includes("tick-manip") ? "focused" : entry.tags.includes("intensive") ? "active" : "afk",
    requirements: entry.requires.map((name) => tool(name, [name.toLowerCase()])),
    location: entry.locations[0],
    xpPerAction: null
  }));
}

export function skillMethods(skillName: string): SkillRouteMethod[] {
  const skill = normalizeSkill(skillName);
  if (!skill) return [];
  const fallback: SkillRouteMethod = { skill, ...DEFAULT_METHODS[skill] };
  return skill === "Fishing" ? [fallback, ...fishingMethods()] : [fallback];
}

function planMethod(
  methodValue: SkillRouteMethod,
  xpRemaining: number,
  bank: CompletionItem[] | undefined,
  accountType: PlannerAccountType | null
): SkillRouteMethodPlan {
  const supplies = methodValue.requirements.map((requirement) => {
    const bankedQuantity = requirementQuantity(requirement, bank);
    return {
      name: requirement.name,
      bankedQuantity,
      state: supplyState(requirement, bankedQuantity, accountType)
    };
  });
  const bankedQuantity = supplies.some((entry) => entry.bankedQuantity !== null)
    ? supplies.reduce((total, entry) => total + (entry.bankedQuantity ?? 0), 0)
    : null;
  const quantityRequired = methodValue.xpPerAction ? Math.ceil(xpRemaining / methodValue.xpPerAction) : null;
  return {
    method: methodValue,
    xpRemaining,
    hours: methodValue.xpPerHour > 0 ? xpRemaining / methodValue.xpPerHour : 0,
    quantityRequired,
    bankedQuantity,
    bankedXp: methodValue.xpPerAction && bankedQuantity !== null
      ? Math.min(xpRemaining, bankedQuantity * methodValue.xpPerAction)
      : null,
    netGp: methodValue.gpPerHour === null ? null : Math.round((xpRemaining / methodValue.xpPerHour) * methodValue.gpPerHour),
    supplies
  };
}

export function buildSkillRoute(input: {
  skill: HiscoreSkill;
  targetLevel: number;
  bank?: CompletionItem[];
  accountType?: PlannerAccountType | null;
  sessionMinutes?: number;
  unlock?: string;
}): SkillRoute | null {
  const skill = normalizeSkill(input.skill.name);
  if (!skill) return null;
  const currentLevel = Math.max(1, Math.min(99, input.skill.level));
  const reportedXp = Math.max(0, input.skill.xp || 0);
  const currentXp = currentLevel >= 99
    ? Math.max(XP_TABLE[99], reportedXp)
    : Math.max(XP_TABLE[currentLevel], Math.min(reportedXp, XP_TABLE[currentLevel + 1] - 1));
  const targetLevel = Math.max(currentLevel, Math.min(99, Math.floor(input.targetLevel)));
  const targetXp = XP_TABLE[targetLevel];
  const xpRemaining = Math.max(0, targetXp - currentXp);
  const methods = skillMethods(skill)
    .filter((entry) => entry.levelReq <= currentLevel)
    .map((entry) => planMethod(entry, xpRemaining, input.bank, input.accountType ?? null));
  const recommended = [...methods].sort((a, b) => {
    const attentionPenalty = (plan: SkillRouteMethodPlan) => plan.method.attention === "focused" ? 0.7 : 1;
    return b.method.xpPerHour * attentionPenalty(b) - a.method.xpPerHour * attentionPenalty(a);
  })[0] ?? null;
  const minutes = Math.max(10, Math.min(120, input.sessionMinutes ?? 45));
  const sessionXp = recommended ? Math.min(xpRemaining, Math.floor(recommended.method.xpPerHour * minutes / 60)) : 0;
  const endXp = currentXp + sessionXp;
  const endLevel = levelForXp(endXp);
  const sourcing = [...new Set((recommended?.supplies ?? []).map((entry) => entry.state))];

  return {
    skill,
    currentLevel,
    currentXp,
    targetLevel,
    targetXp,
    xpRemaining,
    maxed: currentLevel >= 99,
    methods,
    recommended,
    shortSession: {
      minutes,
      xp: sessionXp,
      endXp,
      label: sessionXp >= xpRemaining
        ? `Reach ${skill} ${targetLevel}`
        : `Earn about ${formatXp(sessionXp)} ${skill} XP${endLevel > currentLevel ? ` and reach ${endLevel}` : ""}`
    },
    unlock: input.unlock ?? (targetLevel === 99 ? `${skill} cape` : `${skill} ${targetLevel}`),
    sourcing
  };
}

export function skillRouteNeeds(route: SkillRoute): string[] {
  return (route.recommended?.supplies ?? []).map((supplyValue) => {
    if (supplyValue.state === "banked") return `${supplyValue.name} in bank`;
    if (supplyValue.state === "buyable") return `Buy ${supplyValue.name.toLowerCase()} if needed`;
    if (supplyValue.state === "source-yourself") return `Source ${supplyValue.name.toLowerCase()}`;
    return `Check ${supplyValue.name.toLowerCase()}`;
  });
}

export function skillRoutePlanSeed(route: SkillRoute): { timebox: string; prep: string; steps: string[] } {
  const methodValue = route.recommended?.method;
  const needs = skillRouteNeeds(route);
  const steps = [
    methodValue ? `Start ${methodValue.name.toLowerCase()}${methodValue.location ? ` at ${methodValue.location}` : ""}.` : `Choose one ${route.skill} method.`,
    ...(needs.length > 0 ? [needs.slice(0, 2).join("; ") + "."] : []),
    `${route.shortSession.label}, then stop and check the next route.`
  ];
  return {
    timebox: `${route.shortSession.minutes} min`,
    prep: `${route.skill} ${route.currentLevel} -> ${route.targetLevel}: ${formatXp(route.xpRemaining)} XP for ${route.unlock}.`,
    steps
  };
}
