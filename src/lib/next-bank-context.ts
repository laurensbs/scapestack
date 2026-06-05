import type { BankHandoffItem, BankHandoffSummary } from "./next-bank-handoff";
import { summarizeBankHandoff } from "./next-bank-handoff";

export interface NextBankContextArea {
  name: string;
  itemCount: number;
  totalValue: number;
}

export interface NextBankContext {
  summary: BankHandoffSummary;
  topAreas: NextBankContextArea[];
  hasValuedBank: boolean;
}

export function buildNextBankContext(items: BankHandoffItem[]): NextBankContext | null {
  if (items.length === 0) return null;

  const areas = new Map<string, NextBankContextArea>();
  for (const item of items) {
    const name = item.subtab.trim() || "Bank";
    const area = areas.get(name) ?? { name, itemCount: 0, totalValue: 0 };
    area.itemCount += 1;
    area.totalValue += item.stackValue;
    areas.set(name, area);
  }

  return {
    summary: summarizeBankHandoff(items),
    topAreas: [...areas.values()]
      .sort((a, b) => b.itemCount - a.itemCount || b.totalValue - a.totalValue || a.name.localeCompare(b.name))
      .slice(0, 4),
    hasValuedBank: items.some((item) => item.stackValue > 0 || item.unitPrice > 0)
  };
}
