"use client";

import { useState, useTransition, useMemo, useEffect } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import dynamic from "next/dynamic";
import {
  ArrowRight, ChevronRight, Edit3, Target, Sword, TrendingUp, Layers,
  Sparkles, Trophy, Gamepad2, Coins, Scroll, Map as MapIcon, Dices, ExternalLink,
  CheckCheck, CheckCircle2, Shield, Trash2, ClipboardPaste, X, LockKeyhole
} from "lucide-react";
import { SupportCard } from "@/components/support-card";
import { AddBankModal } from "@/components/add-bank-modal";
import { SavedBankBanner } from "@/components/saved-bank-banner";
import { BossSprite } from "@/components/boss-picker";
import { ItemSprite } from "@/components/item-sprite";
import { AccountModeBadge } from "@/components/account-mode-badge";
import { XpDropLoader } from "@/components/xp-drop-loader";
import { ShuffleLoader } from "@/components/shuffle-loader";
import { BOSSES, type Boss } from "@/lib/bosses";
import { organizeAction, nextUpAction, planningContextAction } from "@/app/actions";
import { type HiscoreSkill } from "@/lib/hiscores";
import { GOAL_SETS, normaliseCompletion, type SetCompletion } from "@/lib/goals";
import type { HoursToMaxSummary } from "@/lib/hours-to-max";
import { getActiveAccount, markAccountPluginBankStatus, markAccountRuneliteProgress, markAccountTrip } from "@/lib/account-storage";
import { loadSavedBank, loadSavedRsn, saveSavedRsn, type SavedBank } from "@/lib/saved-bank";
import { track, type AnalyticsContext } from "@/lib/analytics";
import type { Recommendation, RecKind, NextUpResult, NextBestAction } from "@/lib/next-up";
import type { PlanningContextPayload } from "@/lib/planning-context";
import { buildNextUpInputFromSources } from "@/lib/planning-input";
import {
  buildRecommendationDecision,
  recommendationDecisionCopy,
  type RecommendationDecision
} from "@/lib/recommendation-decision";
import { defaultActionHints } from "@/lib/rec-hints";
import {
  pickForRoute,
  recommendationDiversityFamily,
  recommendationDiversityFamilyForKind,
  recommendationMoodEligibility,
  MOOD_LABEL,
  ROUTE_LENS_LABEL,
  ROUTE_LENS_ORDER,
  type Mood,
  type RouteLens,
  type TimeBudget
} from "@/lib/mood";
import { saveMood, loadMood, relativeSince, type MoodSession } from "@/lib/mood-storage";
import {
  clearLearnedRecommendationPreferences,
  latestRecommendationFeedback,
  latestStartedRecommendationMemory,
  latestRecommendationMemory,
  loadRecommendationFeedback,
  recentRejectedRecommendationMemories,
  recommendationMemoryCounts,
  recordRecommendationMemory,
  RECOMMENDATION_FEEDBACK_CHANGE_EVENT,
  restoreRecommendation,
  suppressRecommendation,
  type RecommendationMemoryEntry,
  type RecommendationFeedback
} from "@/lib/recommendation-feedback";
import {
  buildRecommendationPreferenceProfile,
  recommendationPreferenceContext
} from "@/lib/recommendation-preferences";
import { recordTripEvent, type TripTimelineAction } from "@/lib/trip-timeline";
import { wikiSearchUrl } from "@/lib/wiki";
import { pluginSyncHealth } from "@/lib/plugin-sync";
import { pluginBankStatusLabel, pluginBankStatusTone, shouldUsePluginBank, type PluginBankStatus } from "@/lib/plugin-bank-status";
import { isPluginSyncSource, pluginVerifyUrlForSyncedRsn } from "@/lib/plugin-sync-actions";
import { summarizeNextPluginSync, type NextPluginSyncSummary } from "@/lib/next-plugin-sync-summary";
import { runeliteProgressFromSyncSummary } from "@/lib/runelite-progress-memory";
import { toolHandoffUrl } from "@/lib/bank-tool-routes";
import { bankOrganizerHref } from "@/lib/bank-handoff-url";
import { useDialogA11y } from "@/lib/use-dialog-a11y";
import { shouldReadNextBankHandoff, shouldReadNextHeroBank } from "@/lib/next-route-context";
import { nextIntentFromSearch, type NextIntentPreset } from "@/lib/next-intent";
import {
  accountModePlanningTone,
  accountModeVisual,
  isUltimatePlannerAccount,
  plannerAccountTypeLabel,
  type PlannerAccountType
} from "@/lib/account-type";
import {
  bossBySlug,
  bossViabilityFromBankItems,
  type BossViability
} from "@/lib/boss-viability";
import {
  primaryActionForRecommendation,
  recommendationHrefWithContext,
  routeActionForHref,
  type RecommendationActionContext
} from "@/lib/recommendation-action";
import { exportTag } from "@/lib/bank-tags";
import { cn, formatGp } from "@/lib/utils";
import {
  NEXT_BANK_HANDOFF_KEY,
  bankHandoffItemsFromBankItems,
  bankHandoffItemsFromTabs,
  clearBankHandoffPayload,
  nextUpBankFromHandoff,
  persistBankHandoffPayloadFromItems,
  readBankHandoffPayload,
  summarizeBankHandoff,
  type BankHandoffItem
} from "@/lib/next-bank-handoff";
import { buildNextBankContext } from "@/lib/next-bank-context";
import {
  formatPlanXp,
  makePlanSmarterCopy,
  skillBankConfigForSkill,
  skillingBankSummaryForSkill,
  skillingLevelGapLine,
  type SkillingBankSummary
} from "@/lib/next-plan-surface";
import {
  completeCalculableRouteStep,
  resolveCalculableRouteProgress,
  selectCalculableRouteStep,
  type CalculableRouteProgress
} from "@/lib/calculable-route";
import {
  DIARY_PROGRESS_EVENT,
  loadDiaryTaskChecks,
  setDiaryTaskChecked
} from "@/lib/diary-progress-storage";

const LazyBossDetailModal = dynamic(() => import("@/components/lazy-boss-detail-modal"), {
  ssr: false,
  loading: () => null
});

const LazyKcProbabilityGraph = dynamic(
  () => import("@/components/kc-probability-graph").then((mod) => mod.KcProbabilityGraph),
  { ssr: false, loading: () => null }
);

// Per-kind visual identity — Lucide fallback + an OSRS sprite. Recs that
// already carry their own `iconItemId` keep theirs; everything else falls
// back to the kind's signature item so the page reads as OSRS, not generic
// SaaS. The Lucide icon is a third-tier fallback for if the wiki sprite
// 404s.
//   quest → Quest point cape (signature of completionist questing)
//   diary → Karamja gloves 4 (most-recognised diary reward)
//   skill → Skill cape (any 99 cape stands in for skill progression)
//   bank  → Bank filler (literal bank icon, in-game)
//   milestone → Max cape
const KIND_META: Record<RecKind, { icon: typeof Target; label: string; iconItemId?: number }> = {
  goal:      { icon: Target,     label: "Goal",         iconItemId: 9813   }, // Quest point cape — generic "completion"
  quest:     { icon: Scroll,     label: "Quest",        iconItemId: 9813   }, // Quest point cape
  diary:     { icon: MapIcon,    label: "Diary",        iconItemId: 11140  }, // Karamja gloves 4
  boss:      { icon: Sword,      label: "Boss",         iconItemId: 4151   }, // Abyssal whip
  kc:        { icon: Dices,      label: "Drop chance",  iconItemId: 22325  }, // Scythe of vitur head
  minigame:  { icon: Gamepad2,   label: "Minigame",     iconItemId: 20720  }, // Bruma torch
  money:     { icon: Coins,      label: "Money",        iconItemId: 995    }, // Coins
  slayer:    { icon: Sword,      label: "Slayer",       iconItemId: 11864  }, // Slayer helmet
  skill:     { icon: TrendingUp, label: "Skill",        iconItemId: 9747   }, // Attack cape (any skill cape)
  bank:      { icon: Layers,     label: "Bank",         iconItemId: 20594  }, // Bank filler
  milestone: { icon: Trophy,     label: "Milestone",    iconItemId: 13342  }  // Max cape
};

function hasDropChanceGraph(rec: Recommendation): rec is Recommendation & { kcMeta: NonNullable<Recommendation["kcMeta"]> } {
  return Boolean(rec.kcMeta && rec.kcMeta.dropName !== "first 50 KC");
}

const SAMPLE_LABEL = "sample plan";
const COMPACT_NUMBER = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const RANDOMIZE_ROLL_IDS = [20594, 11140, 11772, 6737, 6739, 7462, 772, 11864, 995, 22109];
const ROUTE_ITEM_IDS = {
  bank: 20594,
  karamjaGloves: 13103,
  questCape: 9813,
  fairyRing: 20636,
  slayerHelmet: 11864,
  berserkerRing: 6737,
  seersRing: 6731,
  archersRing: 6733,
  dragonDefender: 12954,
  avasAssembler: 22109,
  pietyPrayer: 10976
} as const;

const SAMPLE_SKILL_NAMES = [
  "Attack", "Defence", "Strength", "Hitpoints", "Ranged", "Prayer",
  "Magic", "Cooking", "Woodcutting", "Fletching", "Fishing", "Firemaking",
  "Crafting", "Smithing", "Mining", "Herblore", "Agility", "Thieving",
  "Slayer", "Farming", "Runecraft", "Hunter", "Construction", "Sailing"
];

const SAMPLE_LEVELS: Record<string, number> = {
  Attack: 90, Defence: 80, Strength: 90, Hitpoints: 85, Ranged: 92,
  Prayer: 74, Magic: 85, Cooking: 80, Woodcutting: 70, Fletching: 80,
  Fishing: 70, Firemaking: 70, Crafting: 75, Smithing: 70, Mining: 72,
  Herblore: 78, Agility: 70, Thieving: 80, Slayer: 80, Farming: 75,
  Runecraft: 70, Hunter: 70, Construction: 75, Sailing: 34
};

const SAMPLE_BANK = [
  { id: 4151, name: "Abyssal whip" },
  { id: 28688, name: "Blazing blowpipe" },
  { id: 11804, name: "Bandos godsword" },
  { id: 11832, name: "Bandos chestplate" },
  { id: 11834, name: "Bandos tassets" },
  { id: 19553, name: "Amulet of torture" },
  { id: 12954, name: "Dragon defender" },
  { id: 7462, name: "Barrows gloves" },
  { id: 21295, name: "Infernal cape" },
  { id: 21907, name: "Vorkath's head" },
  { id: 12921, name: "Magic fang" }
];

function sampleSkills(): HiscoreSkill[] {
  const skills = SAMPLE_SKILL_NAMES.map((name, index) => ({
    id: index + 1,
    name,
    rank: 100_000,
    level: SAMPLE_LEVELS[name] ?? 1,
    xp: SAMPLE_LEVELS[name] >= 99 ? 13_034_431 : 737_627
  }));
  const total = skills.reduce((sum, skill) => sum + skill.level, 0);
  return [{ id: 0, name: "Overall", rank: 100_000, level: total, xp: 0 }, ...skills];
}

function savedBankForRun(primaryRsn: string, fallbackRsn = ""): SavedBank | null {
  const primary = primaryRsn.trim();
  const fallback = fallbackRsn.trim();
  return loadSavedBank(primary) ?? (fallback && fallback !== primary ? loadSavedBank(fallback) : null);
}

type NextRunOptions = {
  input?: string;
  rsn?: string;
  bankItems?: BankHandoffItem[];
  planningContext?: PlanningContextPayload;
  sample?: boolean;
  routeLens?: RouteLens;
  mood?: Mood;
  minutes?: TimeBudget;
};

type NextBankSource = "none" | "browser" | "handoff" | "plugin" | "sample";

type InitialRouteChoice = {
  routeLens: RouteLens;
  mood: Mood;
  minutes: TimeBudget;
};

type GoalRouteFocus = {
  setId: string;
  targetName: string;
};

function goalRouteFocusFromSearch(search: string): GoalRouteFocus | null {
  const params = new URLSearchParams(search.replace(/^\?/, ""));
  const setId = params.get("unlock")?.trim() ?? "";
  const targetName = params.get("target")?.trim() ?? "";
  if (!setId || !targetName || params.get("from") !== "goals") return null;
  return { setId, targetName };
}

