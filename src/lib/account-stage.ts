import type { HiscoreSkill } from "./hiscores";
import type { AccountMeta } from "./path-progress";

export type AccountStageId =
  | "first-run"
  | "gear-first"
  | "new-account"
  | "early-main"
  | "midgame-main"
  | "returning"
  | "iron-route"
  | "skiller"
  | "pvm-ready"
  | "maxed-grinder"
  | "runelite-aware";

export interface AccountStage {
  id: AccountStageId;
  label: string;
  helper: string;
}

export interface DetectAccountStageInput {
  skills: HiscoreSkill[];
  combatLevel: number | null;
  totalLevel: number | null;
  questPoints: number;
  bossKc?: Record<string, number>;
  accountMeta?: AccountMeta | null;
  hasBankContext: boolean;
  hasPluginSync: boolean;
}

const COMBAT_SKILLS = new Set([
  "Attack",
  "Strength",
  "Defence",
  "Hitpoints",
  "Ranged",
  "Prayer",
  "Magic",
  "Slayer"
]);

const STAGES: Record<AccountStageId, AccountStage> = {
  "first-run": {
    id: "first-run",
    label: "First run",
    helper: "Start with an OSRS name. Gear and RuneLite can come later."
  },
  "gear-first": {
    id: "gear-first",
    label: "Gear-first",
    helper: "Good for a rough trip or GP check before adding stats."
  },
  "new-account": {
    id: "new-account",
    label: "New account",
    helper: "Keep it simple: useful quests, early unlocks and clear stop points."
  },
  "early-main": {
    id: "early-main",
    label: "Early main",
    helper: "Best for unlocking routes, diaries and stats before bigger grinds."
  },
  "midgame-main": {
    id: "midgame-main",
    label: "Midgame main",
    helper: "Best for clearing quests, diaries, Slayer and account unlocks."
  },
  returning: {
    id: "returning",
    label: "Returning",
    helper: "One bounded move so the account feels less overwhelming."
  },
  "iron-route": {
    id: "iron-route",
    label: "Iron route",
    helper: "Prioritises unlocks, supplies and self-sufficient progress."
  },
  skiller: {
    id: "skiller",
    label: "Skiller",
    helper: "Low-combat progress, AFK routes and skill unlocks matter most."
  },
  "pvm-ready": {
    id: "pvm-ready",
    label: "PvM-ready",
    helper: "Built around a short trip, KC push or boss unlock."
  },
  "maxed-grinder": {
    id: "maxed-grinder",
    label: "Maxed grinder",
    helper: "Use tight goals, clog slots, boss blocks and clean stop points."
  },
  "runelite-aware": {
    id: "runelite-aware",
    label: "RuneLite-aware",
    helper: "Scapestack knows more of what this account already finished."
  }
};

function nonCombatTotal(skills: HiscoreSkill[]): number {
  return skills
    .filter((skill) => skill.name !== "Overall" && !COMBAT_SKILLS.has(skill.name))
    .reduce((sum, skill) => sum + Math.max(1, skill.level), 0);
}

function bossKcTotal(bossKc: Record<string, number> | undefined): number {
  if (!bossKc) return 0;
  return Object.values(bossKc).reduce((sum, kc) => sum + Math.max(0, kc), 0);
}

function isIronRoute(accountMeta: AccountMeta | null | undefined): boolean {
  return (
    accountMeta?.accountType === "ironman" ||
    accountMeta?.accountType === "hardcore" ||
    accountMeta?.accountType === "ultimate"
  );
}

export function detectAccountStage(input: DetectAccountStageInput): AccountStage {
  const hasHiscores = input.skills.length > 0;
  if (input.hasPluginSync) return STAGES["runelite-aware"];
  if (!hasHiscores) return input.hasBankContext ? STAGES["gear-first"] : STAGES["first-run"];
  if (isIronRoute(input.accountMeta)) return STAGES["iron-route"];
  if (input.accountMeta?.accountType === "skiller") return STAGES.skiller;

  const combat = input.combatLevel ?? 0;
  const total = input.totalLevel ?? 0;
  const qp = input.questPoints;
  const bossTotal = bossKcTotal(input.bossKc);
  const nonCombat = nonCombatTotal(input.skills);

  if (combat < 50 && nonCombat >= 800) return STAGES.skiller;
  if (total >= 2200 || (total >= 2000 && bossTotal >= 1000)) return STAGES["maxed-grinder"];
  if (bossTotal >= 50 || (combat >= 110 && total >= 1500)) return STAGES["pvm-ready"];
  if (total < 750 || combat < 60 || qp < 40) return STAGES["new-account"];
  if (total < 1400 || qp < 120) return STAGES["early-main"];
  if (total < 1900 || qp < 220) return STAGES["midgame-main"];
  return STAGES.returning;
}
