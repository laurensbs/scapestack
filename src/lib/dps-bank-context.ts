import { ownedGear, type GearItem } from "./gear";
import {
  organizedItemsFromHandoff,
  summarizeBankHandoff,
  type BankHandoffItem,
  type BankHandoffSummary
} from "./next-bank-handoff";

export interface DpsBankContext {
  summary: BankHandoffSummary;
  owned: GearItem[];
  weaponCount: number;
}

export function buildDpsBankContext(items: BankHandoffItem[]): DpsBankContext | null {
  if (items.length === 0) return null;
  const owned = ownedGear(organizedItemsFromHandoff(items));
  return {
    summary: summarizeBankHandoff(items),
    owned,
    weaponCount: owned.filter((gear) => gear.slot === "weapon").length
  };
}
