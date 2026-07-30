// Public contract for the /next recommendation engine.
//
// Split out of next-up.ts so the engine internals can be reorganised without
// touching the shape every caller depends on. next-up.ts re-exports all of
// this, so importing from "@/lib/next-up" keeps working.

import type { CompletionItem } from "./goals";
import type { HiscoreSkill } from "./hiscores";
import type { QuestRouteProgress } from "./quest-route";
import type { DiaryTierProgress } from "./diary-task-progress";
import type { PathOverview } from "./path-progress";
import type { AccountStage } from "./account-stage";
import type { SkillRoute } from "./skill-routes";
import type { CalculableRoute } from "./calculable-route";
import type { SlayerTaskDecision } from "./slayer-task-decision";
import type { PluginBankStatus } from "./plugin-bank-status";
import type { AccountModeAssessment, PlannerAccountType } from "./account-type";
import type { SyncDeltaSummary } from "./sync-repo";
import type { RecommendationSessionProfile } from "./recommendation-session";

// Kind drives the icon + accent the hub renders, and groups the checklist.
export type RecKind =
  | "goal"       // a goal set 1-2 items from done
  | "quest"      // a Wiki-listed quest the player's stats now meet
  | "diary"      // an Achievement Diary tier the player's stats now meet
  | "boss"       // a boss the player's combat level now supports
  | "kc"         // boss KC-aware insight (drop rate vs your kill count)
  | "minigame"   // a minigame the player's skill levels now unlock
  | "money"      // a money-making method matched to the player's skills
  | "slayer"     // live RuneLite-plugin Slayer task / points advice
  | "skill"      // a skill sitting just short of a milestone level
  | "bank"       // a bank-hygiene action (clear junk, complete a set)
  | "milestone"; // an account-wide milestone (quest cape range, maxing, etc.)

export interface RecommendationPlanSeed {
  timebox?: string;
  prep?: string;
  steps?: string[];
  caveat?: string;
  flow?: "supply";
  /** Internal skill calculation used to build the player-facing route. */
  skillRoute?: SkillRoute;
}

export type RecommendationRouteTag =
  | "beginner"
  | "returning"
  | "iron"
  | "skiller"
  | "pvm"
  | "maxing"
  | "gp"
  | "unlock"
  | "afk"
  | "fun"
  | "rebuild"
  | "slayer";

export type RecommendationGearConfidence = "confirmed" | "likely" | "unknown" | "not-needed";

export interface RecommendationQuality {
  /** Past dit echt bij het account, los van ruwe score. */
  accountFit: number;
  /** Kan de speler nu meteen beginnen? */
  actionability: number;
  /** Is er een duidelijke stop point voor deze sessie? */
  stopPoint: number;
  /** Weten we genoeg over gear/supplies om dit niet te oversellen? */
  gearConfidence: number;
  /** Hoeveel unlockt dit downstream? */
  unlockValue: number;
  /** Voelt dit als een leuke OSRS sessie, niet alleen als huiswerk? */
  fun: number;
  /** Hoeveel prereqs, risk of setup-frictie zit erin? 0 = laag, 1 = hoog. */
  friction: number;
}

export interface RecommendationActionPlan {
  /** Short session framing shown on the card, e.g. "45-90 min". */
  timebox: string;
  /** How certain Scapestack is that this action fits the account data. */
  confidence: "exact" | "likely" | "guided";
  /** Human label for the confidence chip. */
  confidenceLabel: string;
  /** Tiny prep hint before the checklist. */
  prep: string;
  /** 2-4 concrete steps that make the recommendation executable. */
  steps: string[];
  /** Optional warning/fallback line for missing data or risky assumptions. */
  caveat?: string;
}

export type RecommendationRouteChainLabel = "Do this first" | "After that" | "If blocked" | "Next login" | "Source" | "Process" | "Stop";

export interface RecommendationRouteChainStep {
  label: RecommendationRouteChainLabel;
  text: string;
}

export interface RecommendationRouteChain {
  steps: RecommendationRouteChainStep[];
}

export type RecommendationCompletionTarget =
  | { kind: "boss_kc_at_least"; boss: string; target: number }
  | { kind: "skill_level_at_least"; skill: string; target: number }
  | { kind: "quest_completed"; quest: string }
  | { kind: "diary_completed"; region: string; tier: string }
  | { kind: "collection_log_item_obtained"; item: string; itemId?: number }
  | { kind: "slayer_task_finished"; taskId: number; taskName: string; startingRemaining: number }
  | { kind: "bank_quantity_at_least"; item: string; itemId?: number; target: number }
  | { kind: "bank_changed" };

