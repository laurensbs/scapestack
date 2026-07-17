import type { PlannerAccountType } from "./account-type";
import { isIronPlannerAccount } from "./account-type";
import { bossBySlug, bossViabilityFromSimpleBank, type BossViability } from "./boss-viability";
import type { NextUpBankItem } from "./next-bank-handoff";
import type { PluginSyncHealth } from "./plugin-sync";
import type { SlayerMonster } from "./slayer/types";

export type SlayerTaskVerdict = "do" | "skip" | "boss-variant" | "refresh";
export type SlayerTaskMethod = "afk" | "melee" | "ranged" | "burst" | "cannon" | "boss";
export type SlayerTaskMood = "chill" | "cash" | "bossing" | "unlock" | "afk" | "short" | "smart";

export interface SlayerTaskState {
  points: number;
  streak: number;
  taskRemaining: number;
  currentTaskId: number;
  taskName?: string | null;
  taskLocation?: string | null;
  blocks: string[];
}

export interface SlayerTaskDecisionInput {
  task: SlayerMonster;
  state: SlayerTaskState;
  bank?: NextUpBankItem[];
  accountType?: PlannerAccountType | null;
  combatLevel?: number | null;
  slayerLevel?: number | null;
  mood?: SlayerTaskMood;
  timeboxMinutes?: number | null;
  syncHealth?: PluginSyncHealth | "unknown" | null;
}

export interface SlayerTaskInventoryLine {
  label: string;
  owned: boolean;
  itemName: string | null;
}

export interface SlayerTaskDecision {
  verdict: SlayerTaskVerdict;
  verdictLabel: string;
  task: Pick<SlayerMonster, "id" | "name" | "hp" | "slayerLevel" | "locations">;
  remaining: number;
  method: SlayerTaskMethod;
  methodLabel: string;
  why: string;
  firstStep: string;
  stopPoint: string;
  pointsConsequence: string;
  avoid: string | null;
  location: string;
  inventory: SlayerTaskInventoryLine[];
  missing: string[];
  bankUsed: boolean;
  bossVariant: {
    slug: string;
    name: string;
    viability: BossViability;
  } | null;
}

interface TaskKnowledge {
  attention: "afk" | "low" | "active" | "focused";
  preferredMethod: SlayerTaskMethod;
  chillMethod?: SlayerTaskMethod;
  skipCandidate?: boolean;
  profitable?: boolean;
  bossSlug?: string;
  inventory?: Array<{ label: string; patterns: RegExp[] }>;
  firstStep?: string;
  avoid?: string;
}

