"use server";

import { organize, exportTabs, type OrganizeResult, type OrganizedTab } from "@/lib/organizer";
import type { Archetype } from "@/lib/archetype";

export async function organizeAction(
  input: string,
  options: { junkFilter?: boolean; includePrices?: boolean; archetype?: Archetype } = {}
): Promise<{ result?: OrganizeResult; strings?: string[]; error?: string }> {
  try {
    const result = await organize({
      input,
      junkFilter: options.junkFilter,
      includePrices: options.includePrices ?? true,
      archetype: options.archetype
    });
    const strings = exportTabs(result.tabs);
    return { result, strings };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to organize" };
  }
}

export async function exportAction(tabs: OrganizedTab[]): Promise<string[]> {
  return exportTabs(tabs);
}