export interface Recommendation {
  id: string;             // stable key
  kind: RecKind;
  title: string;          // the action — imperative, short
  why: string;            // one line: why it's worth doing now
  payoff?: string;        // optional: what completing it unlocks/gives
  /** Account-specific reason shown in the /next headline card. */
  decisionReason?: string;
  /** Concrete vereisten die de speler nu moet hebben/doen. Tonen in
   *  de detail-expand als bullet list. Korte regels, max ~5 stuks. */
  needs?: string[];
  /** Langere uitleg / walkthrough — meerdere regels mogelijk. Wordt
   *  alleen in de detail-expand getoond. Houdt het beknopt; lange
   *  guides horen op de wiki. */
  details?: string;
  /** 0-100, higher surfaces first. The top scorer becomes the headline. */
  score: number;
  /** Tool route to act on this, e.g. "/goals" or "/dps". */
  link?: string;
  /** Optional OSRS item id for a sprite on the card. */
  iconItemId?: number;
  /** Executable next-session plan. This is deliberately generic enough to
   *  render on every rec kind, but concrete enough that /next feels like an
   *  OSRS decision engine instead of a list of vague tips. */
  actionPlan?: RecommendationActionPlan;
  /** Short session chain shown as one flow, not as a dashboard. */
  routeChain?: RecommendationRouteChain;
  /** Quantity-aware route for skilling recommendations. Recomputed from the
   * latest bank and RuneLite state on every /next request. */
  calculableRoute?: CalculableRoute;
  /** Internal engine seed for data-specific plans. Stripped after enrichment
   *  so the UI only sees the normalized actionPlan shape. */
  planSeed?: RecommendationPlanSeed;
  /** Hidden planner tags for route/archetype ranking. Not rendered as UI copy. */
  routeTags?: RecommendationRouteTag[];
  /** Internal quality profile for ranking. Stripped before UI. */
  quality?: RecommendationQuality;
  /** Typed session constraints used before mood ranking. Never rendered. */
  sessionProfile?: Partial<RecommendationSessionProfile>;
  /** Internal gear confidence for boss/KC ranking. Stripped before UI. */
  gearConfidence?: RecommendationGearConfidence;
  /** Optional boss slug — when set, the hub renders a wiki NPC portrait
   *  instead of an item sprite. Used by the kc-kind recs so the player
   *  sees an actual picture of Vorkath, Olm, etc. */
  bossSlug?: string;
  /** kc-kind only: enough data for the inline probability chart in /next.
   *  We carry kc / denom / drop-name so the renderer doesn't have to
   *  reverse-engineer them from the title/why strings. */
  kcMeta?: {
    kc: number;
    denom: number;
    dropName: string;
  };
  /** Structured finish condition consumed by the persisted decision contract.
   *  Player-facing copy must never be reverse-engineered to prove outcomes. */
  completionTarget?: RecommendationCompletionTarget;
  /** Exact Wiki diary tasks plus honest completion evidence. The client may
   *  merge account-local manual checks without changing server ranking. */
  diaryProgress?: DiaryTierProgress;
  questName?: string;
  /** The shortest executable quest block toward a larger unlock. Full guides
   *  stay on the Wiki; this contract only carries the current session. */
  questRoute?: QuestRouteProgress;
  /** Exact Slayer task decision built from task freshness, points, bank and
   *  account mode. The UI renders this contract instead of parsing copy. */
  slayerDecision?: SlayerTaskDecision;
}

export interface ReturnPlan {
  /** One-line return hook: why opening Scapestack again is worth it. */
  title: string;
  /** Short player-facing explanation, no sync jargon. */
  lead: string;
  /** Compact visible changes from the last RuneLite scan. */
  sinceLastTrip: string[];
  /** What to do after the current stop point. */
  checkBack: string;
  /** What Scapestack should do differently on the next visit. */
  nextLogin: string;
  /** Whether there was real progress since the previous scan. */
  hasProgress: boolean;
}

export type NextBestActionKind =
  | "do-quest"
  | "collect-items"
  | "train-skill"
  | "complete-prereq"
  | "unlock-route"
  | "do-diary"
  | "collect-diary-items"
  | "train-diary-skill"
  | "complete-diary-prereq";
export type NextBestActionPreparation = "Low" | "Medium" | "High";

export interface NextBestAction {
  id: string;
  kind: NextBestActionKind;
  title: string;
  reason: string;
  missingRequirements: string[];
  requiredItems: string[];
  preparation: NextBestActionPreparation;
  relevantQuestOrUnlock: string;
  unlockValue: number;
  link?: string;
  iconItemId?: number;
  accountTypeNote?: string;
  questName?: string;
}

export interface QuestCompletionAnswer {
  quest: string;
  completed: boolean;
}

export interface QuestCompletionQuestion {
  quest: string;
  prompt: string;
}