const TASK_KNOWLEDGE: Record<string, TaskKnowledge> = {
  dust_devil: {
    attention: "active",
    preferredMethod: "burst",
    chillMethod: "melee",
    inventory: [
      required("Slayer helm or facemask", /slayer helmet/i, /face ?mask/i),
      required("Ancient burst weapon", /ancient sceptre/i, /ancient staff/i, /nightmare staff/i, /kodai wand/i),
      required("Rune pouch", /rune pouch/i)
    ],
    firstStep: "Pick Catacombs for bursting, stack the room, then test one prayer cycle.",
    avoid: "Do not bring a cannon to the Catacombs; use a cannon only at a location that allows one."
  },
  nechryael: {
    attention: "active",
    preferredMethod: "burst",
    chillMethod: "melee",
    profitable: true,
    inventory: [
      required("Ancient burst weapon", /ancient sceptre/i, /ancient staff/i, /nightmare staff/i, /kodai wand/i),
      required("Rune pouch", /rune pouch/i)
    ],
    firstStep: "Stack the Catacombs room and test one prayer cycle before committing runes."
  },
  abyssal_demon: {
    attention: "low",
    preferredMethod: "melee",
    chillMethod: "afk",
    profitable: true,
    bossSlug: "sire"
  },
  bloodveld: { attention: "low", preferredMethod: "melee", chillMethod: "afk" },
  gargoyle: {
    attention: "low",
    preferredMethod: "melee",
    chillMethod: "afk",
    profitable: true,
    bossSlug: "grotesque-guardians",
    inventory: [required("Rock hammer", /rock hammer/i)]
  },
  hellhound: { attention: "low", preferredMethod: "melee", chillMethod: "afk", bossSlug: "cerberus" },
  cave_kraken: { attention: "afk", preferredMethod: "afk", chillMethod: "afk", profitable: true, bossSlug: "kraken" },
  smoke_devil: {
    attention: "active",
    preferredMethod: "burst",
    bossSlug: "thermonuclear",
    inventory: [
      required("Slayer helm or facemask", /slayer helmet/i, /face ?mask/i),
      required("Ancient burst weapon", /ancient sceptre/i, /ancient staff/i, /nightmare staff/i, /kodai wand/i)
    ]
  },
  hydra: {
    attention: "active",
    preferredMethod: "ranged",
    profitable: true,
    bossSlug: "hydra",
    inventory: [required("Karuulm protection", /boots of stone/i, /boots of brimstone/i, /granite boots/i)]
  },
  kalphite: { attention: "low", preferredMethod: "cannon", chillMethod: "melee", bossSlug: "kalphite-queen" },
  black_dragon: { attention: "active", preferredMethod: "ranged", bossSlug: "king-black-dragon" },
  greater_demon: { attention: "low", preferredMethod: "melee", chillMethod: "afk", bossSlug: "kril" },
  dagannoth: { attention: "low", preferredMethod: "cannon", chillMethod: "afk", bossSlug: "dks-rex" },
  spiritual_creature: { attention: "active", preferredMethod: "melee", skipCandidate: true },
  waterfiend: { attention: "active", preferredMethod: "melee", skipCandidate: true },
  steel_dragon: { attention: "active", preferredMethod: "ranged", skipCandidate: true },
  iron_dragon: { attention: "active", preferredMethod: "ranged", skipCandidate: true },
  suqah: { attention: "active", preferredMethod: "cannon", skipCandidate: true },
  turoth: {
    attention: "low",
    preferredMethod: "melee",
    inventory: [required("Turoth weapon", /leaf-bladed/i, /broad (arrow|bolt)/i)]
  },
  kurask: {
    attention: "low",
    preferredMethod: "melee",
    profitable: true,
    inventory: [required("Kurask weapon", /leaf-bladed/i, /broad (arrow|bolt)/i)]
  },
  wyrm: {
    attention: "low",
    preferredMethod: "ranged",
    inventory: [required("Karuulm protection", /boots of stone/i, /boots of brimstone/i, /granite boots/i)]
  },
  ankylosaur: {
    attention: "active",
    preferredMethod: "ranged",
    skipCandidate: true,
    inventory: [required("Karuulm protection", /boots of stone/i, /boots of brimstone/i, /granite boots/i)]
  },
  aberrant_spectre: {
    attention: "low",
    preferredMethod: "melee",
    inventory: [required("Slayer helm or nose peg", /slayer helmet/i, /nose peg/i)]
  },
  basilisk: {
    attention: "low",
    preferredMethod: "melee",
    inventory: [required("Mirror shield", /mirror shield/i)]
  },
  cockatrice: {
    attention: "low",
    preferredMethod: "melee",
    inventory: [required("Mirror shield", /mirror shield/i)]
  },
  banshee: {
    attention: "low",
    preferredMethod: "melee",
    inventory: [required("Earmuffs", /earmuffs/i, /slayer helmet/i)]
  },
  cave_horror: {
    attention: "low",
    preferredMethod: "melee",
    inventory: [required("Witchwood icon", /witchwood icon/i, /slayer helmet/i)]
  },
  wall_beast: {
    attention: "low",
    preferredMethod: "melee",
    inventory: [required("Spiny helmet", /spiny helmet/i, /slayer helmet/i)]
  }
};

function required(label: string, ...patterns: RegExp[]): { label: string; patterns: RegExp[] } {
  return { label, patterns };
}

function defaultKnowledge(task: SlayerMonster): TaskKnowledge {
  return {
    attention: task.isBoss ? "focused" : "active",
    preferredMethod: task.weakness === "ranged" || task.weakness === "magic" ? "ranged" : "melee"
  };
}

function findOwned(bank: NextUpBankItem[], patterns: RegExp[]): NextUpBankItem | null {
  return bank.find((item) => patterns.some((pattern) => pattern.test(item.name))) ?? null;
}

