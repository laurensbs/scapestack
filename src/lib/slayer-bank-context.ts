import type { BankHandoffItem, BankHandoffSummary } from "./next-bank-handoff";
import { summarizeBankHandoff } from "./next-bank-handoff";

export interface SlayerBankContextMatch {
  id: number;
  name: string;
  quantity: number;
}

export interface SlayerBankContext {
  summary: BankHandoffSummary;
  gear: SlayerBankContextMatch[];
  consumables: SlayerBankContextMatch[];
  unlocks: SlayerBankContextMatch[];
  readyCount: number;
  missing: string[];
}

const GEAR_PATTERNS = [
  /slayer helmet/i,
  /black mask/i,
  /dwarf multicannon/i,
  /cannonball/i,
  /toxic blowpipe/i,
  /trident/i,
  /abyssal whip/i,
  /leaf-bladed/i,
  /dragon hunter/i,
  /armadyl crossbow/i,
  /bow of faerdhinen/i,
  /twisted bow/i
];

const CONSUMABLE_PATTERNS = [
  /prayer potion/i,
  /super restore/i,
  /ranging potion/i,
  /super combat potion/i,
  /divine .*potion/i,
  /stamina potion/i,
  /shark/i,
  /anglerfish/i,
  /karambwan/i,
  /house teleport/i,
  /slayer ring/i,
  /expeditious bracelet/i,
  /bracelet of slaughter/i
];

const UNLOCK_PATTERNS = [
  /rune pouch/i,
  /herb sack/i,
  /gem bag/i,
  /seed box/i,
  /looting bag/i,
  /bonecrusher/i,
  /ash sanctifier/i
];

export function buildSlayerBankContext(items: BankHandoffItem[]): SlayerBankContext | null {
  if (items.length === 0) return null;

  const gear = matchItems(items, GEAR_PATTERNS, 6);
  const consumables = matchItems(items, CONSUMABLE_PATTERNS, 6);
  const unlocks = matchItems(items, UNLOCK_PATTERNS, 5);
  const missing = buildMissingHints({ gear, consumables, unlocks });

  return {
    summary: summarizeBankHandoff(items),
    gear,
    consumables,
    unlocks,
    readyCount: gear.length + consumables.length + unlocks.length,
    missing
  };
}

function matchItems(
  items: BankHandoffItem[],
  patterns: RegExp[],
  limit: number
): SlayerBankContextMatch[] {
  const seen = new Set<number>();
  const matches: SlayerBankContextMatch[] = [];

  for (const item of items) {
    if (seen.has(item.id)) continue;
    if (!patterns.some((pattern) => pattern.test(item.name))) continue;
    seen.add(item.id);
    matches.push({ id: item.id, name: item.name, quantity: item.quantity });
  }

  return matches
    .sort((a, b) => b.quantity - a.quantity || a.name.localeCompare(b.name))
    .slice(0, limit);
}

function buildMissingHints(context: Pick<SlayerBankContext, "gear" | "consumables" | "unlocks">): string[] {
  const allNames = [...context.gear, ...context.consumables, ...context.unlocks]
    .map((item) => item.name.toLowerCase());
  const missing: string[] = [];

  if (!allNames.some((name) => name.includes("slayer helmet") || name.includes("black mask"))) {
    missing.push("Slayer helm / black mask");
  }
  if (!allNames.some((name) => name.includes("prayer potion") || name.includes("super restore"))) {
    missing.push("Prayer restore");
  }
  if (!allNames.some((name) => name.includes("bracelet of slaughter") || name.includes("expeditious bracelet"))) {
    missing.push("Task bracelet");
  }
  if (!allNames.some((name) => name.includes("rune pouch"))) {
    missing.push("Rune pouch");
  }

  return missing.slice(0, 4);
}
