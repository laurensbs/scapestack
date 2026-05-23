"use server";

import { organize, exportTabs, type OrganizeResult, type OrganizedTab } from "@/lib/organizer";
import type { Archetype } from "@/lib/archetype";
import { computeNextUp, type NextUpInput, type NextUpResult } from "@/lib/next-up";

export async function nextUpAction(input: NextUpInput): Promise<NextUpResult> {
  // Server-side because the engine reads data/quests.json from disk via
  // node:fs. Keeping it behind a Server Action means the client bundle
  // never pulls in fs/promises and the quest dataset (~tens of KB) stays
  // on the server.
  return computeNextUp(input);
}

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