function baseInventory(bank: NextUpBankItem[], method: SlayerTaskMethod): SlayerTaskInventoryLine[] {
  const checks = [
    required("Slayer helm or black mask", /slayer helmet/i, /black mask/i),
    required("Prayer restore", /prayer potion/i, /super restore/i),
    required("Food", /shark/i, /anglerfish/i, /karambwan/i, /manta ray/i, /sea turtle/i)
  ];
  if (method === "cannon") checks.push(required("Cannon and cannonballs", /dwarf multicannon/i, /cannonball/i));
  if (method === "burst") checks.push(required("Prayer gear", /proselyte/i, /vestment/i, /monk'?s robe/i));
  return checks.map((check) => inventoryLine(check, bank));
}

function inventoryLine(check: { label: string; patterns: RegExp[] }, bank: NextUpBankItem[]): SlayerTaskInventoryLine {
  const owned = findOwned(bank, check.patterns);
  return { label: check.label, owned: Boolean(owned), itemName: owned?.name ?? null };
}

function nextStreakMilestone(streak: number): number | null {
  return [10, 50, 100, 250, 1000].find((milestone) => streak < milestone && streak + 1 === milestone) ?? null;
}

function methodFor(knowledge: TaskKnowledge, mood: SlayerTaskMood): SlayerTaskMethod {
  if ((mood === "chill" || mood === "afk") && knowledge.chillMethod) return knowledge.chillMethod;
  if (mood === "afk" && knowledge.attention === "afk") return "afk";
  return knowledge.preferredMethod;
}

function methodLabel(method: SlayerTaskMethod): string {
  switch (method) {
    case "afk": return "Low-attention task";
    case "burst": return "Burst the task";
    case "cannon": return "Cannon the task";
    case "ranged": return "Ranged trip";
    case "boss": return "Boss variant";
    case "melee":
    default: return "Melee trip";
  }
}

function bossVariantFor(
  knowledge: TaskKnowledge,
  bank: NextUpBankItem[],
  mood: SlayerTaskMood
): SlayerTaskDecision["bossVariant"] {
  if (mood !== "bossing" || !knowledge.bossSlug || bank.length === 0) return null;
  const boss = bossBySlug(knowledge.bossSlug);
  if (!boss) return null;
  const viability = bossViabilityFromSimpleBank(bank, boss);
  if (!viability || viability.tone !== "ready" || !viability.canKill) return null;
  return { slug: boss.slug, name: boss.name, viability };
}

function stopPoint(remaining: number, mood: SlayerTaskMood, method: SlayerTaskMethod): string {
  if (mood === "short") return `Stop after ${Math.min(remaining, 25)} kills, then keep the remainder for the next login.`;
  if (method === "boss") return `Stop after one boss trip; continue only if kills and supply use feel stable.`;
  if (remaining > 100) return `Stop after ${Math.min(remaining, 50)} kills or one supply cycle; the full task does not need to fit tonight.`;
  return `Stop when all ${remaining.toLocaleString()} are done, then sync the new assignment.`;
}

export function decideSlayerTask(input: SlayerTaskDecisionInput): SlayerTaskDecision {
  const bank = input.bank ?? [];
  const mood = input.mood ?? "smart";
  const knowledge = TASK_KNOWLEDGE[input.task.id] ?? defaultKnowledge(input.task);
  const syncHealth = input.syncHealth ?? "unknown";
  const location = input.state.taskLocation?.trim() || input.task.locations[0] || "Check the task location";
  const streakMilestone = nextStreakMilestone(input.state.streak);
  const bossVariant = syncHealth === "live" ? bossVariantFor(knowledge, bank, mood) : null;
  const iron = isIronPlannerAccount(input.accountType);
  const blockedContradiction = input.state.blocks.includes(input.task.id);
  const canSkip = knowledge.skipCandidate
    && input.state.points >= 30
    && !streakMilestone
    && !iron
    && mood !== "chill"
    && mood !== "afk"
    && mood !== "short";

  let verdict: SlayerTaskVerdict = "do";
  if (syncHealth !== "live" || blockedContradiction) verdict = "refresh";
  else if (bossVariant) verdict = "boss-variant";
  else if (canSkip) verdict = "skip";

  const method = verdict === "boss-variant" ? "boss" : methodFor(knowledge, mood);
  const checks = [
    ...baseInventory(bank, method),
    ...(knowledge.inventory ?? []).map((check) => inventoryLine(check, bank))
  ].filter((line, index, all) => all.findIndex((other) => other.label === line.label) === index);
  if (bossVariant?.viability.weaponName) {
    checks.unshift({ label: "Best owned weapon", owned: true, itemName: bossVariant.viability.weaponName });
  }
  const missing = bank.length > 0
    ? [...new Set([
        ...checks.filter((line) => !line.owned).map((line) => line.label),
        ...(bossVariant?.viability.missing ?? [])
      ])].slice(0, 4)
    : [];

  const taskLabel = `${input.state.taskRemaining.toLocaleString()} ${input.task.name}${input.state.taskRemaining === 1 ? "" : "s"}`;
  const consequence = verdict === "skip"
    ? `Skipping costs 30 points, leaving ${Math.max(0, input.state.points - 30).toLocaleString()}. Your ${input.state.streak}-task streak stays intact.`
    : streakMilestone
      ? `Finishing reaches the ${streakMilestone}-task streak milestone; the exact reward depends on your Slayer master.`
      : `Finishing moves your ${input.state.streak}-task streak forward; the exact point reward depends on your Slayer master.`;

  if (verdict === "refresh") {
    return {
      verdict,
      verdictLabel: "Check the task again",
      task: input.task,
      remaining: input.state.taskRemaining,
      method,
      methodLabel: methodLabel(method),
      why: blockedContradiction
        ? "This task also appears on the saved block list, so Scapestack will not treat it as live until RuneLite confirms it."
        : "This Slayer scan is no longer fresh enough to present the task as live fact.",
      firstStep: "Open RuneLite, press Sync now, then return to this task route.",
      stopPoint: "Do not spend points or build a long trip from an old task scan.",
      pointsConsequence: `${input.state.points.toLocaleString()} points and streak ${input.state.streak} were last seen in the same scan.`,
      avoid: "Do not skip or block from stale task data.",
      location,
      inventory: checks,
      missing,
      bankUsed: bank.length > 0,
      bossVariant: null
    };
  }

  if (verdict === "skip") {
    return {
      verdict,
      verdictLabel: "Skip this one",
      task: input.task,
      remaining: input.state.taskRemaining,
      method,
      methodLabel: methodLabel(method),
      why: `${taskLabel} is a weak use of an active session, and this account has enough points to reroll without breaking the streak.`,
      firstStep: "Spend 30 points on a task cancellation, take the new assignment, then sync again.",
      stopPoint: "Stop after the new assignment appears; do not chain skips without checking the next task.",
      pointsConsequence: consequence,
      avoid: "Do not skip if these points are reserved for a Slayer unlock or block slot.",
      location,
      inventory: checks,
      missing,
      bankUsed: bank.length > 0,
      bossVariant: null
    };
  }

  const bossWhy = bossVariant
    ? `${bossVariant.viability.weaponName} makes the ${bossVariant.name} variant viable from this bank, and Bossing was selected.`
    : null;
  const moodWhy = mood === "afk" || mood === "chill"
    ? `${methodLabel(method)} keeps this assignment inside the selected ${mood === "afk" ? "AFK" : "Chill"} pace.`
    : `${taskLabel} is current, so finishing it beats starting an unrelated grind.`;

  return {
    verdict,
    verdictLabel: bossVariant ? `Try ${bossVariant.name}` : "Do the task",
    task: input.task,
    remaining: input.state.taskRemaining,
    method,
    methodLabel: methodLabel(method),
    why: bossWhy ?? moodWhy,
    firstStep: bossVariant
      ? `Open ${bossVariant.name}, equip ${bossVariant.viability.weaponName ?? "the best owned setup"}, then do one trip.`
      : knowledge.firstStep ?? `Gear at the bank, travel to ${location}, then test the first ${Math.min(10, input.state.taskRemaining)} kills.`,
    stopPoint: stopPoint(input.state.taskRemaining, mood, method),
    pointsConsequence: consequence,
    avoid: knowledge.avoid ?? (missing.length > 0 ? `Do not leave before checking: ${missing.join(", ")}.` : null),
    location,
    inventory: checks,
    missing,
    bankUsed: bank.length > 0,
    bossVariant
  };
}