function recommendationForGoalRoute(focus: GoalRouteFocus, rsn: string): Recommendation {
  const params = new URLSearchParams({ from: "next" });
  if (rsn.trim()) params.set("rsn", rsn.trim());
  return {
    id: `active-unlock:${focus.setId}:${focus.targetName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
    kind: "goal",
    title: `Unlock ${focus.targetName}`,
    why: "You chose this reward in Unlocks, so it stays ahead of unrelated trips.",
    payoff: "Finish one clear reward step, then re-open Unlocks for the next target.",
    decisionReason: "This is your active unlock route.",
    score: 10_000,
    link: `/goals?${params.toString()}`,
    routeTags: ["unlock"],
    actionPlan: {
      timebox: "One reward step",
      confidence: "guided",
      confidenceLabel: "Chosen route",
      prep: "Open the saved unlock steps before leaving the bank.",
      steps: [
        `Open the route for ${focus.targetName}.`,
        "Finish the first unchecked step.",
        "Stop when the reward path changes."
      ],
      caveat: "Unknown quest or diary steps stay unconfirmed until RuneLite or you tick them."
    },
    routeChain: {
      steps: [
        { label: "Do this first", text: `Work on ${focus.targetName}.` },
        { label: "Stop", text: "Stop after the first unchecked reward step is complete." }
      ]
    }
  };
}

const INTAKE_SESSION_CHOICES: Array<{
  id: string;
  label: string;
  helper: string;
  routeLens: RouteLens;
  mood: Mood;
  minutes: TimeBudget;
}> = [
  { id: "best", label: "Best now", helper: "Let Scapestack pick the cleanest route.", routeLens: "smart", mood: "unlock", minutes: 60 },
  { id: "chill", label: "Chill", helper: "Low effort progress, no sweaty trip.", routeLens: "fun", mood: "chill", minutes: 30 },
  { id: "gp", label: "GP", helper: "Fund supplies or your next upgrade.", routeLens: "gp-upgrade", mood: "cash", minutes: 60 },
  { id: "intense", label: "Intense", helper: "Bossing, KC or a harder unlock block.", routeLens: "boss-log", mood: "bossing", minutes: 120 },
  { id: "unlock", label: "Unlock", helper: "Quest, diary or account gates.", routeLens: "unlock-chain", mood: "unlock", minutes: 120 },
  { id: "afk", label: "AFK", helper: "Progress while doing something else.", routeLens: "afk-progress", mood: "afk", minutes: 60 },
  { id: "short", label: "Short", helper: "One clean stop point before logout.", routeLens: "short-login", mood: "short", minutes: 15 },
  { id: "maxing", label: "Maxing", helper: "Longer account route toward 99s.", routeLens: "maxing", mood: "unlock", minutes: 120 }
];

// Render a kind's signature glyph: OSRS sprite first (with a mounted-fade-in
// so the wiki round-trip doesn't pop), Lucide icon as a fallback when the
// sprite 404s. Used in the kind-group header — small, monochrome-ish, no
// border. `tone` flips the Lucide tint between muted (group headers) and
// accent (where the sprite container is already accent-tinted).
function KindGlyph({
  kind,
  size = 14,
  tone = "muted"
}: {
  kind: RecKind;
  size?: number;
  tone?: "muted" | "accent";
}) {
  const meta = KIND_META[kind];
  if (meta.iconItemId) {
    return (
      <ItemSprite
        id={meta.iconItemId}
        alt=""
        className="pixelated shrink-0"
        style={{
          width: size,
          height: size,
          objectFit: "contain",
          imageRendering: "pixelated",
          filter: "drop-shadow(1px 1px 0 rgb(0 0 0 / 0.9))"
        }}
      />
    );
  }
  const Icon = meta.icon;
  return (
    <Icon
      className={cn(
        "shrink-0",
        tone === "accent" ? "text-[var(--color-accent)]" : "text-[var(--color-text-muted)]"
      )}
      style={{ width: size, height: size }}
      strokeWidth={1.75}
    />
  );
}

export function NextClient({
  initialQueryString,
  initialPlanningContext
}: {
  initialQueryString: string;
  initialPlanningContext: PlanningContextPayload | null;
}) {
  const [view, setView] = useState<"intake" | "result" | "not-found">("intake");
  const [result, setResult] = useState<NextUpResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  // When we land on the not-found view, remember what the user typed so
  // we can show 'Lynx Titan didn't return any data' and offer a retry.
  const [notFoundRsn, setNotFoundRsn] = useState<string>("");
  // Currently-open boss detail target. The heavy DPS/gear sheet loads after
  // click so the first /next viewport stays small on mobile.
  const [modalBossSlug, setModalBossSlug] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [expectedPluginSync, setExpectedPluginSync] = useState(false);
  // When the user came from /bank's plan-next-move handoff,
  // we surface a small banner on the intake so they know the bank is
  // already loaded — they only need to add an RSN for stat-aware advice.
  // Avoids `useSearchParams` (which would need a Suspense wrapper at the
  // page level, as we discovered with /bank).
  const [fromBank, setFromBank] = useState<{ items: BankHandoffItem[] } | null>(null);
  // Saved-bank welcome-back: same component as on /bank. Loaded once on
  // mount. Beats nothing — a returning player on /next can now just click
  // a button instead of going to /bank, pasting again, then coming back.
  // We *don't* clobber the bank-handoff banner; if both are present
  // fromBank wins (the user is mid-flow from /bank — that's a fresher
  // intent than yesterday's saved bank).
  const [savedBank, setSavedBank] = useState<SavedBank | null>(null);
  const [savedRsn, setSavedRsn] = useState<string | null>(null);
  const [activeBankItems, setActiveBankItems] = useState<BankHandoffItem[]>([]);
  const [activeBankSource, setActiveBankSource] = useState<NextBankSource>("none");
  const [activeRsn, setActiveRsn] = useState("");
  const [planRequestedAt, setPlanRequestedAt] = useState<number | null>(null);
  const [initialRouteChoice, setInitialRouteChoice] = useState<InitialRouteChoice | null>(null);
  const routeIntent = useMemo(
    () => nextIntentFromSearch(initialQueryString),
    [initialQueryString]
  );
  const goalRouteFocus = useMemo(
    () => goalRouteFocusFromSearch(initialQueryString),
    [initialQueryString]
  );
  const cameFromPlugin = useMemo(() => {
    const params = new URLSearchParams(initialQueryString.replace(/^\?/, ""));
    return params.get("from") === "plugin";
  }, [initialQueryString]);
  const cameFromHome = useMemo(() => {
    const params = new URLSearchParams(initialQueryString.replace(/^\?/, ""));
    return params.get("from") === "home";
  }, [initialQueryString]);
  const isFirstRun = useMemo(() => {
    const params = new URLSearchParams(initialQueryString.replace(/^\?/, ""));
    return params.get("first") === "1";
  }, [initialQueryString]);

  // Three intake paths feed the same engine: RSN-only (no bank),
  // RSN + bank (full data), or sample data (demo). A fourth, hidden
  // path: pre-parsed `bankItems` from /bank's plan-next-move
  // handoff via sessionStorage — skips the textarea + organizeAction
  // round-trip entirely. Each path builds the same engine input shape;
  // we branch at the edges, not in the engine.
  const run = (opts: NextRunOptions) => {
    const requestedAt = Date.now();
    const hasSubmittedBank = Boolean((opts.input ?? "").trim() || (opts.bankItems && opts.bankItems.length > 0));
    const submitSource = opts.sample
      ? "sample"
      : cameFromPlugin
        ? "plugin"
        : cameFromHome
          ? "homepage"
        : opts.bankItems?.length
          ? "bank_handoff"
          : "next";
    const hasSubmittedRsn = Boolean((opts.rsn ?? "").trim());
    setError(null);
    setPlanRequestedAt(requestedAt);
    setActiveBankItems([]);
    setActiveBankSource("none");
    // Fire the funnel event *before* the async work — Plausible is
    // fire-and-forget; we don't want the await chain in front of it.
    track("next:submit", {
      hasRsn: hasSubmittedRsn,
      hasBank: hasSubmittedBank
    });
    if (hasSubmittedRsn) {
      track("rsn:submitted", {
        source: submitSource,
        context: hasSubmittedBank ? "bank" : "public_stats",
        hasBank: hasSubmittedBank,
        sample: false
      });
    }
    startTransition(async () => {
      const rsn = (opts.rsn ?? "").trim();
      const input = (opts.input ?? "").trim();
      setActiveRsn(rsn);
      setInitialRouteChoice(opts.routeLens ? {
        routeLens: opts.routeLens,
        mood: opts.mood ?? moodForRouteLens(opts.routeLens, DEFAULT_MOOD),
        minutes: opts.minutes ?? defaultTimeForRouteLens(opts.routeLens) ?? DEFAULT_TIME
      } : null);

      if (opts.sample) {
        setActiveRsn("");
        setActiveBankSource("sample");
        const bank = SAMPLE_BANK.map((item) => ({ ...item }));
        const sampleHandoffItems = bankHandoffItemsFromBankItems(bank, "Demo PvM sample");
        setActiveBankItems(sampleHandoffItems);
        try {
          persistBankHandoffPayloadFromItems(sampleHandoffItems, window);
        } catch {
          // Demo still works in /next if storage is unavailable; DPS handoff is best-effort.
        }
        setResult(await nextUpAction({
          skills: sampleSkills(),
          bank,
          questPoints: 180,
          bossKc: {
            Vorkath: 250,
            Zulrah: 180,
            Vardorvis: 15
          },
          accountMeta: {
            displayName: "Demo PvMer",
            accountType: "regular",
            ehp: 420,
            ehb: 85,
            lastChangedAt: null
          },
          syncedSources: {
            wom: false,
            temple: false,
            collectionLog: false,
            scapestack: null
          }
        }));
        setView("result");
        return;
      }

      // One server round trip reads the critical RuneLite + Hiscores context
      // and gives optional community trackers a shorter, fixed budget. Late
      // sources never replace a recommendation that the player already saw.
      const planningContext = rsn
        ? opts.planningContext ?? await planningContextAction(rsn)
        : null;
      const hiscores = planningContext?.hiscores ?? null;
      const wom = planningContext?.wom ?? null;
      const temple = planningContext?.temple ?? null;
      const collectionLog = planningContext?.collectionLog ?? null;
      const scapestackSync = planningContext?.scapestackSync ?? null;
      if (planningContext) {
        track("plan:context_ready", {
          serverMs: planningContext.timing.totalMs,
          criticalMs: planningContext.timing.criticalMs,
          optionalMs: planningContext.timing.optionalMs,
          plannerMs: planningContext.timing.plannerMs,
          timeoutCount: planningContext.timing.timeoutCount
        });
      }

      // A fresh RuneLite bank is primary for RSN-only planning. A bank the
      // player just pasted or handed off is an explicit override.
      const handoffItems = opts.bankItems ?? [];
      let bankItemsForContext = handoffItems;
      let bankSource: NextBankSource = handoffItems.length > 0 ? "handoff" : "none";
      let bank: Array<{ id: number; name: string; quantity?: number }> = nextUpBankFromHandoff(handoffItems);
      if (bank.length === 0 && input) {
        const bankRes = await organizeAction(input, { junkFilter: false, includePrices: false });
        if (bankRes.error || !bankRes.result) {
          setError(bankRes.error || "Couldn't read that bank — check the paste.");
          return;
        }
        const flat = bankRes.result.tabs.flatMap((t) => t.items);
        bank = flat.map((it) => ({ id: it.id, name: it.name, quantity: it.quantity }));
        bankItemsForContext = bankHandoffItemsFromTabs(bankRes.result.tabs);
        bankSource = "browser";
      }
      if (rsn && scapestackSync) {
        markAccountPluginBankStatus(rsn, scapestackSync.bankStatus);
      }
      const hasManualBankOverride = bankSource === "browser" || bankSource === "handoff";
      const usePluginBank = shouldUsePluginBank({
        status: scapestackSync?.bankStatus,
        itemCount: scapestackSync?.bankItems?.length ?? 0,
        hasManualOverride: hasManualBankOverride,
        availability: scapestackSync?.availability?.bank
      });
      if (usePluginBank && scapestackSync?.bankItems?.length) {
        bank = scapestackSync.bankItems.map((item) => ({
          id: item.id,
          name: item.name,
          quantity: item.quantity
        }));
        bankItemsForContext = bankHandoffItemsFromBankItems(bank, "RuneLite bank sync");
        bankSource = "plugin";
      }
      setActiveBankItems(bankItemsForContext);
      setActiveBankSource(bankSource);
      if (bankItemsForContext.length > 0 && typeof window !== "undefined") {
        try {
          persistBankHandoffPayloadFromItems(bankItemsForContext, window);
        } catch {
          // Cross-tool handoff is best-effort; the current /next run still has state.
        }
      }

      // If neither RSN nor bank gave us anything, branch on *why*. A
      // player who typed an RSN that 404'd on the Hiscores (typo, or
      // combat too low to be ranked) gets the not-found preview screen
      // — better than a red error blob next to the button which is
      // where v0.4 lost people. A player who submitted nothing gets
      // the original 'fill something in' nudge.
      const plannerInput = buildNextUpInputFromSources({
        rsn,
        hiscores,
        wom,
        templeQuestsCompleted: temple?.questsCompleted,
        collectionLogOwnedItemIds: collectionLog?.ownedItemIds,
        scapestackSync,
        bankOverride: bank
      });
      if (!plannerInput) {
        if (rsn) {
          setNotFoundRsn(rsn);
          setView("not-found");
        } else {
          setError("Enter your OSRS name or paste a bank to get advice.");
        }
        return;
      }

      // The RSN-only path already carries the computed plan, so it avoids a
      // second network round trip. Explicit bank overrides still recalculate
      // from the same shared input builder.
      const nextResult = !hasManualBankOverride && planningContext?.initialPlan
        ? planningContext.initialPlan
        : await nextUpAction(plannerInput);
      setResult(nextResult);
      if (rsn && scapestackSync?.lastSyncSummary) {
        markAccountRuneliteProgress(rsn, runeliteProgressFromSyncSummary(
          scapestackSync.lastSyncSummary,
          {
            syncedAt: scapestackSync.syncedAt,
            headlineTitle: nextResult.headline?.title ?? nextResult.nextBestActions[0]?.title ?? null
          }
        ));
      }

      setView("result");

      // Remember the RSN for next time — independent of bank-save. If the
      // user is in the session opt-out (shared device), this is a no-op.
      if (rsn) saveSavedRsn(rsn);
    });
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    const queryString = initialQueryString || window.location.search.replace(/^\?/, "");
    const params = new URLSearchParams(queryString);
    setExpectedPluginSync(isPluginSyncSource(params.get("source")));
    const hasFromParam = params.has("from");
    const heroRsn = params.get("rsn");
    const activeAccountRsn = getActiveAccount()?.rsn ?? loadSavedRsn() ?? "";
    const shouldReadBankHandoff = shouldReadNextBankHandoff(queryString);
    const shouldReadHeroBank = shouldReadNextHeroBank(queryString);
    const isDirectRun = params.get("sample") === "1" || Boolean(heroRsn?.trim());
    if (isDirectRun) setSavedBank(null);
    if (shouldReadBankHandoff) {
      try {
        const items = readBankHandoffPayload(window);
        if (items.length > 0) setFromBank({ items });
        // We deliberately DON'T clear sessionStorage here — if the user
        // refreshes /next during the same tab session the banner stays.
      } catch { /* malformed handoff — silently ignore, fall back to intake */ }
    } else {
      // Only look up the saved bank when we're not in a handoff/direct-run flow.
      // Otherwise deep links like /next?rsn=X get blocked by a modal instead of
      // running immediately.
      if (!isDirectRun) setSavedBank(loadSavedBank(activeAccountRsn));
    }
    setSavedRsn(activeAccountRsn || null);

    // Demo deep-link: /next?sample=1 should behave like clicking the
    // sample CTA. Useful for homepage previews, browser verification and
    // sharing a working result without requiring a real RSN.
    if (params.get("sample") === "1") {
      window.setTimeout(() => {
        run({ sample: true });
      }, 0);
      return;
    }

    // Hero-handoff: ?rsn=X (+optioneel sessionStorage bank-paste) →
    // sla de intake-form over, run direct. Geeft de homepage hero
    // input een one-shot lookup zonder dat /next er een tweede keer
    // om vraagt.
    if (heroRsn && heroRsn.trim()) {
      let heroBank: string | undefined;
      let heroBankItems = [] as BankHandoffItem[];
      if (shouldReadHeroBank) {
        try {
          heroBank = sessionStorage.getItem("scapestack:hero:bank") ?? undefined;
          sessionStorage.removeItem("scapestack:hero:bank");
        } catch { /* sessionStorage disabled */ }
      }
      if (shouldReadBankHandoff) {
        try {
          heroBankItems = readBankHandoffPayload(window);
        } catch { /* malformed handoff — run with RSN only */ }
      }
      if (shouldReadHeroBank && heroBankItems.length === 0 && !heroBank) {
        heroBank = savedBankForRun(heroRsn.trim(), activeAccountRsn)?.banktags;
      }
      // Trigger run zodra de component-state is gestabiliseerd. setTimeout
      // blijft ook werken in background tabs; requestAnimationFrame kan daar
      // te agressief throttlen waardoor deep-links stil op de intake bleven.
      window.setTimeout(() => {
        run({
          rsn: heroRsn.trim(),
          input: heroBank,
          bankItems: heroBankItems,
          planningContext: initialPlanningContext ?? undefined
        });
      }, 0);
    } else if (!hasFromParam && activeAccountRsn && !shouldReadBankHandoff && !shouldReadHeroBank) {
      window.setTimeout(() => {
        run({
          rsn: activeAccountRsn,
          input: savedBankForRun(activeAccountRsn)?.banktags,
          planningContext: initialPlanningContext ?? undefined
        });
      }, 0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialQueryString]);

  // "Use saved bank" from the welcome-back banner. Reuses the same engine
  // pipeline as a fresh paste — by calling run() with the stored input
  // string, we always re-derive recommendations from the latest engine,
  // not from any cached output.
  const useSaved = (bank: SavedBank) => {
    setSavedBank(null);
    run({ input: bank.banktags, rsn: savedRsn ?? "" });
  };

  const clearStoredBankHandoff = () => {
    try {
      clearBankHandoffPayload(window);
    } catch {
    }
    setFromBank(null);
  };

  if (view === "intake") {
    // Hero-handoff: er staat ?rsn=X in de URL en we zijn al aan't laden.
    // Toon de ShuffleLoader full-pane zodat de speler nooit een leeg
    // intake-form ziet voor data die zo binnen is.
    if (pending && typeof window !== "undefined"
        && new URLSearchParams(window.location.search).get("rsn")) {
      return (
        <div className="mx-auto pt-8">
          <ShuffleLoader />
        </div>
      );
    }
    return (
      <NextIntake
        onRun={run}
        loading={pending}
        error={error}
        fromBank={fromBank}
        savedBank={savedBank}
        savedRsn={savedRsn}
        cameFromPlugin={cameFromPlugin}
        onUseSaved={useSaved}
        onDismissSaved={() => setSavedBank(null)}
        onClearBankHandoff={clearStoredBankHandoff}
      />
    );
  }

  if (view === "not-found") {
    return (
      <NotFoundPreview
        rsn={notFoundRsn}
        onRetry={() => { setNotFoundRsn(""); setView("intake"); }}
      />
    );
  }

  return result ? (
    <>
      <ResultView
        result={result}
        bankItems={activeBankItems}
        bankSource={activeBankSource}
        activeRsn={activeRsn}
        onEdit={() => setView("intake")}
        onClearStoredBankHandoff={clearStoredBankHandoff}
        expectedPluginSync={expectedPluginSync}
        routeIntent={routeIntent}
        goalRouteFocus={goalRouteFocus}
        initialRouteChoice={initialRouteChoice}
        planRequestedAt={planRequestedAt}
        isFirstRun={isFirstRun}
        onBossOpen={(slug) => setModalBossSlug(slug)}
      />
      {modalBossSlug && (
        <LazyBossDetailModal
          bossSlug={modalBossSlug}
          bankItems={activeBankItems}
          accountType={result.summary.accountType}
          analyticsSource="next"
          onSelectBoss={(nextBossSlug) => setModalBossSlug(nextBossSlug)}
          onClose={() => setModalBossSlug(null)}
        />
      )}
    </>
  ) : null;
}

// Empty-state for when an RSN lookup 404s. Instead of a red error
// blob (which is where v0.4 lost people via "Lynx Titan" typos), we
// show what /next *would* look like if the lookup had worked — a
// faded sample-result + a 'try a different name' CTA. The point is
// to keep the user oriented: this tool works, your name didn't.
function NotFoundPreview({ rsn, onRetry }: { rsn: string; onRetry: () => void }) {
  return (
    <section className="animate-[slide-up_0.35s_ease-out] max-w-2xl mx-auto">
      <header className="mb-6">
        <h2 className="text-[22px] sm:text-[26px] font-bold text-[var(--color-text)] tracking-normal leading-tight">
          We couldn&apos;t find <span className="text-[var(--color-accent)]">{rsn}</span> on Hiscores.
        </h2>
        <p className="mt-2 text-[14px] text-[var(--color-text-dim)] leading-relaxed">
          Either it&apos;s a typo, or the account isn&apos;t ranked yet (low combat /
          new account). Try again, or have a look at what a found account looks like.
        </p>
      </header>

      {/* Faded sample-result preview — same shape as a real result page,
          but greyed out and overlaid with a 'try again' CTA. Tells the
          user 'this tool produces something useful' without forcing them
          through the sample-flow detour. */}
      <div className="relative rounded-xl border border-[var(--color-border)] bg-[var(--color-panel)]/40 p-6 overflow-hidden">
        <div className="opacity-40 pointer-events-none select-none" aria-hidden="true">
          <div className="eyebrow text-[var(--color-accent)] mb-1">Start here</div>
          <h3 className="text-[17px] font-bold text-[var(--color-text)] tracking-normal leading-tight">
            Karamja Diary — Hard
          </h3>
          <p className="mt-1.5 text-[13px] text-[var(--color-text-dim)] leading-relaxed">
            Your visible stats clear the Hard skill gates in this region.
          </p>
          <p className="mt-2 text-[12px] text-[var(--color-text-secondary)] border-t border-[var(--color-border)] pt-2">
            Step toward the tier-4 reward; Hard unlocks its tier perks.
          </p>
          <div className="mt-4 grid sm:grid-cols-2 gap-2.5">
            <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-panel)] p-3 text-[12px] text-[var(--color-text-dim)]">
              <div className="font-semibold text-[var(--color-text)]">Try the Dagannoth Kings</div>
              Your Abyssal Whip fits — and CL 89 clears the gate.
            </div>
            <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-panel)] p-3 text-[12px] text-[var(--color-text-dim)]">
              <div className="font-semibold text-[var(--color-text)]">Monkey Madness II</div>
              Grandmaster · Very Long
            </div>
          </div>
        </div>

        {/* Overlay CTA */}
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-b from-transparent via-[var(--color-bg)]/40 to-[var(--color-bg)]/70 backdrop-blur-[1px]">
          <button
            type="button"
            onClick={onRetry}
            className="btn-primary group"
          >
            Try a different name
            <ArrowRight className="size-4 group-hover:translate-x-0.5 transition-transform" />
          </button>
          <p className="mt-3 text-[11.5px] text-[var(--color-text-muted)]">
            What you&apos;d see if your name had been on the list.
          </p>
        </div>
      </div>

      <p className="mt-6 text-[11.5px] text-[var(--color-text-muted)] text-center leading-relaxed">
        Tip: Hiscores names are case-sensitive in some Jagex regions.
        Try &ldquo;Lynx Titan&rdquo; (capital L, T) if you&apos;re testing.
      </p>
    </section>
  );
}

// ── Intake UI ─────────────────────────────────────────────────────────────
// Three paths, surfaced explicitly — that's the whole point of the empty-
// state redesign. RSN-only is the lightest entry (most returning players
// can't export a bank from a session they haven't started). Sample data
// gives a "show me what this looks like" preview. Adding a bank is opt-in
// for optional bank context.
function NextIntake({
  onRun, loading, error, fromBank, savedBank, savedRsn, cameFromPlugin, onUseSaved, onDismissSaved, onClearBankHandoff
}: {
  onRun: (opts: NextRunOptions) => void;
  loading: boolean;
  error: string | null;
  fromBank: { items: BankHandoffItem[] } | null;
  savedBank: SavedBank | null;
  savedRsn: string | null;
  cameFromPlugin: boolean;
  onUseSaved: (bank: SavedBank) => void;
  onDismissSaved: () => void;
  onClearBankHandoff: () => void;
}) {
  // Pre-fill RSN from the remembered value so a returning player doesn't
  // re-type their name. The bank-save and rsn-save are independent — we
  // might have one without the other.
  const [rsn, setRsn] = useState(savedRsn ?? "");
  const [showBankField, setShowBankField] = useState(false);
  const [showRoutePicker, setShowRoutePicker] = useState(false);
  const routePickerRef = useDialogA11y<HTMLDivElement>(showRoutePicker, () => setShowRoutePicker(false));
  const [bank, setBank] = useState("");
  const [selectedRouteLens, setSelectedRouteLens] = useState<RouteLens>("smart");
  const handoffSummary = fromBank ? summarizeBankHandoff(fromBank.items) : null;
  const attachedBank = bank.trim() || (!fromBank ? savedBank?.banktags.trim() ?? "" : "");
  const hasAttachedBank = Boolean(fromBank || attachedBank);
  const pluginVerifyHref = pluginVerifyUrlForSyncedRsn(rsn, "next", {
    hasBankContext: hasAttachedBank
  });

  const runWithRoute = (choice?: {
    routeLens: RouteLens;
    mood: Mood;
    minutes: TimeBudget;
  }) => {
    const clean = rsn.trim();
    const routeLens = choice?.routeLens ?? selectedRouteLens;
    const routeDefaultTime = defaultTimeForRouteLens(routeLens);
    if (clean) saveSavedRsn(clean);
    setShowRoutePicker(false);
    onRun({
      rsn: clean,
      input: attachedBank || undefined,
      // If the user came from /bank, ride that bank along so /next can
      // give gear-aware recs even before they type their RSN.
      bankItems: fromBank?.items,
      routeLens,
      mood: choice?.mood ?? moodForRouteLens(routeLens, DEFAULT_MOOD),
      minutes: choice?.minutes ?? routeDefaultTime ?? DEFAULT_TIME
    });
  };

  const submitRsn = (e: React.FormEvent) => {
    e.preventDefault();
    if (!rsn.trim() && !fromBank) return;
    const clean = rsn.trim();
    if (clean) saveSavedRsn(clean);
    runWithRoute();
  };

  return (
    <section className={cn(
      "max-w-2xl mx-auto",
      loading
        ? "animate-[intake-lift_0.5s_cubic-bezier(0.22,1,0.36,1)_both]"
        : "animate-[slide-up_0.4s_ease-out]"
    )}>
      {/* Welcome-back banner. Only shown when there's no fresh /bank
          handoff — the loader above already skips populating savedBank
          in that case, but the explicit guard keeps the JSX honest. */}
      {savedBank && !fromBank && (
        <SavedBankBanner
          saved={savedBank}
          loading={loading}
          presentation="inline"
          title="Use your saved bank?"
          message={`We found a bank from ${savedBank ? relativeSince(savedBank.savedAt) : "earlier"}. Use it when supplies or GP would change the plan, or skip and start with only an OSRS name.`}
          primaryLabel="Use saved bank"
          secondaryLabel="Skip bank"
          secondaryMode="dismiss"
          onUse={() => onUseSaved(savedBank)}
          onDismiss={onDismissSaved}
        />
      )}

      {cameFromPlugin && (
        <div className="mb-4 rounded-lg border border-[var(--color-warning)]/35 bg-[var(--color-warning)]/8 px-4 py-3 text-left">
          <div className="flex items-start gap-3">
            <Shield className="mt-0.5 size-4 shrink-0 text-[var(--color-warning)]" />
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-semibold text-[var(--color-text)]">
                Back from RuneLite
              </p>
              <p className="mt-1 text-[11.5px] leading-relaxed text-[var(--color-text-muted)]">
                Enter the same RSN. If the plan still looks guessed, press Sync now in RuneLite and check again.
              </p>
            </div>
            <Link
              href={pluginVerifyHref}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-[var(--color-warning)]/35 bg-[var(--color-bg)]/45 px-2.5 py-1.5 text-[11px] font-bold text-[var(--color-warning)] transition-colors hover:bg-[var(--color-warning)]/10"
            >
              Check RuneLite
              <ArrowRight className="size-3" />
            </Link>
          </div>
        </div>
      )}

      {/* Handoff banner — appears when the user arrived here via the
          Bank trip handoff button. The bank is
          already loaded; an RSN is optional and adds stats. */}
      {fromBank && (
        <div className="mb-4 rounded-lg border border-[var(--color-accent)]/40 bg-[var(--color-accent)]/8 px-4 py-3 flex items-start gap-3 animate-[fade-in_0.3s_ease-out] text-left">
          <Sparkles className="size-4 text-[var(--color-accent)] shrink-0 mt-0.5" />
          <div className="min-w-0 flex-1">
            <p className="text-[13px] text-[var(--color-text)] leading-relaxed">
              <span className="font-semibold">Using the bank you just organised</span>
              {handoffSummary ? ` (${handoffSummary.label}).` : "."}{" "}
              Add your OSRS name for stats and KC, or start with this bank alone.
            </p>
            <p className="mt-1 text-[11px] leading-relaxed text-[var(--color-text-muted)]">
              This bank stays in this browser and expires automatically.
            </p>
            {handoffSummary && handoffSummary.topItems.length > 0 && (
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <span className="text-[10.5px] uppercase tracking-[0.14em] font-semibold text-[var(--color-text-muted)]">
                  Top stacks
                </span>
                {handoffSummary.topItems.map((item) => (
                  <span
                    key={item.id}
                    className="inline-flex items-center gap-1.5 rounded-md border border-[var(--color-border)] bg-[var(--color-bg)]/45 px-2 py-1 text-[11px] text-[var(--color-text-dim)]"
                    title={`${item.name}: ${item.stackValue.toLocaleString()} gp`}
                  >
                    <ItemSprite id={item.id} alt="" size={15} />
                    <span className="max-w-[120px] truncate">{item.name}</span>
                  </span>
                ))}
              </div>
            )}
          </div>
          <div className="flex shrink-0 flex-wrap gap-2 sm:flex-col sm:items-stretch">
            <button
              type="button"
              onClick={() => {
                const routeDefaultTime = defaultTimeForRouteLens(selectedRouteLens);
                onRun({
                  bankItems: fromBank.items,
                  routeLens: selectedRouteLens,
                  mood: moodForRouteLens(selectedRouteLens, DEFAULT_MOOD),
                  minutes: routeDefaultTime ?? DEFAULT_TIME
                });
              }}
              disabled={loading}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-[var(--color-accent)]/35 bg-[var(--color-accent)]/10 px-2.5 py-1.5 text-[11px] font-bold text-[var(--color-accent)] transition-colors hover:bg-[var(--color-accent)]/15 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Plan with this bank
              <ArrowRight className="size-3" />
            </button>
            <button
              type="button"
              onClick={onClearBankHandoff}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)]/45 px-2.5 py-1.5 text-[11px] font-semibold text-[var(--color-text-muted)] transition-colors hover:border-[var(--color-danger)]/45 hover:text-[var(--color-danger)]"
            >
              Clear bank
              <Trash2 className="size-3" />
            </button>
          </div>
        </div>
      )}

      {/* Hero input — premium-voelt: gecentreerd, oversized, accent-glow
          op focus. Submit-button leeft binnen het input-frame zodat het
          één geheel is, geen formuliertje. */}
      <form onSubmit={submitRsn}>
        <div className={cn(
          "group relative rounded-2xl bg-[var(--color-panel)] border transition-all",
          loading
            ? "border-[var(--color-accent)]/60 shadow-[0_0_0_4px_rgba(200, 154, 61,0.10)]"
            : "border-[var(--color-border)] focus-within:border-[var(--color-accent)]/60 focus-within:shadow-[0_0_0_4px_rgba(200, 154, 61,0.10)]"
        )}>
          <div className="flex flex-col sm:flex-row sm:items-center">
            <input
              aria-label="Type your OSRS name"
              type="text"
              value={rsn}
              onChange={(e) => setRsn(e.target.value)}
              placeholder="Type your OSRS name"
              autoFocus
              autoComplete="off"
              autoCapitalize="none"
              autoCorrect="off"
              enterKeyHint="go"
              spellCheck={false}
              disabled={loading}
              className="flex-1 bg-transparent outline-none px-5 py-4 sm:py-5 text-[16px] sm:text-[18px] font-mono text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] disabled:opacity-60"
            />
            <button
              type="submit"
              aria-describedby="next-show-me-disabled-help"
              disabled={loading || (!rsn.trim() && !fromBank)}
              className={cn(
                "group/btn relative overflow-hidden rounded-xl m-1.5 px-5 py-3 inline-flex items-center justify-center gap-2",
                "bg-[var(--color-accent)] text-[var(--color-bg)] font-semibold text-[14px]",
                "hover:brightness-110 transition-all",
                "disabled:opacity-50 disabled:cursor-not-allowed"
              )}
            >
              {loading ? <XpDropLoader /> : "Plan my next move"}
              {!loading && <ArrowRight className="size-4 group-hover/btn:translate-x-0.5 transition-transform" />}
            </button>
          </div>
          <p
            id="next-show-me-disabled-help"
            aria-live="polite"
            className="border-t border-[var(--color-border)] px-5 py-2 text-[11.5px] leading-relaxed text-[var(--color-text-muted)]"
          >
            {loading
              ? "Building one clear plan…"
              : rsn.trim()
              ? "One name is enough. Bank or RuneLite can make it sharper later."
              : fromBank
              ? "Bank added. Add a name for stats and KC."
              : "Enter an OSRS name to get one clear next move."}
          </p>

          {/* Tijdens loading verschijnt de ShuffleLoader onder de input
              zodat de speler een rustige "building one plan" state ziet. */}
          {loading && (
            <div className="border-t border-[var(--color-border)]">
              <ShuffleLoader />
            </div>
          )}
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-center">
          <button
            type="button"
            onClick={() => setShowBankField(true)}
            disabled={loading}
            aria-label={hasAttachedBank ? "Edit attached bank" : "Add bank paste"}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12.5px] font-semibold transition-colors disabled:opacity-50",
              hasAttachedBank
                ? "border-[var(--color-accent)]/35 bg-[var(--color-accent)]/10 text-[var(--color-accent)] hover:bg-[var(--color-accent)]/15"
                : "border-transparent text-[var(--color-text-dim)] underline decoration-dotted underline-offset-4 hover:text-[var(--color-accent)]"
            )}
          >
            <ClipboardPaste className="size-3.5" />
            {hasAttachedBank ? "Bank added" : "Add bank"}
          </button>
          <button
            type="button"
            onClick={() => setShowRoutePicker(true)}
            disabled={loading}
            aria-haspopup="dialog"
            aria-expanded={showRoutePicker}
            className="inline-flex items-center gap-1.5 rounded-full border border-transparent px-3 py-1.5 text-[12.5px] font-semibold text-[var(--color-text-dim)] underline decoration-dotted underline-offset-4 transition-colors hover:text-[var(--color-accent)] disabled:opacity-50"
          >
            Choose a session instead
          </button>
          {bank.trim() && (
            <button
              type="button"
              onClick={() => setBank("")}
              disabled={loading}
              className="text-[12px] font-semibold text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-danger)] disabled:opacity-50"
            >
              Remove
            </button>
          )}
        </div>

        {error && (
          <p className="mt-3 text-[12px] text-[var(--color-warning)] text-center">{error}</p>
        )}
      </form>

      {showRoutePicker && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="next-route-popup-title"
          aria-describedby="next-route-popup-description"
          className="fixed inset-0 z-[110] overflow-y-auto bg-black/72 px-4 pb-8 pt-20 backdrop-blur-sm sm:grid sm:place-items-center sm:py-8"
          onClick={() => setShowRoutePicker(false)}
        >
          <div
            ref={routePickerRef}
            tabIndex={-1}
            className="osrs-frame w-full max-w-2xl text-left"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="osrs-title-bar flex items-start justify-between gap-4 px-5 py-4 sm:px-6">
              <div>
                <p className="eyebrow text-[var(--color-accent)]">Before we pick</p>
                <h2 id="next-route-popup-title" className="mt-1 text-[24px] font-semibold leading-tight text-[var(--color-text)]">
                  What do you feel like doing?
                </h2>
                <p id="next-route-popup-description" className="mt-1 text-[13px] leading-relaxed text-[var(--color-text-muted)]">
                  Pick the session. Bank and RuneLite can make the route sharper later.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowRoutePicker(false)}
                aria-label="Close route picker"
                className="inline-flex size-9 shrink-0 items-center justify-center rounded-full border border-[var(--color-border)] text-[var(--color-text-muted)] transition-colors hover:border-[var(--color-accent)]/55 hover:text-[var(--color-accent)]"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="osrs-body grid grid-cols-2 gap-2 p-5 sm:grid-cols-4 sm:p-6">
              {INTAKE_SESSION_CHOICES.map((choice) => {
                const selected = selectedRouteLens === choice.routeLens;
                return (
                  <button
                    key={choice.id}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => {
                      setSelectedRouteLens(choice.routeLens);
                      runWithRoute(choice);
                    }}
                    className={cn(
                      "min-h-[82px] rounded-lg border px-3 py-3 text-left transition-colors",
                      selected
                        ? "border-[var(--color-accent)] bg-[var(--color-accent)]/16 text-[var(--color-text)]"
                        : "border-[var(--color-parchment-edge)]/70 bg-[var(--color-parchment-dark)]/45 text-[var(--color-text-dim)] hover:border-[var(--color-accent)] hover:text-[var(--color-text)]"
                    )}
                  >
                    <span className="block text-[14px] font-bold text-[var(--color-text)]">{choice.label}</span>
                    <span className="mt-1 block text-[11.5px] leading-snug text-[var(--color-text-muted)]">{choice.helper}</span>
                  </button>
                );
              })}
            </div>

            <div className="osrs-body flex flex-col gap-2 border-t border-[var(--color-parchment-edge)] px-5 pb-5 sm:flex-row sm:px-6 sm:pb-6">
              <button
                type="button"
                onClick={() => runWithRoute()}
                className="btn-primary h-11 flex-1 justify-center px-4 text-[14px]"
              >
                Plan best route
                <ArrowRight className="size-4" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowRoutePicker(false);
                  setShowBankField(true);
                }}
                className="btn-ghost h-11 justify-center px-4 text-[13px] font-bold"
              >
                <ClipboardPaste className="size-4" />
                {hasAttachedBank ? "Review bank" : "Add bank first"}
              </button>
            </div>
          </div>
        </div>
      )}

      <AddBankModal
        open={showBankField}
        onClose={() => setShowBankField(false)}
        rsn={rsn}
        initialBank={attachedBank}
        source="next"
        onSaved={(savedBank) => setBank(savedBank)}
      />

      {/* Tertiary: sample run, no input needed */}
      <div className="mt-4 text-center">
        <button
          type="button"
          onClick={() => onRun({ sample: true })}
          disabled={loading}
          className="text-[12.5px] text-[var(--color-text-dim)] hover:text-[var(--color-text)] underline underline-offset-4 decoration-dotted transition-colors disabled:opacity-50"
        >
          Try a {SAMPLE_LABEL}
        </button>
      </div>

      <p className="mt-8 text-[11.5px] text-[var(--color-text-muted)] text-center leading-relaxed">
        {cameFromPlugin
          ? "RuneLite is optional. If it finds this RSN, Scapestack can avoid progress you already finished. Your bank stays in this browser."
          : "Free. Your bank stays in this browser."}
      </p>
    </section>
  );
}

function ResultView({ result, bankItems, bankSource, activeRsn, onEdit, onBossOpen, onClearStoredBankHandoff, expectedPluginSync, routeIntent, goalRouteFocus, initialRouteChoice, planRequestedAt, isFirstRun }: {
  result: NextUpResult;
  bankItems: BankHandoffItem[];
  bankSource: NextBankSource;
  activeRsn: string;
  onEdit: () => void;
  // Called when the user clicks a KC-rec to open the boss detail modal.
  // /next threads this from NextClient down to the trip card + compact rows.
  onBossOpen: (slug: string) => void;
  onClearStoredBankHandoff: () => void;
  expectedPluginSync: boolean;
  routeIntent: NextIntentPreset | null;
  goalRouteFocus: GoalRouteFocus | null;
  initialRouteChoice: InitialRouteChoice | null;
  planRequestedAt: number | null;
  isFirstRun: boolean;
}) {
  const { headline, rest, summary } = result;

  const basisNote =
    summary.basis === "full" ? "Bank and stats are shaping this pick."
    : summary.basis === "hiscores-only" ? "Your OSRS name is enough. Add bank only when GP or supplies change the answer."
    : summary.basis === "bank-only" ? "Bank is enough for a rough plan. Add your OSRS name for stats and KC."
    : "Add your OSRS name or bank when you want a sharper plan.";

  // Alle recommendations voor de What-to-do track. Mood-laag herrangschikt
  // ze; "Also worth knowing" is verdwenen — niet-getoonde recs blijven
  // beschikbaar via de drill-in cards in Where-you-are.
  const focusedUnlock = goalRouteFocus ? recommendationForGoalRoute(goalRouteFocus, activeRsn) : null;
  const allRecs = focusedUnlock
    ? [focusedUnlock, ...(headline ? [headline, ...rest] : rest).filter((rec) => rec.id !== focusedUnlock.id)]
    : headline ? [headline, ...rest] : rest;

  // Track-stagger: elke sectie fade'd binnen met 150ms verschil zodat
  // de pagina vouwt-open ipv pop-in. Gebruikt CSS animation-delay
  // (geen JS-timers) zodat motion-prefers-reduced-motion users niets
  // zien dat ze niet willen.
  const trackAnim = (delayMs: number): React.CSSProperties => ({
    animation: "track-in 0.6s cubic-bezier(0.22, 1, 0.36, 1) both",
    animationDelay: `${delayMs}ms`,
  });
  const pluginSyncSummary = result.pathProgress.syncedSources?.scapestack
    ? summarizeNextPluginSync(result.pathProgress.syncedSources.scapestack)
    : null;
  const pluginSyncState = pluginSyncSummary?.state ?? null;

  return (
    <div className="space-y-6">
      {/* The first screen is the product: one clean trip first, options later. */}
      <div style={trackAnim(0)}>
        <WhatToDo
          allRecs={allRecs}
          activeRsn={activeRsn}
          accountStage={summary.accountStage}
          accountType={summary.accountType}
          accountMode={summary.accountMode}
          maxEstimate={result.maxEstimate}
          hasBankContext={bankItems.length > 0}
          bankItems={bankItems}
          onBossOpen={onBossOpen}
          onEdit={onEdit}
          routeIntent={routeIntent}
          initialRouteChoice={initialRouteChoice}
          pluginSyncState={pluginSyncState}
          pluginSyncSummary={pluginSyncSummary}
          syncResult={result}
          bankSource={bankSource}
          planRequestedAt={planRequestedAt}
        />
      </div>

      <FirstPlanSharpening
        activeRsn={activeRsn}
        hasBank={bankItems.length > 0}
        hasRunelite={pluginSyncState === "live"}
        firstRun={isFirstRun}
      />

      <div style={trackAnim(150)}>
        <details className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-panel)]/55 p-4 sm:p-5">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-[13px] font-bold text-[var(--color-text)] marker:hidden">
            <span>More routes</span>
            <span className="text-[11.5px] font-semibold text-[var(--color-text-muted)]">
              Quests, diaries and bank checks after this trip
            </span>
          </summary>
          <div className="mt-4 space-y-4">
            <NextBestActionsPanel actions={result.nextBestActions} />
            <RouteProgressBoard
              allRecs={allRecs}
              pathData={result.pathProgress}
              bankItems={bankItems}
              readiness={result.readiness}
              accountType={summary.accountType}
              accountMode={summary.accountMode}
              actionContext={{ from: "next", hasBankContext: bankItems.length > 0, rsn: activeRsn }}
              onBossOpen={onBossOpen}
            />
          </div>
        </details>
      </div>

      <div style={trackAnim(300)}>
        <details className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-panel)]/55 p-4 sm:p-5">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-[13px] font-bold text-[var(--color-text)] marker:hidden">
            <span>Why this trip?</span>
            <span className="text-[11.5px] font-semibold text-[var(--color-text-muted)]">
              What changed, what is close and how to make the pick sharper
            </span>
          </summary>
          <div className="mt-4 space-y-6">
            {headline && (
              <RecDetailPanel
                rec={headline}
                actionContext={{ from: "next", hasBankContext: bankItems.length > 0, rsn: activeRsn, accountType: summary.accountMode.type }}
              />
            )}
            <HeroStrip summary={summary} basisNote={basisNote} onEdit={onEdit} />
            <RouteNeeds
              pathData={result.pathProgress}
              maxEstimate={result.maxEstimate}
            />
            <BankProgressSection progress={result.readiness} />
            <MakePlanSmarter
              headline={headline}
              summary={summary}
              basisNote={basisNote}
              bankItems={bankItems}
              bankSource={bankSource}
              activeRsn={activeRsn}
              pluginSyncState={pluginSyncState}
              expectedPluginSync={expectedPluginSync}
              onEdit={onEdit}
              onClearStoredBankHandoff={onClearStoredBankHandoff}
            />
          </div>
        </details>
      </div>

      <div className="pt-2" style={trackAnim(450)}>
        <SupportCard />
      </div>
    </div>
  );
}

function FirstPlanSharpening({
  activeRsn,
  hasBank,
  hasRunelite,
  firstRun
}: {
  activeRsn: string;
  hasBank: boolean;
  hasRunelite: boolean;
  firstRun: boolean;
}) {
  const [visible, setVisible] = useState(false);
  const [open, setOpen] = useState(false);
  const [bankOpen, setBankOpen] = useState(false);
  const sharpenDialogRef = useDialogA11y<HTMLDivElement>(open, () => setOpen(false));

  useEffect(() => {
    if (!firstRun || (hasBank && hasRunelite)) return;
    const key = `scapestack:first-plan-sharpened:${activeRsn.trim().toLowerCase()}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch {
      // The optional prompt can still appear when session storage is unavailable.
    }
    setVisible(true);
  }, [activeRsn, firstRun, hasBank, hasRunelite]);

  if (!visible && !open && !bankOpen) return null;

  const syncHref = pluginVerifyUrlForSyncedRsn(activeRsn, "next", { hasBankContext: hasBank });

  return (
    <>
      {visible && (
        <div className="flex flex-col gap-3 border-y border-[var(--color-border)] py-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[13px] font-bold text-[var(--color-text)]">Your first plan is ready.</p>
            <p className="mt-0.5 text-[11.5px] leading-relaxed text-[var(--color-text-muted)]">
              Add gear or finished progress only when you want the next pick sharper.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => setOpen(true)}
              aria-haspopup="dialog"
              aria-expanded={open}
              className="btn-ghost min-h-10 justify-center px-3 text-[12px] font-bold"
            >
              Sharpen next plan
              <ArrowRight className="size-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setVisible(false)}
              className="px-2 py-2 text-[11.5px] font-semibold text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text)]"
            >
              Not now
            </button>
          </div>
        </div>
      )}

      {open && (
        <div
          className="fixed inset-0 z-[110] grid place-items-center bg-black/72 px-4 py-8 backdrop-blur-sm"
        >
          <button
            type="button"
            tabIndex={-1}
            aria-label="Close optional setup"
            className="absolute inset-0 cursor-default"
            onClick={() => setOpen(false)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="first-plan-sharpen-title"
            aria-describedby="first-plan-sharpen-description"
            ref={sharpenDialogRef}
            tabIndex={-1}
            className="osrs-frame relative w-full max-w-lg text-left"
          >
            <div className="osrs-title-bar flex items-start justify-between gap-4 px-5 py-4">
              <div>
                <p className="eyebrow text-[var(--color-accent)]">Optional</p>
                <h2 id="first-plan-sharpen-title" className="mt-1 text-[22px] font-semibold leading-tight text-[var(--color-text)]">
                  Make the next pick sharper
                </h2>
                <p id="first-plan-sharpen-description" className="sr-only">
                  Choose bank or RuneLite to improve the next Scapestack plan.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close optional setup"
                className="inline-flex size-9 shrink-0 items-center justify-center rounded-full border border-[var(--color-border)] text-[var(--color-text-muted)] transition-colors hover:border-[var(--color-accent)]/55 hover:text-[var(--color-accent)]"
              >
                <X className="size-4" />
              </button>
            </div>
            <div className="osrs-body grid gap-2 p-5 sm:grid-cols-2">
              {!hasBank && (
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    setVisible(false);
                    setBankOpen(true);
                  }}
                  className="min-h-[92px] rounded-lg border border-[var(--color-parchment-edge)]/70 bg-[var(--color-parchment-dark)]/45 p-4 text-left transition-colors hover:border-[var(--color-accent)]"
                >
                  <ClipboardPaste className="size-4 text-[var(--color-accent)]" />
                  <span className="mt-3 block text-[14px] font-bold text-[var(--color-text)]">Add bank</span>
                  <span className="mt-1 block text-[11.5px] leading-relaxed text-[var(--color-text-muted)]">Use owned gear, supplies and GP next time.</span>
                </button>
              )}
              {!hasRunelite && (
                <Link
                  href={syncHref}
                  className="min-h-[92px] rounded-lg border border-[var(--color-parchment-edge)]/70 bg-[var(--color-parchment-dark)]/45 p-4 text-left transition-colors hover:border-[var(--color-accent)]"
                >
                  <Sparkles className="size-4 text-[var(--color-accent)]" />
                  <span className="mt-3 block text-[14px] font-bold text-[var(--color-text)]">Add RuneLite</span>
                  <span className="mt-1 block text-[11.5px] leading-relaxed text-[var(--color-text-muted)]">Skip quests, diaries and clog progress already finished.</span>
                </Link>
              )}
            </div>
            <div className="osrs-body border-t border-[var(--color-parchment-edge)] px-5 pb-5">
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  setVisible(false);
                }}
                className="btn-ghost min-h-10 w-full justify-center text-[12px] font-bold"
              >
                Keep this plan
              </button>
            </div>
          </div>
        </div>
      )}

      <AddBankModal
        open={bankOpen}
        onClose={() => setBankOpen(false)}
        rsn={activeRsn}
        source="next"
        onSaved={() => setBankOpen(false)}
      />
    </>
  );
}