export interface NextUpInput {
  /** Live Hiscores skills. Empty when no RSN was looked up. */
  skills?: HiscoreSkill[];
  /** The player's bank as id+name pairs. Empty when no bank was pasted. */
  bank?: CompletionItem[];
  /** Virtual earned items inferred from account data, e.g. 99 skill capes.
   *  Count for goal completion but not as a real bank context. */
  earnedItems?: CompletionItem[];
  /** Total quest points. `null` means unknown — the OSRS Hiscores do not
   *  publish it, so this is null for every account without exact plugin or
   *  tracker data. Consumers must read unknown as permissive, never as 0. */
  questPoints?: number | null;
  /** Boss kill-counts from Hiscores activities — keyed by activity name.
   *  Used to compute expected-uniques ("142 Vorkath KC ≈ 0.85 visages"). */
  bossKc?: Record<string, number>;
  /** WOM-derived boss kills (snake_case keys). Merged with Hiscores KCs
   *  via Math.max in path-progress — WOM is often ahead because it
   *  updates per RuneLite plugin push. */
  womBossKills?: Record<string, number>;
  /** WOM-derived account metadata. Drives the 'Synced via WOM' badge
   *  and account-type-aware recommendations. */
  accountMeta?: import("./path-progress").AccountMeta | null;
  /** collectionlog.net owned item IDs (any item with the obtained flag).
   *  Used to skip KC-recs whose iconic drop the player already has —
   *  exact data instead of bank-paste guesswork. */
  collectionLogOwnedItemIds?: number[];
  questCompletionAnswers?: QuestCompletionAnswer[];
  /** Scapestack-plugin sync data — our own RuneLite plugin. Highest
   *  priority signal: exact quest + diary + CL state straight from the
   *  player's game client. */
  scapestackSync?: {
    displayName?: string;
    accountType?: string;
    questsCompleted?: string[];
    diariesCompleted?: Array<{ region: string; tier: string }>;
    collectionLogItemIds?: number[];
    bossKc?: Record<string, number> | null;
    bankStatus?: PluginBankStatus;
    lastSyncSummary?: SyncDeltaSummary | null;
    slayer?: {
      points: number;
      streak: number;
      taskRemaining: number;
      currentTaskId: number;
      taskName?: string | null;
      taskLocation?: string | null;
      blocks: string[];
    } | null;
  };
  /** Tracks which external trackers contributed. Surfaced as the
   *  'Synced via X · Y · Z' badge on the hero block.
   *  scapestack is the live plugin sync metadata when present
   *  (freshness + counts), null when the player hasn't installed it. */
  syncedSources?: {
    wom: boolean;
    collectionLog: boolean;
    scapestack: {
      syncedAt: string;
      quests: number;
      diaries: number;
      clItems: number;
      pluginVersion?: string;
      slayerTaskRemaining?: number | null;
      slayerBlocks?: number;
      bankStatus?: PluginBankStatus;
      availability?: Partial<import("./account-snapshot-delta").SnapshotAvailability>;
      lastSyncSummary?: SyncDeltaSummary | null;
    } | null;
  };
}

export interface NextUpResult {
  /** The single strongest recommendation — the hub's headline. */
  headline: Recommendation | null;
  /** Everything else, already sorted high-score-first. */
  rest: Recommendation[];
  /** Specific action queue built from skills, quest state, bank items,
   *  account type and unlock value. */
  nextBestActions: NextBestAction[];
  questQuestions: QuestCompletionQuestion[];
  /** Quick account read-out for the hub header. */
  summary: {
    combatLevel: number | null;
    totalLevel: number | null;
    goalPercent: number | null;
    accountStage: AccountStage;
    accountType: PlannerAccountType | null;
    accountMode: AccountModeAssessment;
    /** Coverage note — which inputs the advice is based on. */
    basis: "full" | "hiscores-only" | "bank-only" | "none";
    /** What changed between the latest RuneLite sync and the previous one. */
    lastSyncSummary: SyncDeltaSummary | null;
  };
  /** Path-to-Max progress across four axes (skills/quests/diaries/bosses).
   *  Drives the new path-card layout in the UI. Always present even when
   *  data is sparse — paths fall back to 0% with empty next-steps. */
  pathProgress: PathOverview;
  /** Top-N goal-sets gesorteerd op "dichtsbij voltooien". Lege array
   *  wanneer geen bank gepasted is. Drijft de Bank-Readiness chip-rij. */
  readiness: import("./goals").SetCompletion[];
  /** Hours-to-max samenvatting: totaal + per-skill. Bron: hours-to-max.ts
   *  met community-XP-rate tabel. Lege summary zonder Hiscores. */
  maxEstimate: import("./hours-to-max").HoursToMaxSummary;
  /** Return-loop copy for /next: what changed, when to come back, and why. */
  returnPlan: ReturnPlan;
}
