// Content access — can this player actually reach this content?
//
// OSRS gates almost everything worth doing behind unlocks, not levels. Vorkath
// needs Dragon Slayer II, Zulrah needs the Regicide chain, birdhouses need
// Bone Voyage. A planner that only checks skill levels will confidently tell a
// questless account to go kill Vorkath — and OSRS players read that as proof
// the tool was built by someone who does not play.
//
// ── Three states, deliberately ──────────────────────────────────────────────
//
// A binary locked/unlocked check would be worse than the bug it fixes: without
// a RuneLite sync we do not know which quests are done, so every gated boss
// would vanish for every player who never installed the plugin.
//
//   unlocked  exact data says the requirement is met      → recommend normally
//   locked    exact data says it is not met               → suppress it
//   unknown   we have no exact data                       → show, state the gate
//
// `unknown` is a feature. "Vorkath — needs Dragon Slayer II" is useful to a
// player who is not sure, it is honest about what Scapestack can see, and it
// is the most concrete reason to install the plugin: with sync, the hedge
// disappears.
//
// Favour (Hosidius and friends) is not in the plugin payload at all, so it can
// never be better than `unknown`. We surface it as a visible condition rather
// than silently assuming it.

import type { DiaryTier } from "./diary-db";
import type { HiscoreSkill } from "./hiscores";
import { lvl } from "./next-up-shared";

export type AccessState = "unlocked" | "locked" | "unknown";

export interface AccessRequirement {
  /** Quest names as they appear in data/quests.json. All must be complete. */
  quests?: string[];
  /** Kourend favour. Never verifiable today — always reported as unverified. */
  favour?: { house: string; percent: number };
  /** Hard skill gates for reaching the content, not for doing it well. */
  skills?: Array<{ skill: string; level: number }>;
  /** Diary tier that unlocks the content (e.g. Falador Hard for the deep mine). */
  diary?: { region: string; tier: DiaryTier };
}

export interface AccessVerdict {
  state: AccessState;
  /** Proven-missing requirements, in player language. */
  missing: string[];
  /** Requirements we cannot check. Shown as conditions, never as blockers. */
  unverified: string[];
}

export interface AccessContext {
  /** Lowercased completed quest names. `undefined` means no exact source. */
  completedQuestNames?: Set<string>;
  /** Completed diary tier keys, as produced by diaryTierKey(). */
  completedDiaryTierKeys?: Set<string>;
  skills: HiscoreSkill[];
}

const UNLOCKED: AccessVerdict = { state: "unlocked", missing: [], unverified: [] };

/** Same key shape as diary-requirements' diaryTierKey, kept local to avoid a cycle. */
function diaryKey(region: string, tier: string): string {
  return `${region.toLowerCase()}::${tier.toLowerCase()}`;
}

export function evaluateAccess(
  requirement: AccessRequirement | undefined,
  context: AccessContext
): AccessVerdict {
  if (!requirement) return UNLOCKED;

  const missing: string[] = [];
  const unverified: string[] = [];

  // Quests — the gate that matters most and the one we can prove.
  if (requirement.quests?.length) {
    if (!context.completedQuestNames) {
      unverified.push(...requirement.quests);
    } else {
      for (const quest of requirement.quests) {
        if (!context.completedQuestNames.has(quest.toLowerCase())) missing.push(quest);
      }
    }
  }

  // Skills — Hiscores or plugin, always known when we have any skills at all.
  if (requirement.skills?.length) {
    for (const need of requirement.skills) {
      if (context.skills.length === 0) {
        unverified.push(`${need.level} ${need.skill}`);
      } else if (lvl(context.skills, need.skill) < need.level) {
        missing.push(`${need.level} ${need.skill}`);
      }
    }
  }

  // Diary tiers — only the plugin knows these exactly.
  if (requirement.diary) {
    const label = `${requirement.diary.region} ${requirement.diary.tier}`;
    if (!context.completedDiaryTierKeys) {
      unverified.push(`${label} diary`);
    } else if (!context.completedDiaryTierKeys.has(diaryKey(requirement.diary.region, requirement.diary.tier))) {
      missing.push(`${label} diary`);
    }
  }

  // Favour is never synced, so it is a condition rather than a blocker.
  if (requirement.favour) {
    unverified.push(`${requirement.favour.percent}% ${requirement.favour.house} favour`);
  }

  if (missing.length > 0) return { state: "locked", missing, unverified };
  if (unverified.length > 0) return { state: "unknown", missing: [], unverified };
  return UNLOCKED;
}

/**
 * One line for the rec's `needs` list. Only meaningful for `unknown` — a
 * `locked` rec never reaches the player.
 */
export function accessNeedsLine(verdict: AccessVerdict): string | null {
  if (verdict.unverified.length === 0) return null;
  return `Needs ${verdict.unverified.join(", ")} — Scapestack cannot confirm this without a RuneLite sync.`;
}

/**
 * Score weight for an unverified recommendation. A rec we know the player can
 * do should always outrank one we merely hope they can.
 */
export function accessScoreMultiplier(verdict: AccessVerdict): number {
  return verdict.state === "unknown" ? 0.82 : 1;
}