function NextBestActionsPanel({ actions }: { actions: NextBestAction[] }) {
  if (actions.length === 0) return null;

  return (
    <section className="rounded-lg border border-[var(--color-border)] bg-[var(--color-panel)]/78 p-4 sm:p-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--color-accent)]">Closest unlocks</div>
          <h2 className="mt-1 text-[18px] font-semibold leading-tight text-[var(--color-text)]">
            More unlock moves
          </h2>
        </div>
        <span className="scapestack-status-badge" data-tone="prep">
          Skills · quests · bank · mode
        </span>
      </div>

      <div className="mt-4 divide-y divide-[var(--color-border)]/70">
        {actions.slice(0, 5).map((action) => {
          const body = (
            <div className="group grid gap-3 py-3 sm:grid-cols-[42px_minmax(0,1fr)_auto] sm:items-start">
              <div className="flex size-10 items-center justify-center rounded-md border border-[var(--color-border)] bg-black/20">
                {action.iconItemId ? (
                  <ItemSprite id={action.iconItemId} alt="" className="pixelated max-h-8 max-w-8" />
                ) : (
                  <Target className="size-4 text-[var(--color-accent)]" />
                )}
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-[14px] font-semibold leading-snug text-[var(--color-text)]">{action.title}</h3>
                  <span className="scapestack-status-badge" data-tone={action.kind === "do-quest" || action.kind === "do-diary" ? "ready" : "prep"}>
                    {action.preparation} prep
                  </span>
                  <span className="scapestack-status-badge">
                    Unlock {action.unlockValue}/100
                  </span>
                </div>
                <p className="mt-1 text-[12px] leading-relaxed text-[var(--color-text-muted)]">{action.reason}</p>
                <div className="mt-2 grid gap-2 text-[11.5px] text-[var(--color-text-muted)] sm:grid-cols-2">
                  <ActionSnippet
                    label="Missing"
                    value={action.missingRequirements.length > 0 ? action.missingRequirements.slice(0, 3).join(", ") : "None visible"}
                  />
                  <ActionSnippet
                    label="Items"
                    value={action.requiredItems.length > 0 ? action.requiredItems.slice(0, 3).join(", ") : "No required items flagged"}
                  />
                </div>
                {action.accountTypeNote && (
                  <p className="mt-2 text-[11.5px] leading-relaxed text-[var(--color-accent)]">{action.accountTypeNote}</p>
                )}
              </div>
              <div className="flex items-center gap-2 sm:justify-end">
                <span className="text-[11px] font-semibold text-[var(--color-text-muted)]">{action.relevantQuestOrUnlock}</span>
                <ChevronRight className="size-4 text-[var(--color-text-muted)] transition-transform group-hover:translate-x-0.5" />
              </div>
            </div>
          );

          return action.link ? (
            <Link key={action.id} href={action.link} className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]">
              {body}
            </Link>
          ) : (
            <div key={action.id}>{body}</div>
          );
        })}
      </div>
    </section>
  );
}

function ActionSnippet({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-md border border-[var(--color-border)]/70 bg-black/10 px-3 py-2">
      <div className="text-[9.5px] font-bold uppercase tracking-[0.14em] text-[var(--color-text-muted)]">{label}</div>
      <div className="mt-0.5 truncate font-medium text-[var(--color-text)]" title={value}>{value}</div>
    </div>
  );
}

type RouteLaneId =
  | "barrows-gloves"
  | "fairy-rings"
  | "piety"
  | "avas-assembler"
  | "dragon-defender"
  | "quest-cape"
  | "raids-prep"
  | "slayer-unlocks";

type RouteLaneDefinition = {
  id: RouteLaneId;
  title: string;
  payoff: string;
  iconItemId: number;
  query: RegExp;
  ownedItemIds?: number[];
  fallback: string;
};

const SESSION_ROUTE_LANES: RouteLaneDefinition[] = [
  {
    id: "barrows-gloves",
    title: "Barrows gloves route",
    payoff: "Best mid-game glove slot and a major quest-account spine.",
    iconItemId: 7462,
    query: /barrows|recipe for disaster|gloves/i,
    ownedItemIds: [7462],
    fallback: "Open the quest route before committing to random skilling."
  },
  {
    id: "fairy-rings",
    title: "Fairy rings route",
    payoff: "Cuts travel time for quests, clues, herb runs and Slayer.",
    iconItemId: 772,
    query: /fairy rings|fairytale|fairy/i,
    fallback: "Check Fairytale I/II gaps, then unlock ring access."
  },
  {
    id: "piety",
    title: "Piety route",
    payoff: "Permanent melee DPS upgrade for quests, Slayer and bossing.",
    iconItemId: 2413,
    query: /piety|prayer.*70|protection prayers|prayer/i,
    fallback: "Check Prayer and Knight Waves gaps before a long combat grind."
  },
  {
    id: "avas-assembler",
    title: "Ava's assembler route",
    payoff: "Cleaner ranged trips and less ammo waste.",
    iconItemId: 22109,
    query: /ava|animal magnetism|assembler|accumulator|vorkath/i,
    ownedItemIds: [10499, 22109],
    fallback: "Get Ava's device first; assembler comes after Vorkath's head."
  },
  {
    id: "dragon-defender",
    title: "Dragon defender route",
    payoff: "Core melee off-hand for Slayer and early bossing.",
    iconItemId: 12954,
    query: /dragon defender|defender|warriors'? guild/i,
    ownedItemIds: [12954],
    fallback: "Get the defender before upgrading small melee pieces."
  },
  {
    id: "quest-cape",
    title: "Quest cape route",
    payoff: "Unlocks large chunks of the account and cleans up route gaps.",
    iconItemId: 9813,
    query: /quest cape|quest|diary|unlock/i,
    ownedItemIds: [9813],
    fallback: "Pick the closest quest gap, not another generic XP session."
  },
  {
    id: "raids-prep",
    title: "Raids prep route",
    payoff: "Turns gear, prayers and quest unlocks into team-ready PvM.",
    iconItemId: 20997,
    query: /raid|cox|xeric|toa|tombs|chambers|olm|bowfa|trident|zulrah|vorkath|boss/i,
    fallback: "Confirm prayers, gear and one boss-readiness step before raids."
  },
  {
    id: "slayer-unlocks",
    title: "Slayer unlock route",
    payoff: "Tasks, points and unlocks that feed PvM progression.",
    iconItemId: 11864,
    query: /slayer|task|kurask|abyssal|kraken|hydra/i,
    fallback: "Check task, points and next Slayer level before skipping."
  }
];

function routeLaneAccountNote(id: RouteLaneId, accountType: PlannerAccountType | null): string | null {
  if (!accountType) return null;
  if (isUltimatePlannerAccount(accountType)) {
    if (id === "barrows-gloves" || id === "fairy-rings" || id === "quest-cape") {
      return "UIM route: stage/carry items before starting; do not treat bank checks as ready.";
    }
    return "UIM route: shorter staging actions beat long bank-dependent plans.";
  }
  if (accountType === "hardcore") {
    if (id === "raids-prep") return "HCIM route: risky PvM stays lower unless the payoff is worth it.";
    return "HCIM route: source safely first; avoid risky gaps when a safer unlock is close.";
  }
  if (accountType === "group") {
    return "GIM route: own bank is checked; group storage is not verified.";
  }
  if (accountType === "ironman") {
    if (id === "piety" || id === "raids-prep") return "Iron route: source supplies and prayer/gear upgrades yourself.";
    if (id === "fairy-rings") return "Iron route: travel unlocks beat buying convenience.";
    return "Iron route: missing items need source hints, not GE assumptions.";
  }
  return null;
}

function bankHasAnyItem(bankItems: BankHandoffItem[], ids: number[] | undefined): boolean {
  if (!ids?.length) return false;
  const owned = new Set(bankItems.map((item) => item.id));
  return ids.some((id) => owned.has(id));
}

function routeLaneMatch(definition: RouteLaneDefinition, recs: Recommendation[]): Recommendation | null {
  return recs.find((rec) => definition.query.test(`${rec.id} ${rec.title} ${rec.why} ${rec.payoff ?? ""}`)) ?? null;
}

function routeLaneStatus({
  definition,
  rec,
  bankItems,
  pathData,
  accountType
}: {
  definition: RouteLaneDefinition;
  rec: Recommendation | null;
  bankItems: BankHandoffItem[];
  pathData: NextUpResult["pathProgress"];
  accountType: PlannerAccountType | null;
}): { label: string; detail: string; tone: "good" | "warn" | "neutral"; href?: string } {
  if (bankHasAnyItem(bankItems, definition.ownedItemIds)) {
    if (isUltimatePlannerAccount(accountType)) {
      return {
        label: "Stage it",
        detail: "Key item is owned; treat it as carry/storage prep, not a normal bank pull.",
        tone: "good"
      };
    }
    return {
      label: accountType === "group" ? "Own bank" : accountType === "ironman" || accountType === "hardcore" ? "Self-sourced" : "In bank",
      detail: accountType === "group"
        ? "Key item is in your synced bank; group storage is not counted."
        : accountType === "ironman" || accountType === "hardcore"
          ? "Key item is already sourced in this bank."
          : "Key item is in this bank.",
      tone: "good"
    };
  }

  if (rec) {
    return {
      label: "Next action",
      detail: rec.decisionReason || rec.why,
      tone: "warn",
      href: rec.link
    };
  }

  if (definition.id === "quest-cape") {
    const quests = pathData.paths.find((path) => path.kind === "quests");
    if (quests && quests.percent >= 98) {
      return {
        label: "Nearly done",
        detail: quests.nextSteps[0]?.title ?? "Finish the last visible quest gap.",
        tone: "good"
      };
    }
    if (quests) {
      return {
        label: `${quests.percent}% route`,
        detail: quests.nextSteps[0]?.title ?? definition.fallback,
        tone: "neutral"
      };
    }
  }

  return {
    label: "Check gaps",
    detail: definition.fallback,
    tone: "neutral"
  };
}

function RouteProgressBoard({
  allRecs,
  pathData,
  bankItems,
  readiness,
  accountType,
  accountMode,
  actionContext,
  onBossOpen
}: {
  allRecs: Recommendation[];
  pathData: NextUpResult["pathProgress"];
  bankItems: BankHandoffItem[];
  readiness: SetCompletion[];
  accountType: PlannerAccountType | null;
  accountMode: NextUpResult["summary"]["accountMode"];
  actionContext: RecommendationActionContext;
  onBossOpen: (slug: string) => void;
}) {
  const questRecs = allRecs.filter((rec) => rec.kind === "quest" || rec.kind === "diary").slice(0, 3);
  const bankGaps = readiness.slice(0, 3);
  return (
    <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-panel)]/60 p-4 sm:p-5">
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="text-[10.5px] font-bold uppercase tracking-[0.18em] text-[var(--color-accent)]">
            Routes to inspect
          </div>
          <h2 className="mt-1 text-[21px] font-bold tracking-normal text-[var(--color-text)]">
            Unlock gaps
          </h2>
          <p className="mt-1 max-w-2xl text-[12.5px] leading-relaxed text-[var(--color-text-muted)]">
            Barrows gloves, fairy rings, Piety, Ava&apos;s, defender, quest cape, raids prep and Slayer.
          </p>
        </div>
        <AccountModeBadge accountMode={accountMode} compact showSourceCopy />
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {SESSION_ROUTE_LANES.map((definition) => {
          const rec = routeLaneMatch(definition, allRecs);
          const status = routeLaneStatus({ definition, rec, bankItems, pathData, accountType });
          const accountNote = routeLaneAccountNote(definition.id, accountType);
          const href = status.href ? recommendationHrefWithContext(status.href, actionContext) : undefined;
          return (
            <article
              key={definition.id}
              className={cn(
                "scapestack-route-row min-h-[150px] p-3",
                status.tone === "good"
                  ? "border-[var(--color-good)]/25"
                  : status.tone === "warn"
                    ? "border-[var(--color-warning)]/28"
                    : "border-[var(--color-border)]"
              )}
            >
              <div className="flex items-start gap-2.5">
                <div className="grid size-10 shrink-0 place-items-center rounded-md border border-[var(--color-border)] bg-[var(--color-bg)]/45">
                  <ItemSprite id={definition.iconItemId} alt="" size={26} />
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <h3 className="text-[13px] font-bold leading-snug text-[var(--color-text)]">{definition.title}</h3>
                    <span
                      className="scapestack-status-badge"
                      data-tone={status.tone === "good" ? "ready" : status.tone === "warn" ? "prep" : undefined}
                    >
                      {status.label}
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] leading-snug text-[var(--color-text-muted)]">{definition.payoff}</p>
                </div>
              </div>
              <p className="mt-3 line-clamp-3 border-t border-[var(--color-border)] pt-2 text-[11.5px] font-semibold leading-relaxed text-[var(--color-text-dim)]">
                {status.detail}
              </p>
              {accountNote && (
                <p className="mt-2 rounded-md border border-[var(--color-border)]/70 bg-[var(--color-bg)]/25 px-2 py-1.5 text-[10.5px] font-semibold leading-snug text-[var(--color-warning)]">{accountNote}</p>
              )}
              {href && (
                <Link
                  href={href}
                  className="mt-2 inline-flex items-center gap-1.5 text-[11.5px] font-bold text-[var(--color-accent)] hover:underline"
                >
                  Open route
                  <ArrowRight className="size-3" />
                </Link>
              )}
            </article>
          );
        })}
      </div>

      {(questRecs.length > 0 || bankGaps.length > 0) && (
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          <QuestReadySoonRail
            recs={questRecs}
            actionContext={actionContext}
            onBossOpen={onBossOpen}
          />
          <BankGapsRail progress={bankGaps} />
        </div>
      )}
    </section>
  );
}

function QuestReadySoonRail({
  recs,
  actionContext
}: {
  recs: Recommendation[];
  actionContext: RecommendationActionContext;
  onBossOpen: (slug: string) => void;
}) {
  if (recs.length === 0) return (
    <div className="scapestack-route-row p-3">
      <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--color-accent)]">Quests and diaries almost ready</div>
      <p className="mt-2 text-[12px] leading-relaxed text-[var(--color-text-muted)]">
        Add RSN or RuneLite sync to see which quest or diary unlock is nearly ready.
      </p>
    </div>
  );

  return (
    <div className="scapestack-route-row p-3">
      <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--color-accent)]">Quests and diaries almost ready</div>
      <div className="scapestack-session-list mt-2">
        {recs.map((rec) => {
          const action = primaryActionForRecommendation(rec, actionContext);
          const href = recommendationHrefWithContext(action.href ?? rec.link ?? "/next", actionContext);
          return (
            <Link
              key={rec.id}
              href={href}
              className="flex items-start gap-2 py-2 transition-colors hover:text-[var(--color-accent)]"
            >
              <KindGlyph kind={rec.kind} size={18} tone="accent" />
              <span className="min-w-0 flex-1">
                <span className="block text-[12px] font-bold leading-snug text-[var(--color-text)]">{rec.title}</span>
                <span className="mt-0.5 block line-clamp-2 text-[11px] leading-snug text-[var(--color-text-muted)]">
                  {rec.decisionReason || rec.why}
                </span>
              </span>
              <ArrowRight className="mt-0.5 size-3.5 shrink-0 text-[var(--color-accent)]" />
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function BankGapsRail({ progress }: { progress: SetCompletion[] }) {
  if (progress.length === 0) {
    return (
      <div className="scapestack-route-row p-3">
        <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--color-accent)]">Items missing</div>
        <p className="mt-2 text-[12px] leading-relaxed text-[var(--color-text-muted)]">
          Add bank to see near-complete sets and missing pieces.
        </p>
      </div>
    );
  }

  return (
    <div className="scapestack-route-row p-3">
      <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--color-accent)]">Items missing</div>
      <div className="scapestack-session-list mt-2">
        {progress.map((completion) => {
          const set = GOAL_SETS.find((candidate) => candidate.id === completion.setId);
          if (!set) return null;
          const norm = normaliseCompletion(completion, set);
          const missing = set.goals.filter((goal) => !completion.perGoal[goal.id]?.satisfied);
          return (
            <div key={completion.setId} className="py-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[12px] font-bold text-[var(--color-text)]">{set.name}</span>
                <span className="scapestack-status-badge" data-tone="prep">
                  {norm.progress}/{norm.max}
                </span>
              </div>
              <p className="mt-1 line-clamp-2 text-[11px] leading-snug text-[var(--color-text-muted)]">
                {missing.length > 0
                  ? `Still missing: ${missing.slice(0, 3).map((goal) => goal.name).join(", ")}`
                  : "Looks complete in this bank."}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MakePlanSmarter({
  headline,
  summary,
  basisNote,
  bankItems,
  bankSource,
  activeRsn,
  pluginSyncState,
  expectedPluginSync,
  onEdit,
  onClearStoredBankHandoff
}: {
  headline: Recommendation | null;
  summary: NextUpResult["summary"];
  basisNote: string;
  bankItems: BankHandoffItem[];
  bankSource: NextBankSource;
  activeRsn: string;
  pluginSyncState: "live" | "stale" | "outdated" | null;
  expectedPluginSync: boolean;
  onEdit: () => void;
  onClearStoredBankHandoff: () => void;
}) {
  const hasBank = bankItems.length > 0 || summary.basis === "full" || summary.basis === "bank-only";
  const hasRsn = Boolean(activeRsn.trim());
  const syncHref = pluginVerifyUrlForSyncedRsn(activeRsn, "next", { hasBankContext: hasBank });
  const contextCopy = makePlanSmarterCopy(headline);

  return (
    <details className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-panel)]/65 p-4 sm:p-5">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 marker:hidden">
        <span>
          <span className="block text-[13px] font-bold text-[var(--color-text)]">{contextCopy.title}</span>
          <span className="mt-0.5 block text-[11.5px] font-medium text-[var(--color-text-muted)]">
            {contextCopy.helper}
          </span>
        </span>
        <span className="shrink-0 rounded-full border border-[var(--color-border)] px-2.5 py-1 text-[10.5px] font-bold text-[var(--color-text-muted)]">
          Details
        </span>
      </summary>

      <div className="mt-4 space-y-4">
        <div className="grid gap-2 sm:grid-cols-3">
          <PlanInputTile
            label="OSRS name"
            value={hasRsn ? activeRsn : "Add name"}
            helper={hasRsn ? "Stats, combat and KC are in the plan." : "Adds skills, combat and KC."}
            tone={hasRsn ? "good" : "muted"}
          />
          <PlanInputTile
            label={contextCopy.bankLabel}
            value={hasBank ? "Loaded" : "Optional"}
            helper={hasBank ? contextCopy.loadedHelper : contextCopy.emptyHelper}
            tone={hasBank ? "good" : "muted"}
          />
          <PlanInputTile
            label="RuneLite"
            value={pluginSyncState === "live" ? "Helping" : pluginSyncState ? "Refresh" : "Optional"}
            helper={pluginSyncState === "live"
              ? "Skips finished quests, diaries, clog slots and Slayer mistakes."
              : "Use it when finished progress would change the pick."}
            tone={pluginSyncState === "live" ? "good" : pluginSyncState ? "warn" : "muted"}
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onEdit}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)]/45 px-3 py-2 text-[11.5px] font-semibold text-[var(--color-text)] transition-colors hover:border-[var(--color-accent)]/45 hover:text-[var(--color-accent)]"
          >
            Change input
            <Edit3 className="size-3.5" />
          </button>
          {!hasBank && (
            <Link
              href={bankOrganizerHref(activeRsn, "next")}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)]/45 px-3 py-2 text-[11.5px] font-semibold text-[var(--color-text)] transition-colors hover:border-[var(--color-accent)]/45 hover:text-[var(--color-accent)]"
            >
              {contextCopy.bankCta}
              <ArrowRight className="size-3.5" />
            </Link>
          )}
          {pluginSyncState !== "live" && (
            <Link
              href={syncHref}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-accent)]/35 bg-[var(--color-accent)]/10 px-3 py-2 text-[11.5px] font-semibold text-[var(--color-accent)] transition-colors hover:bg-[var(--color-accent)]/15"
            >
              Check RuneLite
              <Sparkles className="size-3.5" />
            </Link>
          )}
        </div>

        <p className="text-[11.5px] leading-relaxed text-[var(--color-text-muted)]">{basisNote}</p>
        {expectedPluginSync && pluginSyncState !== "live" && (
          <div className="rounded-xl border border-[var(--color-warning)]/30 bg-[var(--color-warning)]/10 px-4 py-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-[12.5px] leading-relaxed text-[var(--color-text-dim)]">
                RuneLite did not show up yet. Sync again, then check this RSN.
              </p>
              <Link
                href={syncHref}
                className="inline-flex w-fit items-center gap-1.5 rounded-lg border border-[var(--color-warning)]/35 bg-[var(--color-bg)]/35 px-3 py-2 text-[11.5px] font-semibold text-[var(--color-warning)] transition-colors hover:bg-[var(--color-warning)]/10"
              >
                Check RuneLite
                <ArrowRight className="size-3.5" />
              </Link>
            </div>
          </div>
        )}
        <NextBankContextStrip
          bankItems={bankItems}
          bankSource={bankSource}
          basis={summary.basis}
          activeRsn={activeRsn}
          pluginSyncState={pluginSyncState}
          onClearStoredBankHandoff={onClearStoredBankHandoff}
        />
      </div>
    </details>
  );
}

function PlanInputTile({
  label,
  value,
  helper,
  tone
}: {
  label: string;
  value: string;
  helper: string;
  tone: "good" | "warn" | "muted";
}) {
  return (
    <div className={cn(
      "rounded-xl border px-3 py-2.5",
      tone === "good"
        ? "border-[var(--color-good)]/25 bg-[var(--color-good)]/10"
        : tone === "warn"
          ? "border-[var(--color-warning)]/25 bg-[var(--color-warning)]/10"
          : "border-[var(--color-border)] bg-[var(--color-bg)]/35"
    )}>
      <div className="text-[9.5px] font-bold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">
        {label}
      </div>
      <div className={cn(
        "mt-0.5 text-[12px] font-bold",
        tone === "good" ? "text-[var(--color-good)]" : tone === "warn" ? "text-[var(--color-warning)]" : "text-[var(--color-text-dim)]"
      )}>
        {value}
      </div>
      <p className="mt-1 text-[11px] leading-snug text-[var(--color-text-muted)]">{helper}</p>
    </div>
  );
}

function NextBankContextStrip({
  bankItems,
  bankSource,
  basis,
  activeRsn,
  pluginSyncState,
  onClearStoredBankHandoff
}: {
  bankItems: BankHandoffItem[];
  bankSource: NextBankSource;
  basis: NextUpResult["summary"]["basis"];
  activeRsn: string;
  pluginSyncState: "live" | "stale" | "outdated" | null;
  onClearStoredBankHandoff: () => void;
}) {
  const context = useMemo(() => buildNextBankContext(bankItems), [bankItems]);
  const [handoffCleared, setHandoffCleared] = useState(false);
  if (!context) return null;

  const hasLivePluginSync = pluginSyncState === "live";
  const hasPluginSync = pluginSyncState !== null;
  const isPluginBank = bankSource === "plugin";
  const bankLabel = isPluginBank
    ? "Bank ready"
    : hasPluginSync
      ? "Bank + RuneLite"
      : "Bank added";
  const basisCopy =
    isPluginBank && hasLivePluginSync
      ? "RuneLite bank is shaping gear, supplies and GP for this plan."
      : isPluginBank
        ? "RuneLite bank is loaded. Refresh RuneLite if your bank changed."
        : hasLivePluginSync && bankItems.length > 0
      ? "Bank and finished progress are both shaping this pick."
      : pluginSyncState === "stale"
        ? "Last scan needs a refresh before a long grind or GP spend."
        : pluginSyncState === "outdated"
          ? "RuneLite is connected, but update it before trusting newer details."
            : basis === "full"
              ? "Bank, goals and account gates are ranked together."
            : basis === "bank-only"
              ? "Bank added. Add an OSRS name next time for account gates."
              : "Bank added for item checks.";

  const backToBank = () => {
    if (typeof window === "undefined") return;
    if (document.referrer.includes("/bank")) {
      window.history.back();
      return;
    }
    window.location.href = bankOrganizerHref(activeRsn, "next");
  };

  return (
    <section className="rounded-xl border border-[var(--color-accent)]/30 bg-[var(--color-accent)]/8 px-4 py-3">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 gap-3">
          <span className="mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-lg border border-[var(--color-accent)]/25 bg-[var(--color-bg)]/40">
            <ItemSprite id={20594} alt="" size={25} />
          </span>
          <div className="min-w-0">
            <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--color-accent)]">
              {bankLabel}
            </div>
            {hasPluginSync && (
              <div className={cn(
                "mt-1 inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-[0.12em]",
                hasLivePluginSync
                  ? "border-[var(--color-good)]/25 bg-[var(--color-good)]/10 text-[var(--color-good)]"
                  : "border-[var(--color-warning)]/25 bg-[var(--color-warning)]/10 text-[var(--color-warning)]"
              )}>
                <CheckCircle2 className="size-3" />
                {hasLivePluginSync ? "Bank + RuneLite" : pluginSyncState === "outdated" ? "Update RuneLite" : "Refresh RuneLite"}
              </div>
            )}
            <p className="mt-1 text-[12.5px] leading-relaxed text-[var(--color-text-dim)]">
              <span className="font-semibold text-[var(--color-text)]">{context.summary.label}</span>
              {" · "}
              {basisCopy}
            </p>
            <p className="mt-1 text-[11px] leading-relaxed text-[var(--color-text-muted)]">
              {isPluginBank
                ? "RuneLite sent your bank items and quantities. Press Sync again when your bank changes."
                : "This bank stays in this browser and expires automatically. Clear it when you want Scapestack to ignore this bank."}
              {!isPluginBank && handoffCleared ? " Stored bank cleared; this current result keeps the plan it already made until you rerun." : ""}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {context.summary.topItems.map((item) => (
                <span
                  key={item.id}
                  className="inline-flex items-center gap-1.5 rounded-md border border-[var(--color-border)] bg-[var(--color-bg)]/45 px-2 py-1 text-[11px] text-[var(--color-text-dim)]"
                  title={`${item.name}: ${item.stackValue.toLocaleString()} gp`}
                >
                  <ItemSprite id={item.id} alt="" size={15} />
                  <span className="max-w-[130px] truncate">{item.name}</span>
                  <span className="font-mono text-[var(--color-text-muted)]">{formatGp(item.stackValue)}</span>
                </span>
              ))}
              {context.topAreas.map((area) => (
                <span
                  key={area.name}
                  className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg-2)]/45 px-2 py-1 text-[11px] text-[var(--color-text-muted)]"
                  title={area.totalValue > 0 ? `${area.totalValue.toLocaleString()} gp` : undefined}
                >
                  {area.name} · {area.itemCount}
                </span>
              ))}
            </div>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2 lg:justify-end">
          <button
            type="button"
            onClick={backToBank}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-border-strong)] bg-[var(--color-bg)]/45 px-3 py-2 text-[11.5px] font-semibold text-[var(--color-text)] transition-colors hover:border-[var(--color-accent)]/45 hover:text-[var(--color-accent)]"
          >
            Review bank
            <ArrowRight className="size-3.5" />
          </button>
          {!isPluginBank && (
            <button
              type="button"
              onClick={() => {
                onClearStoredBankHandoff();
                setHandoffCleared(true);
              }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-border-strong)] bg-[var(--color-bg)]/45 px-3 py-2 text-[11.5px] font-semibold text-[var(--color-text)] transition-colors hover:border-[var(--color-danger)]/45 hover:text-[var(--color-danger)]"
            >
              Clear bank
              <Trash2 className="size-3.5" />
            </button>
          )}
          <Link
            href={toolHandoffUrl("/dps", "next", activeRsn)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-border-strong)] bg-[var(--color-bg)]/45 px-3 py-2 text-[11.5px] font-semibold text-[var(--color-text)] transition-colors hover:border-[var(--color-accent)]/45 hover:text-[var(--color-accent)]"
          >
            Check kill
            <Sword className="size-3.5" />
          </Link>
          <Link
            href={toolHandoffUrl("/goals", "next", activeRsn)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-border-strong)] bg-[var(--color-bg)]/45 px-3 py-2 text-[11.5px] font-semibold text-[var(--color-text)] transition-colors hover:border-[var(--color-accent)]/45 hover:text-[var(--color-accent)]"
          >
            Open unlocks
            <Target className="size-3.5" />
          </Link>
          <Link
            href={toolHandoffUrl("/slayer", "next", activeRsn)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-border-strong)] bg-[var(--color-bg)]/45 px-3 py-2 text-[11.5px] font-semibold text-[var(--color-text)] transition-colors hover:border-[var(--color-accent)]/45 hover:text-[var(--color-accent)]"
          >
            Check task
            <Shield className="size-3.5" />
          </Link>
          <Link
            href={toolHandoffUrl("/plugin", "next", activeRsn)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-accent)]/35 bg-[var(--color-accent)]/10 px-3 py-2 text-[11.5px] font-semibold text-[var(--color-accent)] transition-colors hover:bg-[var(--color-accent)]/15"
          >
            Check RuneLite
            <Sparkles className="size-3.5" />
          </Link>
        </div>
      </div>
    </section>
  );
}

// ── HeroStrip ──────────────────────────────────────────────────────────
// Eén compact account-identity strip. Bewust géén big hero — dat
// gevecht om aandacht voert "What to do" hieronder.

function HeroStrip({ summary, basisNote, onEdit }: {
  summary: NextUpResult["summary"];
  basisNote: string;
  onEdit: () => void;
}) {
  return (
    // Premium hero-card: lichte gradient, accent top-stripe, route sweep
    // van links naar rechts elke 6s. Voelt mee met de loader-vibe.
    <div
      className="relative overflow-hidden rounded-xl border border-[var(--color-border)] bg-gradient-to-br from-[var(--color-panel)] to-[var(--color-bg-2)] p-5 sm:p-6"
    >
      {/* Subtiele accent top-line — zelfde signature als de SyncedBadge
          en headline-card. Bindt het visueel aan de rest van /next. */}
      <div
        className="absolute inset-x-0 top-0 h-px"
        style={{ background: "linear-gradient(to right, transparent, rgba(200, 154, 61,0.55), transparent)" }}
      />
      {/* Sweep — zachte route-tint die elke 6s van links naar rechts wandelt.
          Subtieler dan de loader-spotlight (we zijn klaar met laden),
          maar geeft de card leven. */}
      <div
        className="pointer-events-none absolute inset-y-0 -inset-x-1/2 opacity-60"
        style={{
          background: "linear-gradient(90deg, transparent 0%, transparent 35%, rgba(200, 154, 61,0.06) 50%, transparent 65%, transparent 100%)",
          animation: "hero-sweep 6s linear infinite"
        }}
      />

      <div className="relative flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-3">
          {/* Vier metrics als één rij — primary stat per metric. */}
          <div className="flex flex-wrap gap-x-7 gap-y-3">
            {summary.combatLevel !== null && (
              <HeroStat icon={<Sword className="size-4 opacity-60" />} label="Combat" value={summary.combatLevel} />
            )}
            {summary.totalLevel !== null && (
              <HeroStat icon={<TrendingUp className="size-4 opacity-60" />} label="Total" value={summary.totalLevel} />
            )}
            <HeroStat
              icon={<Shield className="size-4 opacity-60" />}
              label="Mode"
              value={accountModeVisual(summary.accountMode.type, summary.accountMode.confidence).shortLabel}
            />
            {summary.goalPercent !== null && (
              <HeroStat
                icon={<Target className="size-4" />}
                label="Goals"
                value={`${summary.goalPercent}%`}
                accent
              />
            )}
          </div>
          <p className="text-[11.5px] text-[var(--color-text-muted)]">{basisNote}</p>
        </div>
        <button type="button" onClick={onEdit} className="btn-ghost relative z-10">
          <Edit3 className="size-3.5" /> Change input
        </button>
      </div>
    </div>
  );
}

function HeroStat({ icon, label, value, accent }: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  accent?: boolean;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
        {icon}
        {label}
      </div>
      <div
        className={cn(
          "text-[24px] sm:text-[28px] font-bold tabular-nums leading-none",
          accent ? "text-[var(--color-accent)]" : "text-[var(--color-text)]"
        )}
      >
        {value}
      </div>
    </div>
  );
}

// Renders a wiki NPC portrait for a kc-kind rec. Falls back to whatever
// KindGlyph would have shown if we can't resolve the boss (sprite 404,
// missing slug). `prominent` enables the pulsing route-ring halo for the
// headline-card variant. Hover rumble is always on — it's the "the boss
// notices you" cue that makes a KC-rec feel like more than a number.
function KcPortrait({ rec, size, prominent = false }: {
  rec: Recommendation;
  size: number;
  prominent?: boolean;
}) {
  const boss = rec.bossSlug ? BOSSES.find((b) => b.slug === rec.bossSlug) : undefined;
  if (!boss) {
    // Fallback identical to the non-kc path so the layout doesn't jump.
    return rec.iconItemId
      ? <ItemSprite
          id={rec.iconItemId}
          alt=""
          className="pixelated"
          style={{ maxWidth: "72%", maxHeight: "72%", imageRendering: "pixelated", filter: "drop-shadow(1px 1px 0 rgb(0 0 0 / 0.9))" }}
        />
      : <KindGlyph kind={rec.kind} size={size * 0.72} tone="accent" />;
  }
  return (
    <div
      className="size-full flex items-center justify-center rounded-md overflow-hidden transition-transform duration-200 group-hover:[animation:boss-rumble_0.4s_ease-in-out]"
      style={prominent ? { animation: "boss-halo 2.4s ease-in-out infinite" } : undefined}
    >
      <BossSprite boss={boss} size={size} />
    </div>
  );
}

type RouteIdentitySprite =
  | { type: "boss"; boss: Boss; slug: string; itemId?: number; label: string }
  | { type: "item"; itemId: number; label: string };

function uniqueRouteSprites(items: RouteIdentitySprite[]): RouteIdentitySprite[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = item.type === "boss" ? `boss:${item.slug}` : `item:${item.itemId}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function routeIdentityForRecommendation(rec: Recommendation): RouteIdentitySprite[] {
  const boss = rec.bossSlug ? BOSSES.find((candidate) => candidate.slug === rec.bossSlug) : null;
  const title = rec.title.toLowerCase();
  const id = rec.id.toLowerCase();
  const sprites: RouteIdentitySprite[] = [];

  if (boss) {
    sprites.push({ type: "boss", boss, slug: boss.slug, itemId: boss.iconItemId, label: boss.name });
    if (boss.iconItemId) sprites.push({ type: "item", itemId: boss.iconItemId, label: "Signature drop" });
  }

  if (rec.iconItemId) sprites.push({ type: "item", itemId: rec.iconItemId, label: "Unlock" });

  if (rec.kind === "bank" || /tidy|bank|gear/.test(title)) {
    sprites.push({ type: "item", itemId: ROUTE_ITEM_IDS.bank, label: "Bank" });
  }
  if (/karamja|diary|gloves/.test(title) || id.includes("karamja")) {
    sprites.push({ type: "item", itemId: ROUTE_ITEM_IDS.karamjaGloves, label: "Karamja gloves" });
  }
  if (/fairy/.test(title) || id.includes("fairy")) {
    sprites.push({ type: "item", itemId: ROUTE_ITEM_IDS.fairyRing, label: "Fairy ring" });
  }
  if (/slayer/.test(title) || rec.kind === "slayer") {
    sprites.push({ type: "item", itemId: ROUTE_ITEM_IDS.slayerHelmet, label: "Slayer helmet" });
  }
  if (/dagannoth|dks|prime|rex|supreme/.test(title) || id.includes("dks")) {
    sprites.push({ type: "item", itemId: ROUTE_ITEM_IDS.berserkerRing, label: "Berserker ring" });
    sprites.push({ type: "item", itemId: ROUTE_ITEM_IDS.seersRing, label: "Seers ring" });
    sprites.push({ type: "item", itemId: ROUTE_ITEM_IDS.archersRing, label: "Archers ring" });
  }
  if (/quest/.test(title) || rec.kind === "quest" || rec.kind === "milestone" || rec.kind === "goal") {
    sprites.push({ type: "item", itemId: ROUTE_ITEM_IDS.questCape, label: "Quest unlock" });
  }
  if (/defender/.test(title)) {
    sprites.push({ type: "item", itemId: ROUTE_ITEM_IDS.dragonDefender, label: "Dragon defender" });
  }
  if (/ava|assembler/.test(title)) {
    sprites.push({ type: "item", itemId: ROUTE_ITEM_IDS.avasAssembler, label: "Ava's assembler" });
  }
  if (/piety|prayer/.test(title)) {
    sprites.push({ type: "item", itemId: ROUTE_ITEM_IDS.pietyPrayer, label: "Prayer unlock" });
  }

  if (sprites.length === 0) {
    const itemId = KIND_META[rec.kind].iconItemId;
    if (itemId) sprites.push({ type: "item", itemId, label: KIND_META[rec.kind].label });
  }

  return uniqueRouteSprites(sprites).slice(0, 5);
}

function RouteIdentityStrip({ rec, active = false }: { rec: Recommendation; active?: boolean }) {
  const sprites = routeIdentityForRecommendation(rec);
  if (sprites.length === 0) return null;
  return (
    <div
      className="mt-3 flex flex-wrap items-start gap-2"
      aria-label={`OSRS route icons for ${rec.title}`}
      data-route-id-strip="true"
    >
      {sprites.map((sprite, index) => (
        <span
          key={sprite.type === "boss" ? `boss:${sprite.slug}` : `item:${sprite.itemId}`}
          title={sprite.label}
          data-route-boss-slug={sprite.type === "boss" ? sprite.slug : undefined}
          data-route-item-id={sprite.type === "boss" ? sprite.itemId : sprite.itemId}
          className={cn(
            "group/sprite inline-flex min-w-[52px] flex-col items-center gap-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)]/45 px-2 py-1.5 transition-transform duration-200",
            "hover:-translate-y-0.5 focus-within:-translate-y-0.5",
            active && "border-[var(--color-accent)]/35 bg-[var(--color-accent)]/8"
          )}
          style={active ? { animation: `pop-in 0.42s ease-out ${index * 70}ms both` } : undefined}
        >
          <span
            className="flex size-8 items-center justify-center rounded-md border border-[var(--color-border)] bg-black/30"
            title={sprite.label}
          >
            {sprite.type === "boss" ? (
              <BossSprite boss={sprite.boss} size={30} />
            ) : (
              <ItemSprite id={sprite.itemId} alt={sprite.label} size={26} className="pixelated" />
            )}
          </span>
          <span className="max-w-[86px] truncate text-[9px] font-black text-[var(--color-text-muted)]">
            {sprite.label}
          </span>
        </span>
      ))}
    </div>
  );
}

function RoutePrimarySprite({ rec, active = false }: { rec: Recommendation; active?: boolean }) {
  const sprite = routeIdentityForRecommendation(rec)[0] ?? null;
  return (
    <span
      className={cn(
        "grid size-11 shrink-0 place-items-center overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)]/45",
        active && "border-[var(--color-accent)]/40 bg-[var(--color-accent)]/10"
      )}
      title={sprite ? sprite.label : KIND_META[rec.kind].label}
      data-route-boss-slug={sprite?.type === "boss" ? sprite.slug : undefined}
      data-route-item-id={sprite?.type === "item" ? sprite.itemId : sprite?.itemId}
    >
      {sprite ? (
        sprite.type === "boss" ? (
          <BossSprite boss={sprite.boss} size={36} />
        ) : (
          <ItemSprite id={sprite.itemId} alt={sprite.label} size={32} className="pixelated" />
        )
      ) : (
        <KindGlyph kind={rec.kind} size={28} tone="accent" />
      )}
    </span>
  );
}

function RouteStepBrief({
  label,
  value,
  tone = "default"
}: {
  label: string;
  value: string;
  tone?: "default" | "accent";
}) {
  return (
    <div
      className={cn(
        "rounded-lg border px-3 py-2",
        tone === "accent"
          ? "border-[var(--color-accent)]/25 bg-[var(--color-accent)]/8"
          : "border-[var(--color-border)] bg-[var(--color-bg)]/35"
      )}
    >
      <div className="text-[9.5px] font-black uppercase tracking-[0.16em] text-[var(--color-text-muted)]">{label}</div>
      <div className="mt-1 min-w-0 break-words text-[11.5px] font-semibold leading-relaxed text-[var(--color-text-dim)] [overflow-wrap:anywhere]">{value}</div>
    </div>
  );
}

function RandomizeRoll({ active }: { active: boolean }) {
  if (!active) return null;
  return (
    <span
      className="inline-flex items-center gap-1 rounded-md border border-[var(--color-accent)]/25 bg-[var(--color-accent)]/8 px-2 py-1"
      data-randomize-roll-state="rolling"
      aria-hidden="true"
    >
      {RANDOMIZE_ROLL_IDS.slice(0, 5).map((id, index) => (
        <span
          key={`${id}:${index}`}
          className="inline-flex min-w-[30px] flex-col items-center gap-0.5 rounded border border-[var(--color-border)] bg-[var(--color-bg)]/65 px-1 py-0.5"
          style={{ animation: `pop-in 0.48s ease-out ${index * 85}ms infinite alternate` }}
        >
          <ItemSprite id={id} alt="" size={15} className="pixelated" />
          <span className="text-[7.5px] font-black leading-none text-[var(--color-text-muted)] tabular-nums">
            {id}
          </span>
        </span>
      ))}
    </span>
  );
}

function playerChoiceTag(rec: Recommendation): { label: string; helper: string } {
  if (rec.kind === "money") return { label: "GP", helper: "Pick this when you want cash or the next upgrade." };
  if (rec.kind === "boss" || rec.kind === "kc") return { label: "Bossing", helper: "Pick this when you want a PvM trip." };
  if (rec.kind === "skill") return { label: "AFK", helper: "Pick this when you want a low-pressure grind." };
  if (rec.kind === "bank" || rec.kind === "minigame") return { label: "Chill", helper: "Pick this when you want a lighter session." };
  if (rec.kind === "slayer") return { label: "Slayer", helper: "Pick this when the task should drive the session." };
  return { label: "Unlock", helper: "Pick this when you want quests, diary progress or account unlocks." };
}

function formatRuneLiteScanTime(syncedAt: string): string {
  const date = new Date(syncedAt);
  if (Number.isNaN(date.getTime())) return "scan time unknown";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

function runeLitePlanNote(pluginSyncSummary: NextPluginSyncSummary | null): string | null {
  const pluginSyncState = pluginSyncSummary?.state ?? null;
  const bank = pluginSyncSummary?.bankStatusLabel ? ` ${pluginSyncSummary.bankStatusLabel}.` : "";
  const memory = pluginSyncSummary?.memoryLines.length
    ? ` ${pluginSyncSummary.memoryLines.slice(0, 2).join(" · ")}.`
    : "";
  if (pluginSyncState === "live") {
    const syncedAt = pluginSyncSummary?.syncedAt
      ? `Last scan: ${formatRuneLiteScanTime(pluginSyncSummary.syncedAt)}.`
      : "Last scan is fresh.";
    return `${syncedAt}${memory} Finished quests, diary steps, clog slots and Slayer mistakes are skipped.${bank}`;
  }
  if (pluginSyncState === "stale") {
    return pluginSyncSummary?.syncedAt
      ? `Last scan: ${formatRuneLiteScanTime(pluginSyncSummary.syncedAt)}. Press Sync now before a long grind or GP spend.${memory}${bank}`
      : `Last scan: check again before a long grind or GP spend.${bank}`;
  }
  if (pluginSyncState === "outdated") {
    return pluginSyncSummary?.syncedAt
      ? `Last scan: ${formatRuneLiteScanTime(pluginSyncSummary.syncedAt)}. Update the plugin before trusting newer Slayer or clog details.`
      : "Last scan: update the plugin before trusting newer Slayer or clog details.";
  }
  return "RuneLite can improve picks later.";
}

const GEAR_REALITY_KEYWORDS = {
  weapon: [
    "whip", "fang", "scythe", "shadow", "trident", "bowfa", "blowpipe", "crossbow",
    "zaryte", "rapier", "lance", "hasta", "sword", "staff", "bow", "macuahuitl"
  ],
  armour: [
    "bandos", "torva", "barrows", "karil", "ahrim", "void", "masori", "ancestral",
    "armadyl", "crystal", "inquisitor", "fighter torso", "blessed d'hide", "dhide"
  ],
  food: ["shark", "angler", "karambwan", "manta", "monkfish", "brew", "saradomin brew"],
  potion: [
    "potion", "restore", "super combat", "ranging", "magic", "antifire", "stamina",
    "divine", "prayer", "brew"
  ],
  travel: ["teleport", "tablet", "tabs", "rune", "ring", "amulet", "necklace", "jewellery", "jewelry"]
} as const;

function bossViabilityForRecommendation(
  rec: Recommendation,
  bankItems: BankHandoffItem[],
  hasBankContext: boolean
): BossViability | null {
  if (!hasBankContext || bankItems.length === 0 || !rec.bossSlug) return null;
  const boss = bossBySlug(rec.bossSlug);
  return boss ? bossViabilityFromBankItems(bankItems, boss) : null;
}

function bossViabilityBadgeText(viability: BossViability): string {
  if (viability.dps > 0) {
    return `${viability.verdict} · ${viability.dps.toFixed(viability.dps >= 10 ? 0 : 1)} DPS`;
  }
  return viability.verdict;
}

function bossViabilityBadgeClass(viability: BossViability): string {
  if (viability.tone === "ready") return "border-[var(--color-accent)]/35 bg-[var(--color-accent)]/10 text-[var(--color-accent)]";
  if (viability.tone === "test") return "border-[var(--color-accent)]/30 bg-[var(--color-accent)]/10 text-[var(--color-accent)]";
  return "border-red-400/30 bg-red-400/10 text-red-200";
}

function bankIncludes(items: BankHandoffItem[], keywords: readonly string[]): boolean {
  return items.some((item) => {
    const haystack = `${item.name} ${item.subtab}`.toLowerCase();
    return keywords.some((keyword) => haystack.includes(keyword));
  });
}

function recommendationNeedsCombatSetup(rec: Recommendation): boolean {
  return rec.kind === "boss" || rec.kind === "kc" || rec.kind === "slayer";
}

function recommendationNeedsItemCheck(rec: Recommendation): boolean {
  return rec.kind === "quest" || rec.kind === "diary" || rec.kind === "goal" || rec.kind === "milestone";
}

function recommendationNeeds(rec: Recommendation): string[] {
  const hints = defaultActionHints(rec.kind);
  return (rec.needs?.length ? rec.needs : hints.needs).slice(0, 3);
}

function recommendationFirstStepValue(rec: Recommendation): string {
  return firstUsefulTripLine([
    rec.actionPlan?.steps[0],
    rec.actionPlan?.prep,
    rec.why
  ]) ?? fallbackRecommendationFirstStep(rec);
}

function recommendationStopPointValue(rec: Recommendation): string {
  const plan = rec.actionPlan;
  return firstUsefulTripLine([
    plan?.steps.at(-1),
    rec.payoff ? `Finish after ${rec.payoff}.` : null
  ]) ?? fallbackRecommendationStopPoint(rec);
}

function recommendationBringValue(rec: Recommendation): string {
  const needs = recommendationNeeds(rec);
  return firstUsefulTripLine([
    needs[0],
    rec.actionPlan?.prep
  ], 92) ?? fallbackRecommendationBring(rec);
}

function firstUsefulTripLine(lines: Array<string | null | undefined>, max = 118): string | null {
  for (const line of lines) {
    if (!line?.trim()) continue;
    const clean = trimTripLine(line, max);
    if (clean && !isWeakRouteLine(clean)) return clean;
  }
  return null;
}

function fallbackRecommendationFirstStep(rec: Recommendation): string {
  if (rec.kind === "bank") return "Open Smart Tidy and choose the bank layout you want.";
  if (rec.kind === "boss" || rec.kind === "kc") return "Open the kill check and confirm your setup.";
  if (rec.kind === "slayer") return "Check the task, grab supplies, then do one short task block.";
  if (rec.kind === "diary") return "Open the diary tier and finish the closest missing task.";
  if (rec.kind === "quest") return "Open the quest and check the missing requirements.";
  if (rec.kind === "skill") return `Train ${recommendationSkillLabel(rec)} until the target level is done.`;
  if (rec.kind === "money") return "Check the margin, gear once, then do one short run.";
  if (rec.kind === "minigame") return "Open the activity and prepare one round.";
  return "Start the shortest useful step for this account.";
}

function fallbackRecommendationStopPoint(rec: Recommendation): string {
  if (rec.kind === "bank") return "Copy the cleaned tabs into RuneLite when the layout feels right.";
  if (rec.kind === "boss" || rec.kind === "kc") return "Finish after one trip or one clean kill check.";
  if (rec.kind === "slayer") return "Finish after one task block or when supplies run low.";
  if (rec.kind === "diary") return "Finish after the diary tier is claimed or one requirement is removed.";
  if (rec.kind === "quest") return "Finish after the quest step, reward or unlock is done.";
  if (rec.kind === "skill") return "Finish after the level target or next unlock lands.";
  return "Finish after one clear trip.";
}

function fallbackRecommendationBring(rec: Recommendation): string {
  if (rec.kind === "bank") return "Pick a style, preview the tabs, then copy them to RuneLite.";
  if (rec.kind === "boss" || rec.kind === "kc") return "Grab weapon, armour, food, potions and a teleport out.";
  if (rec.kind === "slayer") return "Grab task gear, food, teleports and rune pouch if needed.";
  if (rec.kind === "quest" || rec.kind === "diary") return "Grab required items and teleports from your bank.";
  if (rec.kind === "skill") return "Grab method items or supplies before training.";
  return "Bring only what this trip needs.";
}

function recommendationSkillLabel(rec: Recommendation): string {
  const haystack = [rec.title, rec.why, rec.payoff].filter(Boolean).join(" ");
  const titleMatch = haystack.match(/\b(Attack|Defence|Strength|Hitpoints|Ranged|Prayer|Magic|Cooking|Woodcutting|Fletching|Fishing|Firemaking|Crafting|Smithing|Mining|Herblore|Agility|Thieving|Slayer|Farming|Runecraft|Hunter|Construction)\b/i);
  if (titleMatch?.[0]) return titleMatch[0];
  if (rec.kind === "skill") return "Skill";
  return playerChoiceTag(rec).label;
}

const TRIP_BANK_KEYWORDS = {
  weapon: GEAR_REALITY_KEYWORDS.weapon,
  armour: GEAR_REALITY_KEYWORDS.armour,
  food: GEAR_REALITY_KEYWORDS.food,
  potion: GEAR_REALITY_KEYWORDS.potion,
  travel: GEAR_REALITY_KEYWORDS.travel,
  quest: ["key", "seal", "mould", "rune", "rope", "hammer", "spade", "saw", "axe", "pickaxe", "tinderbox", "lantern"]
} as const;

type TripBuilderPlan = {
  bring: string[];
  missing: string[];
  teleport: string;
  stopPoint: string;
  tagName: string;
  tag: string | null;
};

type NextTripLine = {
  label: "Why this pick" | "Start" | "Before you leave" | "Grab from bank" | "Stage for UIM" | "Still missing" | "Finish after";
  value: string;
  tone?: "default" | "good" | "warn";
};

function trimTripLine(value: string, max = 118): string {
  const clean = playerRouteLine(value).replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max - 3).trim()}...` : clean;
}

function nextTripBeforeLines(rec: Recommendation): string[] {
  const candidates = [
    rec.actionPlan?.prep,
    recommendationFirstStepValue(rec)
  ].filter((line): line is string => Boolean(line?.trim()));
  const seen = new Set<string>();
  return candidates
    .map((line) => trimTripLine(line))
    .filter((line) => line && !isWeakRouteLine(line))
    .filter((line) => {
      const key = line.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 2);
}

function nextTripAccountModeDecisionLine(accountMode: NextUpResult["summary"]["accountMode"]): string | null {
  switch (accountMode.type) {
    case "ironman":
      return "Ironman: source missing items yourself before leaving.";
    case "hardcore":
      return "HCIM: take the safer route and skip risky combat if the setup looks thin.";
    case "ultimate":
      return "UIM: stage or carry the items before starting.";
    case "group":
      return "GIM: check your own bank; group storage is not assumed.";
    case "skiller":
      return "Skiller: keep combat-heavy steps out unless you planned them.";
    case "pure":
      return "Pure: avoid defence XP steps before leaving.";
    default:
      return null;
  }
}

function concreteMissingTripLine(line: string): boolean {
  const clean = line.trim().toLowerCase();
  if (!clean || isWeakRouteLine(clean)) return false;
  if (/^(gear|food|potions|teleport|combat gear|method items|supplies|quest items|supplies check|quest items check|gear for a cleaner trip)$/.test(clean)) {
    return false;
  }
  return (
    /\b\d+\b/.test(clean) ||
    /\bneeded, you have\b/.test(clean) ||
    /\bmissing\b/.test(clean) ||
    /\btask\b/.test(clean) ||
    /\bquest\b/.test(clean) ||
    /\bdiary\b/.test(clean) ||
    /\bitem\b/.test(clean) ||
    /\bpoints?\b/.test(clean)
  );
}

function nextTripMissingLine(rec: Recommendation, trip: TripBuilderPlan): string | null {
  const needs = (rec.needs ?? [])
    .map((need) => trimTripLine(need, 92))
    .filter(concreteMissingTripLine);
  const missing = trip.missing
    .map((item) => trimTripLine(item, 72))
    .filter(concreteMissingTripLine);
  const joined = [...needs, ...missing]
    .filter(Boolean)
    .filter((line, index, arr) => arr.findIndex((candidate) => candidate.toLowerCase() === line.toLowerCase()) === index)
    .slice(0, 3)
    .join(" · ");
  return joined || null;
}

function nextTripBankLine(
  trip: TripBuilderPlan,
  hasBankContext: boolean,
  accountMode: NextUpResult["summary"]["accountMode"]
): NextTripLine | null {
  if (!hasBankContext || trip.bring.length === 0) return null;
  const value = trip.bring
    .map((item) => trimTripLine(item, 58))
    .filter((item) => !isWeakRouteLine(item))
    .slice(0, 4)
    .join(", ");
  if (!value) return null;
  return {
    label: accountMode.type === "ultimate" ? "Stage for UIM" : "Grab from bank",
    value,
    tone: "good"
  };
}

function nextTripLines({
  rec,
  hasBankContext,
  bankItems,
  accountMode
}: {
  rec: Recommendation;
  hasBankContext: boolean;
  bankItems: BankHandoffItem[];
  accountMode: NextUpResult["summary"]["accountMode"];
}): NextTripLine[] {
  const trip = buildRecommendationTrip(rec, bankItems, hasBankContext);
  const before = nextTripBeforeLines(rec);
  const accountModeDecision = nextTripAccountModeDecisionLine(accountMode);
  const beforeWithAccountMode = accountModeDecision
    ? [before[0], accountModeDecision].filter((line): line is string => Boolean(line))
    : before;
  const lines: NextTripLine[] = [];

  if (beforeWithAccountMode.length > 0) {
    lines.push({
      label: "Before you leave",
      value: beforeWithAccountMode.slice(0, 2).join(" "),
      tone: "default"
    });
  }

  const bankLine = nextTripBankLine(trip, hasBankContext, accountMode);
  if (bankLine) lines.push(bankLine);

  const missing = nextTripMissingLine(rec, trip);
  if (missing) {
    lines.push({
      label: "Still missing",
      value: missing,
      tone: "warn"
    });
  }

  lines.push({
    label: "Finish after",
    value: trimTripLine(recommendationStopPointValue(rec), 118),
    tone: "default"
  });

  return lines.slice(0, 5);
}

function tripItemMatches(item: BankHandoffItem, keywords: readonly string[]): boolean {
  const haystack = `${item.name} ${item.subtab}`.toLowerCase();
  return keywords.some((keyword) => haystack.includes(keyword));
}

function tripBankItems(
  bankItems: BankHandoffItem[],
  keywordGroups: Array<readonly string[]>,
  limit: number
): BankHandoffItem[] {
  const seen = new Set<number>();
  const picks: BankHandoffItem[] = [];
  for (const group of keywordGroups) {
    for (const item of bankItems) {
      if (seen.has(item.id) || !tripItemMatches(item, group)) continue;
      seen.add(item.id);
      picks.push(item);
      if (picks.length >= limit) return picks;
    }
  }
  return picks;
}

function tripItemLabel(item: BankHandoffItem): string {
  if (item.quantity > 1 && item.quantity < 10_000) return `${item.name} x${item.quantity}`;
  return item.name;
}

function buildRecommendationTrip(
  rec: Recommendation,
  bankItems: BankHandoffItem[],
  hasBankContext: boolean
): TripBuilderPlan {
  const needsCombat = recommendationNeedsCombatSetup(rec);
  const isUnlock = recommendationNeedsItemCheck(rec);
  const skillConfig = skillBankConfigForSkill(recommendationSkillLabel(rec));
  const keywordGroups = needsCombat
    ? [
        TRIP_BANK_KEYWORDS.weapon,
        TRIP_BANK_KEYWORDS.armour,
        TRIP_BANK_KEYWORDS.food,
        TRIP_BANK_KEYWORDS.potion,
        TRIP_BANK_KEYWORDS.travel
      ]
    : skillConfig
      ? [skillConfig.keywords, TRIP_BANK_KEYWORDS.travel]
    : isUnlock
      ? [TRIP_BANK_KEYWORDS.travel, TRIP_BANK_KEYWORDS.quest, TRIP_BANK_KEYWORDS.potion]
      : [TRIP_BANK_KEYWORDS.travel, TRIP_BANK_KEYWORDS.food, TRIP_BANK_KEYWORDS.potion, TRIP_BANK_KEYWORDS.weapon];
  const pickedItems = hasBankContext ? tripBankItems(bankItems, keywordGroups, 18) : [];
  const travelItem = pickedItems.find((item) => tripItemMatches(item, TRIP_BANK_KEYWORDS.travel));
  const bring = pickedItems.slice(0, 6).map(tripItemLabel);
  const missing: string[] = [];

  if (!hasBankContext) {
    missing.push(...recommendationNeeds(rec));
  } else if (needsCombat) {
    if (!bankIncludes(bankItems, TRIP_BANK_KEYWORDS.weapon) && !bankIncludes(bankItems, TRIP_BANK_KEYWORDS.armour)) {
      missing.push("combat gear");
    }
    if (!bankIncludes(bankItems, TRIP_BANK_KEYWORDS.food)) missing.push("food");
    if (!bankIncludes(bankItems, TRIP_BANK_KEYWORDS.potion)) missing.push("potions");
    if (!bankIncludes(bankItems, TRIP_BANK_KEYWORDS.travel)) missing.push("teleport");
  } else if (skillConfig) {
    if (!bankIncludes(bankItems, skillConfig.keywords)) missing.push(skillConfig.suppliesLabel);
  } else if (isUnlock) {
    if (!bankIncludes(bankItems, TRIP_BANK_KEYWORDS.travel)) missing.push("teleport near the start");
  } else if (pickedItems.length === 0) {
    missing.push(...recommendationNeeds(rec));
  }

  const tagName = `Scapestack ${playerChoiceTag(rec).label}`;
  const tagItems = needsCombat
    ? pickedItems
    : skillConfig
      ? pickedItems.filter((item) =>
          tripItemMatches(item, skillConfig.keywords) ||
          tripItemMatches(item, TRIP_BANK_KEYWORDS.travel)
        )
    : pickedItems.filter((item) =>
        tripItemMatches(item, TRIP_BANK_KEYWORDS.travel) ||
        tripItemMatches(item, TRIP_BANK_KEYWORDS.quest)
      );
  const iconItemId = rec.iconItemId ?? KIND_META[rec.kind].iconItemId ?? tagItems[0]?.id ?? 995;
  const tag = tagItems.length
    ? exportTag({
        name: tagName,
        iconItemId,
        items: tagItems.map((item) => ({ id: item.id }))
      })
    : null;

  return {
    bring,
    missing: missing.slice(0, 3),
    teleport: travelItem ? tripItemLabel(travelItem) : "Best teleport near the first step",
    stopPoint: recommendationStopPointValue(rec),
    tagName,
    tag
  };
}

function headlinePayoff(rec: Recommendation): string | null {
  const payoff = rec.payoff?.trim();
  if (!payoff) return null;
  return payoff.length <= 120 ? payoff : null;
}

function firstSentence(text: string): string {
  const trimmed = text.trim();
  const match = trimmed.match(/^[^.!?]+[.!?]/);
  return match?.[0] ?? trimmed;
}

function headlineSmartRead(rec: Recommendation): string | null {
  const reason = rec.decisionReason?.trim();
  if (!reason) return null;
  const oneLine = firstSentence(reason);
  return oneLine.length > 150 ? `${oneLine.slice(0, 147).trim()}...` : oneLine;
}

function headlineOneLineReason(rec: Recommendation): string {
  const smart = headlineSmartRead(rec);
  if (smart) return smart;
  const fallback = firstSentence(rec.why);
  return fallback.length > 140 ? `${fallback.slice(0, 137).trim()}...` : fallback;
}

function compactActionLabel(rec: Recommendation, actionLabel: string): string {
  if (rec.kind === "kc" || rec.kind === "boss" || rec.kind === "slayer") return "Trip";
  if (rec.kind === "quest" || rec.kind === "diary") return "Guide";
  if (rec.kind === "goal" || rec.kind === "skill" || rec.kind === "milestone") return "Tracker";
  if (rec.kind === "money") return "Route";

  return actionLabel
    .replace(/^Open\s+/i, "")
    .replace(/^View\s+/i, "")
    .replace(/^Start\s+/i, "")
    .trim() || "Open";
}

function nextTripCtaLabel(rec: Recommendation, actionLabel: string): string {
  if (rec.kind === "boss" || rec.kind === "kc") return "Check kill";
  if (rec.kind === "bank") return "Set up bank";
  if (rec.kind === "quest") return "Open quest";
  if (rec.kind === "diary") return "Open diary";
  if (rec.kind === "slayer") return "Open task";
  if (rec.kind === "skill") return "Start training";
  if (rec.kind === "money") return "Open route";
  return actionLabel || "Start this trip";
}

function nextTripContextLabel(rec: Recommendation): string {
  if (rec.kind === "quest") return "Quest";
  if (rec.kind === "diary") return "Diary";
  if (rec.kind === "boss" || rec.kind === "kc") return "Boss";
  if (rec.kind === "slayer") return "Slayer";
  if (rec.kind === "bank") return "Bank";
  if (rec.kind === "skill") return "Skilling";
  return "Unlock";
}

function recommendationWhyNot({
  headline,
  allRecs,
  mood,
  hasBankContext,
  pluginSyncState
}: {
  headline: Recommendation;
  allRecs: Recommendation[];
  mood: Mood;
  hasBankContext: boolean;
  pluginSyncState: "live" | "stale" | "outdated" | null;
}): string | null {
  const others = allRecs.filter((rec) => rec.id !== headline.id);
  const scout = others.find((rec) =>
    rec.kind === "kc" &&
    typeof rec.kcMeta?.kc === "number" &&
    rec.kcMeta.kc > 0 &&
    rec.kcMeta.kc < 5
  );
  if (scout?.kcMeta) {
    return `Not picked: ${scout.title} is only ${scout.kcMeta.kc.toLocaleString()} KC, so it stays a backup.`;
  }

  const hasBossBackup = others.some((rec) => rec.kind === "boss" || rec.kind === "kc" || rec.kind === "slayer");
  if ((mood === "chill" || mood === "afk" || mood === "short") && hasBossBackup) {
    return "Not picked: bossing stays lower unless you ask for a sweaty trip.";
  }

  if (!hasBankContext && hasBossBackup && headline.kind !== "boss" && headline.kind !== "kc") {
    return "Not picked: no gear pasted, so boss trips stay conservative.";
  }

  const longQuest = others.find((rec) => {
    if (rec.kind !== "quest") return false;
    const text = `${rec.title} ${rec.why} ${rec.payoff ?? ""} ${rec.decisionReason ?? ""}`.toLowerCase();
    return /grandmaster|very long|\(\+\d+ more\)|long prereq/.test(text);
  });
  if (longQuest) {
    return `Not picked: ${longQuest.title} looks longer than this session needs.`;
  }

  if (headline.kind === "diary" && others.some((rec) => rec.kind === "slayer")) {
    return "Worth doing: do this diary before more Slayer.";
  }

  if (pluginSyncState === "live") {
    return "Not picked: RuneLite skipped finished quests, diary steps, clog slots and Slayer mistakes.";
  }

  return null;
}

function recommendationAvoidance(rec: Recommendation): string {
  switch (rec.kind) {
    case "kc":
      return rec.kcMeta && rec.kcMeta.kc >= 10
        ? "Run the fixed KC block. Do not change the goal mid-trip."
        : "Do a fixed KC block. Do not turn a scout read into an endless grind.";
    case "boss":
      return "Do not buy upgrades before DPS proves the trip is worth it.";
    case "skill":
      return "Finish after the unlock unless you actually want an AFK grind.";
    case "quest":
    case "diary":
      return "Do not start if the prereq chain makes this a long session.";
    case "slayer":
      return "Check points before skipping, blocking or extending the task.";
    case "money":
      return "Check prices first. Stop if the GP/hr is not worth your focus.";
    case "goal":
      return "Chase the closest missing piece, then re-run the planner.";
    case "bank":
      return "Only clean up what changes the next plan.";
    case "minigame":
      return "Do one reward or XP block, then switch if it drags.";
    default:
      return "Keep it to one clear stop point, then choose again.";
  }
}

function backupChoicePrompt(rec: Recommendation, headline: Recommendation): { label: string; helper: string } {
  if (rec.kind === "money") {
    return { label: "Need GP?", helper: "Pick this if funding the next upgrade matters more than the main route." };
  }
  if (rec.kind === "skill" || rec.kind === "bank" || rec.kind === "minigame") {
    return headline.kind === "boss" || headline.kind === "kc" || headline.kind === "slayer"
      ? { label: "Too sweaty?", helper: "Lower-pressure progress if the main trip feels like too much." }
      : { label: "Want chill?", helper: "Lower-pressure progress with a clearer stop point." };
  }
  if (rec.kind === "boss" || rec.kind === "kc" || rec.kind === "slayer") {
    return { label: "Want action?", helper: "Use this when you would rather do a trip, task or KC block." };
  }
  return { label: "Prefer unlock?", helper: "Use this when account progress matters more than GP or KC." };
}

function routeStepPrep(
  rec: Recommendation,
  bankItems: BankHandoffItem[],
  accountStage: NextUpResult["summary"]["accountStage"],
  maxEstimate: HoursToMaxSummary | null = null
): string {
  const isIron = accountStage.id === "iron-route";
  const summary = skillingBankSummaryForSkill(recommendationSkillLabel(rec), bankItems, maxEstimate);

  if (summary) {
    if (summary.bankXp > 0) {
      const gap = summary.remainingAfterBank === null
        ? "then re-check the level gap"
        : summary.remainingAfterBank === 0
          ? "enough for the 99 push"
          : `${formatPlanXp(summary.remainingAfterBank)} still left after that`;
      const needed = summary.neededAfterBankLabel ? ` ${summary.neededAfterBankLabel}` : "";
      return `Bank has ${summary.bankItemsLabel} (${summary.bankXpRangeLabel} XP). ${summary.actionVerb} those first; ${gap}.${needed}`;
    }
    if (summary.hasBankMatch) {
      const gap = summary.xpRemaining === null
        ? "check the level gap after the route"
        : `${formatPlanXp(summary.xpRemaining)} left for 99`;
      return `Bank has ${summary.bankItemsLabel}. Use that method; ${gap}.`;
    }
    return isIron
      ? `This bank does not cover the route yet. Gather one usable stack first.`
      : `This bank does not cover the route yet. Buy or gather one usable stack before committing.`;
  }

  if (rec.kind === "kc" || rec.kind === "boss") {
    return bankItems.length > 0
      ? "Use your pasted bank to build the first setup before entering."
      : "Add bank before trusting gear, food or teleport calls.";
  }

  if (rec.kind === "slayer") return "Check task, points and bracelet/rune pouch setup before leaving.";
  if (rec.kind === "money") return "Check price first; only run it while the margin is still worth it.";
  if (rec.kind === "quest" || rec.kind === "diary") return "Check the prereq list, pull quest items, then do one clean unlock block.";
  if (rec.kind === "skill") return "Bank the method items first; if supplies are missing, switch to the gathering step.";
  return "Do one bounded block, stop, then check your plan again.";
}

function routeStepStart(rec: Recommendation): string {
  return recommendationFirstStepValue(rec);
}

function routeMissingValue(rec: Recommendation): string {
  const hints = defaultActionHints(rec.kind);
  const needs = rec.needs ?? hints.needs;
  if (needs.length === 0) return "";
  return needs.slice(0, 3).join(" · ");
}

function routeStepBring(
  rec: Recommendation,
  bankItems: BankHandoffItem[],
  accountStage: NextUpResult["summary"]["accountStage"],
  maxEstimate: HoursToMaxSummary | null = null
): string {
  const summary = skillingBankSummaryForSkill(recommendationSkillLabel(rec), bankItems, maxEstimate);
  if (summary) {
    if (summary.bankXp > 0) return `${summary.bankItemsLabel}. ${summary.bringHint}.`;
    if (summary.hasBankMatch) return `${summary.bankItemsLabel}. ${summary.bringHint}.`;
    return accountStage.id === "iron-route"
      ? `${summary.suppliesLabel} first, then train what you gather.`
      : `${summary.suppliesLabel} or GP for the method.`;
  }
  return recommendationBringValue(rec);
}

function routeCardDetailLines(
  rec: Recommendation,
  bankItems: BankHandoffItem[],
  accountStage: NextUpResult["summary"]["accountStage"],
  maxEstimate: HoursToMaxSummary | null = null
): string[] {
  const candidates = [
    routeStepStart(rec),
    routeStepBring(rec, bankItems, accountStage, maxEstimate),
    routeMissingValue(rec),
    recommendationStopPointValue(rec)
  ];
  const seen = new Set<string>();
  return candidates
    .flatMap((line) => playerRouteLine(line).split(/\s+·\s+/))
    .map(routeChecklistLine)
    .filter((line) => line && !isWeakRouteLine(line))
    .filter((line) => {
      const key = line.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 3);
}

function playerRouteLine(line: string): string {
  return line
    .replace(/\/next/g, "your plan")
    .replace(new RegExp("Stop\\s+" + "when:?\\s*", "gi"), "Finish after ")
    .replace(/Payoff:\s*/gi, "")
    .replace(/re-run your plan/gi, "check your plan again")
    .replace(new RegExp("^Stop " + "when\\s+", "i"), "Finish after ")
    .replace(/Re-sync or paste your bank again after the drop\/unlock so the set disappears from your plan\./i, "Sync again after the unlock so it disappears from your plan.")
    .replace(/Copy the cleaned tabs into RuneLite when the layout feels usable\./i, "Copy the cleaned tabs into RuneLite when the layout feels right.")
    .trim();
}

function routeChecklistLine(line: string): string {
  const clean = line
    .replace(/^(?:start|bring|check|missing|stop|do):\s*/i, "")
    .replace(/^Open the (.+?) goal set and confirm the missing pieces?\.$/i, "Open $1 and check the missing piece.")
    .replace(/^Missing:\s*/i, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!clean) return "";
  return clean.endsWith(".") ? clean : `${clean}.`;
}

function isWeakRouteLine(line: string): boolean {
  const clean = line.replace(/\.$/, "").trim().toLowerCase();
  if (!clean) return true;
  if (/^missing:/.test(clean)) return true;
  if (/^(find unlock|choose unlock|check gear|check setup|check the setup|check items|check bank|quest items check|check the missing piece|check quest\/diary items|no safer route flagged)$/.test(clean)) return true;
  if (/^(find route|find item|nothing special flagged|paste bank)$/.test(clean)) return true;
  if (/^nothing obvious/.test(clean)) return true;
  if (/^add bank before trusting gear/.test(clean)) return true;
  return false;
}

function routeCardStatusLabel(rec: Recommendation, detailLines: string[]): string {
  const combined = detailLines.join(" ");
  const skillGap = combined.match(/\b([A-Z][A-Za-z ]{2,18})\s+(\d{1,2})\/(\d{1,2})\b/);
  if (skillGap) return `Need ${skillGap[3]} ${skillGap[1].trim()}`;

  const missingItem = combined.match(/\b(?:missing|buy or grab|source|stage)\s+(?:\d+\s+)?([a-z][a-z' -]{2,32}?)(?:[.;]|$)/i);
  if (missingItem) return `Missing ${missingItem[1].trim()}`;

  const levelGap = combined.match(/\b(\d+)\s+level(?:s)?\s+to\s+go\b/i);
  if (levelGap) return `${levelGap[1]} level${levelGap[1] === "1" ? "" : "s"} left`;

  if (detailLines.length === 0) return "Ready";
  if (detailLines.length === 1) return "1 thing left";
  if (rec.kind === "boss" || rec.kind === "kc") return "Gear check";
  return `${detailLines.length} things left`;
}

function RouteCard({
  rec,
  index,
  expanded,
  onToggle,
  bankItems,
  accountStage,
  maxEstimate
}: {
  rec: Recommendation;
  index: number;
  expanded: boolean;
  onToggle: () => void;
  bankItems: BankHandoffItem[];
  accountStage: NextUpResult["summary"]["accountStage"];
  maxEstimate: HoursToMaxSummary | null;
}) {
  const panelId = `next-route-card-${index}-${rec.id.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
  const detailLines = routeCardDetailLines(rec, bankItems, accountStage, maxEstimate);
  const statusLabel = routeCardStatusLabel(rec, detailLines);
  const checklistLines = detailLines.length ? detailLines : ["Ready to start."];

  return (
    <article
      className={cn(
        "rounded-xl border bg-[var(--color-bg)]/35 transition-colors",
        expanded
          ? "border-[var(--color-accent)]/45 bg-[var(--color-bg)]/58 shadow-[0_18px_60px_-34px_rgba(200,154,61,0.55)]"
          : "border-[var(--color-border)] hover:border-[var(--color-accent)]/28 hover:bg-[var(--color-bg)]/48"
      )}
      data-route-card="true"
      data-route-card-expanded={expanded ? "true" : "false"}
      data-boss-slug={rec.bossSlug ?? undefined}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        aria-controls={panelId}
        className="group grid w-full min-w-0 grid-cols-[44px_minmax(0,1fr)] items-center gap-3 px-3.5 py-3 text-left sm:grid-cols-[44px_minmax(0,1fr)_auto]"
      >
        <RoutePrimarySprite rec={rec} active={expanded} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-black leading-tight text-[var(--color-text)] sm:text-[16px]">
            {rec.title}
          </span>
          <span
            className={cn(
              "mt-1 inline-flex max-w-full rounded-full border px-2 py-0.5 text-[10px] font-bold",
              statusLabel === "Ready"
                ? "border-[var(--color-good)]/30 bg-[var(--color-good)]/10 text-[var(--color-good)]"
                : "border-[var(--color-accent)]/25 bg-[var(--color-accent)]/10 text-[var(--color-accent)]"
            )}
          >
            <span className="truncate">{statusLabel}</span>
          </span>
        </span>
        <span className="col-start-2 mt-1 inline-flex w-fit items-center gap-1 rounded-full border border-[var(--color-border)] px-2.5 py-1 text-[10.5px] font-bold text-[var(--color-text-muted)] transition-colors group-hover:border-[var(--color-accent)]/35 group-hover:text-[var(--color-accent)] sm:col-auto sm:mt-0">
          Open
          <ChevronRight className={cn("size-3 transition-transform", expanded && "rotate-90")} />
        </span>
      </button>

      {expanded && (
        <div
          id={panelId}
          className="border-t border-[var(--color-border)] px-3.5 pb-3 pt-3"
        >
          <ul className="space-y-2 text-[12.5px] font-semibold leading-relaxed text-[var(--color-text-dim)]">
            {checklistLines.map((line) => (
              <li key={line} className="flex gap-2">
                <span className="mt-[0.55em] size-1.5 shrink-0 rounded-full bg-[var(--color-accent)]" />
                <span className="min-w-0 break-words [overflow-wrap:anywhere]">{line}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </article>
  );
}

function RouteChain({
  recs,
  bankItems,
  accountStage,
  maxEstimate
}: {
  recs: Recommendation[];
  bankItems: BankHandoffItem[];
  accountStage: NextUpResult["summary"]["accountStage"];
  maxEstimate: HoursToMaxSummary | null;
}) {
  const routeIds = recs.map((rec) => rec.id).join("|");
  const firstRouteId = recs[0]?.id ?? null;
  const [expandedId, setExpandedId] = useState<string | null>(firstRouteId);

  useEffect(() => {
    setExpandedId((current) => {
      if (current && routeIds.split("|").includes(current)) return current;
      return firstRouteId;
    });
  }, [firstRouteId, routeIds]);

  if (recs.length === 0) return null;

  const content = (
    <>
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-[10.5px] font-bold uppercase tracking-[0.18em] text-[var(--color-accent)]">
          Choose another trip
        </span>
        <span className="text-[11px] font-semibold text-[var(--color-text-muted)]">
          Open a card only if the first trip is not your mood.
        </span>
      </div>
      <div className="space-y-2.5">
        {recs.slice(0, 5).map((rec, index) => {
          return (
            <RouteCard
              key={`${rec.id}:route-step:${index}`}
              rec={rec}
              index={index}
              expanded={expandedId === rec.id}
              onToggle={() => setExpandedId((current) => current === rec.id ? null : rec.id)}
              bankItems={bankItems}
              accountStage={accountStage}
              maxEstimate={maxEstimate}
            />
          );
        })}
      </div>
    </>
  );

  return (
    <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-panel)]/42 p-3.5">
      {content}
    </section>
  );
}

function sessionMemoryNote({
  feedback,
  lastSession,
  allRecs,
  headline,
  activeRsn
}: {
  feedback: RecommendationFeedback;
  lastSession: MoodSession | null;
  allRecs: Recommendation[];
  headline: Recommendation | null;
  activeRsn: string;
}): string | null {
  const twoWeeks = 14 * 24 * 60 * 60 * 1000;
  const latest = latestRecommendationFeedback(feedback);
  if (latest && Date.now() - latest.savedAt < twoWeeks) {
    const title = latest.title ?? allRecs.find((rec) => rec.id === latest.id)?.title;
    if (latest.reason === "not_today") {
      return title
        ? `Last time: you skipped ${title}, so this plan avoids it.`
        : "Last time: you skipped a pick, so this plan avoids it.";
    }
    if (latest.reason === "already_done") {
      return title
        ? `Welcome back — ${title} is marked done, so this is the next move.`
        : "Welcome back — that pick is marked done, so this is the next move.";
    }
    if (latest.reason === "too_hard") {
      return title
        ? `Last time: ${title} felt too hard, so this plan goes easier.`
        : "Last time: that pick felt too hard, so this plan goes easier.";
    }
  }

  const latestMemory = latestRecommendationMemory(feedback, { rsn: activeRsn });
  if (latestMemory?.action === "try_another") {
    const title = latestMemory.title ?? allRecs.find((rec) => rec.id === latestMemory.id)?.title;
    return title
      ? `Last time: you asked for another route, so ${title} starts lower.`
      : "Last time: you asked for another route, so that pick starts lower.";
  }

  const latestStartedMemory = latestStartedRecommendationMemory(feedback, { rsn: activeRsn, maxAgeMs: twoWeeks });
  if (latestStartedMemory) {
    const title = latestStartedMemory.title ?? allRecs.find((rec) => rec.id === latestStartedMemory.id)?.title;
    return title
      ? `Welcome back — you started ${title}. Finish it or mark it done when the trip is complete.`
      : "Welcome back — finish the trip you started or mark it done when it is complete.";
  }

  if (!lastSession?.lastHeadlineTitle || !headline) return null;
  if (lastSession.lastHeadlineId === headline.id) return null;
  if (Date.now() - lastSession.savedAt > twoWeeks) return null;
  return `Welcome back — last pick was ${lastSession.lastHeadlineTitle}. This is the next move.`;
}

function ContinueRouteBanner({
  note,
  lastSession
}: {
  note: string;
  lastSession: MoodSession | null;
}) {
  const title = lastSession?.lastHeadlineTitle ?? "Your last route";
  const age = lastSession?.savedAt ? relativeSince(lastSession.savedAt) : null;

  return (
    <section
      role="status"
      aria-live="polite"
      className="rounded-xl border border-[var(--color-accent)]/30 bg-[linear-gradient(135deg,rgba(214,170,72,0.13),rgba(20,15,9,0.68))] px-4 py-3 shadow-[0_16px_48px_rgba(0,0,0,0.22)]"
      data-continue-route-memory="true"
    >
      <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-[10.5px] font-black uppercase tracking-[0.16em] text-[var(--color-accent)]">
            <Sparkles className="size-3.5" />
            Continue route
          </p>
          <p className="mt-1 text-[13px] font-semibold leading-relaxed text-[var(--color-text-dim)]">
            {note}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2 rounded-full border border-[var(--color-accent)]/24 bg-[var(--color-bg)]/45 px-3 py-1.5 text-[11px] font-bold text-[var(--color-text)]">
          <span className="max-w-[220px] truncate">{title}</span>
          {age && <span className="text-[var(--color-text-muted)]">{age}</span>}
        </div>
      </div>
    </section>
  );
}

function RecommendationSessionSummary({
  rec,
  compact = false
}: {
  rec: Recommendation;
  compact?: boolean;
}) {
  if (compact) {
    return null;
  }

  const summary = [
    {
      label: "Start",
      value: recommendationFirstStepValue(rec)
    },
    {
      label: "Stop",
      value: recommendationStopPointValue(rec)
    }
  ];

  return (
    <div className="mt-4">
      <dl className="divide-y divide-[var(--color-border)]/55 border-y border-[var(--color-border)]/60">
        {summary.map((note) => (
          <div
            key={`${rec.id}:session:${note.label}`}
            className="grid gap-1 py-2.5 sm:grid-cols-[74px_minmax(0,1fr)] sm:gap-4"
          >
            <dt className="text-[9.5px] font-bold uppercase tracking-[0.16em] text-[var(--color-accent)]">
              {note.label}
            </dt>
            <dd className="text-[12px] font-semibold leading-relaxed text-[var(--color-text-dim)]">
              {note.value}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function ActionPlanBlock({ rec, compact = false }: { rec: Recommendation; compact?: boolean }) {
  const plan = rec.actionPlan;
  if (!plan) return null;

  if (compact) {
    return (
      <div className="mt-2 rounded-md border border-[var(--color-border)] bg-[var(--color-bg-2)]/45 px-2.5 py-2">
        <div className="mb-1.5 flex flex-wrap items-center gap-1.5 text-[10px] uppercase tracking-[0.14em] text-[var(--color-text-muted)]">
          <span className="text-[var(--color-accent)]">Plan</span>
          <span className="text-[var(--color-text-muted)]">·</span>
          <span>{plan.timebox}</span>
        </div>
        <ul className="space-y-1 text-[11px] leading-snug text-[var(--color-text-dim)]">
          {plan.steps.slice(0, 2).map((step, idx) => (
            <li key={`${rec.id}:mini-step:${idx}`} className="flex gap-1.5">
              <span className="mt-[1px] text-[var(--color-accent)]">✓</span>
              <span>{step}</span>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <div className="mt-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-2)]/55 p-3.5">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
        <div className="text-[10.5px] uppercase tracking-[0.18em] font-bold text-[var(--color-accent)]">
          Plan for this session
        </div>
        <div className="flex items-center gap-1.5">
          <span className="rounded-full border border-[var(--color-border)] bg-[var(--color-panel)] px-2 py-0.5 text-[10.5px] font-semibold text-[var(--color-text-dim)]">
            {plan.timebox}
          </span>
        </div>
      </div>
      <p className="text-[12px] leading-relaxed text-[var(--color-text-secondary)]">{plan.prep}</p>
      <ol className="mt-3 space-y-2">
        {plan.steps.map((step, idx) => (
          <li key={`${rec.id}:step:${idx}`} className="flex gap-2 text-[12.5px] leading-relaxed text-[var(--color-text-dim)]">
            <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border border-[var(--color-accent)]/35 bg-[var(--color-accent)]/10 text-[10.5px] font-bold text-[var(--color-accent)]">
              {idx + 1}
            </span>
            <span>{step}</span>
          </li>
        ))}
      </ol>
      {plan.caveat && (
        <p className="mt-3 border-t border-[var(--color-border)] pt-2 text-[11.5px] leading-relaxed text-[var(--color-text-muted)]">
          {plan.caveat}
        </p>
      )}
    </div>
  );
}

function NextTripContextLine({
  activeRsn,
  accountMode
}: {
  activeRsn: string;
  accountMode: NextUpResult["summary"]["accountMode"];
}) {
  const rsn = activeRsn.trim() || "Bank-only plan";
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-2 text-[12px] font-semibold text-[var(--color-text-muted)]">
      <span className="min-w-0 truncate">
        RSN <span className="font-bold text-[var(--color-text)]">{rsn}</span>
      </span>
      <AccountModeBadge accountMode={accountMode} compact />
    </div>
  );
}

function ReturnLoopCard({
  rec,
  pluginSyncState,
  hasBankContext,
  lastSession
}: {
  rec: Recommendation;
  pluginSyncState: "live" | "stale" | "outdated" | null;
  hasBankContext: boolean;
  lastSession: MoodSession | null;
}) {
  const lastRouteLine = lastSession?.lastHeadlineTitle
    ? `Last route: ${lastSession.lastHeadlineTitle} (${relativeSince(lastSession.savedAt)}).`
    : "One trip at a time. Come back after the stop point.";
  const steps = [
    {
      label: "Finish",
      value: recommendationStopPointValue(rec)
    },
    {
      label: "Check back",
      value: returnLoopCheckBackLine(pluginSyncState, hasBankContext)
    },
    {
      label: "Next visit",
      value: returnLoopNextVisitLine(pluginSyncState, hasBankContext)
    }
  ];

  return (
    <section
      className="rounded-lg border border-[var(--color-border)] bg-[var(--color-panel)]/46 px-3.5 py-3"
      data-return-loop-card="true"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[var(--color-accent)]">
            After this trip
          </p>
          <p className="mt-1 text-[12px] font-semibold leading-relaxed text-[var(--color-text-muted)]">
            {lastRouteLine}
          </p>
        </div>
        <div className="grid min-w-0 flex-1 gap-2 sm:max-w-[720px] sm:grid-cols-3">
          {steps.map((step) => (
            <div
              key={step.label}
              className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg)]/38 px-3 py-2"
            >
              <div className="text-[10px] font-black uppercase tracking-[0.14em] text-[var(--color-accent)]">
                {step.label}
              </div>
              <div className="mt-1 text-[11.5px] font-semibold leading-snug text-[var(--color-text-dim)]">
                {step.value}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function ReturnPlanCard({ result, rec }: { result: NextUpResult; rec: Recommendation }) {
  const plan = result.returnPlan;
  const changed = plan.sinceLastTrip.slice(0, 3);
  return (
    <section
      className="rounded-xl border border-[var(--color-accent)]/28 bg-[linear-gradient(135deg,rgba(214,170,72,0.10),rgba(17,13,8,0.64))] px-4 py-3"
      data-return-plan-card="true"
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <p className="text-[10.5px] font-black uppercase tracking-[0.16em] text-[var(--color-accent)]">
            Come back after
          </p>
          <h3 className="mt-1 text-[17px] font-black leading-tight text-[var(--color-text)]">
            {plan.title}
          </h3>
          <p className="mt-1 max-w-[720px] text-[12.5px] font-semibold leading-relaxed text-[var(--color-text-dim)]">
            {plan.lead}
          </p>
        </div>
        <div className="rounded-lg border border-[var(--color-accent)]/22 bg-black/20 px-3 py-2 text-[12px] font-bold leading-relaxed text-[var(--color-text)] lg:max-w-[300px]">
          Finish after: {recommendationStopPointValue(rec)}
        </div>
      </div>

      <div className="mt-3 grid gap-2 md:grid-cols-3">
        <div className="rounded-lg border border-[var(--color-border)] bg-black/18 px-3 py-2">
          <div className="text-[10px] font-black uppercase tracking-[0.15em] text-[var(--color-accent)]">
            Changed
          </div>
          <div className="mt-1 text-[12px] font-semibold leading-relaxed text-[var(--color-text-dim)]">
            {changed.join(" · ")}
          </div>
        </div>
        <div className="rounded-lg border border-[var(--color-border)] bg-black/18 px-3 py-2">
          <div className="text-[10px] font-black uppercase tracking-[0.15em] text-[var(--color-accent)]">
            Check back
          </div>
          <div className="mt-1 text-[12px] font-semibold leading-relaxed text-[var(--color-text-dim)]">
            {plan.checkBack}
          </div>
        </div>
        <div className="rounded-lg border border-[var(--color-border)] bg-black/18 px-3 py-2">
          <div className="text-[10px] font-black uppercase tracking-[0.15em] text-[var(--color-accent)]">
            Next login
          </div>
          <div className="mt-1 text-[12px] font-semibold leading-relaxed text-[var(--color-text-dim)]">
            {plan.nextLogin}
          </div>
        </div>
      </div>
    </section>
  );
}

function returnLoopCheckBackLine(
  pluginSyncState: "live" | "stale" | "outdated" | null,
  hasBankContext: boolean
): string {
  if (pluginSyncState === "live") {
    return "Mark done here, or press Sync in RuneLite after progress.";
  }
  if (pluginSyncState === "stale" || pluginSyncState === "outdated") {
    return "Refresh RuneLite after the trip so finished stuff disappears.";
  }
  if (hasBankContext) {
    return "Refresh bank only if gear, supplies or GP changed.";
  }
  return "Mark done here; add bank later only when gear matters.";
}

function returnLoopNextVisitLine(
  pluginSyncState: "live" | "stale" | "outdated" | null,
  hasBankContext: boolean
): string {
  if (pluginSyncState === "live") {
    return "XP, quests, diary tiers, clog and Slayer can move the next pick.";
  }
  if (pluginSyncState === "stale" || pluginSyncState === "outdated") {
    return "Fresh RuneLite progress can change the route instead of repeating it.";
  }
  if (hasBankContext) {
    return "Bank changes can unlock better trips, gear or buy lists.";
  }
  return "Your skips and done picks still shape the next route.";
}

function routeTimelineItems({
  headline,
  recs,
  pluginSyncState,
  hasBankContext,
  lastSession
}: {
  headline: Recommendation;
  recs: Recommendation[];
  pluginSyncState: "live" | "stale" | "outdated" | null;
  hasBankContext: boolean;
  lastSession: MoodSession | null;
}): Array<{ label: string; title: string; helper: string; tone?: "accent" | "muted" }> {
  const uniqueRecs = recs.filter((rec, index, list) => (
    rec.id !== headline.id && list.findIndex((item) => item.id === rec.id) === index
  ));
  const afterPick = uniqueRecs.find((rec) => rec.kind !== headline.kind) ?? uniqueRecs[0] ?? null;
  const shortPick = uniqueRecs.find((rec) => (
    rec.kind === "skill" ||
    rec.kind === "bank" ||
    rec.kind === "minigame" ||
    rec.routeTags?.includes("afk") ||
    /herb|birdhouse|farm|agility|cooking|fish|woodcut|mine/i.test(rec.title)
  )) ?? afterPick;
  const boredPick = shortPick && shortPick.id !== afterPick?.id
    ? shortPick
    : uniqueRecs.find((rec) => rec.id !== afterPick?.id) ?? shortPick ?? afterPick;
  const syncTitle = pluginSyncState === "live"
    ? "Sync after progress"
    : pluginSyncState === "stale" || pluginSyncState === "outdated"
      ? "Fresh RuneLite check"
      : hasBankContext
        ? "Refresh bank if it changed"
        : "Come back after the stop point";
  const syncHelper = pluginSyncState === "live"
    ? "Finished quests, diary steps, clog slots and Slayer can move the next pick."
    : pluginSyncState === "stale" || pluginSyncState === "outdated"
      ? "Press Sync in RuneLite before a longer grind so finished stuff disappears."
      : hasBankContext
        ? "Only update the bank when gear, supplies or GP changed."
        : "Your done picks and skips keep shaping the route.";
  const lastRoute = lastSession?.lastHeadlineTitle
    ? `Last route was ${lastSession.lastHeadlineTitle}; this keeps the chain moving.`
    : recommendationStopPointValue(headline);

  return [
    {
      label: "Now",
      title: headline.title,
      helper: recommendationFirstStepValue(headline),
      tone: "accent"
    },
    {
      label: "After",
      title: afterPick?.title ?? "Re-check the route",
      helper: afterPick ? backupChoicePrompt(afterPick, headline).helper : lastRoute
    },
    {
      label: "If you get bored",
      title: boredPick?.title ?? "Bank reset or quick prep",
      helper: boredPick
        ? "Switch here without losing the account route."
        : "Use the stop point, then leave the bigger grind for later."
    },
    {
      label: "Next login",
      title: lastSession?.lastHeadlineTitle ? "Keep the chain moving" : "Open a fresh route",
      helper: lastRoute
    },
    {
      label: "Sync after progress",
      title: syncTitle,
      helper: syncHelper
    }
  ];
}

function SessionRouteTimeline({
  headline,
  recs,
  pluginSyncState,
  hasBankContext,
  lastSession
}: {
  headline: Recommendation;
  recs: Recommendation[];
  pluginSyncState: "live" | "stale" | "outdated" | null;
  hasBankContext: boolean;
  lastSession: MoodSession | null;
}) {
  const items = routeTimelineItems({
    headline,
    recs,
    pluginSyncState,
    hasBankContext,
    lastSession
  });

  return (
    <section
      className="rounded-xl border border-[var(--color-border)]/85 bg-[var(--color-panel)]/34 p-3"
      data-session-route-timeline="true"
    >
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-[12px] font-black text-[var(--color-text)]">Trip chain</p>
        <p className="text-[11px] font-semibold text-[var(--color-text-muted)]">One route you can follow after the first stop.</p>
      </div>
      <div className="grid gap-2 md:grid-cols-5">
        {items.map((item) => (
          <div
            key={`${item.label}:${item.title}`}
            className={cn(
              "rounded-lg border px-3 py-3",
              item.tone === "accent"
                ? "border-[var(--color-accent)]/45 bg-[var(--color-accent)]/10"
                : "border-[var(--color-border)] bg-[var(--color-bg)]/34"
            )}
          >
            <div className="text-[10px] font-black uppercase tracking-[0.15em] text-[var(--color-accent)]">
              {item.label}
            </div>
            <div className="mt-1.5 text-[13px] font-black leading-tight text-[var(--color-text)]">
              {item.title}
            </div>
            <div className="mt-1.5 line-clamp-2 text-[11.5px] font-semibold leading-relaxed text-[var(--color-text-muted)]">
              {item.helper}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function NextTripCard({
  rec,
  decision,
  actionContext,
  onBossOpen,
  onStart,
  hasBankContext,
  bankItems,
  accountMode
}: {
  rec: Recommendation;
  decision: RecommendationDecision;
  actionContext: RecommendationActionContext;
  onBossOpen: (slug: string) => void;
  onStart: (rec: Recommendation) => void;
  hasBankContext: boolean;
  bankItems: BankHandoffItem[];
  accountMode: NextUpResult["summary"]["accountMode"];
}) {
  const isBossWithDetail = (rec.kind === "kc" || rec.kind === "boss") && !!rec.bossSlug;
  const primaryAction = primaryActionForRecommendation(rec, actionContext);
  const actionLabel = nextTripCtaLabel(rec, isBossWithDetail ? "Check kill" : primaryAction.label);
  const actionHref = isBossWithDetail ? undefined : primaryAction.href;
  const decisionCopy = recommendationDecisionCopy(decision);
  const bringLine = (hasBankContext ? nextTripLines({ rec, hasBankContext, bankItems, accountMode }) : [])
    .find((line) => line.label === "Grab from bank" || line.label === "Stage for UIM");
  const planLines = [
    { label: "Start", value: decisionCopy.firstStep },
    ...(bringLine ? [{ label: "Bring", value: bringLine.value }] : []),
    { label: "Stop at", value: decisionCopy.stopPoint }
  ];

  const actionClass = "scapestack-command-button scapestack-primary-action px-4 text-[12.5px] font-black";

  return (
    <article className="scape-focus min-w-0 max-w-full overflow-hidden p-4 sm:p-6" data-next-trip-card="true">
      <div className="grid min-w-0 grid-cols-[88px_minmax(0,1fr)] gap-4 sm:grid-cols-[128px_minmax(0,1fr)] sm:gap-6">
        <div className="grid size-[88px] shrink-0 place-items-center overflow-hidden rounded-lg border border-[var(--color-accent)]/32 bg-black/30 text-[var(--color-accent)] sm:size-[128px]">
          {rec.kind === "kc" && rec.bossSlug ? (
            <KcPortrait rec={rec} size={104} />
          ) : rec.iconItemId ? (
            <ItemSprite
              id={rec.iconItemId}
              alt=""
              className="pixelated"
              size={82}
              style={{ imageRendering: "pixelated", filter: "drop-shadow(1px 1px 0 rgb(0 0 0 / 0.9))" }}
            />
          ) : (
            <KindGlyph kind={rec.kind} size={48} tone="accent" />
          )}
        </div>

        <div className="min-w-0">
          <p className="eyebrow mb-2 text-[var(--color-accent)]">Do this first</p>

          <h2 className="min-w-0 break-words text-[23px] font-black leading-[1.08] tracking-normal text-[var(--color-text)] sm:text-[32px]">
            {decisionCopy.title}
          </h2>
          <p className="mt-2 text-[12.5px] font-semibold leading-relaxed text-[var(--color-text-dim)] sm:text-[13.5px]">
            {decisionCopy.why}
          </p>
        </div>

        <dl className="col-span-2 grid gap-3 border-t border-[var(--color-border)] pt-4 sm:grid-cols-3">
          {planLines.map((line) => (
            <div key={`${line.label}:${line.value}`} className="min-w-0">
              <dt className="text-[10.5px] font-black uppercase tracking-[0.14em] text-[var(--color-accent)]">
                {line.label}
              </dt>
              <dd className="mt-1 min-w-0 break-words text-[12.5px] font-semibold leading-relaxed text-[var(--color-text)] [overflow-wrap:anywhere]">
                {line.value}
              </dd>
            </div>
          ))}
        </dl>

        <div className="col-span-2">
          <div className="flex flex-wrap items-center gap-2">
            {isBossWithDetail && rec.bossSlug ? (
              <button
                type="button"
                onClick={() => {
                  onStart(rec);
                  onBossOpen(rec.bossSlug!);
                }}
                className={cn(actionClass, "min-h-11 w-full justify-center sm:w-auto")}
                aria-label={`${actionLabel}: ${rec.title}`}
              >
                {actionLabel} <ArrowRight className="size-4" />
              </button>
            ) : actionHref ? (
              primaryAction.external ? (
                <a
                  href={actionHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => onStart(rec)}
                  className={cn(actionClass, "min-h-11 w-full justify-center sm:w-auto")}
                  aria-label={`${actionLabel}: ${rec.title}`}
                >
                  {actionLabel} <ExternalLink className="size-3.5" />
                </a>
              ) : (
                <Link
                  href={actionHref}
                  onClick={() => onStart(rec)}
                  className={cn(actionClass, "min-h-11 w-full justify-center sm:w-auto")}
                  aria-label={`${actionLabel}: ${rec.title}`}
                >
                  {actionLabel} <ArrowRight className="size-4" />
                </Link>
              )
            ) : null}
          </div>
        </div>
      </div>
    </article>
  );
}

function RouteChainScroll({
  rec,
  onStart
}: {
  rec: Recommendation;
  onStart?: (rec: Recommendation) => void;
}) {
  const steps = rec.routeChain?.steps ?? [];
  const calculable = rec.calculableRoute ?? null;
  const routeFingerprint = calculable
    ? `${calculable.id}:${calculable.bankCoveredXp}:${calculable.remainingSessionXp}:${calculable.steps.map((step) => `${step.id}:${step.requiredQuantity ?? "x"}:${step.ownedQuantity ?? "x"}`).join("|")}`
    : "static";
  const [progress, setProgress] = useState<CalculableRouteProgress>({
    completedStepIds: [],
    activeStepId: calculable?.steps.find((step) => step.state === "active")?.id ?? null
  });
  const [routeMessage, setRouteMessage] = useState<string | null>(null);

  useEffect(() => {
    setProgress({
      completedStepIds: [],
      activeStepId: calculable?.steps.find((step) => step.state === "active")?.id ?? null
    });
    setRouteMessage(null);
  }, [routeFingerprint]);

  const resolvedRoute = useMemo(
    () => calculable ? resolveCalculableRouteProgress(calculable, progress) : null,
    [calculable, progress]
  );

  if (!calculable && steps.length === 0) return null;

  if (calculable && resolvedRoute) {
    const chooseStep = (stepId: string) => {
      const selection = selectCalculableRouteStep(calculable, progress, stepId);
      if (!selection.accepted) {
        const blocker = calculable.steps.find((step) => step.id === selection.blockerId);
        setRouteMessage(blocker ? `Finish “${blocker.title}” first.` : "Finish the earlier route step first.");
        return;
      }
      setProgress(selection.progress);
      setRouteMessage(null);
      onStart?.(rec);
    };
    const finishStep = (stepId: string) => {
      setProgress((current) => completeCalculableRouteStep(calculable, current, stepId));
      setRouteMessage(null);
      onStart?.(rec);
    };

    return (
      <section
        className="mt-4 rounded-lg border border-[var(--color-accent)]/28 bg-[var(--color-bg)]/36 px-4 py-4"
        data-route-chain-scroll="true"
        data-calculable-route="true"
      >
        <div className="mb-4">
          <p className="font-serif text-[18px] font-semibold text-[var(--color-text)]">Your route</p>
          <p className="mt-1 text-[11.5px] font-semibold leading-relaxed text-[var(--color-text-muted)]">
            {calculable.bankSummary} About {calculable.estimatedSessions} session{calculable.estimatedSessions === 1 ? "" : "s"} to level {calculable.targetLevel}.
          </p>
        </div>

        <ol className="space-y-0">
          {resolvedRoute.steps.map((step, index) => {
            const active = step.state === "active";
            const done = step.state === "done";
            const blocked = step.state === "blocked";
            return (
              <li key={step.id} className="relative grid grid-cols-[30px_minmax(0,1fr)] gap-3 pb-3 last:pb-0">
                {index < resolvedRoute.steps.length - 1 && (
                  <span className="absolute bottom-0 left-[14px] top-7 w-px bg-[var(--color-parchment-edge)]" aria-hidden="true" />
                )}
                <span className={cn(
                  "relative z-[1] grid size-[30px] place-items-center rounded-full border text-[11px] font-black",
                  done
                    ? "border-[var(--color-accent)] bg-[var(--color-accent)] text-black"
                    : active
                      ? "border-[var(--color-accent)] bg-[var(--color-accent)]/16 text-[var(--color-accent)] shadow-[0_0_0_3px_rgba(214,170,72,0.10)]"
                      : "border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text-muted)]"
                )}>
                  {done ? <CheckCircle2 className="size-4" /> : blocked ? <LockKeyhole className="size-3.5" /> : index + 1}
                </span>
                <div
                  className={cn(
                    "min-w-0 rounded-md border px-3 py-3 text-left transition-colors",
                    active
                      ? "border-[var(--color-accent)]/48 bg-[var(--color-accent)]/10"
                      : done
                        ? "border-[var(--color-border)]/55 bg-[var(--color-bg)]/24 opacity-70"
                        : "border-[var(--color-border)] bg-[var(--color-bg)]/38 hover:border-[var(--color-accent)]/40"
                  )}
                >
                  <button
                    type="button"
                    onClick={() => chooseStep(step.id)}
                    aria-current={active ? "step" : undefined}
                    className="block w-full text-left"
                  >
                    <span className="flex flex-wrap items-start justify-between gap-2">
                      <span className="min-w-0 font-semibold leading-snug text-[var(--color-text)]">{step.title}</span>
                      <span className="shrink-0 text-[9.5px] font-black uppercase tracking-[0.12em] text-[var(--color-accent)]">
                        {done ? "Done" : active ? "Do now" : blocked ? "After first" : "Choose"}
                      </span>
                    </span>
                    <span className="mt-1 block text-[11.5px] font-semibold leading-relaxed text-[var(--color-text-muted)]">{step.detail}</span>
                  </button>
                  {active && (
                    <button
                      type="button"
                      onClick={() => finishStep(step.id)}
                      className="mt-3 inline-flex min-h-11 items-center gap-1.5 rounded-md border border-[var(--color-accent)]/44 bg-[var(--color-accent)]/12 px-3 text-[11px] font-black text-[var(--color-accent)]"
                    >
                      {step.kind === "stop" ? "Finish route" : "Done, next"} <ArrowRight className="size-3.5" />
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ol>

        {routeMessage && (
          <p role="status" className="mt-3 rounded-md border border-[var(--color-warning)]/28 bg-[var(--color-warning)]/8 px-3 py-2 text-[11.5px] font-semibold text-[var(--color-text-secondary)]">
            {routeMessage}
          </p>
        )}
        <p className="mt-4 border-t border-[var(--color-parchment-edge)] pt-3 text-[11px] font-semibold leading-relaxed text-[var(--color-text-muted)]">
          {calculable.nextReplanPoint}
        </p>
      </section>
    );
  }

  return (
    <section
      className="mt-4 rounded-lg border border-[var(--color-accent)]/24 bg-[var(--color-bg)]/36 px-4 py-4"
      data-route-chain-scroll="true"
    >
      <ol className="space-y-3">
        {steps.slice(0, 4).map((step, index) => (
          <li key={`${rec.id}:route-chain:${step.label}`} className="grid min-w-0 grid-cols-[24px_minmax(0,1fr)] gap-2.5">
            <div className="flex items-start text-[10px] font-black uppercase tracking-[0.13em] text-[var(--color-accent)]">
              <span className="grid size-5 shrink-0 place-items-center rounded-full border border-[var(--color-accent)]/35 bg-[var(--color-accent)]/10 text-[10px]">
                {index + 1}
              </span>
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-[0.13em] text-[var(--color-accent)]">{step.label}</p>
              <p className="mt-0.5 text-[11.5px] font-semibold leading-relaxed text-[var(--color-text-dim)]">{step.text}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

// One checklist row — compact, with explicit links/buttons.
function RecRow({
  rec,
  onSelect,
  backupPrompt
}: {
  rec: Recommendation;
  onSelect: (rec: Recommendation) => void;
  backupPrompt?: { label: string; helper: string };
}) {
  const choice = playerChoiceTag(rec);
  return (
    <button
      type="button"
      onClick={() => onSelect(rec)}
      data-route-card="true"
      className="group min-h-[136px] w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-panel)] p-4 text-left transition-colors hover:border-[var(--color-accent)]/55 hover:bg-[var(--color-accent)]/8 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
      aria-label={`Choose ${rec.title}`}
    >
      <div className="flex min-h-12 items-start gap-4">
        <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-2)] text-[var(--color-accent)]">
          {rec.kind === "kc" && rec.bossSlug ? (
            <KcPortrait rec={rec} size={54} />
          ) : rec.iconItemId ? (
            <ItemSprite
              id={rec.iconItemId}
              alt=""
              className="pixelated"
              style={{ maxWidth: "82%", maxHeight: "82%", imageRendering: "pixelated", filter: "drop-shadow(1px 1px 0 rgb(0 0 0 / 0.9))" }}
            />
          ) : (
            <KindGlyph kind={rec.kind} size={32} tone="accent" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
            <span
              className="shrink-0 rounded-full border border-[var(--color-border)] bg-[var(--color-bg)]/45 px-2 py-0.5 text-[10px] font-bold text-[var(--color-accent)]"
              title={backupPrompt?.helper ?? choice.helper}
            >
              {backupPrompt?.label ?? choice.label}
            </span>
            <h4 className="min-w-0 text-[17px] font-black leading-snug tracking-normal text-[var(--color-text)]">
              {rec.title}
            </h4>
          </div>
          <p className="mt-2 text-[12px] font-semibold leading-relaxed text-[var(--color-text-muted)]">
            {backupPrompt?.helper ?? choice.helper}
          </p>
        </div>
        <ArrowRight className="mt-5 size-5 shrink-0 text-[var(--color-accent)] transition-transform group-hover:translate-x-1" />
      </div>
    </button>
  );
}

// ── Mood section ───────────────────────────────────────────────────────────
// "Wat heb je zin in?" — kies een vibe, kies een tijdsbudget, krijg
// één concrete suggestie + 2 alternatieven. Optioneel; "Tonight's pick"
// hierboven blijft de objectief-beste anchor voor wie deze keuze wil
// overslaan. Engine zit in src/lib/mood.ts (pickForMood).

const MOODS: Mood[] = ["chill", "cash", "bossing", "unlock", "afk", "short"];
const TIME_OPTIONS: { value: TimeBudget; label: string }[] = [
  { value: 15,  label: "15 min" },
  { value: 30,  label: "30 min" },
  { value: 60,  label: "1 hour" },
  { value: 120, label: "2 hours" },
];
const SESSION_MOOD_GRID_CHOICES: Array<{
  id: Mood | "surprise";
  label: string;
  helper: string;
  mood?: Mood;
  minutes?: TimeBudget;
}> = [
  { id: "chill", label: "Chill", helper: "Easy progress, no sweaty trip.", mood: "chill", minutes: 30 },
  { id: "cash", label: "GP", helper: "Money or supplies for the next upgrade.", mood: "cash", minutes: 60 },
  { id: "bossing", label: "Bossing", helper: "KC, drops or a real PvM trip.", mood: "bossing", minutes: 120 },
  { id: "unlock", label: "Unlock", helper: "Quest, diary or account gate.", mood: "unlock", minutes: 120 },
  { id: "afk", label: "AFK", helper: "Progress while doing something else.", mood: "afk", minutes: 60 },
  { id: "short", label: "Short", helper: "One clean stop point.", mood: "short", minutes: 15 },
  { id: "surprise", label: "Surprise me", helper: "Same vibe, different route." }
];

function moodForRouteLens(lens: RouteLens, currentMood: Mood): Mood {
  switch (lens) {
    case "maxing":
    case "unlock-chain":
      return "unlock";
    case "fun":
      return currentMood === "bossing" || currentMood === "afk" ? currentMood : "chill";
    case "gp-upgrade":
      return "cash";
    case "boss-log":
      return "bossing";
    case "afk-progress":
      return "afk";
    case "short-login":
      return "short";
    case "smart":
      return currentMood;
  }
}

function defaultTimeForRouteLens(lens: RouteLens): TimeBudget | null {
  switch (lens) {
    case "maxing":
    case "unlock-chain":
    case "boss-log":
      return 120;
    case "gp-upgrade":
    case "afk-progress":
      return 60;
    case "fun":
      return 60;
    case "short-login":
      return 15;
    case "smart":
      return null;
  }
}

type SessionSkippedPick = {
  id: string;
  kind: RecKind;
  title: string;
  count: number;
  skippedAt: number;
};

function recordSessionSkip(
  current: Record<string, SessionSkippedPick>,
  rec: Recommendation
): Record<string, SessionSkippedPick> {
  const existing = current[rec.id];
  return {
    ...current,
    [rec.id]: {
      id: rec.id,
      kind: rec.kind,
      title: rec.title,
      count: (existing?.count ?? 0) + 1,
      skippedAt: Date.now()
    }
  };
}

function sessionSkippedCounts(skipped: Record<string, SessionSkippedPick>): Record<string, number> {
  return Object.fromEntries(Object.values(skipped).map((entry) => [entry.id, entry.count]));
}

function mergedSkipCounts(...counts: Record<string, number>[]): Record<string, number> {
  const merged: Record<string, number> = {};
  for (const countMap of counts) {
    for (const [id, count] of Object.entries(countMap)) {
      merged[id] = Math.min(5, (merged[id] ?? 0) + count);
    }
  }
  return merged;
}

function latestSessionSkip(skipped: Record<string, SessionSkippedPick>): SessionSkippedPick | null {
  return Object.values(skipped).sort((a, b) => b.skippedAt - a.skippedAt)[0] ?? null;
}

function memoryKind(memory: RecommendationMemoryEntry | null): RecKind | null {
  return memory ? (memory.kind as RecKind) : null;
}

function defaultTimeForMood(mood: Mood): TimeBudget | null {
  if (mood === "short") return 15;
  if (mood === "chill") return 30;
  if (mood === "unlock") return 120;
  if (mood === "bossing" || mood === "afk" || mood === "cash") return 60;
  return null;
}

// ── Bank progress ──────────────────────────────────────────────────────────
// Toont "je bent dicht bij completen van deze sets" als chip-row.
// Klik op een chip → expandeert + toont wat er nog mist. Geen visual
// noise wanneer de bank leeg is.

function BankProgressSection({ progress }: { progress: SetCompletion[] }) {
  const [openId, setOpenId] = useState<string | null>(null);
  if (progress.length === 0) return null;

  return (
    <section className="mb-10">
      <h3 className="eyebrow mb-1 text-[var(--color-accent)]">Almost there</h3>
      <p className="text-[11.5px] text-[var(--color-text-muted)] mb-3">
        Sets you're closest to completing — click for what's still missing.
      </p>
      <div className="flex flex-wrap gap-2">
        {progress.map((c) => {
          const set = GOAL_SETS.find((s) => s.id === c.setId);
          if (!set) return null;
          const norm = normaliseCompletion(c, set);
          const missing = norm.max - norm.progress;
          const active = openId === c.setId;
          return (
            <button
              key={c.setId}
              type="button"
              onClick={() => setOpenId(active ? null : c.setId)}
              className={cn(
                "px-3 py-1.5 rounded-md border text-[11.5px] transition-colors flex items-center gap-2 tabular-nums",
                active
                  ? "border-[var(--color-accent)]/60 bg-[var(--color-accent)]/10 text-[var(--color-accent)]"
                  : "border-[var(--color-border)] bg-[var(--color-panel)] text-[var(--color-text-dim)] hover:text-[var(--color-text)] hover:border-[var(--color-border-strong)]"
              )}
            >
              <span className="font-semibold">{set.name}</span>
              <span className="text-[10px] opacity-70">
                {norm.progress}/{norm.max}
              </span>
              {missing > 0 && (
                <span className="text-[10px] opacity-60">· {missing} short</span>
              )}
            </button>
          );
        })}
      </div>
      {/* Expanded panel — toont missende goals voor de open set. */}
      {openId && (() => {
        const c = progress.find((r) => r.setId === openId);
        const set = c && GOAL_SETS.find((s) => s.id === c.setId);
        if (!c || !set) return null;
        const missing = set.goals.filter((g) => !c.perGoal[g.id]?.satisfied);
        return (
          <div className="mt-3 p-3 rounded-lg bg-[var(--color-panel)] border border-[var(--color-border)]">
            <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--color-text-muted)] mb-2">
              {set.name} — still missing
            </div>
            {missing.length === 0 ? (
              <p className="text-[12px] text-[var(--color-good)]">
                Actually complete — probably a tiered set where you already own the top tier.
              </p>
            ) : (
              <ul className="space-y-1">
                {missing.slice(0, 12).map((g) => (
                  <li key={g.id} className="text-[12px] text-[var(--color-text-dim)] flex items-baseline gap-2">
                    <span className="size-1 rounded-full bg-[var(--color-text-muted)] inline-block translate-y-[-2px]" />
                    <span className="text-[var(--color-text)]">{g.name}</span>
                    {g.tier !== undefined && (
                      <span className="text-[10.5px] opacity-60">tier {g.tier}</span>
                    )}
                  </li>
                ))}
                {missing.length > 12 && (
                  <li className="text-[11px] text-[var(--color-text-muted)] mt-1">
                    + {missing.length - 12} more
                  </li>
                )}
              </ul>
            )}
          </div>
        );
      })()}
    </section>
  );
}

// ── WhatToDo (track 1) ─────────────────────────────────────────────────────
// Side-by-side layout: mood-chips + time-budget links, gekozen suggestie
// + alternatieven rechts. Default is unlock-first; explicit routes can
// still opt into GP, Bossing, AFK, Chill or Short.

const DEFAULT_MOOD: Mood = "unlock";
const DEFAULT_TIME: TimeBudget = 60;

function visibleMood(mood: Mood): Mood {
  if (mood === "focused") return "bossing";
  if (mood === "quest") return "unlock";
  return MOODS.includes(mood) ? mood : DEFAULT_MOOD;
}

function SessionMoodGrid({
  mood,
  onPick,
  onSurprise
}: {
  mood: Mood;
  onPick: (mood: Mood, minutes?: TimeBudget) => void;
  onSurprise: () => void;
}) {
  const activeMood = visibleMood(mood);

  return (
    <section
      className="min-w-0 max-w-full overflow-hidden border-y border-[var(--color-border)] py-4"
      data-session-mood-grid="true"
      aria-label="Pick a session mood"
    >
      <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
        <p className="min-w-0 text-[12px] font-black text-[var(--color-text)]">What are you in the mood for?</p>
        <p className="min-w-0 max-w-full text-[11px] font-semibold leading-snug text-[var(--color-text-muted)]">Same mood, different route.</p>
      </div>
      <div className="grid min-w-0 grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
        {SESSION_MOOD_GRID_CHOICES.map((choice) => {
          const active = choice.mood ? visibleMood(choice.mood) === activeMood : false;
          return (
            <button
              key={choice.id}
              type="button"
              aria-pressed={choice.id === "surprise" ? undefined : active}
              onClick={() => {
                if (choice.id === "surprise") {
                  onSurprise();
                  return;
                }
                onPick(choice.mood!, choice.minutes);
              }}
              className={cn(
                "scape-route-choice min-h-[72px] min-w-0 px-3 py-2.5 text-left",
                active
                  ? "border-[var(--color-accent)] bg-[var(--color-accent)]/16 text-[var(--color-text)] shadow-[0_0_0_1px_var(--color-accent)]"
                  : choice.id === "surprise"
                    ? "border-[var(--color-accent)]/45 bg-[var(--color-accent)]/10 text-[var(--color-text)] hover:bg-[var(--color-accent)]/16"
                    : "border-[var(--color-border)] bg-[var(--color-bg)]/34 text-[var(--color-text-dim)] hover:border-[var(--color-accent)]/55 hover:text-[var(--color-text)]"
              )}
            >
              <span className="block min-w-0 break-words text-[13px] font-black">{choice.label}</span>
              <span className="mt-1 block min-w-0 break-words text-[10.5px] font-semibold leading-snug text-[var(--color-text-muted)]">
                {choice.helper}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function WhatToDo({
  allRecs,
  activeRsn,
  accountStage,
  accountType,
  accountMode,
  maxEstimate,
  hasBankContext,
  bankItems,
  onBossOpen,
  onEdit,
  routeIntent,
  initialRouteChoice,
  pluginSyncState,
  pluginSyncSummary,
  syncResult,
  bankSource,
  planRequestedAt
}: {
  allRecs: Recommendation[];
  activeRsn: string;
  accountStage: NextUpResult["summary"]["accountStage"];
  accountType: PlannerAccountType | null;
  accountMode: NextUpResult["summary"]["accountMode"];
  maxEstimate: HoursToMaxSummary | null;
  hasBankContext: boolean;
  bankItems: BankHandoffItem[];
  onBossOpen: (slug: string) => void;
  onEdit: () => void;
  routeIntent: NextIntentPreset | null;
  initialRouteChoice: InitialRouteChoice | null;
  pluginSyncState: "live" | "stale" | "outdated" | null;
  pluginSyncSummary: NextPluginSyncSummary | null;
  syncResult: NextUpResult;
  bankSource: NextBankSource;
  planRequestedAt: number | null;
}) {
  const [mood, setMood] = useState<Mood>(
    routeIntent ? visibleMood(routeIntent.mood) : initialRouteChoice?.mood ?? DEFAULT_MOOD
  );
  const [minutes, setMinutes] = useState<TimeBudget>(routeIntent?.minutes ?? initialRouteChoice?.minutes ?? DEFAULT_TIME);
  const [routeLens] = useState<RouteLens>(initialRouteChoice?.routeLens ?? "smart");
  const [shuffleIdx, setShuffleIdx] = useState(0);
  const [selectedRecommendationId, setSelectedRecommendationId] = useState<string | null>(null);
  const [isRandomizing, setIsRandomizing] = useState(false);
  const [sessionSkipped, setSessionSkipped] = useState<Record<string, SessionSkippedPick>>({});
  const [lastStarted, setLastStarted] = useState<{ id: string; title: string } | null>(null);
  const [lastSuppressed, setLastSuppressed] = useState<{ id: string; kind: RecKind; title: string } | null>(null);
  const [lastCompleted, setLastCompleted] = useState<{ id: string; title: string } | null>(null);
  const [feedback, setFeedback] = useState<RecommendationFeedback>(() => ({
    version: 1,
    suppressed: {},
    recent: []
  }));
  useEffect(() => {
    if (!isRandomizing) return;
    const timer = window.setTimeout(() => setIsRandomizing(false), 760);
    return () => window.clearTimeout(timer);
  }, [isRandomizing]);
  useEffect(() => {
    const last = loadMood(activeRsn);
    if (last) {
      if (!routeIntent && !initialRouteChoice) {
        setMood(visibleMood(last.mood));
        setMinutes(last.minutes);
      }
    }
    setFeedback(loadRecommendationFeedback());
  }, [routeIntent, initialRouteChoice]);
  useEffect(() => {
    const refreshFeedback = () => setFeedback(loadRecommendationFeedback());
    window.addEventListener(RECOMMENDATION_FEEDBACK_CHANGE_EVENT, refreshFeedback);
    return () => window.removeEventListener(RECOMMENDATION_FEEDBACK_CHANGE_EVENT, refreshFeedback);
  }, []);

  const hiddenCount = allRecs.filter((rec) => feedback.suppressed[rec.id]).length;
  const choiceHiddenCount = allRecs.filter((rec) => {
    const entry = feedback.suppressed[rec.id];
    return entry && entry.reason !== "already_done";
  }).length;
  const visibleRecs = allRecs.filter((rec) => !feedback.suppressed[rec.id]);
  const latestSkipped = useMemo(() => latestSessionSkip(sessionSkipped), [sessionSkipped]);
  const recentMemoryCounts = useMemo(
    () => recommendationMemoryCounts(feedback, { rsn: activeRsn }),
    [activeRsn, feedback]
  );
  const latestMemory = useMemo(
    () => latestRecommendationMemory(feedback, { rsn: activeRsn }),
    [activeRsn, feedback]
  );
  const recentRejectedMemory = useMemo(
    () => recentRejectedRecommendationMemories(feedback, { rsn: activeRsn, mood }).slice(0, 12),
    [activeRsn, feedback, mood]
  );
  const latestStartedMemory = useMemo(
    () => latestStartedRecommendationMemory(feedback, { rsn: activeRsn }),
    [activeRsn, feedback]
  );
  const preferenceProfile = useMemo(
    () => buildRecommendationPreferenceProfile(feedback, { rsn: activeRsn }),
    [activeRsn, feedback]
  );
  const routePickOptions = useMemo(
    () => {
      const recentFamilies = recentRejectedMemory.map((entry) => {
        const rec = allRecs.find((candidate) => candidate.id === entry.id);
        return rec
          ? recommendationDiversityFamily(rec)
          : recommendationDiversityFamilyForKind(entry.kind as RecKind);
      });
      return {
        skippedIds: mergedSkipCounts(sessionSkippedCounts(sessionSkipped), recentMemoryCounts),
        previousKind: latestSkipped?.kind ?? memoryKind(latestMemory),
        previousId: latestSkipped?.id ?? latestMemory?.id ?? null,
        excludedIds: [...new Set([...Object.keys(sessionSkipped), ...recentRejectedMemory.map((entry) => entry.id)])],
        acceptedIds: [...new Set([lastStarted?.id, latestStartedMemory?.id].filter((id): id is string => Boolean(id)))],
        recentFamilies: [...new Set(recentFamilies)],
        seed: `${activeRsn || bankSource}:${mood}:${minutes}:${shuffleIdx}`,
        preferenceProfile,
        honestyContext: {
          hasPublicStats: syncResult.summary.basis === "full" || syncResult.summary.basis === "hiscores-only",
          hasBank: hasBankContext,
          hasRuneLite: pluginSyncState !== null
        }
      };
    },
    [activeRsn, allRecs, bankSource, hasBankContext, lastStarted?.id, latestMemory, latestSkipped?.id, latestSkipped?.kind, latestStartedMemory?.id, minutes, mood, pluginSyncState, preferenceProfile, recentMemoryCounts, recentRejectedMemory, sessionSkipped, shuffleIdx, syncResult.summary.basis]
  );
  const actionContext = useMemo<RecommendationActionContext>(
    () => ({ from: "next", hasBankContext, rsn: activeRsn, accountType: accountMode.type }),
    [accountMode.type, activeRsn, hasBankContext]
  );
  const analyticsContext: AnalyticsContext = bankSource === "sample"
    ? "sample"
    : pluginSyncState && hasBankContext
      ? "bank_runelite"
      : pluginSyncState
        ? "runelite"
        : hasBankContext
          ? "bank"
          : "public_stats";

  const recommendationAnalytics = (
    rec: Recommendation,
    nextRouteLens: RouteLens = routeLens
  ) => ({
    recommendationId: rec.id,
    recommendationKind: rec.kind,
    routeFamily: nextRouteLens,
    mood,
    accountStage: accountStage.id,
    context: analyticsContext,
    sessionMinutes: minutes,
    elapsedMs: planRequestedAt ? Math.max(0, Date.now() - planRequestedAt) : 0
  });

  const rememberTrip = (rec: Recommendation, action: TripTimelineAction, nextRouteLens: RouteLens = routeLens) => {
    const event = {
      id: rec.id,
      kind: rec.kind,
      title: rec.title,
      action,
      mood,
      routeLens: nextRouteLens,
      rsn: activeRsn,
      stopPoint: recommendationStopPointValue(rec)
    };
    recordTripEvent(event);
    if (activeRsn && (action === "started" || action === "done" || action === "skipped")) {
      markAccountTrip(activeRsn, { ...event, action });
    }
  };

  // Reset shuffle wanneer mood/time veranderen — een nieuwe vibe begint
  // op de top-pick, anders blijven we stiekem op een oude alternative.
  useEffect(() => {
    setShuffleIdx(0);
    setSelectedRecommendationId(null);
  }, [mood, minutes, routeLens]);

  const pick = useMemo(
    () => pickForRoute(visibleRecs, mood, minutes, routeLens, 0, routePickOptions),
    [visibleRecs, mood, minutes, routeLens, shuffleIdx, routePickOptions]
  );
  const moodEligibleRecs = useMemo(
    () => visibleRecs.filter((rec) => recommendationMoodEligibility(rec, mood, minutes).eligible),
    [minutes, mood, visibleRecs]
  );
  const activePick = useMemo(() => {
    if (!pick) return null;
    const selectedRec = selectedRecommendationId
      ? moodEligibleRecs.find((rec) => rec.id === selectedRecommendationId)
      : null;
    if (selectedRec && selectedRec.id !== pick.headline.id) {
      const alternatives = [pick.headline, ...pick.alternatives]
        .filter((rec, index, list) => rec.id !== selectedRec.id && list.findIndex((candidate) => candidate.id === rec.id) === index)
        .slice(0, 2);
      return { ...pick, headline: selectedRec, alternatives };
    }
    const rememberedStartedId = lastStarted?.id ?? latestStartedMemory?.id ?? null;
    const startedId = rememberedStartedId
      && !recentRejectedMemory.some((entry) => entry.id === rememberedStartedId)
      ? rememberedStartedId
      : null;
    const startedRec = startedId ? moodEligibleRecs.find((rec) => rec.id === startedId) : null;
    if (!startedRec || startedRec.id === pick.headline.id) return pick;
    const alternatives = [pick.headline, ...pick.alternatives]
      .filter((rec, index, list) => rec.id !== startedRec.id && list.findIndex((candidate) => candidate.id === rec.id) === index)
      .slice(0, 2);
    return { ...pick, headline: startedRec, alternatives };
  }, [lastStarted?.id, latestStartedMemory?.id, moodEligibleRecs, pick, recentRejectedMemory, selectedRecommendationId]);
  const activeDecision = useMemo(() => activePick
    ? buildRecommendationDecision({
        winner: activePick.headline,
        alternatives: activePick.alternatives,
        mood,
        routeFamily: routeLens,
        minutes,
        accountStage: accountStage.id,
        accountType,
        hasPublicStats: syncResult.summary.basis === "full" || syncResult.summary.basis === "hiscores-only",
        hasBank: hasBankContext,
        hasRuneLite: pluginSyncState !== null
      })
    : null, [
      accountStage.id,
      accountType,
      activePick,
      hasBankContext,
      minutes,
      mood,
      pluginSyncState,
      routeLens,
      syncResult.summary.basis
    ]);
  useEffect(() => {
    if (!activePick) return;
    saveMood({
      mood,
      minutes,
      lastHeadlineId: activePick.headline.id,
      lastHeadlineTitle: activePick.headline.title
    }, activeRsn || undefined);
  }, [activeRsn, mood, minutes, activePick]);

  useEffect(() => {
    if (!activeDecision || pluginSyncState === null) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      const connectedAccount = getActiveAccount();
      if (!connectedAccount?.serverAccountId) return;
      if (activeRsn && connectedAccount.rsn.toLowerCase() !== activeRsn.toLowerCase()) return;
      void fetch("/api/account/decision", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ decision: activeDecision }),
        credentials: "same-origin",
        keepalive: true,
        signal: controller.signal
      }).catch(() => undefined);
    }, 250);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [activeDecision, activeRsn, pluginSyncState]);

  const persistDecisionLifecycle = (
    rec: Recommendation,
    eventType: "started" | "done" | "skipped"
  ) => {
    if (pluginSyncState === null) return;
    const connectedAccount = getActiveAccount();
    if (!connectedAccount?.serverAccountId) return;
    if (activeRsn && connectedAccount.rsn.toLowerCase() !== activeRsn.toLowerCase()) return;
    const decision = activeDecision?.recommendationId === rec.id
      ? activeDecision
      : buildRecommendationDecision({
          winner: rec,
          alternatives: activePick?.alternatives ?? [],
          mood,
          routeFamily: routeLens,
          minutes,
          accountStage: accountStage.id,
          accountType,
          hasPublicStats: syncResult.summary.basis === "full" || syncResult.summary.basis === "hiscores-only",
          hasBank: hasBankContext,
          hasRuneLite: true
        });
    void fetch("/api/account/decision", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ decision, eventType }),
      credentials: "same-origin",
      keepalive: true
    }).catch(() => undefined);
  };

  useEffect(() => {
    if (!activePick) return;
    const props = recommendationAnalytics(activePick.headline);
    track("plan:first_rendered", props, {
      dedupeKey: `plan:${planRequestedAt ?? "unknown"}:${activePick.headline.id}`
    });
    track("recommendation:impression", props, {
      dedupeKey: `impression:${activePick.headline.id}:${routeLens}:${mood}:${minutes}:${shuffleIdx}`
    });
  }, [activePick?.headline.id, analyticsContext, accountStage.id, minutes, mood, planRequestedAt, routeLens, shuffleIdx]);

  useEffect(() => {
    if (!routeIntent && !initialRouteChoice) return;
    track("mood:changed", {
      mood,
      sessionMinutes: minutes,
      source: "onboarding"
    }, { dedupeKey: `onboarding-mood:${planRequestedAt ?? "unknown"}` });
  }, [initialRouteChoice, minutes, mood, planRequestedAt, routeIntent]);

  if (allRecs.length === 0) return null;
  const applySessionIntent = (
    nextMood: Mood,
    nextMinutes?: TimeBudget,
    source: "picker" | "feedback" | "completion" | "onboarding" = "picker"
  ) => {
    setMood(nextMood);
    const defaultTime = nextMinutes ?? defaultTimeForMood(nextMood);
    if (defaultTime) setMinutes(defaultTime);
    track("mood:changed", {
      mood: nextMood,
      sessionMinutes: defaultTime ?? minutes,
      source
    });
    setShuffleIdx(0);
    setLastSuppressed(null);
    setLastCompleted(null);
  };
  const startRecommendation = (rec: Recommendation) => {
    const analytics = recommendationAnalytics(rec);
    track("recommendation:accepted", analytics);
    track("trip:started", analytics);
    setFeedback(recordRecommendationMemory({
      id: rec.id,
      kind: rec.kind,
      title: rec.title,
      action: "started",
      mood,
      routeLens,
      rsn: activeRsn,
      ...recommendationPreferenceContext(rec, minutes)
    }));
    rememberTrip(rec, "started");
    persistDecisionLifecycle(rec, "started");
    setLastStarted({ id: rec.id, title: rec.title });
    setLastCompleted(null);
    setLastSuppressed(null);
  };
  const hideRecommendation = (rec: Recommendation) => {
    track("recommendation:skipped", {
      ...recommendationAnalytics(rec),
      reason: "not_my_style"
    });
    setFeedback(recordRecommendationMemory({
      id: rec.id,
      kind: rec.kind,
      title: rec.title,
      action: "not_my_style",
      mood,
      routeLens,
      rsn: activeRsn,
      ...recommendationPreferenceContext(rec, minutes)
    }));
    setSessionSkipped((current) => recordSessionSkip(current, rec));
    rememberTrip(rec, "skipped");
    persistDecisionLifecycle(rec, "skipped");
    setLastSuppressed({ id: rec.id, kind: rec.kind, title: rec.title });
    setLastStarted(null);
    setLastCompleted(null);
  };
  const completeRecommendation = (rec: Recommendation) => {
    track("trip:completed_manual", recommendationAnalytics(rec));
    recordRecommendationMemory({
      id: rec.id,
      kind: rec.kind,
      title: rec.title,
      action: "completed_manual",
      mood,
      routeLens,
      rsn: activeRsn,
      ...recommendationPreferenceContext(rec, minutes)
    });
    setFeedback(suppressRecommendation({
      id: rec.id,
      kind: rec.kind,
      title: rec.title,
      reason: "already_done",
      mood,
      routeLens,
      rsn: activeRsn,
      ...recommendationPreferenceContext(rec, minutes)
    }));
    rememberTrip(rec, "done");
    persistDecisionLifecycle(rec, "done");
    setLastCompleted({ id: rec.id, title: rec.title });
    setLastStarted(null);
    setLastSuppressed(null);
  };
  const restoreLastSuppressed = () => {
    if (!lastSuppressed) return;
    setFeedback(restoreRecommendation(lastSuppressed.id));
    setSessionSkipped((current) => {
      const next = { ...current };
      delete next[lastSuppressed.id];
      return next;
    });
    setLastSuppressed(null);
    setShuffleIdx(0);
  };
  const markLastSuppressedTooHard = () => {
    if (!lastSuppressed) return;
    const suppressedRec = allRecs.find((rec) => rec.id === lastSuppressed.id);
    setFeedback(suppressRecommendation({
      id: lastSuppressed.id,
      kind: lastSuppressed.kind,
      title: lastSuppressed.title,
      reason: "too_hard",
      mood,
      routeLens,
      rsn: activeRsn,
      ...(suppressedRec ? recommendationPreferenceContext(suppressedRec, minutes) : {})
    }));
    if (suppressedRec) {
      track("recommendation:skipped", {
        ...recommendationAnalytics(suppressedRec),
        reason: "too_hard"
      });
    }
    applySessionIntent("chill", 30, "feedback");
  };
  const restoreLastCompleted = () => {
    if (!lastCompleted) return;
    setFeedback(restoreRecommendation(lastCompleted.id));
    setLastCompleted(null);
    setShuffleIdx(0);
  };
  const moveToAnotherPlan = () => {
    setIsRandomizing(true);
    setSelectedRecommendationId(null);
    setLastStarted(null);
    setLastCompleted(null);
    setLastSuppressed(null);
    if (activePick?.headline) {
      track("recommendation:another", {
        ...recommendationAnalytics(activePick.headline),
        nextRouteFamily: routeLens
      });
      track("recommendation:skipped", {
        ...recommendationAnalytics(activePick.headline),
        reason: "another_plan"
      });
      setSessionSkipped((current) => recordSessionSkip(current, activePick.headline));
      setFeedback(recordRecommendationMemory({
        id: activePick.headline.id,
        kind: activePick.headline.kind,
        title: activePick.headline.title,
        action: "try_another",
        mood,
        routeLens,
        rsn: activeRsn,
        ...recommendationPreferenceContext(activePick.headline, minutes)
      }));
      rememberTrip(activePick.headline, "skipped", routeLens);
    }
    setShuffleIdx((roll) => roll + 1);
  };
  const moveToChillPlan = () => {
    applySessionIntent("chill", 30, "completion");
  };
  const resetLearnedChoices = () => {
    setFeedback(clearLearnedRecommendationPreferences());
    setSessionSkipped({});
    setLastSuppressed(null);
    setLastCompleted(null);
    setShuffleIdx(0);
    setSelectedRecommendationId(null);
  };
  const fallbackRecs = activePick ? activePick.alternatives.slice(0, 2) : [];
  const selectAlternative = (rec: Recommendation) => {
    if (!activePick || rec.id === activePick.headline.id) return;
    track("recommendation:accepted", {
      ...recommendationAnalytics(rec)
    });
    setSelectedRecommendationId(rec.id);
    setLastStarted(null);
    setLastCompleted(null);
    setLastSuppressed(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <section className="min-w-0 max-w-full overflow-x-hidden">
      <div className="min-w-0 max-w-full">
      {lastSuppressed && (
        <div
          role="status"
          aria-live="polite"
          className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--color-warning)]/30 bg-[var(--color-warning)]/10 px-3.5 py-2.5 text-[12px]"
        >
          <span className="text-[var(--color-text-dim)]">
            Hidden for now: <span className="font-semibold text-[var(--color-text)]">{lastSuppressed.title}</span>.
          </span>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => applySessionIntent("cash", 60)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-warning)]/35 bg-[var(--color-bg)]/35 px-2.5 py-1.5 text-[11px] font-semibold text-[var(--color-warning)] transition-colors hover:bg-[var(--color-warning)]/10"
            >
              Need GP
            </button>
            <button
              type="button"
              onClick={() => applySessionIntent("afk", 60)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-warning)]/35 bg-[var(--color-bg)]/35 px-2.5 py-1.5 text-[11px] font-semibold text-[var(--color-warning)] transition-colors hover:bg-[var(--color-warning)]/10"
            >
              Want AFK
            </button>
            <button
              type="button"
              onClick={markLastSuppressedTooHard}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-warning)]/35 bg-[var(--color-bg)]/35 px-2.5 py-1.5 text-[11px] font-semibold text-[var(--color-warning)] transition-colors hover:bg-[var(--color-warning)]/10"
            >
              Too hard
            </button>
            <button
              type="button"
              onClick={restoreLastSuppressed}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-warning)]/35 bg-[var(--color-bg)]/35 px-2.5 py-1.5 text-[11px] font-semibold text-[var(--color-warning)] transition-colors hover:bg-[var(--color-warning)]/10"
            >
              Undo hide
            </button>
          </div>
        </div>
      )}

      {lastCompleted && (
        <div
          role="status"
          aria-live="polite"
          className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--color-good)]/30 bg-[var(--color-good)]/10 px-3.5 py-2.5 text-[12px]"
        >
          <span className="text-[var(--color-text-dim)]">
            Nice. <span className="font-semibold text-[var(--color-text)]">{lastCompleted.title}</span> is done. Pick the next move.
          </span>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={moveToAnotherPlan}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-good)]/35 bg-[var(--color-bg)]/35 px-2.5 py-1.5 text-[11px] font-semibold text-[var(--color-good)] transition-colors hover:bg-[var(--color-good)]/10"
            >
              Next trip
            </button>
            <button
              type="button"
              onClick={moveToChillPlan}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-good)]/35 bg-[var(--color-bg)]/35 px-2.5 py-1.5 text-[11px] font-semibold text-[var(--color-good)] transition-colors hover:bg-[var(--color-good)]/10"
            >
              Chill now
            </button>
            <button
              type="button"
              onClick={restoreLastCompleted}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-good)]/35 bg-[var(--color-bg)]/35 px-2.5 py-1.5 text-[11px] font-semibold text-[var(--color-good)] transition-colors hover:bg-[var(--color-good)]/10"
            >
              Undo done
            </button>
          </div>
        </div>
      )}

      <div className="min-w-0 max-w-full space-y-3">
        {activePick ? (
          <>
            <RecHeadlineExpandable
              rec={activePick.headline}
              decision={activeDecision!}
              allRecs={allRecs}
              actionContext={actionContext}
              onBossOpen={onBossOpen}
              onStart={startRecommendation}
              onSuppress={hideRecommendation}
              onComplete={completeRecommendation}
              started={(lastStarted?.id ?? latestStartedMemory?.id) === activePick.headline.id}
              mood={mood}
              hasBankContext={hasBankContext}
              bankItems={bankItems}
              accountMode={accountMode}
              pluginSyncState={pluginSyncState}
            />
            {fallbackRecs.length > 0 && (
              <section className="pt-2" aria-labelledby="next-alternatives-title">
                <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
                  <div>
                    <p className="eyebrow text-[var(--color-accent)]">Not your trip?</p>
                    <h3 id="next-alternatives-title" className="mt-1 text-[18px] font-black text-[var(--color-text)]">
                      Choose a different vibe
                    </h3>
                  </div>
                  <p className="text-[11.5px] font-semibold text-[var(--color-text-muted)]">Two different session routes.</p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {fallbackRecs.map((rec) => (
                    <RecRowExpandable
                      key={rec.id}
                      rec={rec}
                      onSelect={selectAlternative}
                      backupPrompt={backupChoicePrompt(rec, activePick.headline)}
                    />
                  ))}
                </div>
              </section>
            )}
            <details className="group rounded-xl border border-[var(--color-border)] bg-[var(--color-panel)]/35 px-3.5 py-3">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-[12px] font-bold text-[var(--color-text-dim)] marker:hidden [&::-webkit-details-marker]:hidden">
                <span>Want a different kind of session?</span>
                <span className="inline-flex items-center gap-1.5 text-[var(--color-accent)]">
                  {MOOD_LABEL[visibleMood(mood)].name}
                  <ChevronRight className="size-3.5 transition-transform group-open:rotate-90" />
                </span>
              </summary>
              <div className="mt-3">
                <SessionMoodGrid
                  mood={mood}
                  onPick={applySessionIntent}
                  onSurprise={moveToAnotherPlan}
                />
              </div>
            </details>
            {lastStarted && !lastSuppressed && !lastCompleted && (
              <div
                role="status"
                aria-live="polite"
                className="rounded-xl border border-[var(--color-accent)]/20 bg-[var(--color-accent)]/8 px-3.5 py-2.5 text-[12px] font-semibold leading-relaxed text-[var(--color-text-dim)]"
              >
                Started: <span className="font-semibold text-[var(--color-text)]">{lastStarted.title}</span>. Mark it done when the finish condition is true.
              </div>
            )}
            {(choiceHiddenCount > 0 || preferenceProfile.evidenceCount > 0) && (
              <button
                type="button"
                onClick={resetLearnedChoices}
                className="text-[11px] font-semibold text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-accent)]"
              >
                Reset learned choices{choiceHiddenCount > 0 ? ` (${choiceHiddenCount} hidden)` : ""}
              </button>
            )}
          </>
        ) : (
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-panel)] p-8 text-center text-[var(--color-text-muted)] text-[13px]">
            {hiddenCount > 0
              ? "Everything matching this mood is hidden. Restore hidden picks or change mood/time."
              : "No safe trip fits this exact mood and time yet. Pick another vibe or a longer session."}
          </div>
        )}
      </div>

      </div>
    </section>
  );
}

// ── RouteNeeds ──────────────────────────────────────────────────────────────
// Collapsed evidence layer for the Session Board. Every lane is framed as an
// unlock planner: missing step, first action, prep and stop point.

function RouteNeeds({
  pathData
}: {
  pathData: NextUpResult["pathProgress"];
  maxEstimate: NextUpResult["maxEstimate"];
}) {
  const routes = pathData.unlockRoutes.slice(0, 9);

  return (
    <section>
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="eyebrow text-[var(--color-accent)]">Routes to inspect</h3>
          <p className="mt-1 text-[12px] text-[var(--color-text-muted)]">
            Pick the route with the smallest missing step.
          </p>
        </div>
        <span className="rounded-full border border-[var(--color-border)] bg-[var(--color-bg)]/35 px-2.5 py-1 text-[10.5px] font-bold text-[var(--color-text-muted)]">
          {pathData.overallPercent}% mapped
        </span>
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {routes.map((route) => (
          <article key={route.id} className="rounded-lg border border-[var(--color-border)] bg-[var(--color-panel)]/82 p-4">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)]/45">
                {route.iconItemId ? (
                  <ItemSprite id={route.iconItemId} alt={route.title} size={28} />
                ) : (
                  <MapIcon className="size-5 text-[var(--color-accent)]" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h4 className="text-[14px] font-bold leading-tight text-[var(--color-text)]">{route.title}</h4>
                  <span className={cn(
                    "rounded-full border px-2 py-0.5 text-[10px] font-bold",
                    route.blockersLeft === 0
                      ? "border-[var(--color-good)]/30 bg-[var(--color-good)]/10 text-[var(--color-good)]"
                      : "border-[var(--color-warning)]/30 bg-[var(--color-warning)]/10 text-[var(--color-warning)]"
                  )}>
                    {route.primaryLabel}
                  </span>
                </div>
                <p className="mt-1 text-[11.5px] leading-relaxed text-[var(--color-text-muted)]">{route.why}</p>
              </div>
            </div>

            <div className="mt-3 grid gap-2 text-[11.5px]">
              <RoutePlanLine label="Need first" value={route.nextBlocker} />
              <RoutePlanLine label="First action" value={route.nextAction} strong />
              <RoutePlanLine label="Prep" value={`${route.prepLevel} · ${route.blockersLeft} step${route.blockersLeft === 1 ? "" : "s"}`} />
              <RoutePlanLine label="Stop" value={route.stopPoint} />
            </div>

            {route.blockers.length > 1 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {route.blockers.slice(1, 4).map((blocker, index) => (
                  <span
                    key={`${route.id}:${blocker.type}:${blocker.label}:${index}`}
                    className="rounded border border-[var(--color-border)] bg-[var(--color-bg)]/35 px-2 py-1 text-[10px] font-semibold text-[var(--color-text-muted)]"
                  >
                    {blocker.label}
                  </span>
                ))}
              </div>
            )}

            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-[var(--color-border)]/60 pt-3 text-[10.5px] text-[var(--color-text-dim)]">
              <span>{route.payoff}</span>
              <span className="tabular-nums">{route.progressPercent}% mapped</span>
            </div>
            {route.accountTypeNote && (
              <p className="mt-2 text-[10.5px] leading-relaxed text-[var(--color-text-muted)]">{route.accountTypeNote}</p>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}

function RoutePlanLine({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="grid grid-cols-[76px_minmax(0,1fr)] gap-2">
      <span className="text-[10px] uppercase tracking-[0.16em] text-[var(--color-text-dim)]">{label}</span>
      <span className={cn(
        "min-w-0 leading-snug",
        strong ? "font-semibold text-[var(--color-text)]" : "text-[var(--color-text-muted)]"
      )}>
        {value}
      </span>
    </div>
  );
}

// ── RecHeadlineExpandable + RecRowExpandable ───────────────────────────────
// Wrappers rond NextTripCard / RecRow die een details-paneel toevoegen.
// Klik op de "Show details" toggle → expand inline (geen navigatie weg).
// Details bevat: payoff, needs[], details-tekst, en de link-naar-tool.
// Werkt voor zowel hero als alt-rows (zelfde details, andere
// presentation density).

function DiaryReadinessDetail({ rec, rsn }: { rec: Recommendation; rsn?: string }) {
  const progress = rec.diaryProgress;
  const [manualChecks, setManualChecks] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (!progress || !rsn) return;
    const reload = () => setManualChecks(loadDiaryTaskChecks(rsn));
    reload();
    window.addEventListener(DIARY_PROGRESS_EVENT, reload);
    return () => window.removeEventListener(DIARY_PROGRESS_EVENT, reload);
  }, [progress, rsn]);
  if (rec.kind !== "diary" || !progress) return null;

  const tasks = progress.tasks.map((task) => manualChecks.has(task.id) && task.status !== "done"
    ? { ...task, status: "done" as const, evidence: "manual" as const }
    : task);
  const remaining = tasks.filter((task) => task.status !== "done");
  const nextSweep = remaining.slice(0, 3);
  const later = remaining.slice(3);
  const completed = progress.totalTasks - remaining.length;
  const toggle = (taskId: string, checked: boolean) => {
    if (!rsn) return;
    setManualChecks(setDiaryTaskChecked(rsn, taskId, checked));
  };

  return (
    <section className="overflow-hidden rounded-lg border border-[var(--color-accent)]/30 bg-[var(--color-bg)]/35">
      <div className="flex items-center gap-3 border-b border-[var(--color-border)] px-3 py-3">
        <ItemSprite id={progress.rewardItemId} alt={progress.rewardName} size={42} />
        <div className="min-w-0 flex-1">
          <p className="font-serif text-[17px] font-semibold text-[var(--color-text)]">{progress.rewardName}</p>
          <p className="text-[11.5px] text-[var(--color-text-muted)]">
            {progress.completionEvidence
              ? `Already complete · proven by ${progress.completionEvidence === "runelite" ? "RuneLite" : "the reward in your bank"}`
              : `${completed}/${progress.totalTasks} checked · ${remaining.length} to confirm`}
          </p>
        </div>
      </div>

      {!progress.completionEvidence && nextSweep.length > 0 && (
        <div className="px-3 py-3">
          {progress.blockers.length > 0 && (
            <p className="mb-3 rounded-md border border-[var(--color-warning)]/25 bg-[var(--color-warning)]/8 px-3 py-2 text-[11.5px] leading-snug text-[var(--color-text-secondary)]">
              <span className="font-bold text-[var(--color-warning)]">Before this sweep:</span> {progress.blockers.slice(0, 3).join(" · ")}
            </p>
          )}
          <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--color-accent)]">{progress.blockers.length > 0 ? "Next sweep" : "Do these next"}</p>
          <div className="space-y-1.5">
            {nextSweep.map((task) => (
              <label key={task.id} className="flex cursor-pointer items-start gap-2.5 rounded-md px-2 py-2 transition-colors hover:bg-[var(--color-accent)]/8">
                <input
                  type="checkbox"
                  checked={task.status === "done"}
                  onChange={(event) => toggle(task.id, event.currentTarget.checked)}
                  disabled={!rsn}
                  className="mt-0.5 size-4 accent-[var(--color-accent)]"
                />
                <span className="min-w-0">
                  <span className="block text-[12.5px] font-semibold leading-snug text-[var(--color-text)]">{task.label}</span>
                  {task.requirements.length > 0 && (
                    <span className="mt-0.5 block text-[11px] leading-snug text-[var(--color-text-muted)]">Before: {task.requirements.slice(0, 2).join(" · ")}</span>
                  )}
                </span>
              </label>
            ))}
          </div>
        </div>
      )}

      {!progress.completionEvidence && remaining.length === 0 && (
        <p className="px-4 py-4 text-[12.5px] font-semibold text-[var(--color-accent)]">Claim {progress.rewardName}, then press Sync in RuneLite.</p>
      )}

      {later.length > 0 && (
        <details className="border-t border-[var(--color-border)] px-3 py-2.5">
          <summary className="cursor-pointer list-none text-[11.5px] font-semibold text-[var(--color-text-muted)] marker:hidden">See all {remaining.length} remaining tasks</summary>
          <div className="mt-2 space-y-1">
            {later.map((task) => (
              <label key={task.id} className="flex cursor-pointer items-start gap-2 rounded-md px-2 py-1.5 hover:bg-[var(--color-accent)]/8">
                <input type="checkbox" checked={task.status === "done"} onChange={(event) => toggle(task.id, event.currentTarget.checked)} disabled={!rsn} className="mt-0.5 size-4 accent-[var(--color-accent)]" />
                <span className="text-[11.5px] leading-snug text-[var(--color-text-secondary)]">{task.label}</span>
              </label>
            ))}
          </div>
        </details>
      )}

      <p className="border-t border-[var(--color-border)] px-4 py-2.5 text-[11px] leading-snug text-[var(--color-text-muted)]">Stop after {progress.stopPoint}</p>
    </section>
  );
}

function QuestRouteDetail({ rec }: { rec: Recommendation }) {
  const route = rec.questRoute;
  if (rec.kind !== "quest" || !route) return null;

  return (
    <section className="overflow-hidden rounded-lg border border-[var(--color-accent)]/30 bg-[var(--color-bg)]/35">
      <div className="flex items-center gap-3 border-b border-[var(--color-border)] px-3 py-3">
        <ItemSprite id={9813} alt="Quest route" size={42} />
        <div className="min-w-0 flex-1">
          <p className="font-serif text-[17px] font-semibold text-[var(--color-text)]">{route.activeQuestName}</p>
          <p className="text-[11.5px] text-[var(--color-text-muted)]">
            {route.activeIsTarget ? route.payoff : `Toward ${route.targetQuestName} · ${route.payoff}`}
          </p>
        </div>
        <span className="shrink-0 text-[11px] font-bold text-[var(--color-accent)]">{route.expectedBlock}</span>
      </div>

      <div className="space-y-3 px-3 py-3">
        <p className="text-[12.5px] font-semibold leading-relaxed text-[var(--color-text)]">{route.whyThisBlock}</p>
        {route.completionEvidence === "unknown" && (
          <p className="rounded-md border border-[var(--color-warning)]/25 bg-[var(--color-warning)]/8 px-3 py-2 text-[11.5px] leading-snug text-[var(--color-text-secondary)]">
            Check RuneLite before committing to the full chain; completed prerequisites are not guessed.
          </p>
        )}
        {route.skillPreparation.length > 0 && (
          <RoutePlanLine label="Train" value={route.skillPreparation.slice(0, 2).join(" · ")} strong />
        )}
        {route.ownedItems.length > 0 && (
          <RoutePlanLine label="From bank" value={route.ownedItems.slice(0, 3).join(" · ")} />
        )}
        {route.missingItems.length > 0 && (
          <RoutePlanLine label="Get first" value={route.missingItems.slice(0, 3).join(" · ")} strong />
        )}
        {route.ownedItems.length === 0 && route.missingItems.length === 0 && (
          <RoutePlanLine label="Bank" value={route.bankNote} />
        )}
        <RoutePlanLine label="Boosts" value={route.boostAssumption} />
        <RoutePlanLine label="Stop" value={route.stopPoint} strong />
        {route.nextQuestName && <RoutePlanLine label="Next" value={route.nextQuestName} />}
      </div>
    </section>
  );
}

function RecDetailPanel({
  rec,
  actionContext,
  whyNot
}: {
  rec: Recommendation;
  actionContext: RecommendationActionContext;
  whyNot?: string | null;
}) {
  // Fallback naar default hints wanneer rec ze niet expliciet meegaf.
  const hints = defaultActionHints(rec.kind);
  const needs = rec.needs ?? hints.needs;
  const details = rec.details ?? hints.details;
  const payoff = headlinePayoff(rec);
  const linkedAction = rec.link ? routeActionForHref(rec.link, actionContext) : null;
  const wikiQuery = recommendationWikiQuery(rec);
  return (
    <div className="mt-2 px-4 py-3 rounded-lg bg-[var(--color-bg-2)]/40 border border-[var(--color-border)] animate-[fade-in_0.2s_ease-out] space-y-2.5">
      {rec.kind !== "diary" && !rec.questRoute && !rec.calculableRoute && <ActionPlanBlock rec={rec} />}
      <DiaryReadinessDetail rec={rec} rsn={actionContext.rsn ?? undefined} />
      <QuestRouteDetail rec={rec} />
      {rec.kind !== "diary" && !rec.questRoute && <p className="text-[12.5px] text-[var(--color-text-dim)] leading-relaxed">
        {rec.why}
      </p>}
      {rec.kind !== "diary" && !rec.questRoute && payoff && (
        <p className="text-[12px] font-semibold text-[var(--color-text-secondary)] leading-relaxed">
          {payoff}
        </p>
      )}
      {hasDropChanceGraph(rec) && (
        <LazyKcProbabilityGraph
          kc={rec.kcMeta.kc}
          denom={rec.kcMeta.denom}
          dropName={rec.kcMeta.dropName}
        />
      )}
      {rec.kind !== "diary" && !rec.questRoute && details && (
        <p className="text-[12.5px] text-[var(--color-text-dim)] leading-relaxed">
          {details}
        </p>
      )}
      {whyNot && (
        <p className="flex gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)]/35 px-3 py-2 text-[12px] font-semibold leading-relaxed text-[var(--color-text-muted)]">
          <Shield className="mt-0.5 size-3.5 shrink-0 text-[var(--color-text-muted)]" />
          <span>{whyNot}</span>
        </p>
      )}
      {rec.kind !== "diary" && !rec.questRoute && !rec.calculableRoute && needs.length > 0 && (
        <div>
          <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--color-text-muted)] mb-1.5">
            You'll need
          </div>
          <ul className="space-y-1">
            {needs.map((n, i) => (
              <li key={i} className="text-[12px] text-[var(--color-text)] flex items-baseline gap-2">
                <span className="size-1 rounded-full bg-[var(--color-accent)] inline-block translate-y-[-2px] shrink-0" />
                {n}
              </li>
            ))}
          </ul>
        </div>
      )}
      {(rec.link || wikiQuery) && (
        <div className="flex flex-wrap items-center gap-2 pt-1">
          {rec.link && (
            <Link
              href={recommendationHrefWithContext(rec.link, actionContext)}
              className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-[var(--color-accent)] hover:underline"
            >
              {linkedAction?.label ?? "Open Scapestack route"} <ArrowRight className="size-3.5" />
            </Link>
          )}
          {wikiQuery && (
            <a
              href={wikiSearchUrl(wikiQuery)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-md border border-[var(--color-border)] bg-[var(--color-bg)]/45 px-2.5 py-1 text-[11.5px] font-semibold text-[var(--color-text-dim)] transition-colors hover:border-[var(--color-accent)]/45 hover:text-[var(--color-accent)]"
              aria-label={`Open OSRS Wiki for ${wikiQuery}`}
            >
              OSRS Wiki
              <ExternalLink className="size-3" />
            </a>
          )}
        </div>
      )}
    </div>
  );
}

function recommendationWikiQuery(rec: Recommendation): string {
  if (rec.kind === "kc" || rec.kind === "boss") {
    const boss = rec.bossSlug ? BOSSES.find((candidate) => candidate.slug === rec.bossSlug) : null;
    if (boss) return boss.name;
  }
  return rec.title
    .replace(/^Try\s+/i, "")
    .replace(/^Do\s+/i, "")
    .replace(/^Push\s+/i, "")
    .replace(/^Finish\s+/i, "")
    .replace(/\s+to\s+\d+\s*(?:KC)?$/i, "")
    .replace(/\s+KC$/i, "")
    .trim();
}

function RecHeadlineExpandable({
  rec,
  decision,
  allRecs,
  actionContext,
  onBossOpen,
  onStart,
  onSuppress,
  onComplete,
  started = false,
  mood,
  hasBankContext,
  bankItems,
  accountMode,
  pluginSyncState
}: {
  rec: Recommendation;
  decision: RecommendationDecision;
  allRecs: Recommendation[];
  actionContext: RecommendationActionContext;
  onBossOpen: (slug: string) => void;
  onStart: (rec: Recommendation) => void;
  onSuppress: (rec: Recommendation) => void;
  onComplete: (rec: Recommendation) => void;
  started?: boolean;
  mood: Mood;
  hasBankContext: boolean;
  bankItems: BankHandoffItem[];
  accountMode: NextUpResult["summary"]["accountMode"];
  pluginSyncState: "live" | "stale" | "outdated" | null;
}) {
  const [open, setOpen] = useState(false);
  const tripDetailsRef = useDialogA11y<HTMLElement>(open, () => setOpen(false));
  const whyNot = recommendationWhyNot({ headline: rec, allRecs, mood, hasBankContext, pluginSyncState });

  const unknownNotes = decision.unknowns.map((unknown) => {
    if (unknown.code === "bank_setup") return "Your exact setup is not known, so the bring list stays conservative.";
    if (unknown.code === "runelite_completion") return "RuneLite can confirm whether this progress is already finished.";
    return "Public progress is limited, so the route avoids narrow assumptions.";
  });

  return (
    <div>
      <NextTripCard
        rec={rec}
        decision={decision}
        actionContext={actionContext}
        onBossOpen={onBossOpen}
        onStart={onStart}
        hasBankContext={hasBankContext}
        bankItems={bankItems}
        accountMode={accountMode}
      />
      <div className="mt-2 flex justify-end">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex min-h-11 items-center gap-1.5 px-1 text-[12px] font-bold text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-accent)]"
          aria-expanded={open}
          aria-haspopup="dialog"
        >
          Trip details <ChevronRight className="size-3.5" />
        </button>
      </div>
      {open && createPortal((
        <div className="fixed inset-0 z-[120] flex items-end justify-center bg-black/76 p-0 backdrop-blur-sm sm:items-center sm:p-6">
          <div
            aria-hidden="true"
            className="absolute inset-0 cursor-default"
            onClick={() => setOpen(false)}
          />
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="trip-details-title"
            aria-describedby="trip-details-description"
            ref={tripDetailsRef}
            tabIndex={-1}
            className="osrs-frame relative max-h-[92dvh] w-full overflow-y-auto rounded-b-none sm:max-w-2xl sm:rounded-lg"
          >
            <header className="osrs-title-bar sticky top-0 z-10 flex items-start justify-between gap-4 px-5 py-4">
              <div className="min-w-0">
                <p className="eyebrow text-[var(--color-accent)]">Trip details</p>
                <h2 id="trip-details-title" className="mt-1 break-words text-[22px] font-semibold leading-tight text-[var(--color-text)]">
                  {rec.title}
                </h2>
                <p id="trip-details-description" className="sr-only">
                  Trip details, steps and follow-up actions for this recommendation.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close trip details"
                className="inline-flex size-10 shrink-0 items-center justify-center rounded-full border border-[var(--color-border)] text-[var(--color-text-muted)] transition-colors hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]"
              >
                <X className="size-4" />
              </button>
            </header>
            <div className="osrs-body space-y-4 p-4 sm:p-5">
              <RouteChainScroll rec={rec} onStart={onStart} />
              <RecDetailPanel rec={rec} actionContext={actionContext} whyNot={whyNot} />
              {unknownNotes.length > 0 && (
                <div className="border-t border-[var(--color-parchment-edge)] pt-4">
                  <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[var(--color-accent)]">Kept conservative</p>
                  <ul className="mt-2 space-y-1.5 text-[12px] font-semibold leading-relaxed text-[var(--color-text-muted)]">
                    {unknownNotes.map((note) => <li key={note}>{note}</li>)}
                  </ul>
                </div>
              )}
              <div className="flex flex-col gap-2 border-t border-[var(--color-parchment-edge)] pt-4 sm:flex-row">
                {!started && (
                  <button type="button" onClick={() => onStart(rec)} className="btn-ghost min-h-11 justify-center text-[12px] font-bold">
                    Mark trip started
                  </button>
                )}
                <button type="button" onClick={() => onComplete(rec)} className="btn-ghost min-h-11 justify-center text-[12px] font-bold">
                  Mark done
                </button>
                <button type="button" onClick={() => onSuppress(rec)} className="btn-ghost min-h-11 justify-center text-[12px] font-bold">
                  Less like this
                </button>
              </div>
            </div>
          </section>
        </div>
      ), document.body)}
    </div>
  );
}

function RecRowExpandable({
  rec,
  onSelect,
  backupPrompt
}: {
  rec: Recommendation;
  onSelect: (rec: Recommendation) => void;
  backupPrompt?: { label: string; helper: string };
}) {
  return (
    <RecRow
      rec={rec}
      onSelect={onSelect}
      backupPrompt={backupPrompt}
    />
  );
}
