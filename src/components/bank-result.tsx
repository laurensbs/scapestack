"use client";

import Link from "next/link";
import { useState, useMemo, useCallback, useEffect, useRef, createContext, useContext } from "react";
import { createPortal } from "react-dom";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  TouchSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  useDndContext,
  pointerWithin,
  rectIntersection,
  type DragEndEvent,
  type DragStartEvent,
  type CollisionDetection
} from "@dnd-kit/core";
import {
  Copy, CheckCheck, Coins, Layers, AlertCircle, Edit3,
  TrendingDown, Hash, ArrowUpDown, ArrowRight,
  LayoutGrid, Rows3, EyeOff, SlidersHorizontal, Share2,
  Wand2, ChevronDown, Sparkles, Trash2, Hourglass, Target, Sword, Grid2x2, Search, X,
  Pin, GripVertical, RotateCcw, Save, ExternalLink, CheckCircle2, Shield, PlugZap
} from "lucide-react";
import { encodeSnapshot } from "@/lib/share";
import { BANK_FILLER_ID } from "@/lib/bank-filler";
import type { ShareSnapshot } from "@/lib/share";
import { presetsForTab, layoutWithPreset, type Preset } from "@/lib/presets";
import { cn, formatQty, formatGp, qtyColor, spriteIdForItem } from "@/lib/utils";
import type { OrganizedTab, OrganizedItem, OrganizeResult } from "@/lib/organizer";
import { reorganizeTabs, type ReorganizeStrategy } from "@/lib/reorganize";
import { ARCHETYPES, type Archetype } from "@/lib/archetype";
import { buildUseCaseTabs, USE_CASE_ORDER, type UseCaseTab } from "@/lib/use-case-tabs";
import { exportAction } from "@/app/actions";
import { SuggestionsPanel } from "./suggestions-panel";
import { DiffBanner } from "./diff-banner";
import { TipsCard } from "./tips-card";
import { ItemSprite } from "./item-sprite";
import { computeTips, type BankTip } from "@/lib/tips";
import { track } from "@/lib/analytics";
import { StackScoreBadge } from "./stack-score-badge";
import { computeStackScore } from "@/lib/stack-score";
import { pushScorePoint, type ScorePoint } from "@/lib/score-history";
import { isJunkCandidate, summarizeJunk, listJunkItems } from "@/lib/junk";
import { recordSnapshot, daysSinceChanged, type ItemHistory } from "@/lib/item-history";
import { matchGoals, summarizeGoalProgress, type GoalMatch } from "@/lib/goal-match";
import { suggestUpgrades, ownedIdSet, type UpgradeSuggestion } from "@/lib/upgrades";
import type { HiscoreSkill } from "@/lib/hiscores";
import { BOSSES, type Boss } from "@/lib/bosses";
import { BossSprite } from "./boss-picker";
import { ownedGear } from "@/lib/gear";
import { bestStyleAndSetup } from "@/lib/dps";
import { exportTag } from "@/lib/bank-tags";
import { DiscordWebhookCard } from "./discord-webhook-card";
import { SupportCard } from "./support-card";
import type { ReadyToLeaveItem, ReadyToLeaveStatus } from "./ready-to-leave";
import { buildItemVerdict, type ItemVerdictTone } from "@/lib/item-action";
import { copyText } from "@/lib/clipboard";
import { buildBankActionLoop, type BankActionLoopInput, type BankActionLoopStep } from "@/lib/bank-action-loop";
import { buildItemIdentity } from "@/lib/item-identity";
import type { PluginHubStatus } from "@/lib/plugin-hub-status";
import { persistBankHandoffPayload } from "@/lib/next-bank-handoff";
import { rsnSlug } from "@/lib/hiscores";
import { loadWebhookConfig, sendBankUpdate } from "@/lib/discord";
import {
  diffSnapshots,
  loadSnapshot,
  saveSnapshot,
  snapshotBank,
  type BankDiff,
  type BankSnapshot
} from "@/lib/diff";
import {
  appendSnapshot,
  deleteSnapshot,
  restoreDeletedSnapshot,
  summarizeTabsForSnapshot,
  type SnapshotSummary
} from "@/lib/snapshot-history";
import {
  buildSnapshotCompareShareText,
  recommendSnapshotCompareActions,
  summarizeSnapshotCompare
} from "@/lib/snapshot-compare-summary";
import { bankToolUrl } from "@/lib/bank-tool-routes";
import { bankSearchQueryForItems, countBankSearchMatches, firstMatchingBankTabIndex, matchesBankSearch } from "@/lib/bank-search";
import { wikiSearchUrl } from "@/lib/wiki";
import { ACCOUNT_MODE_ICON_ITEM_IDS, accountModePlanningTone } from "@/lib/account-type";

interface BankResultProps {
  initial: OrganizeResult;
  initialStrings: string[];
  onEditInput: () => void;
  inferredArchetype?: Archetype | null;
  inferredRsn?: string | null;
  hiscoreSkills?: HiscoreSkill[] | null;
  returnBossSlug?: string | null;
  initialMode?: string | null;
}

type SortMode = "default" | "value" | "quantity" | "name";
type Density = "ultra" | "compact" | "comfortable";
type TabMode = "type" | "useCase";
const PREFS_KEY = "scapestack-bank:prefs";
type BankPluginHubActionState = NonNullable<BankActionLoopInput["pluginHubState"]>;
type BankDecisionAction = "next" | "dps" | "copy" | "tidy";
type SmartTidyStage = "closed" | "choosing" | "preview" | "applying" | "applied";
type SmartTidyPlaystyle = "pvm" | "ironman" | "skilling" | "questing" | "minimal";
type SmartTidyFront = "gear" | "teleports" | "supplies" | "current";

interface SmartTidyPreset {
  id: SmartTidyPlaystyle;
  label: string;
  helper: string;
  archetype: Archetype;
  order: UseCaseTab[];
}

const SMART_TIDY_PRESETS: SmartTidyPreset[] = [
  {
    id: "pvm",
    label: "PvM",
    helper: "PvM gear first",
    archetype: "pvm",
    order: ["PvM Gear", "Teleports", "Potions", "Drops", "Skilling", "Quest", "Clue", "Cosmetic", "Misc"]
  },
  {
    id: "ironman",
    label: "Ironman",
    helper: "Quest items kept together",
    archetype: "ironman",
    order: ["Teleports", "Quest", "Potions", "Skilling", "PvM Gear", "Drops", "Clue", "Cosmetic", "Misc"]
  },
  {
    id: "skilling",
    label: "Skilling",
    helper: "Tools and supplies first",
    archetype: "skiller",
    order: ["Skilling", "Teleports", "Potions", "Quest", "PvM Gear", "Drops", "Clue", "Cosmetic", "Misc"]
  },
  {
    id: "questing",
    label: "Questing",
    helper: "Quest and diary items first",
    archetype: "main",
    order: ["Quest", "Teleports", "Skilling", "Potions", "PvM Gear", "Drops", "Clue", "Cosmetic", "Misc"]
  },
  {
    id: "minimal",
    label: "Minimal",
    helper: "Teleports, gear, supplies",
    archetype: "unspecified",
    order: ["Teleports", "PvM Gear", "Potions", "Quest", "Skilling", "Drops", "Clue", "Cosmetic", "Misc"]
  }
];

const SMART_TIDY_FRONT_CHOICES: Array<{ id: SmartTidyFront; label: string; helper: string; tab?: UseCaseTab }> = [
  { id: "gear", label: "Gear", helper: "PvM gear first", tab: "PvM Gear" },
  { id: "teleports", label: "Teleports", helper: "Teleports near the top", tab: "Teleports" },
  { id: "supplies", label: "Supplies", helper: "Potions and food close", tab: "Potions" },
  { id: "current", label: "Current grind", helper: "Keep this tab first" }
];

type SmartTidyPrefs = {
  playstyle: SmartTidyPlaystyle;
  front: SmartTidyFront;
};

const SMART_TIDY_PREFS_KEY = "scapestack-bank:smart-tidy";
const DEFAULT_SMART_TIDY_PREFS: SmartTidyPrefs = { playstyle: "pvm", front: "gear" };

function isSmartTidyPlaystyle(value: unknown): value is SmartTidyPlaystyle {
  return typeof value === "string" && SMART_TIDY_PRESETS.some((preset) => preset.id === value);
}

function isSmartTidyFront(value: unknown): value is SmartTidyFront {
  return typeof value === "string" && SMART_TIDY_FRONT_CHOICES.some((choice) => choice.id === value);
}

function readSmartTidyPrefs(): SmartTidyPrefs {
  if (typeof window === "undefined") return DEFAULT_SMART_TIDY_PREFS;
  try {
    const raw = window.localStorage.getItem(SMART_TIDY_PREFS_KEY);
    if (!raw) return DEFAULT_SMART_TIDY_PREFS;
    const parsed = JSON.parse(raw) as Partial<SmartTidyPrefs>;
    return {
      playstyle: isSmartTidyPlaystyle(parsed.playstyle) ? parsed.playstyle : DEFAULT_SMART_TIDY_PREFS.playstyle,
      front: isSmartTidyFront(parsed.front) ? parsed.front : DEFAULT_SMART_TIDY_PREFS.front
    };
  } catch {
    return DEFAULT_SMART_TIDY_PREFS;
  }
}

function writeSmartTidyPrefs(prefs: SmartTidyPrefs): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(SMART_TIDY_PREFS_KEY, JSON.stringify(prefs));
  } catch {
    // localStorage can be unavailable in private windows; Smart Tidy still works.
  }
}

function moveTabToFront(order: UseCaseTab[], tab: string | null | undefined): UseCaseTab[] {
  if (!tab || !USE_CASE_ORDER.includes(tab as UseCaseTab)) return order;
  const useCaseTab = tab as UseCaseTab;
  return [useCaseTab, ...order.filter((name) => name !== useCaseTab)];
}

function smartTidyOrder(playstyle: SmartTidyPlaystyle, front: SmartTidyFront, currentTabName?: string | null): UseCaseTab[] {
  const preset = SMART_TIDY_PRESETS.find((item) => item.id === playstyle) ?? SMART_TIDY_PRESETS[0];
  const frontChoice = SMART_TIDY_FRONT_CHOICES.find((item) => item.id === front);
  if (front === "current") return moveTabToFront(preset.order, currentTabName);
  return moveTabToFront(preset.order, frontChoice?.tab);
}

function orderTabsForSmartTidy(tabs: OrganizedTab[], order: UseCaseTab[]): OrganizedTab[] {
  const rank = new Map(order.map((name, index) => [name, index]));
  return tabs
    .map((tab, index) => ({ tab, index }))
    .sort((a, b) => {
      const ar = rank.has(String(a.tab.name) as UseCaseTab) ? rank.get(String(a.tab.name) as UseCaseTab)! : 999;
      const br = rank.has(String(b.tab.name) as UseCaseTab) ? rank.get(String(b.tab.name) as UseCaseTab)! : 999;
      if (ar !== br) return ar - br;
      return a.index - b.index;
    })
    .map((entry) => entry.tab);
}

function buildSmartTidyLayout(tabs: OrganizedTab[], playstyle: SmartTidyPlaystyle, front: SmartTidyFront, currentTabName?: string | null): OrganizedTab[] {
  const preset = SMART_TIDY_PRESETS.find((item) => item.id === playstyle) ?? SMART_TIDY_PRESETS[0];
  const smartTabs = reorganizeTabs(tabs, "smart", preset.archetype);
  const useCaseTabs = buildUseCaseTabs(smartTabs, preset.archetype);
  return orderTabsForSmartTidy(useCaseTabs, smartTidyOrder(playstyle, front, currentTabName));
}

function smartTidyArchetype(playstyle: SmartTidyPlaystyle): Archetype {
  return SMART_TIDY_PRESETS.find((item) => item.id === playstyle)?.archetype ?? "unspecified";
}

interface BankDecision {
  iconItemId: number;
  title: string;
  why: string;
  firstStep: string;
  stopPoint: string;
  avoid: string;
  primaryAction: BankDecisionAction;
  primaryLabel: string;
  secondaryAction: BankDecisionAction;
  secondaryLabel: string;
}

interface BankReadyToLeave {
  status: ReadyToLeaveStatus;
  items: ReadyToLeaveItem[];
}

const BANK_FOOD_RE = /\b(anglerfish|manta ray|dark crab|sea turtle|shark|monkfish|karambwan|saradomin brew|tuna potato)\b/i;
const BANK_TELEPORT_RE = /\b(teleport|tablet|scroll of redirection|house tab|xeric|glory|dueling|games necklace|skills necklace|combat bracelet|drakan|ectophial|royal seed pod|crystal seed)\b/i;

function hasBankItem(items: OrganizedItem[], pattern: RegExp): boolean {
  return items.some((item) => pattern.test(item.name));
}

function buildBankReadyToLeave({
  items,
  weaponCount,
  stopPoint
}: {
  items: OrganizedItem[];
  weaponCount: number;
  stopPoint: string;
}): BankReadyToLeave {
  const hasFood = hasBankItem(items, BANK_FOOD_RE);
  const hasTeleport = hasBankItem(items, BANK_TELEPORT_RE);
  const status: ReadyToLeaveStatus = weaponCount === 0
    ? "Skip for now"
    : !hasFood
    ? "Bring food"
    : !hasTeleport
    ? "Pick a teleport"
    : "Good first trip";

  return {
    status,
    items: [
      {
        label: "Gear",
        value: weaponCount > 0 ? `${weaponCount} weapon${weaponCount === 1 ? "" : "s"}` : "Add combat gear",
        tone: weaponCount > 0 ? "good" : "warn"
      },
      {
        label: "Food",
        value: hasFood ? "Found" : "Bring food",
        tone: hasFood ? "good" : "warn"
      },
      {
        label: "Teleport",
        value: hasTeleport ? "Found" : "Pick a teleport",
        tone: hasTeleport ? "good" : "warn"
      },
      {
        label: "Stop point",
        value: stopPoint,
        tone: "neutral"
      }
    ]
  };
}

function buildBankDecision({
  weaponCount,
  tipCount,
  tipSlotsFreed,
  totalValue,
  totalItems,
  hasPrices,
  focusMode
}: {
  weaponCount: number;
  tipCount: number;
  tipSlotsFreed: number;
  totalValue: number;
  totalItems: number;
  hasPrices: boolean;
  focusMode?: string | null;
}): BankDecision {
  if ((focusMode === "tidy" || weaponCount === 0) && tipCount > 0) {
    const slotCopy = tipSlotsFreed > 0
      ? `${tipSlotsFreed} slot${tipSlotsFreed === 1 ? "" : "s"}`
      : "a few slots";

    return {
      iconItemId: 8007,
      title: `Clean ${slotCopy} before your next trip`,
      why: `Scapestack found ${tipCount} quick bank cleanup move${tipCount === 1 ? "" : "s"} that can make gearing less annoying.`,
      firstStep: "Run Smart tidy, then copy the tabs back to RuneLite.",
      stopPoint: "Finish after gear, supplies and teleports are easy to find.",
      avoid: "Avoid dragging every item by hand.",
      primaryAction: "tidy",
      primaryLabel: "Smart tidy",
      secondaryAction: "copy",
      secondaryLabel: "Copy to RuneLite"
    };
  }

  if (weaponCount > 0) {
    return {
      iconItemId: 4151,
      title: "Check one boss trip before buying upgrades",
      why: `${weaponCount} combat weapon${weaponCount === 1 ? "" : "s"} found. Kill checks can use gear you own.`,
      firstStep: "Open the kill check, lock a setup, then do one short trip.",
      stopPoint: "Stop after the first trip if kills feel slow or supplies burn too fast.",
      avoid: "Avoid buying upgrades before checking what your bank can already do.",
      primaryAction: "dps",
      primaryLabel: "Check kill",
      secondaryAction: tipCount > 0 ? "tidy" : "next",
      secondaryLabel: tipCount > 0 ? "Tidy bank" : "Open next trip"
    };
  }

  if (totalValue > 0 || totalItems > 0) {
    return {
      iconItemId: hasPrices ? 995 : 13307,
      title: "Use this bank for one clear trip",
      why: hasPrices && totalValue > 0
        ? `Gear, supplies and ${formatGp(totalValue)} GP are now part of the next recommendation.`
        : "Gear and supplies are now part of the next recommendation.",
      firstStep: "Open the next trip plan that fits tonight.",
      stopPoint: "Finish after you have one trip, unlock or AFK goal picked.",
      avoid: "Avoid comparing every tab before deciding what to do.",
      primaryAction: "next",
      primaryLabel: "Open next trip",
      secondaryAction: "dps",
      secondaryLabel: "Check kill"
    };
  }

  return {
    iconItemId: 841,
    title: "Paste a fuller bank before trusting gear advice",
    why: "This paste does not give enough gear or supplies to make a good route.",
    firstStep: "Paste Bank Memory or a full Bank Tags export.",
    stopPoint: "Stop once Scapestack can see combat gear and supplies.",
    avoid: "Avoid using a tiny loot tab as your whole bank.",
    primaryAction: "copy",
    primaryLabel: "Copy tabs",
    secondaryAction: "next",
    secondaryLabel: "Plan anyway"
  };
}

function BankDecisionHero({
  decision,
  totalItems,
  totalValue,
  weaponCount,
  tipCount,
  hasPrices,
  readiness,
  copied,
  onPrimary,
  onSecondary,
  onTidy,
  onEditInput
}: {
  decision: BankDecision;
  totalItems: number;
  totalValue: number;
  weaponCount: number;
  tipCount: number;
  hasPrices: boolean;
  readiness: BankReadyToLeave;
  copied: string | null;
  onPrimary: (action: BankDecisionAction) => void;
  onSecondary: (action: BankDecisionAction) => void;
  onTidy: () => void;
  onEditInput: () => void;
}) {
  const statusLabel = totalItems > 0 ? "Bank loaded" : "Bank needs a paste";
  const chips = [
    `${totalItems} items`,
    weaponCount > 0 ? `${weaponCount} weapon${weaponCount === 1 ? "" : "s"}` : null,
    hasPrices && totalValue > 0 ? formatGp(totalValue) : null,
    tipCount > 0 ? `${tipCount} cleanup move${tipCount === 1 ? "" : "s"}` : null
  ].filter((chip): chip is string => Boolean(chip));
  const setupSteps = [
    {
      label: "Choose tab style",
      value: "Pick PvM, Ironman, Questing, Skilling or Minimal.",
      state: "ready" as const,
      icon: Layers
    },
    {
      label: "Preview tabs",
      value: "Check the tab names, item sprites and counts before applying.",
      state: decision.primaryAction === "tidy" ? "attention" as const : "ready" as const,
      icon: Wand2
    },
    {
      label: "Copy to RuneLite",
      value: "Use Bank Tags export when the tabs look right.",
      state: "ready" as const,
      icon: Copy
    }
  ];
  const checkRows = [
    { label: "Before you leave", value: decision.firstStep },
    { label: "Grab from bank", value: readiness.items.filter((item) => item.tone === "good").map((item) => `${item.label}: ${item.value}`).slice(0, 2).join(" · ") || readiness.status },
    { label: "Finish after", value: decision.stopPoint }
  ];
  const PrimaryIcon = decision.primaryAction === "tidy"
    ? Wand2
    : decision.primaryAction === "copy"
      ? Copy
      : decision.primaryAction === "dps"
        ? Sword
        : ArrowRight;
  const secondaryQuickAction: {
    action: BankDecisionAction | "tidy";
    label: string;
    ariaLabel: string;
    icon: typeof Copy;
  } = decision.primaryAction === "copy"
    ? {
        action: "tidy",
        label: "Smart tidy",
        ariaLabel: "Smart tidy this organized bank again",
        icon: Wand2
      }
    : {
        action: "copy",
        label: copied === "all" ? "Copied" : "Copy to RuneLite",
        ariaLabel: "Copy cleaned bank tabs to RuneLite",
        icon: Copy
      };
  const SecondaryIcon = secondaryQuickAction.icon;

  return (
    <section className="scapestack-board-panel scapestack-lock-panel mb-4 w-full max-w-full px-4 py-4 sm:px-5" aria-label="Tonight's RuneLite bank setup">
      <div className="flex min-w-0 flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-2">
            <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-md border border-[var(--color-border)] bg-[var(--color-bg)]/45">
              <ItemSprite id={decision.iconItemId} alt="" size={30} />
            </span>
            <div className="min-w-0">
              <div className="eyebrow text-[var(--color-accent)]">Tonight&apos;s bank setup</div>
              <h1 className="mt-1 max-w-full text-[23px] font-semibold leading-[1.02] tracking-normal text-[var(--color-text)] sm:text-[31px]">
                {decision.title}
              </h1>
            </div>
          </div>
          <div className="mt-3 flex max-w-full flex-wrap items-center gap-2">
            <span className="scapestack-status-badge" data-tone={totalItems > 0 ? "ready" : "blocked"}>{statusLabel}</span>
            <span className="scapestack-status-badge" data-tone="prep">{readiness.status}</span>
            {chips.slice(0, 3).map((chip) => (
              <span key={chip} className="scapestack-status-badge" data-tone="prep">{chip}</span>
            ))}
          </div>
          <p className="mt-3 max-w-3xl text-[13px] font-semibold leading-relaxed text-[var(--color-text-muted)]">
            {decision.why}
          </p>
        </div>

        <div className="grid min-w-0 grid-cols-1 gap-2 sm:flex sm:flex-wrap xl:shrink-0 xl:justify-end">
          <button
            type="button"
            onClick={() => onPrimary(decision.primaryAction)}
            aria-label={`${decision.primaryLabel}: ${decision.title}`}
            className="scapestack-command-button scapestack-primary-action min-w-0 px-3 py-2 text-[12.5px] font-bold sm:px-3.5"
          >
            {decision.primaryAction === "copy" && copied === "all" ? <CheckCheck className="size-3.5" /> : <PrimaryIcon className="size-3.5" />}
            <span className="truncate">{decision.primaryAction === "copy" && copied === "all" ? "Copied" : decision.primaryLabel}</span>
          </button>
          <button
            type="button"
            onClick={() => secondaryQuickAction.action === "tidy" ? onTidy() : onPrimary("copy")}
            aria-label={secondaryQuickAction.ariaLabel}
            className="scapestack-command-button min-w-0 border-[var(--color-accent)]/35 bg-[var(--color-accent)]/10 px-3 py-2 text-[12.5px] font-bold text-[var(--color-accent)] hover:bg-[var(--color-accent)]/15 sm:px-3.5"
          >
            {secondaryQuickAction.action === "copy" && copied === "all" ? <CheckCheck className="size-3.5" /> : <SecondaryIcon className="size-3.5" />}
            <span className="truncate">{secondaryQuickAction.label}</span>
          </button>
          <details className="group relative sm:col-span-1">
            <summary className="scapestack-command-button w-full cursor-pointer list-none bg-transparent px-3 py-2 text-[12.5px] font-semibold marker:hidden sm:px-3.5 [&::-webkit-details-marker]:hidden">
              More
              <ChevronDown className="size-3.5 transition-transform group-open:rotate-180" />
            </summary>
            <div className="absolute right-0 z-20 mt-2 hidden w-52 rounded-xl border border-[var(--color-border)] bg-[var(--color-panel)] p-2 shadow-[0_18px_55px_rgba(0,0,0,0.28)] group-open:block">
              <button
                type="button"
                onClick={() => onSecondary(decision.secondaryAction)}
                aria-label={`${decision.secondaryLabel}: ${decision.title}`}
                className="flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left text-[12px] font-semibold text-[var(--color-text-dim)] transition-colors hover:bg-[var(--color-bg)]/60 hover:text-[var(--color-accent)]"
              >
                {decision.secondaryLabel}
                <ArrowRight className="size-3.5" />
              </button>
              <button
                type="button"
                onClick={onEditInput}
                aria-label="Edit pasted bank input"
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[12px] font-semibold text-[var(--color-text-dim)] transition-colors hover:bg-[var(--color-bg)]/60 hover:text-[var(--color-accent)]"
              >
                <Edit3 className="size-3.5" />
                Replace bank
              </button>
            </div>
          </details>
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-3" data-testid="bank-tonight-trip">
        {checkRows.map((row) => (
          <div key={row.label} className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)]/30 p-3">
            <div className="text-[10px] font-black uppercase tracking-[0.16em] text-[var(--color-accent)]">{row.label}</div>
            <p className="mt-1 text-[12.5px] font-semibold leading-relaxed text-[var(--color-text-dim)]">{row.value}</p>
          </div>
        ))}
      </div>

      <div className="mt-4 grid gap-2 sm:hidden" aria-label="RuneLite bank setup steps">
        {setupSteps.map((step, index) => {
          const Icon = step.icon;
          return (
            <span
              key={step.label}
              className="inline-flex min-w-0 items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)]/28 px-3 py-2 text-[12px] font-bold text-[var(--color-text)]"
            >
              <span className="inline-flex size-5 shrink-0 items-center justify-center rounded-md border border-[var(--color-accent)]/35 bg-[var(--color-accent)]/10 text-[10px] font-black text-[var(--color-accent)]">
                {index + 1}
              </span>
              <Icon className="size-3.5 text-[var(--color-accent)]" />
              {step.label}
            </span>
          );
        })}
      </div>

      <div className="scapestack-lock-list scapestack-decision-list mt-4 hidden sm:block" data-testid="bank-setup-steps">
        {setupSteps.map((step, index) => {
          const Icon = step.icon;
          return (
            <div
              key={step.label}
              className={cn(
                "scapestack-lock-row md:grid-cols-[180px_minmax(0,1fr)] md:items-center",
                step.state === "attention" && "text-[var(--color-warning)]"
              )}
            >
              <div className="flex items-center gap-2">
                <span className="inline-flex size-6 shrink-0 items-center justify-center rounded-full border border-[var(--color-accent)]/35 bg-[var(--color-accent)]/10 text-[11px] font-black text-[var(--color-accent)]">
                  {index + 1}
                </span>
                <Icon className="size-3.5 text-[var(--color-accent)]" />
                <h2 className="text-[13px] font-bold text-[var(--color-text)]">{step.label}</h2>
              </div>
              <p className="text-[12px] font-semibold leading-relaxed text-[var(--color-text-dim)]">
                {step.value}
              </p>
            </div>
          );
        })}
      </div>

      <details className="group mt-4 hidden border-t border-[var(--color-border)] pt-3 sm:block">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-[12px] font-semibold text-[var(--color-text-muted)] marker:hidden [&::-webkit-details-marker]:hidden">
          <span>RuneLite setup steps</span>
          <span className="inline-flex items-center gap-1 text-[11px] text-[var(--color-text-muted)]">
            Show
            <ChevronDown className="size-3.5 transition-transform group-open:rotate-180" />
          </span>
        </summary>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          {setupSteps.map((step) => (
            <div key={step.label}>
              <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">{step.label}</div>
              <p className="mt-1 text-[12.5px] leading-relaxed text-[var(--color-text)]">{step.value}</p>
            </div>
          ))}
        </div>
      </details>
    </section>
  );
}

function SmartTidyWizard({
  stage,
  setStage,
  currentTabs,
  baseTabs,
  currentTabName,
  copied,
  onApply,
  onCopy
}: {
  stage: SmartTidyStage;
  setStage: (stage: SmartTidyStage) => void;
  currentTabs: OrganizedTab[];
  baseTabs: OrganizedTab[];
  currentTabName?: string | null;
  copied: string | null;
  onApply: (tabs: OrganizedTab[], playstyle: SmartTidyPlaystyle, front: SmartTidyFront) => void;
  onCopy: () => void;
}) {
  const [smartTidyPrefs, setSmartTidyPrefs] = useState<SmartTidyPrefs>(DEFAULT_SMART_TIDY_PREFS);
  const playstyle = smartTidyPrefs.playstyle;
  const front = smartTidyPrefs.front;
  const proposedTabs = useMemo(
    () => buildSmartTidyLayout(baseTabs, playstyle, front, currentTabName).slice(0, 8),
    [baseTabs, currentTabName, front, playstyle]
  );
  const beforeTabs = currentTabs.slice(0, 4);
  const selectedPreset = SMART_TIDY_PRESETS.find((item) => item.id === playstyle) ?? SMART_TIDY_PRESETS[0];
  const selectedFront = SMART_TIDY_FRONT_CHOICES.find((item) => item.id === front) ?? SMART_TIDY_FRONT_CHOICES[0];
  const tabPlan = smartTidyOrder(playstyle, front, currentTabName).slice(0, 6);
  const ironmanTone = playstyle === "ironman" ? accountModePlanningTone("ironman") : null;
  const previewHelper = selectedPreset.helper === selectedFront.helper
    ? `${selectedPreset.helper}.`
    : `${selectedPreset.helper}. ${selectedFront.helper}.`;

  useEffect(() => {
    setSmartTidyPrefs(readSmartTidyPrefs());
  }, []);

  const updateSmartTidyPrefs = (next: Partial<SmartTidyPrefs>) => {
    setSmartTidyPrefs((current) => {
      const merged = { ...current, ...next };
      writeSmartTidyPrefs(merged);
      return merged;
    });
  };

  if (stage === "closed") return null;

  const applyLayout = () => {
    writeSmartTidyPrefs({ playstyle, front });
    setStage("applying");
    window.setTimeout(() => {
      onApply(proposedTabs, playstyle, front);
      setStage("applied");
    }, 620);
  };

  return (
    <section
      className="mb-3 rounded-xl border border-[var(--color-accent)]/30 bg-[var(--color-panel)]/82 p-3 shadow-[0_24px_70px_-36px_rgba(0,0,0,0.75)] sm:p-4"
      aria-label="Smart Tidy setup"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="eyebrow text-[var(--color-accent)]">Choose style</div>
          <h2 className="mt-1 text-[19px] font-semibold leading-tight text-[var(--color-text)] sm:text-[22px]">
            Pick the bank setup you want
          </h2>
          <p className="mt-2 max-w-2xl text-[12.5px] font-semibold leading-relaxed text-[var(--color-text-dim)]">
            Answer two quick choices, preview the tabs, then copy the layout back to RuneLite.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setStage("closed")}
          className="inline-flex min-h-9 shrink-0 self-start items-center justify-center rounded-lg border border-[var(--color-border)] px-3 py-2 text-[12px] font-bold text-[var(--color-text-dim)] transition-colors hover:border-[var(--color-border-strong)] hover:text-[var(--color-text)] sm:self-auto"
          aria-label="Close Smart Tidy setup"
        >
          Close
        </button>
      </div>

      {(stage === "choosing" || stage === "preview") && (
        <div className="mt-4 grid gap-3 lg:grid-cols-[0.92fr_1.08fr]">
          <div className="space-y-3">
            <SmartTidyChoiceGroup
              label="How do you mostly play?"
              value={playstyle}
              choices={SMART_TIDY_PRESETS.map((preset) => ({
                id: preset.id,
                label: preset.label,
                helper: preset.helper,
                iconItemId: preset.id === "ironman" ? ACCOUNT_MODE_ICON_ITEM_IDS.ironman ?? 12810 : preset.id === "skilling" ? 6739 : preset.id === "questing" ? 1891 : preset.id === "minimal" ? 8007 : 4151
              }))}
              onChange={(value) => {
                updateSmartTidyPrefs({ playstyle: value as SmartTidyPlaystyle });
                setStage("preview");
              }}
            />
            <SmartTidyChoiceGroup
              label="What should be first?"
              value={front}
              choices={SMART_TIDY_FRONT_CHOICES.map((choice) => ({
                id: choice.id,
                label: choice.label,
                helper: choice.helper,
                iconItemId: choice.id === "teleports" ? 8007 : choice.id === "supplies" ? 2434 : choice.id === "current" ? currentTabs[0]?.iconItemId ?? 995 : 4151
              }))}
              onChange={(value) => {
                updateSmartTidyPrefs({ front: value as SmartTidyFront });
                setStage("preview");
              }}
            />
          </div>

          <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)]/28 p-3">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="text-[12px] font-bold text-[var(--color-text)]">Preview tabs</div>
                <div className="mt-0.5 text-[11px] font-semibold text-[var(--color-text-muted)]">
                  {ironmanTone ? `${ironmanTone.itemCopy}. ${previewHelper}` : previewHelper}
                </div>
                <div className="mt-1 text-[10.5px] font-bold text-[var(--color-accent)]/85">
                  Saved for next bank: {selectedPreset.label} · {selectedFront.label}
                </div>
              </div>
              {ironmanTone && ACCOUNT_MODE_ICON_ITEM_IDS.ironman && (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-[#7a8796]/35 bg-[#7a8796]/12 px-2 py-1 text-[10.5px] font-bold text-[#c7d0dd]">
                  <ItemSprite id={ACCOUNT_MODE_ICON_ITEM_IDS.ironman} alt="" size={16} className="pixelated" />
                  Ironman bank
                </span>
              )}
              <span className="scapestack-status-badge" data-tone="ready">{proposedTabs.length} tabs</span>
            </div>
            <div className="mb-3 rounded-md border border-[var(--color-border)] bg-[var(--color-panel)]/45 px-2.5 py-2">
              <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--color-text-muted)]">
                Suggested first tabs
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {tabPlan.map((tabName, index) => (
                  <span
                    key={`${tabName}-${index}`}
                    className="inline-flex items-center gap-1 rounded-full border border-[var(--color-accent)]/25 bg-[var(--color-accent)]/10 px-2 py-1 text-[10.5px] font-bold text-[var(--color-accent)]"
                  >
                    <span className="font-mono text-[9.5px] text-[var(--color-text-muted)]">{index + 1}</span>
                    {tabName}
                  </span>
                ))}
              </div>
            </div>
            <RuneLiteTabStripPreview tabs={proposedTabs} />
            <div className="grid grid-cols-2 gap-2 sm:gap-3">
              <SmartTidyTabPreview title="Current bank" tabs={beforeTabs} tone="muted" />
              <SmartTidyTabPreview title="Proposed layout" tabs={proposedTabs} tone="accent" />
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={applyLayout}
                className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-lg bg-[var(--color-accent)] px-3.5 py-2 text-[12.5px] font-black text-[#0b0906] transition-all hover:brightness-110"
              >
                <Sparkles className="size-3.5" />
                Apply layout
              </button>
              <button
                type="button"
                onClick={() => setStage("choosing")}
                className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-lg border border-[var(--color-border)] bg-transparent px-3.5 py-2 text-[12.5px] font-bold text-[var(--color-text-dim)] transition-colors hover:border-[var(--color-border-strong)] hover:text-[var(--color-text)]"
              >
                Try another setup
              </button>
            </div>
          </div>
        </div>
      )}

      {stage === "applying" && (
        <div className="mt-4 rounded-lg border border-[var(--color-accent)]/25 bg-[var(--color-accent)]/8 p-4">
          <div className="flex items-center gap-3">
            <span className="inline-flex size-10 items-center justify-center rounded-lg border border-[var(--color-accent)]/35 bg-[var(--color-accent)]/10">
              <Sparkles className="size-5 animate-pulse text-[var(--color-accent)]" />
            </span>
            <div>
              <div className="text-[13px] font-bold text-[var(--color-text)]">Moving items into cleaner RuneLite tabs</div>
              <div className="mt-1 text-[12px] font-semibold text-[var(--color-text-muted)]">
                Gear, teleports, supplies and quest items are being grouped.
              </div>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-8 gap-1">
            {proposedTabs.flatMap((tab) => tab.items.slice(0, 3)).slice(0, 16).map((item, index) => (
              <span
                key={`${item.id}-${index}`}
                className="flex aspect-square items-center justify-center rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] animate-[pop-in_0.2s_ease-out]"
                style={{ animationDelay: `${index * 18}ms` }}
              >
                <ItemSprite id={spriteIdForItem(item.id, item.quantity)} alt="" size={24} />
              </span>
            ))}
          </div>
        </div>
      )}

      {stage === "applied" && (
        <div className="mt-4 rounded-lg border border-[var(--color-accent)]/30 bg-[var(--color-accent)]/8 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-[13px] font-bold text-[var(--color-text)]">Layout applied</div>
              <p className="mt-1 text-[12px] font-semibold leading-relaxed text-[var(--color-text-muted)]">
                Review the bank below, then copy the tabs to RuneLite.
              </p>
            </div>
            <button
              type="button"
              onClick={onCopy}
              className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-lg bg-[var(--color-accent)] px-3.5 py-2 text-[12.5px] font-black text-[#0b0906] transition-all hover:brightness-110"
            >
              {copied === "all" ? <CheckCheck className="size-3.5" /> : <Copy className="size-3.5" />}
              {copied === "all" ? "Copied" : "Copy tabs to RuneLite"}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

function RuneLiteTabStripPreview({ tabs }: { tabs: OrganizedTab[] }) {
  return (
    <div className="mb-3 rounded-md border border-[var(--color-accent)]/25 bg-[var(--color-bg)]/40 p-2" data-testid="runelite-tab-strip-preview">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--color-accent)]">
          RuneLite tab order
        </div>
        <div className="text-[10px] font-semibold text-[var(--color-text-muted)]">
          copy this order
        </div>
      </div>
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {tabs.slice(0, 8).map((tab, index) => (
          <div
            key={`runelite-strip-${String(tab.name)}-${index}`}
            className="flex min-w-[82px] shrink-0 flex-col items-center gap-1 rounded-md border border-[var(--color-border)] bg-[var(--color-panel)]/70 px-2 py-2"
            title={`${index + 1}. ${String(tab.name)} - ${tab.items.length} items`}
          >
            <span className="font-mono text-[9px] font-black text-[var(--color-text-muted)]">{index + 1}</span>
            <ItemSprite id={tab.iconItemId} alt="" size={24} />
            <span className="max-w-[70px] truncate text-[10.5px] font-bold text-[var(--color-text)]">{String(tab.name)}</span>
            <span className="font-mono text-[9px] text-[var(--color-text-muted)]">{tab.items.length}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function SmartTidyChoiceGroup<T extends string>({
  label,
  value,
  choices,
  onChange
}: {
  label: string;
  value: T;
  choices: Array<{ id: T; label: string; helper: string; iconItemId: number }>;
  onChange: (value: T) => void;
}) {
  return (
    <fieldset className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)]/24 p-3">
      <legend className="px-1 text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--color-text-muted)]">
        {label}
      </legend>
      <div className="mt-2 grid grid-cols-2 gap-2">
        {choices.map((choice) => {
          const active = choice.id === value;
          return (
            <button
              key={choice.id}
              type="button"
              onClick={() => onChange(choice.id)}
              aria-pressed={active}
              className={cn(
                "flex min-h-12 items-center gap-2 rounded-lg border px-2 py-2 text-left transition-colors sm:px-2.5",
                active
                  ? "border-[var(--color-accent)] bg-[var(--color-accent)]/12 text-[var(--color-text)]"
                  : "border-[var(--color-border)] bg-[var(--color-panel)]/45 text-[var(--color-text-dim)] hover:border-[var(--color-accent)]/40 hover:text-[var(--color-text)]"
              )}
            >
              <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-md border border-[var(--color-border)] bg-[var(--color-bg)]">
                <ItemSprite id={choice.iconItemId} alt="" size={24} />
              </span>
              <span className="min-w-0">
                <span className="block text-[12px] font-black leading-tight sm:text-[12.5px]">{choice.label}</span>
                <span className="mt-0.5 hidden text-[10.5px] font-semibold leading-snug text-[var(--color-text-muted)] sm:block">{choice.helper}</span>
              </span>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

function SmartTidyTabPreview({ title, tabs, tone }: { title: string; tabs: OrganizedTab[]; tone: "muted" | "accent" }) {
  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-panel)]/45 p-2.5">
      <div className={cn(
        "mb-2 text-[10.5px] font-bold uppercase tracking-[0.14em]",
        tone === "accent" ? "text-[var(--color-accent)]" : "text-[var(--color-text-muted)]"
      )}>
        {title}
      </div>
      <div className="space-y-2">
        {tabs.slice(0, 4).map((tab) => (
          <div key={`${title}-${String(tab.name)}`} className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg)]/35 p-2">
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-1.5">
                <ItemSprite id={tab.iconItemId} alt="" size={18} />
                <span className="truncate text-[12px] font-bold text-[var(--color-text)]">{String(tab.name)}</span>
              </div>
              <span className="shrink-0 text-[10.5px] font-mono text-[var(--color-text-muted)]">{tab.items.length}</span>
            </div>
            <div className="flex min-h-7 flex-wrap gap-1">
              {tab.items.slice(0, 8).map((item) => (
                <span key={`${String(tab.name)}-${item.id}`} className="inline-flex size-7 items-center justify-center rounded border border-[var(--color-border)] bg-[var(--color-bg)]">
                  <ItemSprite id={spriteIdForItem(item.id, item.quantity)} alt="" size={22} />
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

interface Prefs {
  sort: SortMode;
  density: Density;
  hideMisc: boolean;
  hideEmpty: boolean;
  tabMode: TabMode;
  showJunk: boolean;
  showStale: boolean;
  showGoals: boolean;
  // Manual tab-order preference, layered ON TOP of the playstyle order.
  // A list of tab names; any tab named here is pulled to that position,
  // tabs not named keep their playstyle-relative order after the pinned
  // ones. Empty = pure playstyle order. Lets a player say "Runes first".
  tabOrder: string[];
  // Item ids the player pinned to the front of whichever tab they sit in.
  // Pinned items sort ahead of everything else in that tab, in pin order.
  pinnedItems: number[];
  // Manual within-tab item order, keyed by tab name → ordered item ids.
  // Set by dragging one item onto another. Items not listed keep their
  // natural order after the manually-placed ones.
  itemOrder: Record<string, number[]>;
}

function bankSourceReceipt(initial: OrganizeResult): {
  sourceLabel: string;
  confidenceLabel: string;
  confidenceTone: "good" | "warn";
  exactLine: string;
  limitationLine: string;
  nextLine: string;
} {
  if (initial.source.kind === "bankMemory") {
    return {
      sourceLabel: "Bank Memory TSV",
      confidenceLabel: "Exact item stacks",
      confidenceTone: "good",
      exactLine: "Item IDs, names, quantities and stack values are ready for sorting, DPS and the next plan.",
      limitationLine: "Finished quests, diary steps, clog slots and Slayer still need RuneLite to help.",
      nextLine: "Best for serious PvM plans when quantities and GP value matter."
    };
  }

  if (initial.source.kind === "banktags") {
    return {
      sourceLabel: "RuneLite Bank Tags",
      confidenceLabel: "Exact layout, partial stacks",
      confidenceTone: "warn",
      exactLine: "Item IDs and tab layout are clear, so copy-back and planning work.",
      limitationLine: "Bank Tags do not include quantities; GP value, stack size and supply counts are inferred or unavailable.",
      nextLine: "For value-aware advice, copy Bank Memory item data instead of Bank Tags next time."
    };
  }

  return {
    sourceLabel: "Raw item IDs",
    confidenceLabel: "Usable fallback",
    confidenceTone: "warn",
    exactLine: "Recognized item IDs can still be organized and used for the next plan.",
    limitationLine: "Names, quantities, tab names and GP values may be incomplete because the paste was not a full bank export.",
    nextLine: "Use Bank Memory or RuneLite Bank Tags for a cleaner import."
  };
}

function bankIdSpriteHealth(initial: OrganizeResult): {
  label: string;
  tone: "good" | "warn";
  detail: string;
} {
  const warnings = initial.importWarnings;
  const tileCount = initial.stats.items;
  const tabCount = initial.stats.tabs;
  const tabLabel = `${tabCount} organized tab${tabCount === 1 ? "" : "s"}`;
  const tileLabel = `${tileCount} visible bank tile${tileCount === 1 ? "" : "s"}`;

  if (warnings.fallbackItemCount > 0) {
    const previewIds = warnings.fallbackItemIds.slice(0, 6).join(", ");
    return {
      label: "ID check needs review",
      tone: "warn",
      detail: `${warnings.recognizedItemCount}/${warnings.parsedItemCount} pasted IDs mapped into ${tileLabel} across ${tabLabel}. ${warnings.fallbackItemCount} ID${warnings.fallbackItemCount === 1 ? "" : "s"} did not match the local item map${previewIds ? ` (${previewIds}${warnings.fallbackItemIds.length > 6 ? ", …" : ""})` : ""}. Scapestack keeps those IDs as fallback tiles, loads art through /api/sprite/item/:id.png, and links the first one to the OSRS Wiki.`
    };
  }

  if (warnings.duplicateItemCount > 0) {
    return {
      label: "IDs normalized",
      tone: "warn",
      detail: `${warnings.recognizedItemCount}/${warnings.parsedItemCount} pasted IDs mapped into ${tileLabel} across ${tabLabel}. ${warnings.duplicateItemCount} duplicate ID${warnings.duplicateItemCount === 1 ? "" : "s"} collapsed. Sprites are loaded through the local Scapestack sprite proxy and keep item-ID fallback labels.`
    };
  }

  return {
    label: "IDs and sprites ready",
    tone: "good",
    detail: `${warnings.recognizedItemCount}/${warnings.parsedItemCount} pasted IDs mapped into ${tileLabel} across ${tabLabel}. Item art loads through /api/sprite/item/:id.png and missing sprites degrade to a labelled fallback tile.`
  };
}

function bankPluginHubActionState(status: PluginHubStatus | null): BankPluginHubActionState {
  if (!status) return "unknown";
  if (status.state === "merged") return "merged";
  if (status.state === "closed") return "closed";
  if (status.state === "unknown") return "unknown";
  const hasReviewBlocker = status.reviewCopyIssues.length > 0
    || status.pinSummary?.includes("behind standalone repo head") === true
    || status.reviewSummary?.includes("requested changes") === true;
  return hasReviewBlocker ? "review-blocked" : "pending";
}

const DEFAULT_PREFS: Prefs = {
  sort: "default",
  density: "comfortable",
  hideMisc: false,
  hideEmpty: true,
  // Item-type is more intuitive on first visit (clear Combat/Range/Magic etc).
  // Use-case mode (Teleports/PvM/Drops/Potions/Skilling/Clue/Quest/Cosmetic/Misc)
  // matches community-standard bank layouts like Tuck's 9-tab — that's the
  // smart default. Item-type mode stays available as a fallback.
  tabMode: "useCase",
  showJunk: false,
  showStale: false,
  showGoals: false,
  tabOrder: [],
  pinnedItems: [],
  itemOrder: {}
};

// Pin state, shared via context so the deeply-nested ItemSlot can read
// "is this pinned" and toggle it without threading props through BankBody →
// BankGrid/BankList. `isPinned` is null when pinning isn't available (e.g.
// non-interactive previews) — ItemSlot then hides the pin affordance.
interface PinContextValue {
  isPinned: (id: number) => boolean;
  togglePin: (id: number) => void;
}
const PinContext = createContext<PinContextValue | null>(null);

// After a successful drop, we trigger a short route flash on the dragged
// item's new slot. Done via context so we don't have to thread a prop
// through every tab/grid/slot. Token is bumped per drop so React
// remounts the animation even when the same id is dropped twice.
interface DropFlashContextValue {
  flashedId: number | null;
  token: number;
}
const DropFlashContext = createContext<DropFlashContextValue>({ flashedId: null, token: 0 });

export function BankResult({
  initial,
  initialStrings,
  onEditInput,
  inferredArchetype,
  inferredRsn,
  hiscoreSkills,
  returnBossSlug,
  initialMode
}: BankResultProps) {
  const [tabs, setTabs] = useState<OrganizedTab[]>(initial.tabs);
  const [strings, setStrings] = useState<string[]>(initialStrings);
  // Active archetype — starts as the auto-inferred one (from Hiscores), but
  // the user can override it via the archetype selector below the tab strip.
  // Re-running buildUseCaseTabs with a different archetype just reshuffles the
  // existing data; no server round-trip needed.
  const [archetypeOverride, setArchetypeOverride] = useState<Archetype | null>(null);
  const activeArchetype: Archetype = archetypeOverride ?? inferredArchetype ?? "unspecified";
  // Per-item bucket overrides driven by drag-and-drop in use-case mode. When
  // the user drops an item onto a different use-case tab, we record that the
  // item should go there from now on instead of the default bucketFor()
  // routing. Empty by default; key=itemId, value=target UseCaseTab.
  const [userBucketOverrides, setUserBucketOverrides] = useState<Map<number, UseCaseTab>>(new Map());
  const [activeIdx, setActiveIdx] = useState(0);
  const [dragging, setDragging] = useState<OrganizedItem | null>(null);
  // Pixel size of the slot the drag started from. Bank slots are fluid
  // (8 columns of `1fr`), so a fixed-size drag overlay would sit off-centre
  // from the cursor. Capturing the real rect keeps the overlay the exact
  // size of the slot it was lifted from, so it stays under the pointer.
  const [dragSize, setDragSize] = useState<number>(56);
  const [hoveredTab, setHoveredTab] = useState<string | null>(null);
  // Drop-success flash. Bumping the token forces the ItemSlot to remount
  // its animation even when the same id is dropped twice in a row.
  const [dropFlash, setDropFlash] = useState<DropFlashContextValue>({ flashedId: null, token: 0 });
  const flashDrop = (id: number) =>
    setDropFlash((p) => ({ flashedId: id, token: p.token + 1 }));
  const [copied, setCopied] = useState<string | null>(null);
  const [manualExportFallback, setManualExportFallback] = useState("");
  const [layoutOpen, setLayoutOpen] = useState(false);
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);
  const [activeSubtab, setActiveSubtab] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [diff, setDiff] = useState<BankDiff | null>(null);
  const [diffDismissed, setDiffDismissed] = useState(false);
  const [activePreset, setActivePreset] = useState<Preset | null>(null);
  const [actionSearch, setActionSearch] = useState<{ query: string; sourceLabel: string } | null>(null);
  const [previousScore, setPreviousScore] = useState<number | undefined>(undefined);
  const [reorgFlash, setReorgFlash] = useState<string | null>(null);
  // Last reorganize strategy that was applied — used to re-sort items inside
  // each (use-case) tab after bucketing, so the user actually sees the change.
  const [viewSort, setViewSort] = useState<ReorganizeStrategy | null>(null);
  const [scoreHistory, setScoreHistory] = useState<ScorePoint[]>([]);
  const [itemHistory, setItemHistory] = useState<ItemHistory>({});
  const [rsnSnapshots, setRsnSnapshots] = useState<BankSnapshot[]>([]);
  const [compareSnapshot, setCompareSnapshot] = useState<BankSnapshot | null>(null);
  const [deletedSnapshot, setDeletedSnapshot] = useState<BankSnapshot | null>(null);
  const [isNarrow, setIsNarrow] = useState(false);
  const [pluginHubState, setPluginHubState] = useState<BankPluginHubActionState>("pending");
  const [handoffBlockedHref, setHandoffBlockedHref] = useState<string | null>(null);
  const [smartTidyStage, setSmartTidyStage] = useState<SmartTidyStage>("closed");

  // Auto-density: switch to compact when viewport is narrow.
  useEffect(() => {
    const check = () => setIsNarrow(window.innerWidth < 640);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let active = true;

    fetch("/api/plugin-hub/status")
      .then(async (response) => response.ok ? await response.json() as PluginHubStatus : null)
      .then((status) => {
        if (!active) return;
        if (!status) {
          setPluginHubState("unknown");
          return;
        }
        setPluginHubState(bankPluginHubActionState(status));
      })
      .catch(() => {
        if (active) setPluginHubState("unknown");
      });

    return () => {
      active = false;
    };
  }, []);

  // ⌘K / Ctrl+K to focus the bank search.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
      } else if (e.key === "Escape" && document.activeElement === searchRef.current) {
        setSearch("");
        setActionSearch(null);
        searchRef.current?.blur();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Restore prefs once on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(PREFS_KEY);
      if (saved) setPrefs({ ...DEFAULT_PREFS, ...JSON.parse(saved) });
    } catch {}
  }, []);

  // Compute diff against the previous saved snapshot (if any), then save
  // a new snapshot. Also tracks Stack Score and fires a Discord webhook
  // if one is configured and there's something meaningful to report.
  useEffect(() => {
    const prev = loadSnapshot();
    const next = snapshotBank(initial.tabs);
    let computedDiff: BankDiff | null = null;
    if (prev && prev.items.length > 0) {
      const d = diffSnapshots(prev, next);
      if (d.added.length || d.removed.length || d.changedQuantity.length) {
        setDiff(d);
        computedDiff = d;
      }
    }
    saveSnapshot(next);

    // Bank diet: update per-item activity ledger from the snapshot.
    const updatedHistory = recordSnapshot(next);
    setItemHistory(updatedHistory);

    // Snapshot history. RSN if known, otherwise local/manual history.
    setRsnSnapshots(appendSnapshot(inferredRsn, next));

    // Stack Score delta
    try {
      const SCORE_KEY = "scapestack-bank:last-score";
      const prevScoreRaw = localStorage.getItem(SCORE_KEY);
      if (prevScoreRaw) {
        const parsed = parseInt(prevScoreRaw, 10);
        if (Number.isFinite(parsed)) setPreviousScore(parsed);
      }
      const currentScore = computeStackScore(initial.tabs).total;
      localStorage.setItem(SCORE_KEY, String(currentScore));
      // Push to historical series for the sparkline.
      const hist = pushScorePoint(currentScore);
      setScoreHistory(hist);
    } catch {}

    // Discord webhook fire-and-forget — only when something changed.
    if (computedDiff) {
      const config = loadWebhookConfig();
      if (config?.enabled) {
        void sendBankUpdate(config, {
          rsn: config.rsn,
          label: config.label,
          tabs: initial.tabs,
          diff: computedDiff
        }).catch(() => { /* silent */ });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    try { localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)); } catch {}
  }, [prefs]);

  // Filtered + sorted tab list for display
  const visibleTabs = useMemo(() => {
    let list = prefs.tabMode === "useCase"
      ? buildUseCaseTabs(tabs, activeArchetype, userBucketOverrides)
      : tabs.slice();
    if (prefs.hideMisc) list = list.filter((t) => t.name !== "Misc");
    if (prefs.hideEmpty) list = list.filter((t) => t.items.length > 0);
    // RuneLite Bank Tags maxes at 9. Apply the cap only in type-tab mode —
    // use-case mode is already 9 buckets by design, and capping there would
    // discard meaningful categories. Skipping the cap here also means items
    // keep their original classification when the player rebuckets via the
    // use-case view.
    const MAX = 9;
    if (prefs.tabMode === "type" && list.length > MAX) {
      const head = list.slice(0, MAX - 1);
      const tail = list.slice(MAX - 1);
      const overflowItems = tail.flatMap((t) => t.items);
      const overflowQty = tail.reduce((s, t) => s + t.quantity, 0);
      const overflowValue = tail.reduce((s, t) => s + t.value, 0);
      const existingMisc = head.find((t) => t.name === "Misc");
      const mergedItems = [
        ...(existingMisc?.items ?? []),
        ...overflowItems
      ];
      const mergedLayout: Record<number, number> = {};
      for (let i = 0; i < mergedItems.length; i++) mergedLayout[i] = mergedItems[i].id;
      // Pick a representative icon. Order of preference:
      //   1. Existing Misc icon if it isn't the bare 1-coin placeholder.
      //   2. The most valuable item in the bucket — visually anchors the tab.
      //   3. First overflow item.
      //   4. Coins as a last resort.
      const existingIcon = existingMisc?.iconItemId;
      const topByValue = [...mergedItems].sort((a, b) => b.stackValue - a.stackValue)[0];
      const iconItemId =
        existingIcon && existingIcon !== 995
          ? existingIcon
          : (topByValue?.id ?? mergedItems[0]?.id ?? existingIcon ?? 995);
      const merged: OrganizedTab = {
        name: "Misc" as OrganizedTab["name"],
        iconItemId,
        items: mergedItems,
        layout: mergedLayout,
        quantity: overflowQty + (existingMisc?.quantity ?? 0),
        value: overflowValue + (existingMisc?.value ?? 0)
      };
      // Replace existing Misc tab if any, otherwise append.
      const withoutMisc = head.filter((t) => t.name !== "Misc");
      list = [...withoutMisc, merged];
    }

    // Apply the last Reorganize sort to the items inside every visible tab so
    // value/quantity/name strategies are still honored after use-case bucketing
    // re-groups things. Smart tidy is the default and uses the canonical sort
    // already baked into the bucket builders.
    if (viewSort && viewSort !== "smart") {
      list = list.map((t) => {
        const items = t.items.slice();
        if (viewSort === "value") items.sort((a, b) => b.stackValue - a.stackValue || a.name.localeCompare(b.name));
        else if (viewSort === "quantity") items.sort((a, b) => b.quantity - a.quantity || a.name.localeCompare(b.name));
        else if (viewSort === "name") items.sort((a, b) => a.name.localeCompare(b.name));
        const newLayout: Record<number, number> = {};
        for (let i = 0; i < items.length; i++) newLayout[i] = items[i].id;
        return { ...t, items, layout: newLayout };
      });
    }

    // Manual tab-order preference, layered on top of the playstyle order.
    // Tabs named in prefs.tabOrder are pulled to the front in that exact
    // order; any tab not named keeps its current (playstyle) position after
    // them. Stable: a partial list like ["Runes"] just floats Runes up.
    if (prefs.tabOrder.length > 0) {
      const rank = new Map(prefs.tabOrder.map((name, i) => [name, i]));
      list = list
        .map((t, i) => ({ t, i }))
        .sort((a, b) => {
          const ra = rank.has(String(a.t.name)) ? rank.get(String(a.t.name))! : Infinity;
          const rb = rank.has(String(b.t.name)) ? rank.get(String(b.t.name))! : Infinity;
          if (ra !== rb) return ra - rb;
          return a.i - b.i; // keep original order among un-pinned tabs
        })
        .map((x) => x.t);
    }

    // Manual within-tab item order — set by dragging one item onto another.
    // Items the player has explicitly placed sort by their recorded index;
    // anything not in the list keeps its natural order after them.
    {
      const hasManual = Object.keys(prefs.itemOrder).length > 0;
      if (hasManual) {
        list = list.map((t) => {
          const order = prefs.itemOrder[String(t.name)];
          if (!order || order.length === 0) return t;
          const rank = new Map(order.map((id, i) => [id, i]));
          const items = t.items
            .map((it, i) => ({ it, i }))
            .sort((a, b) => {
              const ra = rank.has(a.it.id) ? rank.get(a.it.id)! : Infinity;
              const rb = rank.has(b.it.id) ? rank.get(b.it.id)! : Infinity;
              if (ra !== rb) return ra - rb;
              return a.i - b.i;
            })
            .map((x) => x.it);
          const newLayout: Record<number, number> = {};
          for (let i = 0; i < items.length; i++) newLayout[i] = items[i].id;
          return { ...t, items, layout: newLayout };
        });
      }
    }

    // Pinned items float to the front of whichever tab they live in, in the
    // order they were pinned. Applied AFTER manual order so a pinned item
    // still sits at the very top even inside a hand-ordered tab.
    if (prefs.pinnedItems.length > 0) {
      const pinRank = new Map(prefs.pinnedItems.map((id, i) => [id, i]));
      list = list.map((t) => {
        if (!t.items.some((it) => pinRank.has(it.id))) return t;
        const items = t.items
          .map((it, i) => ({ it, i }))
          .sort((a, b) => {
            const ra = pinRank.has(a.it.id) ? pinRank.get(a.it.id)! : Infinity;
            const rb = pinRank.has(b.it.id) ? pinRank.get(b.it.id)! : Infinity;
            if (ra !== rb) return ra - rb;
            return a.i - b.i;
          })
          .map((x) => x.it);
        const newLayout: Record<number, number> = {};
        for (let i = 0; i < items.length; i++) newLayout[i] = items[i].id;
        return { ...t, items, layout: newLayout };
      });
    }

    return list;
  }, [tabs, prefs.hideMisc, prefs.hideEmpty, prefs.tabMode, prefs.tabOrder, prefs.pinnedItems, prefs.itemOrder, activeArchetype, viewSort, userBucketOverrides]);

  // Auto-jump to the tab with the most matches when the user types a search
  // query. Without this, searching for "ranarr" while sitting on the PvM Gear
  // tab shows an empty grid (no ranarr in gear) even though the Potions tab
  // has 12 matches. The user sees the match-count chip on the Potions tab
  // and would have to manually click — auto-switch makes it feel like a
  // bank-wide search.
  useEffect(() => {
    if (!search.trim()) return;
    // Count matches per visible tab. If the active tab already has matches,
    // leave the user where they are — no point yanking them around mid-type.
    const bestIdx = firstMatchingBankTabIndex(visibleTabs, search);
    const activeCount = visibleTabs[activeIdx] ? countBankSearchMatches(visibleTabs[activeIdx], search) : 0;
    if (activeCount === 0 && bestIdx >= 0) {
      setActiveIdx(bestIdx);
    }
  }, [search, visibleTabs, activeIdx]);

  // Make sure activeIdx is valid for visible list
  useEffect(() => {
    if (activeIdx >= visibleTabs.length) setActiveIdx(Math.max(0, visibleTabs.length - 1));
  }, [visibleTabs.length, activeIdx]);

  // Clear subtab filter + preset when switching tabs
  useEffect(() => {
    setActiveSubtab(null);
    setActivePreset(null);
  }, [activeIdx]);

  const activeTab = visibleTabs[activeIdx];

  // Junk set across all visible tabs — used for the banner. The active tab's
  // junk-id set is what we pass down so each ItemSlot can style itself.
  const junkSummaryAll = useMemo(() => summarizeJunk(visibleTabs), [visibleTabs]);
  // Tips engine — decant / merge / outfit / pickup. Recomputed when the
  // bank changes; dismissals are session-local inside TipsCard itself.
  const bankTips = useMemo(() => computeTips(visibleTabs), [visibleTabs]);
  const bankTipSearchQuery = useMemo(() => bankSearchQueryForTips(bankTips), [bankTips]);
  const junkEntries = useMemo(
    () => prefs.showJunk ? listJunkItems(visibleTabs) : [],
    [prefs.showJunk, visibleTabs]
  );
  const [junkListOpen, setJunkListOpen] = useState(false);
  const activeJunkIds = useMemo(() => {
    if (!activeTab || !prefs.showJunk) return new Set<number>();
    const ids = new Set<number>();
    for (const it of activeTab.items) {
      if (isJunkCandidate(it, activeTab.name)) ids.add(it.id);
    }
    return ids;
  }, [activeTab, prefs.showJunk]);

  const STALE_PROTECTED = useMemo(() => new Set(["Quest", "Untradeables", "Trophy", "Clues"]), []);
  const activeStaleIds = useMemo(() => {
    if (!activeTab || !prefs.showStale) return new Set<number>();
    if (STALE_PROTECTED.has(activeTab.name)) return new Set<number>();
    const ids = new Set<number>();
    for (const it of activeTab.items) {
      const days = daysSinceChanged(itemHistory[it.id]);
      if (days !== null && days >= 30) ids.add(it.id);
    }
    return ids;
  }, [activeTab, prefs.showStale, itemHistory, STALE_PROTECTED]);

  const allItems = useMemo(() => visibleTabs.flatMap((t) => t.items), [visibleTabs]);
  const totalSearchMatches = useMemo(() => {
    if (!search.trim()) return 0;
    return visibleTabs.reduce((sum, tab) => sum + countBankSearchMatches(tab, search), 0);
  }, [search, visibleTabs]);
  const currentSnapshot = useMemo(() => snapshotBank(tabs), [tabs]);

  // Gear upgrade suggestions — only when we have hiscores for this RSN.
  const compareDiff = useMemo<BankDiff | null>(() => {
    if (!compareSnapshot) return null;
    return diffSnapshots(compareSnapshot, currentSnapshot);
  }, [compareSnapshot, currentSnapshot]);

  const upgradeSuggestions = useMemo<UpgradeSuggestion[]>(() => {
    if (!hiscoreSkills) return [];
    const priceMap = new Map<number, number>();
    for (const it of allItems) {
      if (it.unitPrice > 0) priceMap.set(it.id, it.unitPrice);
    }
    return suggestUpgrades(hiscoreSkills, ownedIdSet(allItems), priceMap);
  }, [hiscoreSkills, allItems]);

  const goalMatches = useMemo(() => {
    if (!prefs.showGoals) return new Map<number, GoalMatch[]>();
    return matchGoals(allItems);
  }, [prefs.showGoals, allItems]);

  const goalSetProgress = useMemo(() => {
    if (!prefs.showGoals) return [];
    return summarizeGoalProgress(allItems).slice(0, 4);
  }, [prefs.showGoals, allItems]);

  const staleSummary = useMemo(() => {
    if (!prefs.showStale) return { count: 0, oldestDays: 0 };
    let count = 0;
    let oldest = 0;
    for (const tab of visibleTabs) {
      if (STALE_PROTECTED.has(tab.name)) continue;
      for (const it of tab.items) {
        const d = daysSinceChanged(itemHistory[it.id]);
        if (d !== null && d >= 30) {
          count++;
          if (d > oldest) oldest = d;
        }
      }
    }
    return { count, oldestDays: oldest };
  }, [visibleTabs, prefs.showStale, itemHistory, STALE_PROTECTED]);

  // Subtabs available in current active tab (unique, ordered)
  const subtabsInActive = useMemo(() => {
    if (!activeTab) return [] as string[];
    const seen = new Set<string>();
    const out: string[] = [];
    for (const it of activeTab.items) {
      if (!seen.has(it.subtab)) { seen.add(it.subtab); out.push(it.subtab); }
    }
    return out;
  }, [activeTab]);

  // Apply search globally (lowercase substring on name or subtab)
  const matchesSearch = useCallback((it: OrganizedItem) => {
    return matchesBankSearch(it, search);
  }, [search]);

  const searchSuggestionItems = useCallback((query: string, sourceLabel = "bank action") => {
    if (!query.trim()) return;
    setSearch(query);
    setActionSearch({ query, sourceLabel });
    setActiveSubtab(null);
    const bestIdx = firstMatchingBankTabIndex(visibleTabs, query);
    if (bestIdx >= 0) setActiveIdx(bestIdx);
    document.getElementById("bank-view-panel")?.scrollIntoView({ behavior: "smooth", block: "start" });
    window.setTimeout(() => {
      searchRef.current?.focus();
      searchRef.current?.select();
    }, 150);
  }, [visibleTabs]);

  const updateSearch = useCallback((value: string) => {
    setSearch(value);
    setActionSearch((current) => current && current.query !== value ? null : current);
  }, []);

  const clearActionSearch = useCallback(() => {
    setSearch("");
    setActionSearch(null);
    setActiveSubtab(null);
    window.setTimeout(() => {
      searchRef.current?.focus();
    }, 50);
  }, []);

  // Multi-modal drag sensors:
  //  - PointerSensor with 8px activation: ignores micro-jitter and lets a
  //    plain click reach the tooltip instead of starting a drag.
  //  - TouchSensor with a 200ms long-press: lets phone users scroll the bank
  //    normally; a deliberate hold starts a drag.
  //  - KeyboardSensor: space picks up, arrows move, space drops — accessibility.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } }),
    useSensor(KeyboardSensor)
  );

  // Collision detection for nested droppables: item slots sit *inside* the
  // tab body, so a plain rect-intersection would always also match the body.
  // pointerWithin picks the smallest droppable the pointer is actually over
  // (the item slot) — falling back to rectIntersection only when the pointer
  // isn't inside any droppable (e.g. dragging over the tab strip gap).
  const collisionDetection = useCallback<CollisionDetection>((args) => {
    const within = pointerWithin(args);
    return within.length > 0 ? within : rectIntersection(args);
  }, []);

  const refreshStrings = useCallback(async (next: OrganizedTab[]) => {
    const res = await exportAction(next);
    setStrings(res);
  }, []);

  const onDragStart = (e: DragStartEvent) => {
    const itemId = Number(e.active.id);
    for (const tab of tabs) {
      const found = tab.items.find((i) => i.id === itemId);
      if (found) { setDragging(found); break; }
    }
    // Size the drag overlay to the actual lifted slot so it sits squarely
    // under the cursor instead of jumping to a fixed 56px box. dnd-kit
    // exposes the dragged element's initial rect on the active node.
    const rect = e.active.rect.current.initial;
    if (rect && rect.width > 0) setDragSize(rect.width);
    // Lock pointer-events on body so hover-tooltips don't pop up while
    // dragging — they're confusing and visually compete with the overlay.
    document.body.style.cursor = "grabbing";
  };

  const onDragOver = (e: { over: { id: string | number } | null }) => {
    // Item-on-item targets (`item:<id>`) are highlighted by the slot itself
    // via useDroppable's isOver — don't route them into hoveredTab, which is
    // only for tab/body drop zones.
    const id = e.over ? String(e.over.id) : null;
    setHoveredTab(id && !id.startsWith("item:") ? id : null);
  };

  const onDragCancel = () => {
    setDragging(null);
    setHoveredTab(null);
    document.body.style.cursor = "";
  };

  const onDragEnd = async (e: DragEndEvent) => {
    setDragging(null);
    setHoveredTab(null);
    document.body.style.cursor = "";
    const itemId = Number(e.active.id);
    const overId = e.over?.id;
    if (!overId) return;

    // Within-tab reorder: dropped one item onto another (`item:<id>`).
    // The dragged item takes the *visual position* of the slot it was
    // dropped on, so it ends up exactly where the player hovered.
    if (String(overId).startsWith("item:")) {
      const targetItemId = Number(String(overId).slice(5));
      if (targetItemId === itemId) return; // dropped on itself — no-op
      const tab = visibleTabs.find((t) => t.items.some((i) => i.id === itemId));
      if (!tab) return;
      // Both items must be in the same tab for a reorder to make sense.
      if (!tab.items.some((i) => i.id === targetItemId)) return;

      const fromIdx = tab.items.findIndex((i) => i.id === itemId);
      const targetIdx = tab.items.findIndex((i) => i.id === targetItemId);
      if (fromIdx === -1 || targetIdx === -1) return;

      const ids = tab.items.map((i) => i.id).filter((id) => id !== itemId);
      // Position of the target *after* the dragged item was removed.
      const targetIdxAfter = ids.indexOf(targetItemId);
      // Dragging forward (target sits after the original spot) → the item
      // should land AFTER the target so it occupies the hovered slot.
      // Dragging backward → it lands AT the target's spot, pushing it down.
      const insertAt = fromIdx < targetIdx ? targetIdxAfter + 1 : targetIdxAfter;
      ids.splice(insertAt, 0, itemId);

      setPrefs((p) => ({
        ...p,
        itemOrder: { ...p.itemOrder, [String(tab.name)]: ids }
      }));
      flashDrop(itemId);
      return;
    }

    const targetTabName = String(overId).replace(/^tab:|^body:/, "");

    // Two routing modes:
    //
    // 1. Use-case mode: tab names are buckets (PvM Gear / Teleports / …) and
    //    don't correspond 1:1 with the underlying `tabs` (type-tabs Combat /
    //    Range / etc.). Dropping an item moves it into the target bucket by
    //    recording a per-item override that buildUseCaseTabs() honours.
    //
    // 2. Type-tab mode: tab names map directly to `tabs`, so we physically
    //    move the item between type-tabs in state (the legacy behaviour).
    if (prefs.tabMode === "useCase") {
      if (!USE_CASE_ORDER.includes(targetTabName as UseCaseTab) && targetTabName !== "Bank") return;
      // No-op if dropping on the same tab the item is already in.
      const currentBucket = visibleTabs.find((t) =>
        t.items.some((i) => i.id === itemId)
      )?.name;
      if (String(currentBucket) === targetTabName) return;
      setUserBucketOverrides((prev) => {
        const next = new Map(prev);
        next.set(itemId, targetTabName as UseCaseTab);
        return next;
      });
      flashDrop(itemId);
      // Strings update happens after buildUseCaseTabs re-runs via memo; the
      // export action picks up the new ordering on next render.
      return;
    }

    // Type-tab mode: physically reshuffle the underlying tabs state.
    const sourceTabIdx = tabs.findIndex((t) => t.items.some((i) => i.id === itemId));
    const targetTabIdx = tabs.findIndex((t) => t.name === targetTabName);
    if (sourceTabIdx === -1) return;
    if (targetTabIdx === -1 || sourceTabIdx === targetTabIdx) return;

    const item = tabs[sourceTabIdx].items.find((i) => i.id === itemId)!;
    const next: OrganizedTab[] = tabs.map((t, i) => {
      if (i === sourceTabIdx) {
        const items = t.items.filter((x) => x.id !== itemId);
        return tabWithItems(t, items);
      }
      if (i === targetTabIdx) {
        return tabWithItems(t, [...t.items, item]);
      }
      return t;
    });

    setTabs(next);
    refreshStrings(next);
    flashDrop(itemId);
  };

  // Pin / unpin an item to the front of its tab. Pins persist via prefs.
  const togglePin = useCallback((id: number) => {
    setPrefs((p) => {
      const has = p.pinnedItems.includes(id);
      return {
        ...p,
        pinnedItems: has
          ? p.pinnedItems.filter((x) => x !== id)
          : [...p.pinnedItems, id]
      };
    });
  }, []);
  const pinContextValue = useMemo<PinContextValue>(() => ({
    isPinned: (id) => prefs.pinnedItems.includes(id),
    togglePin
  }), [prefs.pinnedItems, togglePin]);

  const applyReorganize = (strategy: ReorganizeStrategy, label: string) => {
    const next = reorganizeTabs(tabs, strategy, inferredArchetype ?? "unspecified");
    setTabs(next);
    // Track the strategy so use-case bucketing re-applies it post-bucketing.
    // Smart tidy = canonical (no override needed); others want explicit sort.
    setViewSort(strategy);
    // Force "default" sort so BankList doesn't re-sort on top of our chosen
    // order. Also clear preset/subtab filters that would mask the new layout.
    // CRITICAL: smart-tidy must wipe prefs.itemOrder, otherwise visibleTabs
    // re-applies the previous manual per-tab order on top of the new layout
    // — the silent cause of the "still feels random after reorganize" bug.
    // Other strategies keep itemOrder because *they* set it themselves.
    setPrefs((p) => ({
      ...p,
      sort: "default",
      ...(strategy === "smart" ? { itemOrder: {} } : {})
    }));
    setActivePreset(null);
    setActiveSubtab(null);
    refreshStrings(next);
    // Unique-per-click flash so the reshuffle animation re-fires even when
    // the button is pressed twice in a row (otherwise `key` is stable and
    // React skips the remount).
    const flashId = `${label} #${Date.now() % 100000}`;
    setReorgFlash(flashId);
    setTimeout(() => setReorgFlash((x) => (x === flashId ? null : x)), 2000);
  };

  const applySmartTidyLayout = (next: OrganizedTab[], playstyle: SmartTidyPlaystyle, front: SmartTidyFront) => {
    const tabOrder = smartTidyOrder(playstyle, front, activeTab?.name);
    setTabs(next);
    setArchetypeOverride(smartTidyArchetype(playstyle));
    setViewSort("smart");
    setUserBucketOverrides(new Map());
    setPrefs((p) => ({
      ...p,
      tabMode: "useCase",
      tabOrder,
      sort: "default",
      itemOrder: {}
    }));
    setActiveIdx(0);
    setActivePreset(null);
    setActiveSubtab(null);
    setSearch("");
    setActionSearch(null);
    void refreshStrings(next);
    const flashId = `Smart tidy #${Date.now() % 100000}`;
    setReorgFlash(flashId);
    setTimeout(() => setReorgFlash((x) => (x === flashId ? null : x)), 2000);
  };

  const shareCurrentBank = async () => {
    // Build snapshot from the current tabs (after any DnD edits).
    const ids: number[] = [];
    const qty: number[] = [];
    for (const tab of tabs) {
      for (const it of tab.items) {
        ids.push(it.id);
        qty.push(it.quantity);
      }
    }
    const snap: ShareSnapshot = {
      v: 1,
      n: initial.source.name,
      i: ids,
      q: qty,
      k: initial.stats.hasQuantities ? "bankMemory" : "banktags"
    };
    const code = encodeSnapshot(snap);
    const url = `${window.location.origin}/bank/share/${code}`;
    const copyResult = await copyText(url);
    if (copyResult !== "failed") {
      flash("share-link");
    } else {
      // Fallback: navigate to it so they can copy from address bar
      window.location.href = url;
    }
  };

  const saveCurrentSnapshot = () => {
    const snap = snapshotBank(tabs);
    setRsnSnapshots(appendSnapshot(inferredRsn, snap, { forceNew: true }));
    setCompareSnapshot(null);
    setDeletedSnapshot(null);
    flash("snapshot");
  };

  const deleteStoredSnapshot = (snap: BankSnapshot) => {
    const next = deleteSnapshot(inferredRsn, snap.ts);
    setRsnSnapshots(next);
    if (compareSnapshot?.ts === snap.ts) setCompareSnapshot(null);
    setDeletedSnapshot(snap);
  };

  const undoDeleteSnapshot = () => {
    if (!deletedSnapshot) return;
    const restored = restoreDeletedSnapshot(inferredRsn, deletedSnapshot);
    setRsnSnapshots(restored);
    setDeletedSnapshot(null);
  };

  const restoreSnapshot = (snap: BankSnapshot) => {
    const items: OrganizedItem[] = snap.items.map((item, index) => ({
      id: item.id,
      name: item.name,
      quantity: item.quantity,
      unitPrice: item.quantity > 0 ? Math.round(item.stackValue / item.quantity) : 0,
      stackValue: item.stackValue,
      subtab: "Restored snapshot",
      slot: null,
      weight: index
    }));
    const layout: Record<number, number> = {};
    for (let i = 0; i < items.length; i++) layout[i] = items[i].id;
    const topItem = items.reduce<OrganizedItem | null>(
      (best, item) => !best || item.stackValue > best.stackValue ? item : best,
      null
    );
    const restored: OrganizedTab = {
      name: "Misc",
      iconItemId: topItem?.id ?? 995,
      items,
      layout,
      quantity: items.reduce((sum, item) => sum + item.quantity, 0),
      value: items.reduce((sum, item) => sum + item.stackValue, 0)
    };
    const nextTabs = [restored];
    setTabs(nextTabs);
    setCompareSnapshot(null);
    setActiveIdx(0);
    setActiveSubtab(null);
    refreshStrings(nextTabs);
    flash("snapshot-restore");
  };

  const copyToClipboard = async (text: string, key: string) => {
    const result = await copyText(text);
    if (result !== "failed") {
      flash(key);
      return true;
    }
    setManualExportFallback(text);
    flash("copy-error");
    window.setTimeout(() => {
      const exportPanel = document.getElementById("bank-export-panel");
      exportPanel?.scrollIntoView({ behavior: "smooth", block: "start" });
      exportPanel?.focus({ preventScroll: true });
    }, 0);
    return false;
  };
  const copyCompareSummary = async (compare: BankDiff) => {
    const ok = await copyToClipboard(buildSnapshotCompareShareText(compare), "snapshot-compare-summary");
    if (ok) track("bank:snapshot_compare_copy", {
      added: compare.added.length,
      removed: compare.removed.length,
      changedQuantity: compare.changedQuantity.length
    });
  };
  const copyAll = async () => {
    const ok = await copyToClipboard(strings.join("\n"), "all");
    if (ok) track("bank:copy", { mode: "all", tabs: strings.length });
  };
  const openBankHandoffRoute = useCallback((href: string) => {
    let stored = false;
    try {
      stored = persistBankHandoffPayload(tabs, window);
    } catch {
    }
    if (!stored) {
      setHandoffBlockedHref(href);
      document.getElementById("bank-handoff-warning")?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    setHandoffBlockedHref(null);
    window.location.href = href;
  }, [tabs]);

  const openBlockedHandoffWithoutBank = useCallback(() => {
    if (!handoffBlockedHref) return;
    const [pathname, query = ""] = handoffBlockedHref.split("?");
    const params = new URLSearchParams(query);
    params.set("bank", "none");
    window.location.href = `${pathname}?${params.toString()}`;
  }, [handoffBlockedHref]);
  const copyNumbered = async () => {
    const total = strings.length;
    const blocks = strings.map((s, i) => `--- Tab ${i + 1}/${total}: ${tabs[i]?.name || "?"} ---\n${s}`);
    const ok = await copyToClipboard(blocks.join("\n\n"), "numbered");
    if (ok) track("bank:copy", { mode: "numbered", tabs: total });
  };
  const copyOne = async (i: number) => {
    const ok = await copyToClipboard(strings[i], `one-${i}`);
    if (ok) track("bank:copy", { mode: "single", tab: tabs[i]?.name || "?" });
  };
  const flash = (key: string) => {
    setCopied(key);
    if (key.endsWith("-error")) return;
    setTimeout(() => setCopied((x) => (x === key ? null : x)), 1600);
  };

  const importAdjustmentSuffix = (() => {
    const parts: string[] = [];
    if (initial.importWarnings.duplicateItemCount > 0) {
      parts.push(`${initial.importWarnings.duplicateItemCount} duplicate ID${initial.importWarnings.duplicateItemCount === 1 ? "" : "s"} collapsed`);
    }
    if (initial.importWarnings.fallbackItemCount > 0) {
      parts.push(`${initial.importWarnings.fallbackItemCount} unknown ID${initial.importWarnings.fallbackItemCount === 1 ? "" : "s"} kept as fallback`);
    }
    return parts.length ? ` Import adjusted: ${parts.join("; ")}.` : "";
  })();

  const exportCopyMessage = (() => {
    if (copied === "all") return `Copied ${strings.length} RuneLite tab strings. Paste each line via Bank Tags → Import tag tab.${importAdjustmentSuffix}`;
    if (copied === "numbered") return `Copied ${strings.length} labelled tab blocks. Useful for review before importing.${importAdjustmentSuffix}`;
    if (copied?.startsWith("one-")) {
      const tabIndex = Number(copied.slice(4));
      const tabName = Number.isFinite(tabIndex) ? tabs[tabIndex]?.name : null;
      return `Copied ${tabName ? `${tabName} ` : ""}tab ${Number.isFinite(tabIndex) ? tabIndex + 1 : ""}. Paste it into RuneLite now.${importAdjustmentSuffix}`;
    }
    if (copied === "copy-error") return "Clipboard permission failed. Use the visible Bank Tags string and copy it manually.";
    return null;
  })();

  const totalValue = useMemo(() => tabs.reduce((s, t) => s + t.value, 0), [tabs]);
  const totalQty = useMemo(() => tabs.reduce((s, t) => s + t.quantity, 0), [tabs]);
  const totalItems = useMemo(() => tabs.reduce((s, t) => s + t.items.length, 0), [tabs]);
  const bankGearItems = useMemo(() => ownedGear(allItems), [allItems]);
  const bankWeaponCount = useMemo(
    () => bankGearItems.filter((gear) => gear.slot === "weapon").length,
    [bankGearItems]
  );
  const sourceReceipt = useMemo(() => bankSourceReceipt(initial), [initial]);
  const idSpriteHealth = useMemo(() => bankIdSpriteHealth(initial), [initial]);
  const fallbackItemSearchQuery = useMemo(
    () => initial.importWarnings.fallbackItemIds.slice(0, 12).join(" "),
    [initial.importWarnings.fallbackItemIds]
  );
  const tipSlotsFreed = useMemo(() => bankTips.reduce((sum, tip) => sum + (tip.slotsFreed ?? 0), 0), [bankTips]);
  const bankActionLoop = useMemo(() => buildBankActionLoop({
    tabCount: strings.length || tabs.length,
    itemCount: totalItems,
    totalValue,
    tipCount: bankTips.length,
    tipSlotsFreed,
    hasPluginSyncHint: Boolean(inferredRsn),
    pluginHubState
  }), [bankTips.length, inferredRsn, pluginHubState, strings.length, tabs.length, tipSlotsFreed, totalItems, totalValue]);
  const bankDecision = useMemo(() => buildBankDecision({
    weaponCount: bankWeaponCount,
    tipCount: bankTips.length,
    tipSlotsFreed,
    totalValue,
    totalItems,
    hasPrices: initial.stats.hasPrices,
    focusMode: initialMode
  }), [bankTips.length, bankWeaponCount, initial.stats.hasPrices, initialMode, tipSlotsFreed, totalItems, totalValue]);
  const bankReadiness = useMemo(
    () => buildBankReadyToLeave({
      items: allItems,
      weaponCount: bankWeaponCount,
      stopPoint: bankDecision.stopPoint
    }),
    [allItems, bankDecision.stopPoint, bankWeaponCount]
  );
  const pluginSyncHref = useMemo(() => {
    const params = new URLSearchParams();
    if (inferredRsn?.trim()) params.set("rsn", inferredRsn.trim());
    params.set("from", "bank");
    return `/plugin?${params.toString()}#verify-sync`;
  }, [inferredRsn]);
  const dpsHandoffOptions = useMemo(
    () => returnBossSlug ? { boss: returnBossSlug } : undefined,
    [returnBossSlug]
  );
  const openSmartTidyWizard = useCallback(() => {
    setSmartTidyStage((stage) => stage === "closed" ? "choosing" : stage);
    document.getElementById("smart-tidy-setup")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);
  const runBankDecision = useCallback((action: BankDecisionAction) => {
    if (action === "dps") {
      openBankHandoffRoute(bankToolUrl("/dps", inferredRsn, dpsHandoffOptions));
      return;
    }
    if (action === "next") {
      openBankHandoffRoute(bankToolUrl("/next", inferredRsn));
      return;
    }
    if (action === "tidy") {
      openSmartTidyWizard();
      return;
    }
    void copyAll();
  }, [copyAll, dpsHandoffOptions, inferredRsn, openBankHandoffRoute, openSmartTidyWizard]);

  return (
    <div className="animate-[slide-up_0.35s_ease-out]">
      <BankDecisionHero
        decision={bankDecision}
        totalItems={totalItems}
        totalValue={totalValue}
        weaponCount={bankWeaponCount}
        tipCount={bankTips.length}
        hasPrices={initial.stats.hasPrices}
        readiness={bankReadiness}
        copied={copied}
        onPrimary={runBankDecision}
        onSecondary={runBankDecision}
        onTidy={openSmartTidyWizard}
        onEditInput={onEditInput}
      />
      <div id="smart-tidy-setup">
        <SmartTidyWizard
          stage={smartTidyStage}
          setStage={setSmartTidyStage}
          currentTabs={visibleTabs}
          baseTabs={tabs}
          currentTabName={activeTab?.name}
          copied={copied}
          onApply={applySmartTidyLayout}
          onCopy={copyAll}
        />
      </div>
      {layoutOpen && (
        <LayoutPopup
          tabNames={visibleTabs.map((t) => String(t.name))}
          prefs={prefs}
          setPrefs={setPrefs}
          pinnedNames={prefs.pinnedItems
            .map((id) => {
              const it = tabs.flatMap((t) => t.items).find((x) => x.id === id);
              return it ? { id, name: it.name } : null;
            })
            .filter((x): x is { id: number; name: string } => x !== null)}
          onClose={() => setLayoutOpen(false)}
        />
      )}

      {handoffBlockedHref && (
        <div
          id="bank-handoff-warning"
          role="alert"
          className="mb-3 rounded-xl border border-[var(--color-warning)]/30 bg-[var(--color-warning)]/10 px-4 py-3"
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--color-warning)]">
                Bank not saved
              </div>
              <p className="mt-1 max-w-2xl text-[12.5px] leading-relaxed text-[var(--color-text-dim)]">
                Scapestack could not save this bank into browser storage, so opening another tool would lose this gear.
                Enable storage for this site or copy the RuneLite export before continuing.
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              <button
                type="button"
                onClick={copyAll}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-accent)]/35 bg-[var(--color-accent)]/10 px-3 py-2 text-[12px] font-bold text-[var(--color-accent)] hover:bg-[var(--color-accent)]/15 transition-colors"
              >
                Copy export instead
                <Copy className="size-3.5" />
              </button>
              <button
                type="button"
                onClick={openBlockedHandoffWithoutBank}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)]/45 px-3 py-2 text-[12px] font-bold text-[var(--color-text)] hover:border-[var(--color-warning)]/45 hover:text-[var(--color-warning)] transition-colors"
              >
                Open without bank
                <ArrowRight className="size-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      <PinContext.Provider value={pinContextValue}>
      <DropFlashContext.Provider value={dropFlash}>
      <DndContext sensors={sensors} collisionDetection={collisionDetection} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragOver={onDragOver} onDragCancel={onDragCancel}>
        {/* Bank frame — dark slate panel, mint title accent. The "OSRS" feel
            comes from the tab strip + pixelated items inside, not the chrome. */}
        <div
          id="bank-view-panel"
          key={reorgFlash ?? "stable"}
          className={cn(
            "group/frame relative mt-3 min-w-0 overflow-hidden rounded-lg",
            "transition-[border-color,box-shadow] duration-300 ease-out",
            "hover:border-[var(--color-accent)]/30 hover:shadow-[0_28px_70px_-28px_rgb(0_0_0/0.75),0_0_0_1px_rgba(134, 166, 217,0.18)]",
            reorgFlash && "animate-[reshuffle_0.55s_cubic-bezier(0.22,1,0.36,1),mint-sweep_0.7s_ease-out]"
          )}
          style={{
            background: "var(--color-panel)",
            border: "1px solid var(--color-border-strong)",
            boxShadow: "0 24px 60px -28px rgb(0 0 0 / 0.7)"
          }}
        >
          {/* Mint scan-line at the top edge — lights up on hover */}
          <span
            aria-hidden="true"
            className="pointer-events-none absolute top-0 inset-x-0 h-px opacity-0 group-hover/frame:opacity-100 transition-opacity duration-500"
            style={{ background: "linear-gradient(to right, transparent, rgba(134, 166, 217,0.6), transparent)" }}
          />
          {/* Title bar — minimal monochrome */}
          <div className="relative flex items-center justify-between py-2.5 px-4 border-b border-[var(--color-border)] bg-[var(--color-bg-2)] gap-3">
            <div className="flex items-center gap-2">
              <span className="size-1.5 rounded-full bg-[var(--color-accent)]" />
              <span className="text-[10.5px] uppercase tracking-[0.18em] font-semibold text-[var(--color-text-dim)]">
                Tabs
              </span>
            </div>
            <QtyColorLegend />
            {initial.stats.hasPrices && totalValue > 0 && (
              <span className="text-[11.5px] font-mono font-semibold tabular-nums text-[var(--color-accent)]">
                {formatGp(totalValue)} gp
              </span>
            )}
          </div>

          {/* Tab strip — flush against title bar, items sit just below */}
          <div className="flex items-end flex-wrap gap-0.5 px-3 pt-2 bg-[var(--color-bg-2)]">
            {visibleTabs.map((tab, idx) => {
              const matches = search.trim()
                ? tab.items.filter(matchesSearch).length
                : 0;
              return (
                <TabButton
                  key={tab.name}
                  tab={tab}
                  num={idx + 1}
                  total={visibleTabs.length}
                  active={idx === activeIdx}
                  draggingTo={dragging != null}
                  hovered={hoveredTab === `tab:${tab.name}`}
                  onClick={() => setActiveIdx(idx)}
                  searchMatches={matches}
                  searching={!!search.trim()}
                />
              );
	          })}
          </div>

          {/* Inner panel — sunken dark area where items live. Density picks the
              max-width of the body so slot sizes shrink together (8 cols × N px). */}
          <div
            className={cn(
              "min-w-0 p-3",
              prefs.density === "ultra" && "max-w-[520px]",
              prefs.density === "compact" && "max-w-[680px]"
            )}
            style={{
              background: "var(--color-osrs-bank-bg)",
              borderTop: "1px solid var(--color-border-strong)"
            }}
          >
            {/* Subtab filter chips + search */}
            <SubtabFilterRow
              subtabs={subtabsInActive}
              active={activeSubtab}
              onChange={setActiveSubtab}
              search={search}
              onSearchChange={updateSearch}
              itemCount={activeTab?.items.length || 0}
              searchRef={searchRef}
            />

            {actionSearch && search.trim() && (
              <div
                role="status"
                aria-live="polite"
                className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-md border border-[var(--color-accent)]/25 bg-[var(--color-accent)]/10 px-3 py-2 text-[11.5px] text-[var(--color-text-dim)]"
              >
                <span>
                  Showing{" "}
                  <span className="font-semibold text-[var(--color-text)]">
                    {totalSearchMatches}
                  </span>{" "}
                  bank item{totalSearchMatches === 1 ? "" : "s"} for{" "}
                  <span className="font-semibold text-[var(--color-text)]">{actionSearch.sourceLabel}</span>
                  <span className="text-[var(--color-text-muted)]">{" · "}</span>
                  <span className="font-mono text-[10.5px] text-[var(--color-accent)]">{search}</span>
                </span>
                <button
                  type="button"
                  onClick={clearActionSearch}
                  className="inline-flex items-center gap-1 rounded-md border border-[var(--color-accent)]/35 bg-[var(--color-bg)]/35 px-2.5 py-1 text-[11px] font-semibold text-[var(--color-accent)] hover:bg-[var(--color-accent)]/10 transition-colors"
                >
                  Clear action search
                  <X className="size-3" />
                </button>
              </div>
            )}
            {!actionSearch && search.trim() && (
              <div
                role="status"
                aria-live="polite"
                data-testid="bank-search-visible-status"
                className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-md border border-[var(--color-border)] bg-[var(--color-bg-2)]/35 px-3 py-2 text-[11.5px] text-[var(--color-text-dim)]"
              >
                <span>
                  Search shows{" "}
                  <span className="font-semibold text-[var(--color-text)]">
                    {totalSearchMatches}
                  </span>{" "}
                  bank item{totalSearchMatches === 1 ? "" : "s"} across all tabs for{" "}
                  <span className="font-mono text-[10.5px] text-[var(--color-accent)]">{search}</span>.
                </span>
                <button
                  type="button"
                  onClick={clearActionSearch}
                  className="inline-flex items-center gap-1 rounded-md border border-[var(--color-border)] bg-[var(--color-bg)]/35 px-2.5 py-1 text-[11px] font-semibold text-[var(--color-text-dim)] hover:border-[var(--color-border-strong)] hover:text-[var(--color-text)] transition-colors"
                  aria-label="Clear visible bank search results"
                >
                  Clear search
                  <X className="size-3" />
                </button>
              </div>
            )}

            {/* Bank body (also droppable so users can drop on the canvas) */}
            <div className="min-w-0 overflow-x-auto overscroll-x-contain">
              <BankBody
                tab={activeTab}
                hasPrices={initial.stats.hasPrices}
                hasQty={initial.stats.hasQuantities}
                sort={prefs.sort}
                density={isNarrow && prefs.density === "comfortable" ? "compact" : prefs.density}
                activeSubtab={activeSubtab}
                matchesSearch={matchesSearch}
                hovered={!!activeTab && hoveredTab === `body:${activeTab.name}`}
                draggingTo={dragging != null}
                preset={activePreset}
                junkIds={activeJunkIds}
                staleIds={activeStaleIds}
                goalMatches={goalMatches}
              />
            </div>
          </div>
        </div>

        <DragOverlay dropAnimation={null}>
          {dragging && (
            <div
              className={cn(
                "rounded-md flex items-center justify-center",
                "bg-[var(--color-osrs-slot)] border-2 border-[var(--color-accent)]",
                "shadow-[0_12px_28px_-8px_rgb(0_0_0/0.7),0_0_0_4px_rgba(134, 166, 217,0.15)]",
                "animate-[pop-in_0.16s_cubic-bezier(0.22,1,0.36,1)] cursor-grabbing"
              )}
              // Match the lifted slot's real size so the overlay stays
              // squarely under the cursor (slots are fluid, not 56px fixed).
              style={{ width: dragSize, height: dragSize }}
            >
              <ItemSprite
                id={spriteIdForItem(dragging.id, dragging.quantity)}
                alt=""
                loading="eager"
                className="pixelated pointer-events-none"
                style={{
                  maxWidth: "72%",
                  maxHeight: "72%",
                  width: "auto",
                  height: "auto"
                }}
              />
              <span className="absolute -bottom-7 left-1/2 -translate-x-1/2 text-[10px] font-mono whitespace-nowrap text-[var(--color-text)] bg-[var(--color-panel)] border border-[var(--color-border-strong)] rounded px-1.5 py-0.5 shadow-md">
                {dragging.name}
              </span>
            </div>
          )}
        </DragOverlay>
      </DndContext>
      </DropFlashContext.Provider>
      </PinContext.Provider>

      <details className="group mt-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-panel)]/45 px-3 py-2">
        <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3 marker:hidden [&::-webkit-details-marker]:hidden">
          <span className="inline-flex items-center gap-2 text-[12px] font-bold text-[var(--color-text)]">
            <SlidersHorizontal className="size-3.5 text-[var(--color-accent)]" />
            More controls
          </span>
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--color-text-muted)]">
            Layout, sort and density
            <ChevronDown className="size-3.5 transition-transform group-open:rotate-180" />
          </span>
        </summary>
        <div className="mt-3">
          <PreferencesBar
            prefs={prefs}
            setPrefs={setPrefs}
            activeArchetype={activeArchetype}
            onArchetypeChange={setArchetypeOverride}
            inferredArchetype={inferredArchetype}
          />
          {inferredRsn && (
            <div className="mt-3 flex justify-end">
              <Link
                href={`/u/${encodeURIComponent(rsnSlug(inferredRsn))}`}
                className="text-[11px] font-semibold text-[var(--color-text-muted)] hover:text-[var(--color-accent)] hover:underline"
                title={`Open ${inferredRsn}'s Scapestack profile`}
              >
                Open {inferredRsn}&apos;s Scapestack profile
              </Link>
            </div>
          )}
        </div>
      </details>

      <BankActionLoopRail
        steps={bankActionLoop}
        onCopy={copyAll}
        onTips={() => {
          const details = document.getElementById("bank-insights-panel") as HTMLDetailsElement | null;
          if (details) details.open = true;
          if (bankTipSearchQuery) {
            searchSuggestionItems(bankTipSearchQuery, "Bank tips");
            return;
          }
          document.getElementById("bank-insights-panel")?.scrollIntoView({ behavior: "smooth", block: "start" });
        }}
        onNext={() => openBankHandoffRoute(bankToolUrl("/next", inferredRsn))}
        onDps={() => openBankHandoffRoute(bankToolUrl("/dps", inferredRsn, dpsHandoffOptions))}
        onPlugin={() => openBankHandoffRoute(pluginSyncHref)}
        copied={copied}
      />

      {(initial.importWarnings.fallbackItemCount > 0 || initial.importWarnings.duplicateItemCount > 0) && (
        <details className="mt-4 rounded-xl border border-[var(--color-warning)]/25 bg-[var(--color-warning)]/8 p-3">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 marker:hidden [&::-webkit-details-marker]:hidden">
            <span className="inline-flex items-center gap-2 text-[12.5px] font-semibold text-[var(--color-warning)]">
              <AlertCircle className="size-3.5" />
              Import note
            </span>
            <span className="text-[11px] font-semibold text-[var(--color-text-muted)]">
              Item IDs adjusted
            </span>
          </summary>
          <div className="mt-3 text-[12.5px] text-[var(--color-text)]">
            <p className="leading-relaxed text-[var(--color-text-dim)]">
              Imported <span className="font-mono text-[var(--color-text)]">{initial.source.itemCount}</span> of{" "}
              <span className="font-mono text-[var(--color-text)]">{initial.importWarnings.parsedItemCount}</span> pasted entries.
              {initial.importWarnings.duplicateItemCount > 0 && (
                <>
                  {" "}Collapsed <span className="font-mono text-[var(--color-text)]">{initial.importWarnings.duplicateItemCount}</span> duplicate ID{initial.importWarnings.duplicateItemCount === 1 ? "" : "s"}.
                </>
              )}
              {initial.importWarnings.fallbackItemCount > 0 && (
                <>
                  {" "}Some newer/unknown item IDs were kept as fallback tiles.
                </>
              )}
            </p>
            {initial.importWarnings.fallbackItemCount > 0 && (
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => searchSuggestionItems(fallbackItemSearchQuery, "fallback item IDs")}
                  className="inline-flex items-center gap-1 rounded-md border border-[var(--color-warning)]/35 bg-[var(--color-warning)]/10 px-2.5 py-1.5 text-[11.5px] font-semibold text-[var(--color-warning)] hover:bg-[var(--color-warning)]/15 transition-colors"
                  aria-label="Show fallback item IDs in the bank grid"
                >
                  Show in bank
                  <Search className="size-3" />
                </button>
                <a
                  href={wikiSearchUrl(`OSRS item ID ${initial.importWarnings.fallbackItemIds[0]}`)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 rounded-md border border-[var(--color-border)] bg-[var(--color-bg)]/35 px-2.5 py-1.5 text-[11.5px] font-semibold text-[var(--color-warning)] hover:border-[var(--color-warning)]/45 transition-colors"
                >
                  Check first ID on Wiki
                  <ExternalLink className="size-3" />
                </a>
              </div>
            )}
          </div>
        </details>
      )}

      <details className="mt-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-panel)]/45 p-3">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-[13px] font-semibold text-[var(--color-text)] marker:hidden">
          <span>Saved banks</span>
          <span className="text-[11px] font-medium text-[var(--color-text-muted)]">compare or restore later</span>
        </summary>
        <div className="mt-3">
          <SnapshotHistoryPanel
            snapshots={rsnSnapshots}
            scopeLabel={inferredRsn ?? "local device"}
            currentSummary={summarizeTabsForSnapshot(tabs)}
            currentSnapshot={currentSnapshot}
            compareSnapshot={compareSnapshot}
            compareDiff={compareDiff}
            deletedSnapshot={deletedSnapshot}
            onSaveSnapshot={saveCurrentSnapshot}
            onCompare={(snap) => setCompareSnapshot(compareSnapshot?.ts === snap.ts ? null : snap)}
            onDelete={deleteStoredSnapshot}
            onUndoDelete={undoDeleteSnapshot}
            onRestore={restoreSnapshot}
            onOpenNext={() => openBankHandoffRoute(bankToolUrl("/next", inferredRsn))}
            onOpenDps={() => openBankHandoffRoute(bankToolUrl("/dps", inferredRsn, dpsHandoffOptions))}
            onSearchItems={searchSuggestionItems}
            onCopyCompareSummary={copyCompareSummary}
            compareSummaryCopied={copied === "snapshot-compare-summary"}
          />
        </div>
      </details>

      <details className="mt-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-panel)]/45 p-3">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-[13px] font-semibold text-[var(--color-text)] marker:hidden">
          <span>Import details</span>
          <span className="text-[11px] font-medium text-[var(--color-text-muted)]">source, quantities and item IDs</span>
        </summary>
        <div
          data-testid="bank-source-receipt"
          className="mt-3 grid gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-2)]/70 p-3.5 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)]"
        >
          <div className="flex items-start gap-3">
            <div
              className={cn(
                "mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-lg border",
                sourceReceipt.confidenceTone === "good"
                  ? "border-[var(--color-good)]/35 bg-[var(--color-good)]/10 text-[var(--color-good)]"
                  : "border-[var(--color-warning)]/35 bg-[var(--color-warning)]/10 text-[var(--color-warning)]"
              )}
            >
              {sourceReceipt.confidenceTone === "good" ? <Shield className="size-4" /> : <AlertCircle className="size-4" />}
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--color-text-muted)]">Paste check</p>
              <p className="mt-1 text-[14px] font-semibold text-[var(--color-text)]">{sourceReceipt.sourceLabel}</p>
              <p
                className={cn(
                  "mt-1 inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold",
                  sourceReceipt.confidenceTone === "good"
                    ? "border-[var(--color-good)]/30 bg-[var(--color-good)]/10 text-[var(--color-good)]"
                    : "border-[var(--color-warning)]/30 bg-[var(--color-warning)]/10 text-[var(--color-warning)]"
                )}
              >
                {sourceReceipt.confidenceLabel}
              </p>
            </div>
          </div>
          <div className="grid gap-2 text-[12.5px] leading-relaxed text-[var(--color-text-dim)]">
            <p className="flex gap-2">
              <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-[var(--color-good)]" />
              <span>{sourceReceipt.exactLine}</span>
            </p>
            <p className="flex gap-2">
              <AlertCircle className="mt-0.5 size-3.5 shrink-0 text-[var(--color-warning)]" />
              <span>{sourceReceipt.limitationLine}</span>
            </p>
            <p className="flex gap-2">
              <ArrowRight className="mt-0.5 size-3.5 shrink-0 text-[var(--color-accent)]" />
              <span>{sourceReceipt.nextLine}</span>
            </p>
            <div
              data-testid="bank-id-sprite-health"
              className={cn(
                "mt-1 rounded-lg border px-3 py-2",
                idSpriteHealth.tone === "good"
                  ? "border-[var(--color-good)]/25 bg-[var(--color-good)]/8"
                  : "border-[var(--color-warning)]/30 bg-[var(--color-warning)]/8"
              )}
            >
              <p className={cn(
                "flex items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-[0.16em]",
                idSpriteHealth.tone === "good" ? "text-[var(--color-good)]" : "text-[var(--color-warning)]"
              )}>
                {idSpriteHealth.tone === "good" ? <CheckCircle2 className="size-3.5" /> : <AlertCircle className="size-3.5" />}
                {idSpriteHealth.label}
              </p>
              <p className="mt-1 text-[11.5px] leading-relaxed text-[var(--color-text-dim)]">
                {idSpriteHealth.detail}
              </p>
            </div>
          </div>
        </div>
      </details>

      {/* ── Insights — secondary panels, collapsed below the bank ────────────
          Six analytical panels (tips, diffs, junk, upgrades, goals, diet)
          used to stack equally below the bank, competing for attention and
          burying the export action. Now wrapped in a single <details>
          element: a summary line counts what's inside, click to expand.
          Visitors who came to "get tabs and export" never scroll past the
          summary; analytical users find everything one click away.
          Native <details> over a React state toggle on purpose — no extra
          render, keyboard-accessible, survives soft navigation. */}
      <details
        id="bank-insights-panel"
        open={bankTips.length > 0 || undefined}
        className="group mt-8 rounded-lg border border-[var(--color-border)] bg-[var(--color-panel)]/40 overflow-hidden"
      >
        <summary className="cursor-pointer list-none flex items-center justify-between gap-3 px-4 py-3 hover:bg-[var(--color-panel)]/60 transition-colors">
          <div className="flex items-center gap-3 min-w-0">
            <Sparkles className="size-4 text-[var(--color-accent)] shrink-0" />
            <span className="text-[13px] font-semibold text-[var(--color-text)] tracking-normal">
              Insights about this bank
            </span>
            <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11.5px] text-[var(--color-text-dim)] font-mono">
              {bankTips.length > 0 && <span>· {bankTips.length} tip{bankTips.length === 1 ? "" : "s"}</span>}
              {diff && !diffDismissed && <span className="text-[var(--color-accent)]">· diff vs last</span>}
              {junkSummaryAll.count > 0 && <span className="text-[var(--color-danger)]">· {junkSummaryAll.count} junk</span>}
              {upgradeSuggestions.length > 0 && <span className="text-[var(--color-accent)]">· {upgradeSuggestions.length} upgrade{upgradeSuggestions.length === 1 ? "" : "s"}</span>}
              {goalSetProgress.length > 0 && <span>· {goalSetProgress.length} goal{goalSetProgress.length === 1 ? "" : "s"} close</span>}
              {staleSummary.count > 0 && <span className="text-[var(--color-warning)]">· {staleSummary.count} stale</span>}
            </span>
          </div>
          <ChevronDown className="size-4 text-[var(--color-text-dim)] shrink-0 transition-transform group-open:rotate-180" />
        </summary>
        <div className="px-4 pt-1 pb-4 border-t border-[var(--color-border)] space-y-3">

      {/* Actionable tips — decant, merge, complete outfit, pick up untradeables. */}
      <div>
        <TipsCard tips={bankTips} onSearchItems={searchSuggestionItems} />
      </div>

      {/* Diff vs previous bank snapshot, if any */}
      {diff && !diffDismissed && (
        <DiffBanner diff={diff} history={scoreHistory} onDismiss={() => setDiffDismissed(true)} />
      )}

      {/* Junk banner */}
      {prefs.showJunk && (
        <div className="mt-3 rounded-lg border border-[var(--color-danger)]/30 bg-[var(--color-danger)]/8 text-[12.5px] overflow-hidden">
          <button
            type="button"
            onClick={() => junkSummaryAll.count > 0 && setJunkListOpen((v) => !v)}
            disabled={junkSummaryAll.count === 0}
            className={cn(
              "w-full flex items-center gap-3 px-3.5 py-2.5 text-left",
              junkSummaryAll.count > 0 && "hover:bg-[var(--color-danger)]/12 cursor-pointer",
              junkSummaryAll.count === 0 && "cursor-default"
            )}
            aria-expanded={junkListOpen}
          >
            <Trash2 className="size-3.5 text-[var(--color-danger)] shrink-0" />
            <div className="flex-1 min-w-0">
              {junkSummaryAll.count > 0 ? (
                <>
                  <span className="text-[var(--color-text)]">
                    <span className="font-semibold text-[var(--color-danger)]">{junkSummaryAll.count}</span> items can probably go &mdash; freeing slots, worth roughly{" "}
                    <span className="font-mono font-semibold text-[var(--color-text)]">{formatGp(junkSummaryAll.totalValue)} gp</span>
                  </span>
                  <span className="block text-[10.5px] text-[var(--color-text-muted)] mt-0.5">
                    Single-stack items under 25 gp with no use slot. Tools, teleport jewellery, diary rewards are protected.
                  </span>
                </>
              ) : (
                <span className="text-[var(--color-text-dim)]">No junk detected &mdash; your bank is clean.</span>
              )}
            </div>
            {junkSummaryAll.count > 0 && (
              <ChevronDown
                className={cn(
                  "size-4 text-[var(--color-text-dim)] transition-transform shrink-0",
                  junkListOpen && "rotate-180"
                )}
              />
            )}
          </button>
          {junkListOpen && junkEntries.length > 0 && (
            <div
              className="border-t border-[var(--color-danger)]/20 bg-[var(--color-bg)]/30 max-h-[420px] overflow-y-auto"
              // Inline padding so the grid below can compute its width
              // accurately from the parent's content-box. Tailwind's px-3.5
              // applied via class works the same way but inline-style edits
              // are immune to JIT classnamemiss.
              style={{ padding: "12px 14px" }}
            >
              {/* Premium junk-grid. Pure inline CSS so it can't be undone by
                  a missing Tailwind class. auto-fill + minmax(44px,1fr) packs
                  as many fixed-min columns as the container can fit. */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(44px, 1fr))",
                  gridAutoRows: "44px",
                  columnGap: "6px",
                  rowGap: "6px",
                  width: "100%",
                  boxSizing: "border-box"
                }}
              >
                {junkEntries.map(({ item, tab }) => (
                  <JunkTile key={`${item.id}-${tab}`} item={item} tab={tab} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Hiscores-aware upgrade suggestions */}
      {upgradeSuggestions.length > 0 && (
        <div className="mt-3 rounded-lg border border-[var(--color-accent)]/25 bg-gradient-to-br from-[var(--color-accent)]/10 to-transparent px-4 py-3 animate-[fade-in_0.3s_ease-out]">
          <div className="flex items-center gap-2 mb-2.5">
            <Sparkles className="size-3.5 text-[var(--color-accent)]" />
            <span className="text-[12.5px] font-medium text-[var(--color-text)]">Next upgrades for {inferredRsn || "your account"}</span>
            <span className="text-[10.5px] text-[var(--color-text-muted)] ml-auto">Picked from your hiscores + bank</span>
          </div>
          <div className="grid sm:grid-cols-3 gap-2.5">
            {upgradeSuggestions.map((s) => {
              const price = s.livePrice ?? s.upgrade.approxPrice;
              return (
                <div
                  key={s.upgrade.id}
                  className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg-2)] p-2.5 hover:border-[var(--color-accent)]/40 transition-colors group"
                >
                  <div className="flex items-start gap-2.5">
                    <div className="size-10 rounded bg-[var(--color-bg)] border border-[var(--color-border)] flex items-center justify-center shrink-0 group-hover:border-[var(--color-accent)]/30 transition-colors">
                      <ItemSprite
                        id={s.upgrade.id}
                        alt=""
                        className="pixelated"
                        style={{ maxWidth: "78%", maxHeight: "78%" }}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[12px] font-semibold text-[var(--color-text)] leading-tight truncate">{s.upgrade.name}</div>
                      <div className="text-[10.5px] text-[var(--color-accent)] font-mono tabular-nums mt-0.5">
                        {price > 0 ? `${formatGp(price)} gp` : "Untradeable"}
                      </div>
                      <div className="text-[10px] text-[var(--color-text-muted)] mt-0.5 truncate" title={s.upgrade.bucket}>
                        {s.upgrade.bucket}
                        {s.upgrade.reqs.length > 0 && (
                          <span className="ml-1">· {s.upgrade.reqs.map((r) => `${r.level} ${r.skill.slice(0, 3)}`).join(", ")}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  {s.upgrade.why && (
                    <p className="mt-2 text-[10.5px] leading-snug text-[var(--color-text-dim)] border-t border-[var(--color-border)] pt-2">
                      {s.upgrade.why}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Goals progress banner */}
      {prefs.showGoals && goalSetProgress.length > 0 && (
        <div className="mt-3 rounded-lg border border-[var(--color-accent)]/30 bg-[var(--color-accent)]/8 px-3.5 py-2.5 text-[12.5px] animate-[fade-in_0.25s_ease-out]">
          <div className="flex items-center gap-2 mb-2">
            <Target className="size-3.5 text-[var(--color-accent)]" />
            <span className="text-[var(--color-text)] font-medium">Closest goal sets &mdash; chase what&apos;s nearest done</span>
          </div>
          <div className="grid sm:grid-cols-2 gap-1.5">
            {goalSetProgress.map((p) => {
              const pct = Math.round((p.owned / p.total) * 100);
              return (
                <div key={p.set.id} className="flex items-center gap-2">
                  {p.set.iconItemId ? (
                    <span className="size-5 shrink-0 rounded bg-[var(--color-bg-2)] border border-[var(--color-border)] flex items-center justify-center">
                      <ItemSprite
                        id={p.set.iconItemId}
                        alt=""
                        className="pixelated"
                        style={{
                          maxWidth: "78%",
                          maxHeight: "78%"
                        }}
                      />
                    </span>
                  ) : (
                    <span aria-hidden="true" className="size-3 shrink-0 rounded-full bg-[var(--color-text-muted)] inline-block" />
                  )}
                  <span className="text-[var(--color-text-dim)] flex-1 min-w-0 truncate">{p.set.name}</span>
                  <span className="font-mono tabular-nums text-[var(--color-accent)] font-semibold shrink-0">{p.owned}/{p.total}</span>
                  <div className="w-16 h-1.5 rounded-full bg-[var(--color-border)] overflow-hidden shrink-0">
                    <div className="h-full bg-[var(--color-accent)]" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Bank diet banner */}
      {prefs.showStale && (
        <div className="mt-3 flex items-center gap-3 rounded-lg border border-[var(--color-warning)]/30 bg-[var(--color-warning)]/8 px-3.5 py-2.5 text-[12.5px] animate-[fade-in_0.25s_ease-out]">
          <Hourglass className="size-3.5 text-[var(--color-warning)] shrink-0" />
          <div className="flex-1 min-w-0">
            {staleSummary.count > 0 ? (
              <>
                <span className="text-[var(--color-text)]">
                  <span className="font-semibold text-[var(--color-warning)]">{staleSummary.count}</span> items haven&apos;t budged in {staleSummary.oldestDays}+ days &mdash; dead weight worth a look.
                </span>
                <span className="block text-[10.5px] text-[var(--color-text-muted)] mt-0.5">
                  Quest, Untradeables, Trophy and Clue tabs are protected. Diet builds up as you re-organize over time.
                </span>
              </>
            ) : (
              <span className="text-[var(--color-text-dim)]">
                Bank diet starts tracking now &mdash; come back after a few organize sessions to see stale items.
              </span>
            )}
          </div>
        </div>
      )}
        </div>
      </details>

      {/* Smart suggestions based on what's in the bank */}
      <SuggestionsPanel tabs={tabs} onSearchItems={searchSuggestionItems} />

      {/* Export */}
      <section id="bank-export-panel" tabIndex={-1} className="mt-8 surface p-5">
        <div className="flex items-baseline justify-between flex-wrap gap-3 mb-1">
          <h3 className="text-[15px] font-semibold text-[var(--color-text)] tracking-normal">
            Export back to RuneLite
          </h3>
          <span className="text-[11px] text-[var(--color-text-muted)]">
            One string per tab
          </span>
        </div>
        <p className="text-[12.5px] text-[var(--color-text-dim)] leading-relaxed mb-4">
          In RuneLite: <span className="text-[var(--color-accent)]">Bank Tags → Import tag tab</span>, paste, repeat for each tab.
        </p>

        <div className="flex flex-wrap items-center gap-2 mb-4">
          <button
            type="button"
            onClick={copyAll}
            className={cn(
              "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] font-medium",
              "bg-[var(--color-accent)] text-[#0B1116] hover:brightness-110 transition-all"
            )}
          >
            {copied === "all" ? <CheckCheck className="size-3.5" /> : <Copy className="size-3.5" />}
            {copied === "all" ? "Copied all tabs" : "Copy all tabs"}
          </button>
          <button type="button" onClick={copyNumbered} className="btn-ghost">
            {copied === "numbered" ? <CheckCheck className="size-3.5 text-[var(--color-accent)]" /> : <Copy className="size-3.5" />}
            {copied === "numbered" ? "Copied headers" : "Copy with headers"}
          </button>
        </div>

        <div
          role="status"
          aria-live="polite"
          className={cn(
            "mb-4 min-h-[34px] rounded-md border px-3 py-2 text-[11.5px] transition-colors",
            exportCopyMessage
              ? copied === "copy-error"
                ? "border-[var(--color-danger)]/35 bg-[var(--color-danger)]/10 text-[var(--color-danger)]"
                : "border-[var(--color-accent)]/30 bg-[var(--color-accent)]/10 text-[var(--color-text)]"
              : "border-[var(--color-border)] bg-[var(--color-bg-2)]/35 text-[var(--color-text-muted)]"
          )}
        >
          {exportCopyMessage ?? "Copy an export string, then paste it into RuneLite Bank Tags."}
        </div>
        {copied === "copy-error" && (
          <div className="mb-4 rounded-md border border-[var(--color-danger)]/25 bg-[var(--color-bg-2)]/50 p-3">
            <label
              htmlFor="manual-banktags-export"
              className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--color-danger)]"
            >
              Manual fallback export
            </label>
            <textarea
              id="manual-banktags-export"
              readOnly
              value={manualExportFallback || strings.join("\n")}
              onFocus={(event) => event.currentTarget.select()}
              className="min-h-[120px] w-full resize-y rounded border border-[var(--color-border)] bg-[var(--color-bg)] p-2 font-mono text-[11px] leading-relaxed text-[var(--color-text)]"
              aria-label="Manual Bank Tags export fallback"
            />
            <p className="mt-1.5 text-[11px] text-[var(--color-text-muted)]">
              Select all, copy manually, then paste the shown export into RuneLite Bank Tags.
            </p>
          </div>
        )}

        <ol className="space-y-1.5">
          {tabs.map((tab, i) => (
            <li
              key={tab.name}
              className="grid grid-cols-[28px_28px_1fr_auto] items-center gap-3 p-3 rounded-md bg-[var(--color-bg-2)] border border-[var(--color-border)] hover:border-[var(--color-border-strong)] transition-colors"
            >
              <span className="text-center text-[11px] font-mono font-medium text-[var(--color-text-muted)] tabular-nums">
                {i + 1}
              </span>
              <ItemSprite
                id={tab.iconItemId}
                alt=""
                loading="lazy"
                className="pixelated mx-auto"
                style={{
                  maxWidth: "22px",
                  maxHeight: "22px",
                  width: "auto",
                  height: "auto"
                }}
              />
              <div className="min-w-0">
                <div className="text-[13px] font-medium text-[var(--color-text)]">
                  {tab.name}
                  <span className="ml-2 text-[11px] text-[var(--color-text-muted)] font-normal font-mono">
                    {tab.items.length} items
                  </span>
                </div>
                <code className="block mt-0.5 font-mono text-[10.5px] text-[var(--color-text-muted)] break-all max-h-8 overflow-y-auto leading-snug">
                  {strings[i] || ""}
                </code>
              </div>
              <button
                type="button"
                onClick={() => copyOne(i)}
                className={cn(
                  "btn-ghost shrink-0",
                  copied === `one-${i}` && "text-[var(--color-accent)] border-[var(--color-accent)]/40"
                )}
              >
                {copied === `one-${i}` ? <CheckCheck className="size-3.5" /> : <Copy className="size-3.5" />}
                {copied === `one-${i}` ? "Copied" : "Copy"}
              </button>
            </li>
          ))}
        </ol>
      </section>

      <BossTagSection
        items={allItems}
        flash={flash}
        copied={copied}
        onOpenDps={(bossSlug) => openBankHandoffRoute(bankToolUrl("/dps", inferredRsn, { boss: bossSlug }))}
      />

      {/* Support ask — appears once a user has just gotten value (organized
          a bank). Dismissable for 30 days. */}
      <SupportCard context="Saved you a minute organizing your bank?" />

      {/* Optional Discord notifications — tucked at the bottom so it doesn't
          dominate the layout. Hidden by default until user opts in. */}
      <div className="mt-7">
        <DiscordWebhookCard />
      </div>
    </div>
  );
}

// ── Subcomponents ─────────────────────────────────────────────────────────

function SnapshotHistoryPanel({
  snapshots,
  scopeLabel,
  currentSummary,
  currentSnapshot,
  compareSnapshot,
  compareDiff,
  deletedSnapshot,
  onCompare,
  onDelete,
  onUndoDelete,
  onSaveSnapshot,
  onRestore,
  onOpenNext,
  onOpenDps,
  onSearchItems,
  onCopyCompareSummary,
  compareSummaryCopied
}: {
  snapshots: BankSnapshot[];
  scopeLabel: string;
  currentSummary: SnapshotSummary;
  currentSnapshot: BankSnapshot;
  compareSnapshot: BankSnapshot | null;
  compareDiff: BankDiff | null;
  deletedSnapshot: BankSnapshot | null;
  onCompare: (snap: BankSnapshot) => void;
  onDelete: (snap: BankSnapshot) => void;
  onUndoDelete: () => void;
  onSaveSnapshot: () => void;
  onRestore: (snap: BankSnapshot) => void;
  onOpenNext: () => void;
  onOpenDps: () => void;
  onSearchItems: (query: string, sourceLabel?: string) => void;
  onCopyCompareSummary: (diff: BankDiff) => void;
  compareSummaryCopied: boolean;
}) {
  const recent = snapshots.slice(-5).reverse();
  const latest = snapshots[snapshots.length - 1] ?? null;
  const recommendedBaseline = !compareSnapshot
    ? recent.find((snap) => hasSnapshotDelta(diffSnapshots(snap, currentSnapshot))) ?? null
    : null;
  const recommendedBaselineDiff = recommendedBaseline
    ? diffSnapshots(recommendedBaseline, currentSnapshot)
    : null;

  return (
    <section className="mb-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-panel)]/55 px-4 py-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Hourglass className="size-3.5 text-[var(--color-accent)]" />
            <span className="text-[11px] uppercase tracking-[0.18em] font-bold text-[var(--color-text-muted)]">
              Saved banks
            </span>
            <span className="rounded-full border border-[var(--color-border)] bg-[var(--color-bg-2)] px-2 py-0.5 text-[10.5px] text-[var(--color-text-dim)]">
              {scopeLabel}
            </span>
          </div>
          <p className="mt-1 text-[12px] leading-relaxed text-[var(--color-text-dim)]">
            Current bank: <strong className="text-[var(--color-text)]">{currentSummary.itemCount}</strong> items ·{" "}
            <strong className="text-[var(--color-accent)]">{formatGp(currentSummary.totalValue)}</strong> · Stack Score{" "}
            <strong className="text-[var(--color-text)]">{currentSummary.stackScore}</strong>
            {currentSummary.tipCount > 0 && <> · <strong className="text-[var(--color-warning)]">{currentSummary.tipCount}</strong> tip{currentSummary.tipCount === 1 ? "" : "s"}</>}
          </p>
          {currentSummary.topItems.length > 0 && (
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <span className="text-[10.5px] uppercase tracking-[0.14em] font-bold text-[var(--color-text-muted)]">
                Top now
              </span>
              {currentSummary.topItems.slice(0, 3).map((item) => (
                <span
                  key={item.id}
                  className="inline-flex items-center gap-1.5 rounded-md border border-[var(--color-border)] bg-[var(--color-bg-2)]/45 px-1.5 py-1 text-[10.5px] text-[var(--color-text-dim)]"
                  title={`${item.name} · ${formatGp(item.stackValue)} gp`}
                >
                  <span className="size-5 rounded bg-[var(--color-bg)] border border-[var(--color-border)] flex items-center justify-center">
                    <ItemSprite
                      id={spriteIdForItem(item.id, item.quantity)}
                      alt=""
                      className="pixelated"
                      style={{ maxWidth: "82%", maxHeight: "82%" }}
                    />
                  </span>
                  <span className="max-w-[110px] truncate">{item.name}</span>
                  {item.stackValue > 0 && (
                    <span className="font-mono tabular-nums text-[var(--color-accent)]">{formatGp(item.stackValue)}</span>
                  )}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="text-right text-[11px] text-[var(--color-text-muted)]">
          {latest ? (
            <>
              <div>Latest autosave: {snapshotAge(latest.ts)}</div>
              <div>{snapshots.length} local snapshot{snapshots.length === 1 ? "" : "s"}</div>
            </>
          ) : (
            <div>No snapshots yet</div>
          )}
        </div>
      </div>

      {deletedSnapshot && (
        <div
          role="status"
          aria-live="polite"
          className="mt-3 flex flex-wrap items-center gap-2 rounded-md border border-[var(--color-danger)]/30 bg-[var(--color-danger)]/10 px-3 py-2 text-[11.5px] text-[var(--color-text)]"
        >
          <Trash2 className="size-3.5 text-[var(--color-danger)]" />
          <span className="flex-1 min-w-[180px]">
            Deleted {snapshotAge(deletedSnapshot.ts)} snapshot · {deletedSnapshot.items.length} items.
          </span>
          <button
            type="button"
            onClick={onUndoDelete}
            className="inline-flex items-center gap-1 rounded border border-[var(--color-border)] bg-[var(--color-bg)]/40 px-2 py-1 text-[10.5px] font-semibold text-[var(--color-text)] hover:border-[var(--color-border-strong)]"
          >
            <RotateCcw className="size-3" />
            Undo
          </button>
        </div>
      )}

      {recent.length > 0 ? (
        <>
          {snapshots.length === 1 && !compareSnapshot && (
            <div
              data-testid="snapshot-single-compare-hint"
              className="mt-3 flex flex-wrap items-center gap-2 rounded-md border border-[var(--color-accent)]/25 bg-[var(--color-accent)]/10 px-3 py-2 text-[11.5px] text-[var(--color-text)]"
            >
              <ArrowUpDown className="size-3.5 text-[var(--color-accent)]" />
              <span className="flex-1 min-w-[210px]">
                Compare needs two save points. Save another snapshot after edits, loot, or a new import to unlock a before/after diff.
              </span>
              <button
                type="button"
                onClick={onSaveSnapshot}
                className="inline-flex items-center gap-1 rounded border border-[var(--color-accent)]/35 bg-[var(--color-bg)]/40 px-2 py-1 text-[10.5px] font-semibold text-[var(--color-accent)] hover:border-[var(--color-accent)]/60"
                aria-label="Save second bank snapshot"
              >
                <Save className="size-3" />
                Save second snapshot
              </button>
            </div>
          )}

          {recommendedBaseline && recommendedBaselineDiff && (
            <div
              data-testid="snapshot-baseline-recommendation"
              className="mt-3 flex flex-wrap items-center gap-2 rounded-md border border-[var(--color-good)]/25 bg-[var(--color-good)]/10 px-3 py-2 text-[11.5px] text-[var(--color-text)]"
            >
              <Target className="size-3.5 text-[var(--color-good)]" />
              <span className="flex-1 min-w-[220px]">
                Recommended baseline: compare against the {snapshotAge(recommendedBaseline.ts)} save point.{" "}
                <span className="font-semibold text-[var(--color-text)]">
                  {snapshotDeltaPreview(recommendedBaselineDiff)}
                </span>
                {" "}changed since then.
              </span>
              <button
                type="button"
                onClick={() => onCompare(recommendedBaseline)}
                className="inline-flex items-center gap-1 rounded border border-[var(--color-good)]/35 bg-[var(--color-bg)]/40 px-2 py-1 text-[10.5px] font-semibold text-[var(--color-good)] hover:border-[var(--color-good)]/60"
                aria-label="Compare the recommended bank baseline"
              >
                <ArrowUpDown className="size-3" />
                Compare recommended
              </button>
            </div>
          )}

          <div className="mt-3 flex flex-wrap gap-2">
            {recent.map((snap) => {
              const active = compareSnapshot?.ts === snap.ts;
              const isLatest = latest?.ts === snap.ts;
              const previewDiff = diffSnapshots(snap, currentSnapshot);
              const previewSummary = summarizeSnapshotCompare(previewDiff);
              const isCurrentSnapshot = !hasSnapshotDelta(previewDiff);
              const totalValue = snap.items.reduce((sum, item) => sum + item.stackValue, 0);
              const topItems = snap.items
                .slice()
                .sort((a, b) => b.stackValue - a.stackValue)
                .slice(0, 3);
              return (
                <div
                  key={snap.ts}
                  className={cn(
                    "rounded-md border px-2.5 py-2 text-[11.5px] min-w-[220px]",
                    active
                      ? "border-[var(--color-accent)]/45 bg-[var(--color-accent)]/10"
                      : "border-[var(--color-border)] bg-[var(--color-bg-2)]/45"
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className={cn("font-semibold", active ? "text-[var(--color-accent)]" : "text-[var(--color-text)]")}>
                        {isLatest ? "Latest · " : ""}{snapshotAge(snap.ts)}
                      </div>
                      <div className="mt-1 text-[var(--color-text-muted)] tabular-nums">
                        {snap.items.length} items · {formatGp(totalValue)}
                      </div>
                    </div>
                    {isLatest && (
                      <span className="rounded-full border border-[var(--color-accent)]/25 bg-[var(--color-accent)]/10 px-1.5 py-0.5 text-[9.5px] font-semibold uppercase tracking-[0.12em] text-[var(--color-accent)]">
                        autosave
                      </span>
                    )}
                  </div>

                  {topItems.length > 0 && (
                    <div className="mt-2 flex items-center gap-1.5">
                      {topItems.map((item) => (
                        <span
                          key={item.id}
                          className="size-7 rounded border border-[var(--color-border)] bg-[var(--color-bg)] flex items-center justify-center"
                          title={`${item.name} · ${formatGp(item.stackValue)} gp`}
                        >
                          <ItemSprite
                            id={spriteIdForItem(item.id, item.quantity)}
                            alt=""
                            className="pixelated"
                            style={{ maxWidth: "82%", maxHeight: "82%" }}
                          />
                        </span>
                      ))}
                    </div>
                  )}

                  {!isCurrentSnapshot && (
                    <div
                      className="mt-2 rounded border border-[var(--color-border)] bg-[var(--color-bg)]/35 px-2 py-1.5 text-[10.5px] leading-relaxed text-[var(--color-text-dim)]"
                      title={previewSummary.headline}
                    >
                      Compare preview: <span className="font-semibold text-[var(--color-text)]">{snapshotDeltaPreview(previewDiff)}</span>
                    </div>
                  )}

                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {isCurrentSnapshot ? (
                      <span className="inline-flex items-center gap-1 rounded border border-[var(--color-accent)]/30 bg-[var(--color-accent)]/10 px-2 py-1 text-[10.5px] font-semibold text-[var(--color-accent)]">
                        <CheckCheck className="size-3" />
                        Current
                      </span>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => onCompare(snap)}
                          className={cn(
                            "inline-flex items-center gap-1 rounded border px-2 py-1 text-[10.5px] font-semibold transition-colors",
                            active
                              ? "border-[var(--color-accent)]/45 bg-[var(--color-accent)]/12 text-[var(--color-accent)]"
                              : "border-[var(--color-border)] text-[var(--color-text-dim)] hover:text-[var(--color-accent)] hover:border-[var(--color-accent)]/35"
                          )}
                          aria-label={active ? "Stop comparing this bank snapshot" : "Compare this bank snapshot"}
                        >
                          <ArrowUpDown className="size-3" />
                          {active ? "Viewing impact" : "Compare impact"}
                        </button>
                        <button
                          type="button"
                          onClick={() => onRestore(snap)}
                          className="inline-flex items-center gap-1 rounded border border-[var(--color-border)] px-2 py-1 text-[10.5px] font-semibold text-[var(--color-text-dim)] hover:text-[var(--color-text)] hover:border-[var(--color-border-strong)]"
                          aria-label="Restore this snapshot as a flat bank view"
                        >
                          <RotateCcw className="size-3" />
                          Restore
                        </button>
                      </>
                    )}
                    <button
                      type="button"
                      onClick={() => onDelete(snap)}
                      className="inline-flex items-center gap-1 rounded border border-[var(--color-border)] px-2 py-1 text-[10.5px] font-semibold text-[var(--color-text-dim)] hover:text-[var(--color-danger)] hover:border-[var(--color-danger)]/35"
                      aria-label="Delete this snapshot"
                    >
                      <Trash2 className="size-3" />
                      Delete
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      ) : (
        <p className="mt-3 rounded-md border border-dashed border-[var(--color-border)] bg-[var(--color-bg-2)]/30 px-3 py-2 text-[11.5px] text-[var(--color-text-muted)]">
          Organize again later and Scapestack will show what changed. Use “Save snapshot” after manual drag/drop changes.
        </p>
      )}

      {compareDiff && compareSnapshot && (
        <div className="mt-3 border-t border-[var(--color-border)] pt-3">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="text-[10px] uppercase tracking-[0.16em] font-bold text-[var(--color-text-muted)]">
                Compare to
              </div>
              <div className="text-[12px] font-semibold text-[var(--color-text)]">
                {snapshotAge(compareSnapshot.ts)} snapshot
              </div>
            </div>
            <button
              type="button"
              onClick={() => onCompare(compareSnapshot)}
              className="inline-flex items-center gap-1 rounded border border-[var(--color-border)] px-2 py-1 text-[10.5px] font-semibold text-[var(--color-text-dim)] hover:text-[var(--color-text)] hover:border-[var(--color-border-strong)]"
              aria-label="Stop comparing this bank snapshot"
            >
              <X className="size-3" />
              Stop compare
            </button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <SnapshotDelta label="Added" value={compareDiff.added.length} tone="good" />
            <SnapshotDelta label="Removed" value={compareDiff.removed.length} tone="danger" />
            <SnapshotDelta label="Qty changed" value={compareDiff.changedQuantity.length} />
            <SnapshotDelta
              label="Value delta"
              value={formatGp(Math.abs(compareDiff.totalValueAfter - compareDiff.totalValueBefore))}
              tone={compareDiff.totalValueAfter >= compareDiff.totalValueBefore ? "good" : "danger"}
            />
          </div>
          <SnapshotCompareActionRail
            diff={compareDiff}
            onSaveSnapshot={onSaveSnapshot}
            onOpenNext={onOpenNext}
            onOpenDps={onOpenDps}
            onSearchItems={onSearchItems}
            onCopySummary={() => onCopyCompareSummary(compareDiff)}
            summaryCopied={compareSummaryCopied}
          />
          <SnapshotDiffDetails diff={compareDiff} onSearchItems={onSearchItems} />
        </div>
      )}
    </section>
  );
}

function SnapshotCompareActionRail({
  diff,
  onSaveSnapshot,
  onOpenNext,
  onOpenDps,
  onSearchItems,
  onCopySummary,
  summaryCopied
}: {
  diff: BankDiff;
  onSaveSnapshot: () => void;
  onOpenNext: () => void;
  onOpenDps: () => void;
  onSearchItems: (query: string, sourceLabel?: string) => void;
  onCopySummary: () => void;
  summaryCopied: boolean;
}) {
  const summary = summarizeSnapshotCompare(diff);
  const actions = recommendSnapshotCompareActions(diff);
  const valueDelta = diff.totalValueAfter - diff.totalValueBefore;
  const nextCopy = valueDelta > 0 ? "Re-plan upgrades with new GP" : "Find next affordable upgrade";

  return (
    <div
      data-testid="snapshot-compare-action-rail"
      className="mt-3 rounded-md border border-[var(--color-accent)]/20 bg-[var(--color-accent)]/8 px-3 py-2"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-[220px] flex-1">
          <div className="text-[10px] uppercase tracking-[0.16em] font-bold text-[var(--color-accent)]">
            Do something with this diff
          </div>
          <p className="mt-1 text-[11.5px] leading-relaxed text-[var(--color-text-dim)]">
            {summary.headline}. Use the same bank state for upgrade planning or DPS, then save the current bank as the new baseline.
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={onOpenNext}
            className="inline-flex items-center gap-1 rounded border border-[var(--color-accent)]/35 bg-[var(--color-bg)]/45 px-2 py-1 text-[10.5px] font-semibold text-[var(--color-accent)] hover:border-[var(--color-accent)]/60"
            aria-label="Open next upgrades using this bank"
          >
            <Target className="size-3" />
            {nextCopy}
          </button>
          <button
            type="button"
            onClick={onOpenDps}
            className="inline-flex items-center gap-1 rounded border border-[var(--color-border)] bg-[var(--color-bg)]/35 px-2 py-1 text-[10.5px] font-semibold text-[var(--color-text)] hover:border-[var(--color-border-strong)]"
            aria-label="Check kill using this bank"
          >
            <Sword className="size-3" />
            Check kill
          </button>
          <button
            type="button"
            onClick={onCopySummary}
            className={cn(
              "inline-flex items-center gap-1 rounded border bg-[var(--color-bg)]/35 px-2 py-1 text-[10.5px] font-semibold hover:border-[var(--color-border-strong)]",
              summaryCopied
                ? "border-[var(--color-accent)]/45 text-[var(--color-accent)]"
                : "border-[var(--color-border)] text-[var(--color-text-dim)] hover:text-[var(--color-text)]"
            )}
            aria-label="Copy bank compare summary"
          >
            {summaryCopied ? <CheckCheck className="size-3" /> : <Copy className="size-3" />}
            {summaryCopied ? "Summary copied" : "Copy summary"}
          </button>
          <button
            type="button"
            onClick={onSaveSnapshot}
            className="inline-flex items-center gap-1 rounded border border-[var(--color-border)] bg-[var(--color-bg)]/35 px-2 py-1 text-[10.5px] font-semibold text-[var(--color-text-dim)] hover:text-[var(--color-text)] hover:border-[var(--color-border-strong)]"
            aria-label="Save current bank as new compare baseline"
          >
            <Save className="size-3" />
            Save as baseline
          </button>
        </div>
      </div>
      <div className="mt-3 grid gap-1.5 md:grid-cols-2">
        {actions.map((action) => (
          <div
            key={`${action.label}:${action.searchQuery ?? action.body}`}
            className="rounded border border-[var(--color-border)] bg-[var(--color-bg)]/30 px-2 py-1.5"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="text-[10.5px] font-bold text-[var(--color-text)]">{action.label}</div>
                <p className="mt-0.5 text-[10.5px] leading-relaxed text-[var(--color-text-muted)]">{action.body}</p>
              </div>
              {action.searchQuery && (
                <button
                  type="button"
                  onClick={() => onSearchItems(action.searchQuery!, "snapshot action brief")}
                  className="inline-flex shrink-0 items-center gap-1 rounded border border-[var(--color-border)] px-1.5 py-0.5 text-[9.5px] font-semibold text-[var(--color-text-muted)] hover:border-[var(--color-accent)]/40 hover:text-[var(--color-accent)]"
                  aria-label={`Search current bank for ${action.label.toLowerCase()}`}
                >
                  <Search className="size-2.5" />
                  Search
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SnapshotDiffDetails({
  diff,
  onSearchItems
}: {
  diff: BankDiff;
  onSearchItems: (query: string, sourceLabel?: string) => void;
}) {
  const summary = summarizeSnapshotCompare(diff);
  const changed = diff.changedQuantity
    .slice()
    .sort((left, right) => Math.abs(right.deltaValue) - Math.abs(left.deltaValue))
    .slice(0, 4);
  const added = diff.added.slice().sort((left, right) => right.stackValue - left.stackValue).slice(0, 4);
  const removed = diff.removed.slice().sort((left, right) => right.stackValue - left.stackValue).slice(0, 4);

  if (added.length === 0 && removed.length === 0 && changed.length === 0) {
    return (
      <SnapshotCompareInsight summary={summary} />
    );
  }

  return (
    <>
      <SnapshotCompareInsight summary={summary} />
      <div className="mt-3 grid gap-2 lg:grid-cols-3">
        <SnapshotItemList title="Added" tone="good" items={added.map((item) => ({
          id: item.id,
          name: item.name,
          quantity: item.quantity,
          value: item.stackValue,
          meta: item.quantity > 0 ? `+${item.quantity.toLocaleString()}` : "new item"
        }))} action="search" onSearchItems={onSearchItems} />
        <SnapshotItemList title="Removed" tone="danger" items={removed.map((item) => ({
          id: item.id,
          name: item.name,
          quantity: item.quantity,
          value: -item.stackValue,
          meta: item.quantity > 0 ? `-${item.quantity.toLocaleString()}` : "removed"
        }))} action="wiki" />
        <SnapshotItemList title="Quantity changed" items={changed.map((item) => ({
          id: item.id,
          name: item.name,
          quantity: item.after,
          value: item.deltaValue,
          meta: `${item.delta > 0 ? "+" : ""}${item.delta.toLocaleString()} · ${item.before.toLocaleString()} → ${item.after.toLocaleString()}`
        }))} action="search" onSearchItems={onSearchItems} />
      </div>
    </>
  );
}

function SnapshotCompareInsight({ summary }: { summary: ReturnType<typeof summarizeSnapshotCompare> }) {
  return (
    <div
      className={cn(
        "mt-3 rounded-md border px-3 py-2",
        summary.tone === "good" && "border-[var(--color-good)]/25 bg-[var(--color-good)]/8",
        summary.tone === "danger" && "border-[var(--color-danger)]/25 bg-[var(--color-danger)]/8",
        summary.tone === "neutral" && "border-[var(--color-border)] bg-[var(--color-bg-2)]/30"
      )}
    >
      <div
        className={cn(
          "text-[11.5px] font-semibold",
          summary.tone === "good" && "text-[var(--color-good)]",
          summary.tone === "danger" && "text-[var(--color-danger)]",
          summary.tone === "neutral" && "text-[var(--color-text)]"
        )}
      >
        {summary.headline}
      </div>
      <p className="mt-1 text-[11px] leading-relaxed text-[var(--color-text-muted)]">{summary.detail}</p>
    </div>
  );
}

function SnapshotItemList({
  title,
  items,
  tone,
  action,
  onSearchItems
}: {
  title: string;
  items: Array<{ id: number; name: string; quantity: number; value: number; meta: string }>;
  tone?: "good" | "danger";
  action?: "search" | "wiki";
  onSearchItems?: (query: string, sourceLabel?: string) => void;
}) {
  return (
    <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg-2)]/30 px-3 py-2">
      <div
        className={cn(
          "text-[9.5px] uppercase tracking-[0.16em] font-bold",
          tone === "good" && "text-[var(--color-good)]",
          tone === "danger" && "text-[var(--color-danger)]",
          !tone && "text-[var(--color-text-muted)]"
        )}
      >
        {title}
      </div>
      {items.length > 0 ? (
        <ul className="mt-2 space-y-1.5">
          {items.map((item) => (
            <li key={`${title}:${item.id}`} className="flex items-center gap-2 text-[11.5px]">
              <span className="size-6 rounded border border-[var(--color-border)] bg-[var(--color-bg)] flex items-center justify-center shrink-0">
                <ItemSprite
                  id={spriteIdForItem(item.id, item.quantity)}
                  alt=""
                  className="pixelated"
                  style={{ maxWidth: "82%", maxHeight: "82%" }}
                />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[var(--color-text)]">{item.name}</span>
                <span className="block text-[10px] text-[var(--color-text-muted)]">
                  <span className="font-mono text-[var(--color-text-dim)]">#{item.id}</span>
                  {" · "}
                  {item.meta}
                </span>
              </span>
              {item.value !== 0 && (
                <span
                  className={cn(
                    "font-mono tabular-nums text-[10.5px] shrink-0",
                    item.value > 0 ? "text-[var(--color-good)]" : "text-[var(--color-danger)]"
                  )}
                >
                  {item.value > 0 ? "+" : "-"}{formatGp(Math.abs(item.value))}
                </span>
              )}
              {action === "search" && onSearchItems && (
                <button
                  type="button"
                  onClick={() => onSearchItems(`#${item.id}`, `snapshot ${title.toLowerCase()} item`)}
                  className="inline-flex shrink-0 items-center gap-1 rounded border border-[var(--color-border)] px-1.5 py-0.5 text-[9.5px] font-semibold text-[var(--color-text-muted)] hover:border-[var(--color-accent)]/40 hover:text-[var(--color-accent)]"
                  aria-label={`Show ${item.name} item ID ${item.id} in the current bank`}
                >
                  <Search className="size-2.5" />
                  Show
                </button>
              )}
              {action === "wiki" && (
                <a
                  href={wikiSearchUrl(item.name)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex shrink-0 items-center gap-1 rounded border border-[var(--color-border)] px-1.5 py-0.5 text-[9.5px] font-semibold text-[var(--color-text-muted)] hover:border-[var(--color-accent)]/40 hover:text-[var(--color-accent)]"
                  aria-label={`Open ${item.name} on the OSRS Wiki`}
                >
                  Wiki
                  <ExternalLink className="size-2.5" />
                </a>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-[11px] text-[var(--color-text-muted)]">Nothing here.</p>
      )}
    </div>
  );
}

function SnapshotDelta({ label, value, tone }: { label: string; value: number | string; tone?: "good" | "danger" }) {
  return (
    <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg-2)]/35 px-2.5 py-2">
      <div className="text-[9.5px] uppercase tracking-[0.16em] text-[var(--color-text-muted)]">{label}</div>
      <div
        className={cn(
          "mt-0.5 text-[14px] font-bold tabular-nums",
          tone === "good" && "text-[var(--color-good)]",
          tone === "danger" && "text-[var(--color-danger)]",
          !tone && "text-[var(--color-text)]"
        )}
      >
        {value}
      </div>
    </div>
  );
}

function hasSnapshotDelta(diff: BankDiff): boolean {
  return diff.added.length > 0
    || diff.removed.length > 0
    || diff.changedQuantity.length > 0
    || diff.totalValueBefore !== diff.totalValueAfter;
}

function snapshotDeltaPreview(diff: BankDiff): string {
  const valueDelta = diff.totalValueAfter - diff.totalValueBefore;
  const value = valueDelta === 0
    ? "flat value"
    : `${valueDelta > 0 ? "+" : "-"}${formatGp(Math.abs(valueDelta))}`;
  return `+${diff.added.length} added / -${diff.removed.length} removed / ${diff.changedQuantity.length} qty · ${value}`;
}

function snapshotAge(ts: number): string {
  const diff = Math.max(0, Date.now() - ts);
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "yesterday";
  return `${days}d ago`;
}

function BankActionLoopRail({
  steps,
  onCopy,
  onTips,
  onNext,
  onDps,
  onPlugin,
  copied
}: {
  steps: BankActionLoopStep[];
  onCopy: () => void;
  onTips: () => void;
  onNext: () => void;
  onDps: () => void;
  onPlugin: () => void;
  copied: string | null;
}) {
  const actionFor = (step: BankActionLoopStep) => {
    if (step.id === "export") return onCopy;
    if (step.id === "tips") return onTips;
    if (step.id === "dps") return onDps;
    if (step.id === "sync") return onPlugin;
    return onNext;
  };

  return (
    <details className="group mt-4 mb-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-panel)]/55 p-3 sm:p-4">
      <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3 marker:hidden [&::-webkit-details-marker]:hidden">
        <div>
          <div className="text-[10.5px] font-bold uppercase tracking-[0.18em] text-[var(--color-accent)]">
            After tidy
          </div>
          <h3 className="mt-1 text-[15px] font-bold text-[var(--color-text)]">
            Copy tabs, check one setup, then pick the next trip.
          </h3>
        </div>
        {copied === "all" && (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--color-good)]/30 bg-[var(--color-good)]/10 px-2.5 py-1 text-[11px] font-semibold text-[var(--color-good)]">
            <CheckCircle2 className="size-3.5" />
            Export copied
          </span>
        )}
        <span className="rounded-full border border-[var(--color-border)] px-2.5 py-1 text-[10.5px] font-bold text-[var(--color-text-muted)] group-open:hidden">
          Show
        </span>
      </summary>
      <div className="mt-3 grid gap-2 md:grid-cols-5">
        {steps.map((step) => {
          const isCopiedExport = step.id === "export" && copied === "all";
          return (
            <button
              type="button"
              key={step.id}
              onClick={actionFor(step)}
              title={`${step.cta} · ${step.destination}`}
              aria-label={`${step.cta}: ${step.destination}`}
              data-testid="bank-action-loop-card"
              className={cn(
                "group/bank-action rounded-lg border p-3 text-left transition-all hover:-translate-y-0.5 focus:outline-none focus-visible:border-[var(--color-accent)]/60 focus-visible:shadow-[0_0_0_3px_rgba(134, 166, 217,0.13)]",
                step.state === "attention"
                  ? "border-[var(--color-warning)]/35 bg-[var(--color-warning)]/8 hover:border-[var(--color-warning)]/55"
                  : step.state === "ready"
                    ? "border-[var(--color-accent)]/25 bg-[var(--color-bg)]/35 hover:border-[var(--color-accent)]/50"
                    : "border-[var(--color-border)] bg-[var(--color-bg)]/25 hover:border-[var(--color-accent)]/35"
              )}
            >
              <div className="flex items-start gap-2.5">
                <span
                  className={cn(
                    "inline-flex size-7 shrink-0 items-center justify-center rounded-full border text-[10px] font-black",
                    step.state === "attention"
                      ? "border-[var(--color-warning)]/45 text-[var(--color-warning)]"
                      : step.state === "ready"
                        ? "border-[var(--color-accent)]/40 text-[var(--color-accent)]"
                        : "border-[var(--color-border-strong)] text-[var(--color-text-muted)]"
                  )}
                >
                  {step.label}
                </span>
                <div className="min-w-0">
                  <h4 className="text-[13px] font-bold text-[var(--color-text)]">{step.title}</h4>
                  <p className="mt-1 text-[11.5px] leading-relaxed text-[var(--color-text-muted)]">
                    {step.body}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[10.5px]">
                    <span className="rounded border border-[var(--color-border)] bg-[var(--color-bg)]/45 px-1.5 py-0.5 font-semibold text-[var(--color-text-muted)]">
                      {step.destination}
                    </span>
                    <span className="rounded border border-[var(--color-accent)]/20 bg-[var(--color-accent)]/8 px-1.5 py-0.5 font-semibold text-[var(--color-accent)]">
                      {step.proof}
                    </span>
                  </div>
                </div>
              </div>
              <span
                className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-[var(--color-border-strong)] bg-[var(--color-bg-2)] px-2.5 py-1.5 text-[11.5px] font-semibold text-[var(--color-text)] transition-colors group-hover/bank-action:border-[var(--color-accent)]/50 group-hover/bank-action:text-[var(--color-accent)]"
              >
                {isCopiedExport ? "Copied" : step.cta}
                {isCopiedExport ? <CheckCheck className="size-3.5" /> : <ArrowRight className="size-3.5" />}
              </span>
            </button>
          );
        })}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-[var(--color-border)]/50 pt-3">
        <button
          type="button"
          onClick={onNext}
          className="inline-flex items-center gap-1.5 rounded-md border border-[var(--color-accent)]/35 bg-[var(--color-accent)]/10 px-2.5 py-1.5 text-[11.5px] font-semibold text-[var(--color-accent)] transition-colors hover:bg-[var(--color-accent)]/15"
        >
          Open next trip
          <Sparkles className="size-3.5" />
        </button>
        <button
          type="button"
          onClick={onDps}
          className="inline-flex items-center gap-1.5 rounded-md border border-[var(--color-border)] bg-[var(--color-bg-2)] px-2.5 py-1.5 text-[11.5px] font-semibold text-[var(--color-text)] transition-colors hover:border-[var(--color-accent)]/45 hover:text-[var(--color-accent)]"
        >
          Check kill
          <Sword className="size-3.5" />
        </button>
        <button
          type="button"
          onClick={onPlugin}
          className="inline-flex items-center gap-1.5 rounded-md border border-[var(--color-border)] bg-[var(--color-bg-2)] px-2.5 py-1.5 text-[11.5px] font-semibold text-[var(--color-text)] transition-colors hover:border-[var(--color-accent)]/45 hover:text-[var(--color-accent)]"
        >
          RuneLite sync
          <PlugZap className="size-3.5" />
        </button>
      </div>
    </details>
  );
}

// Compact dropdown that lets the user override which archetype drives the
// use-case tab order + intra-tab sort. Inferred archetype (from Hiscores) is
// the default; switching is local-only — no server round-trip, just a
// re-render of buildUseCaseTabs.
function ArchetypeSelect({
  value, onChange, inferred
}: {
  value: Archetype;
  onChange: (a: Archetype | null) => void;
  inferred: Archetype | null;
}) {
  const isOverridden = inferred && value !== inferred;
  return (
    <div className="flex items-center gap-1">
      <select
        value={value}
        onChange={(e) => {
          const next = e.target.value as Archetype;
          // If user picks the inferred one, clear the override so the inferred
          // value continues to track (e.g. if Hiscores resync changes it).
          onChange(next === inferred ? null : next);
        }}
        className="text-[11px] bg-[var(--color-bg)] border border-[var(--color-border)] rounded px-1.5 py-0.5 cursor-pointer hover:border-[var(--color-text-muted)]"
        title={inferred ? `Inferred from Hiscores: ${inferred}` : "Pick how you want the bank laid out"}
      >
        {ARCHETYPES.map((a) => (
          // <option> can't host an <img>, so this dropdown is text-only —
          // the OSRS sprite for the active archetype is rendered next to
          // the select via the "Layout tuned for …" pill (see line ~782).
          <option key={a.id} value={a.id}>
            {a.label}
          </option>
        ))}
        <option value="unspecified">— Default</option>
      </select>
      {isOverridden && (
        <button
          type="button"
          onClick={() => onChange(null)}
          className="text-[10px] text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] underline decoration-dotted"
          title={`Reset to inferred (${inferred})`}
        >
          reset
        </button>
      )}
    </div>
  );
}

function PreferencesBar({
  prefs, setPrefs, activeArchetype, onArchetypeChange, inferredArchetype
}: {
  prefs: Prefs;
  setPrefs: (p: Prefs) => void;
  activeArchetype: Archetype;
  onArchetypeChange: (a: Archetype | null) => void;
  inferredArchetype: Archetype | null | undefined;
}) {
  // The four analysis toggles (Hide Misc, Find junk, Bank diet, Goals) are
  // power-user filters — they don't need to occupy the bar by default. They
  // collapse behind a "More" button; the button shows a count when any are
  // active so a toggled-on filter is never silently hidden.
  // (Tab-order + pin management live in the Layout popup off the toolbar's
  // Smart-tidy button — not here — so this bar stays focused on view prefs.)
  const [moreOpen, setMoreOpen] = useState(false);
  const activeFilters =
    (prefs.hideMisc ? 1 : 0) + (prefs.showJunk ? 1 : 0) +
    (prefs.showStale ? 1 : 0) + (prefs.showGoals ? 1 : 0);

  return (
    <div className="rounded-lg bg-[var(--color-panel)] border border-[var(--color-border)]">
      {/* Essential row — tabs / playstyle / sort / density, always visible. */}
      <div className="flex flex-wrap items-center gap-3 px-3.5 py-2.5">
        <SlidersHorizontal className="size-3.5 text-[var(--color-text-muted)]" />
        <PrefGroup label="Tabs">
          <SegmentedControl
            value={prefs.tabMode}
            onChange={(v) => setPrefs({ ...prefs, tabMode: v as TabMode })}
            options={[
              { value: "useCase", label: "Activity", icon: Layers },
              { value: "type", label: "Item type", icon: LayoutGrid }
            ]}
          />
        </PrefGroup>

        {prefs.tabMode === "useCase" && (
          <PrefGroup label="Playstyle">
            <ArchetypeSelect
              value={activeArchetype}
              onChange={onArchetypeChange}
              inferred={inferredArchetype ?? null}
            />
          </PrefGroup>
        )}

        <PrefGroup label="Sort">
          <SegmentedControl
            value={prefs.sort}
            onChange={(v) => setPrefs({ ...prefs, sort: v as SortMode })}
            options={[
              { value: "default", label: "Auto", icon: ArrowUpDown },
              { value: "value", label: "Value", icon: TrendingDown },
              { value: "quantity", label: "Qty", icon: Hash }
            ]}
          />
        </PrefGroup>

        <PrefGroup label="Density">
          <SegmentedControl
            value={prefs.density}
            onChange={(v) => setPrefs({ ...prefs, density: v as Density })}
            options={[
              { value: "ultra", label: "Ultra", icon: Grid2x2 },
              { value: "compact", label: "Compact", icon: LayoutGrid },
              { value: "comfortable", label: "Roomy", icon: Rows3 }
            ]}
          />
        </PrefGroup>

        <button
          type="button"
          onClick={() => setMoreOpen((v) => !v)}
          aria-expanded={moreOpen}
          className={cn(
            "ml-auto inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[12px] font-medium border transition-colors",
            moreOpen || activeFilters > 0
              ? "bg-[var(--color-accent)]/12 text-[var(--color-accent)] border-[var(--color-accent)]/35"
              : "bg-transparent text-[var(--color-text-dim)] border-[var(--color-border)] hover:text-[var(--color-text)] hover:border-[var(--color-border-strong)]"
          )}
        >
          <SlidersHorizontal className="size-3.5" />
          More
          {activeFilters > 0 && (
            <span className="inline-flex items-center justify-center min-w-4 h-4 px-1 rounded-full text-[9.5px] font-bold bg-[var(--color-accent)] text-[var(--color-bg)]">
              {activeFilters}
            </span>
          )}
          <ChevronDown className={cn("size-3 transition-transform", moreOpen && "rotate-180")} />
        </button>
      </div>

      {/* Filters row — collapsed by default. Slides open on demand. */}
      {moreOpen && (
        <div className="flex flex-wrap items-center gap-2 px-3.5 pb-2.5 pt-0.5 border-t border-[var(--color-border)] animate-[fade-in_0.15s_ease-out]">
          <span className="text-[10.5px] uppercase tracking-[0.14em] text-[var(--color-text-muted)] font-medium mr-1">
            Filters
          </span>
          <Toggle on={prefs.hideMisc} onChange={(v) => setPrefs({ ...prefs, hideMisc: v })} label="Hide Misc" icon={EyeOff} />
          <Toggle on={prefs.showJunk} onChange={(v) => setPrefs({ ...prefs, showJunk: v })} label="Find junk" icon={Trash2} />
          <Toggle on={prefs.showStale} onChange={(v) => setPrefs({ ...prefs, showStale: v })} label="Bank diet" icon={Hourglass} />
          <Toggle on={prefs.showGoals} onChange={(v) => setPrefs({ ...prefs, showGoals: v })} label="Goals" icon={Target} />
        </div>
      )}
    </div>
  );
}

// Layout popup — a focused modal for the bank's layout preferences: tab order
// and pinned items. Opened from the toolbar's "Layout" button. Grouping both
// here keeps the toolbar uncluttered and gives layout customisation one clear
// home instead of inline panels competing for space above the bank.
function LayoutPopup({
  tabNames, prefs, setPrefs, pinnedNames, onClose
}: {
  tabNames: string[];
  prefs: Prefs;
  setPrefs: (p: Prefs) => void;
  pinnedNames: Array<{ id: number; name: string }>;
  onClose: () => void;
}) {
  // Moving a tab writes a complete order snapshot — visibleTabs already
  // reflects prefs.tabOrder, so tabNames is the current effective order.
  const moveTab = (idx: number, dir: -1 | 1) => {
    const next = tabNames.slice();
    const target = idx + dir;
    if (target < 0 || target >= next.length) return;
    [next[idx], next[target]] = [next[target], next[idx]];
    setPrefs({ ...prefs, tabOrder: next });
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return createPortal(
    <div
      className="fixed inset-0 z-[80] flex items-start sm:items-center justify-center p-3 sm:p-6 bg-black/70 backdrop-blur-sm animate-[fade-in_0.18s_ease-out]"
      role="dialog"
      aria-modal="true"
      aria-label="Bank layout preferences"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-md rounded-xl border border-[var(--color-border-strong)] bg-[var(--color-panel)] shadow-[0_30px_80px_-20px_rgb(0_0_0/0.85)] overflow-hidden animate-[pop-in_0.22s_cubic-bezier(0.22,1,0.36,1)]">
        <header className="flex items-center justify-between px-5 py-3 border-b border-[var(--color-border)]">
          <div className="flex items-center gap-2">
            <GripVertical className="size-4 text-[var(--color-accent)]" />
            <h2 className="text-[14px] font-semibold tracking-normal">Bank layout</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="size-7 rounded-md flex items-center justify-center text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-panel-2)]"
            aria-label="Close"
          >
            <X className="size-3.5" />
          </button>
        </header>

        <div className="px-5 py-4 max-h-[70vh] overflow-y-auto">
          {/* Tab order */}
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] uppercase tracking-[0.14em] text-[var(--color-text-muted)] font-semibold">
              Tab order
            </span>
            {prefs.tabOrder.length > 0 && (
              <button
                type="button"
                onClick={() => setPrefs({ ...prefs, tabOrder: [] })}
                className="text-[11px] text-[var(--color-text-dim)] hover:text-[var(--color-text)] transition-colors"
              >
                Reset to default
              </button>
            )}
          </div>
          <p className="text-[11px] text-[var(--color-text-muted)] leading-snug mb-2.5">
            Nudge tabs up or down — e.g. put Runes first. Sits on top of the playstyle order.
          </p>
          <div className="flex flex-col gap-1">
            {tabNames.map((name, i) => (
              <div
                key={name}
                className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-[var(--color-bg-2)] border border-[var(--color-border)]"
              >
                <span className="text-[10px] font-mono tabular-nums text-[var(--color-text-muted)] w-4 text-right">
                  {i + 1}
                </span>
                <span className="flex-1 text-[12.5px] font-medium text-[var(--color-text)] truncate">
                  {name}
                </span>
                <button
                  type="button"
                  onClick={() => moveTab(i, -1)}
                  disabled={i === 0}
                  aria-label={`Move ${name} up`}
                  className="size-6 rounded flex items-center justify-center text-[var(--color-text-dim)] hover:text-[var(--color-accent)] hover:bg-[var(--color-panel-2)] disabled:opacity-25 disabled:hover:bg-transparent disabled:hover:text-[var(--color-text-dim)] transition-colors"
                >
                  <ChevronDown className="size-3.5 rotate-180" />
                </button>
                <button
                  type="button"
                  onClick={() => moveTab(i, 1)}
                  disabled={i === tabNames.length - 1}
                  aria-label={`Move ${name} down`}
                  className="size-6 rounded flex items-center justify-center text-[var(--color-text-dim)] hover:text-[var(--color-accent)] hover:bg-[var(--color-panel-2)] disabled:opacity-25 disabled:hover:bg-transparent disabled:hover:text-[var(--color-text-dim)] transition-colors"
                >
                  <ChevronDown className="size-3.5" />
                </button>
              </div>
            ))}
          </div>

          {/* Pinned items */}
          <div className="mt-5 pt-4 border-t border-[var(--color-border)]">
            <span className="text-[11px] uppercase tracking-[0.14em] text-[var(--color-text-muted)] font-semibold">
              Pinned items
            </span>
            {pinnedNames.length > 0 ? (
              <>
                <p className="text-[11px] text-[var(--color-text-muted)] leading-snug mt-1.5 mb-2.5">
                  These float to the front of their tab. Right-click any item in the bank to pin or unpin it.
                </p>
                <div className="flex flex-col gap-1">
                  {pinnedNames.map((p) => (
                    <div
                      key={p.id}
                      className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-[var(--color-bg-2)] border border-[var(--color-border)]"
                    >
                      <span className="size-6 shrink-0 rounded bg-[var(--color-bg)] border border-[var(--color-border)] flex items-center justify-center">
                        <ItemSprite
                          id={p.id}
                          alt=""
                          className="pixelated"
                          style={{ maxWidth: "78%", maxHeight: "78%" }}
                        />
                      </span>
                      <span className="flex-1 text-[12.5px] font-medium text-[var(--color-text)] truncate">
                        {p.name}
                      </span>
                      <button
                        type="button"
                        onClick={() => setPrefs({ ...prefs, pinnedItems: prefs.pinnedItems.filter((x) => x !== p.id) })}
                        aria-label={`Unpin ${p.name}`}
                        className="size-6 rounded flex items-center justify-center text-[var(--color-text-dim)] hover:text-[var(--color-danger)] hover:bg-[var(--color-panel-2)] transition-colors"
                      >
                        <X className="size-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <p className="text-[11px] text-[var(--color-text-muted)] leading-snug mt-1.5">
                Nothing pinned yet. Right-click any item in the bank to pin it to the front of its tab.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

function PrefGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[10.5px] uppercase tracking-[0.14em] text-[var(--color-text-muted)] font-medium">
        {label}
      </span>
      {children}
    </div>
  );
}

interface SegOpt {
  value: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

function SegmentedControl({ value, onChange, options }: {
  value: string;
  onChange: (v: string) => void;
  options: SegOpt[];
}) {
  return (
    <div className="inline-flex bg-[var(--color-bg-2)] border border-[var(--color-border)] rounded-md p-0.5">
      {options.map((opt) => (
        <button
          type="button"
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={cn(
            "flex items-center gap-1 px-2 py-1 rounded-sm text-[11px] font-medium transition-colors",
            value === opt.value
              ? "bg-[var(--color-panel-2)] text-[var(--color-text)] shadow-[inset_0_0_0_1px_var(--color-border-strong)]"
              : "text-[var(--color-text-dim)] hover:text-[var(--color-text)]"
          )}
        >
          <opt.icon className="size-3" />
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function Toggle({ on, onChange, label, icon: Icon }: {
  on: boolean;
  onChange: (v: boolean) => void;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!on)}
      className={cn(
        "flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium transition-colors border",
        on
          ? "bg-[var(--color-panel-2)] text-[var(--color-accent)] border-[var(--color-accent)]/30"
          : "bg-transparent text-[var(--color-text-dim)] border-[var(--color-border)] hover:text-[var(--color-text)] hover:border-[var(--color-border-strong)]"
      )}
    >
      <Icon className="size-3" />
      {label}
    </button>
  );
}

function bankSearchQueryForTips(tips: BankTip[]): string {
  const seen = new Set<number>();
  const items: Array<{ id: number; name: string }> = [];
  for (const tip of tips) {
    const refs = tip.itemRefs ?? tip.itemIds.map((id) => ({ id, name: `Item ID ${id}` }));
    for (const item of refs) {
      if (seen.has(item.id)) continue;
      seen.add(item.id);
      items.push(item);
      if (items.length >= 6) return bankSearchQueryForItems(items, 6);
    }
  }
  return bankSearchQueryForItems(items, 6);
}

function TabButton({ tab, num, total, active, hovered, draggingTo, onClick, searchMatches = 0, searching = false }: {
  tab: OrganizedTab;
  num: number;
  total: number;
  active: boolean;
  hovered: boolean;
  draggingTo: boolean;
  onClick: () => void;
  searchMatches?: number;
  searching?: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `tab:${tab.name}` });
  const { active: dndActive } = useDndContext();
  const dragInProgress = dndActive !== null;
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const [tipPos, setTipPos] = useState<{ x: number; y: number } | null>(null);
  const topItems = useMemo(() => {
    return tab.items.slice().sort((a, b) => b.stackValue - a.stackValue).slice(0, 3);
  }, [tab.items]);
  const dimmed = searching && searchMatches === 0 && !active;

  const showTip = () => {
    if (dragInProgress) return;
    const el = btnRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setTipPos({ x: r.left + r.width / 2, y: r.bottom + 6 });
  };
  const hideTip = () => setTipPos(null);

  useEffect(() => {
    if (dragInProgress && tipPos) setTipPos(null);
  }, [dragInProgress, tipPos]);

  const composedBtnRef = (el: HTMLButtonElement | null) => {
    btnRef.current = el;
    setNodeRef(el);
  };

  return (
    <div
      className={cn("relative shrink-0", dimmed && "opacity-40")}
      onMouseEnter={showTip}
      onMouseLeave={hideTip}
    >
      <button
        type="button"
        ref={composedBtnRef}
        onClick={onClick}
        aria-label={`Tab ${num}/${total} — ${tab.name} (${tab.items.length} items)`}
        className={cn(
          "relative flex items-center justify-center transition-all",
          "rounded-t-md border-b-0",
          active && "translate-y-[1px]",
          draggingTo && !active && "ring-1 ring-[var(--color-accent)]/40",
          (hovered || isOver) && "z-20 ring-2 ring-[var(--color-accent)] scale-[1.05]"
        )}
        style={{
          width: "44px",
          height: "36px",
          background: (isOver || active) ? "var(--color-osrs-bank-bg)" : "var(--color-panel)",
          // Three-sided border (no bottom — tab merges into the panel below).
          // Use longhand properties only; mixing `border` shorthand with
          // `borderBottom` triggers a React warning on rerender because the
          // two paths reset each other in DOM order.
          borderTopWidth: "1px",
          borderTopStyle: "solid",
          borderTopColor: (isOver || active) ? "var(--color-border-strong)" : "var(--color-border)",
          borderLeftWidth: "1px",
          borderLeftStyle: "solid",
          borderLeftColor: (isOver || active) ? "var(--color-border-strong)" : "var(--color-border)",
          borderRightWidth: "1px",
          borderRightStyle: "solid",
          borderRightColor: (isOver || active) ? "var(--color-border-strong)" : "var(--color-border)",
          zIndex: active ? 10 : 1
        }}
      >
        <ItemSprite
          id={tab.iconItemId}
          alt=""
          loading="lazy"
          className={cn(
            "pixelated pointer-events-none transition-opacity",
            active ? "opacity-100" : "opacity-65"
          )}
          style={{
            maxWidth: "26px",
            maxHeight: "26px",
            width: "auto",
            height: "auto",
            objectFit: "contain"
          }}
        />
        {active && (
          <span
            className="absolute -top-px inset-x-1 h-[2px] rounded-full"
            style={{ background: "var(--color-accent)" }}
          />
        )}
        {searching && searchMatches > 0 && (
          <span
            className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-1 rounded-full flex items-center justify-center text-[9px] font-bold font-mono tabular-nums bg-[var(--color-accent)] text-[var(--color-bg)] shadow-[0_0_0_2px_var(--color-bg-2)] animate-[pop-in_0.24s_cubic-bezier(0.22,1,0.36,1)]"
          >
            {searchMatches}
          </span>
        )}
      </button>

      {tipPos && createPortal(
        <div
          className="fixed z-[100] pointer-events-none animate-[tooltip-in_0.16s_cubic-bezier(0.22,1,0.36,1)]"
          style={{ left: tipPos.x, top: tipPos.y, transform: "translateX(-50%)" }}
        >
          <div className="rounded-lg border border-[var(--color-border-strong)] bg-[var(--color-panel)] shadow-[0_12px_30px_-10px_rgb(0_0_0/0.7)] px-3 py-2.5 w-[220px]">
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <span className="text-[12px] font-semibold text-[var(--color-text)] truncate">{tab.name}</span>
              <span className="text-[10px] text-[var(--color-text-muted)] tabular-nums shrink-0">
                {tab.items.length} item{tab.items.length === 1 ? "" : "s"}
              </span>
            </div>
            {topItems.length > 0 ? (
              <ul className="space-y-1">
                {topItems.map((it) => (
                  <li key={it.id} className="flex items-center gap-2 text-[11px]">
                    <span className="size-5 rounded bg-[var(--color-bg-2)] border border-[var(--color-border)] flex items-center justify-center shrink-0">
                      <ItemSprite
                        id={spriteIdForItem(it.id, it.quantity)}
                        alt=""
                        className="pixelated"
                        style={{ maxWidth: "85%", maxHeight: "85%" }}
                      />
                    </span>
                    <span className="text-[var(--color-text-dim)] truncate flex-1">{it.name}</span>
                    {it.stackValue > 0 && (
                      <span className="text-[var(--color-accent)] tabular-nums font-mono shrink-0">{formatGp(it.stackValue)}</span>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[11px] text-[var(--color-text-muted)] italic">Empty tab</p>
            )}
            {tab.value > 0 && (
              <div className="mt-2 pt-2 border-t border-[var(--color-border)] flex items-center justify-between text-[10.5px]">
                <span className="text-[var(--color-text-muted)]">Total value</span>
                <span className="font-mono tabular-nums text-[var(--color-accent)] font-semibold">{formatGp(tab.value)} gp</span>
              </div>
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

function PresetChipRow({ tabName, active, onChange }: {
  tabName: string;
  active: Preset | null;
  onChange: (p: Preset | null) => void;
}) {
  const presets = presetsForTab(tabName);
  if (presets.length === 0) return null;
  return (
    <div className="flex items-center gap-2 mb-3 flex-wrap">
      <span className="text-[10.5px] uppercase tracking-[0.14em] font-medium text-[var(--color-text-muted)]">
        Loadout
      </span>
      <button
        type="button"
        onClick={() => onChange(null)}
        className={cn(
          "px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors border whitespace-nowrap",
          active === null
            ? "bg-[var(--color-accent)]/10 text-[var(--color-accent)] border-[var(--color-accent)]/40"
            : "bg-[var(--color-bg-2)] text-[var(--color-text-dim)] border-[var(--color-border)] hover:text-[var(--color-text)]"
        )}
      >
        Default
      </button>
      {presets.map((p) => (
        <button
          type="button"
          key={p.slug}
          onClick={() => onChange(active?.slug === p.slug ? null : p)}
          className={cn(
            "flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors border whitespace-nowrap",
            active?.slug === p.slug
              ? "bg-[var(--color-accent)]/10 text-[var(--color-accent)] border-[var(--color-accent)]/40"
              : "bg-[var(--color-bg-2)] text-[var(--color-text-dim)] border-[var(--color-border)] hover:text-[var(--color-text)] hover:border-[var(--color-border-strong)]"
          )}
          title={`Inventory loadout for ${p.name}`}
        >
          {p.iconItemId ? (
            <ItemSprite
              id={p.iconItemId}
              alt=""
              className="pixelated"
              style={{
                width: "16px",
                height: "16px",
                objectFit: "contain"
              }}
            />
          ) : (
            <span aria-hidden="true" className="size-3 rounded-full bg-[var(--color-text-muted)] inline-block" />
          )}
          {p.name}
        </button>
      ))}
    </div>
  );
}

function SubtabFilterRow({ subtabs, active, onChange, search, onSearchChange, itemCount, searchRef }: {
  subtabs: string[];
  active: string | null;
  onChange: (s: string | null) => void;
  search: string;
  onSearchChange: (v: string) => void;
  itemCount: number;
  searchRef?: React.RefObject<HTMLInputElement | null>;
}) {
  return (
    <div className="flex items-center gap-2 mb-3 flex-wrap">
      <div className="relative flex-1 min-w-[200px] max-w-[320px]">
        <label htmlFor="bank-grid-search" className="sr-only">
          Search bank items across all tabs
        </label>
        <input
          id="bank-grid-search"
          name="bank-search"
          ref={searchRef}
          type="text"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search name, tab or #4151…"
          autoComplete="off"
          spellCheck={false}
          aria-describedby="bank-grid-search-help bank-grid-search-status"
          className={cn(
            "w-full pl-7 pr-16 py-1.5 rounded-md text-[12px]",
            "bg-[var(--color-bg-2)] border border-[var(--color-border)]",
            "text-[var(--color-text)] placeholder:text-[var(--color-text-muted)]",
            "focus:outline-none focus:border-[var(--color-accent)] focus:shadow-[0_0_0_3px_rgba(134, 166, 217,0.12)]"
          )}
        />
        <svg className="absolute left-2 top-1/2 -translate-y-1/2 size-3.5 text-[var(--color-text-muted)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
        {search ? (
          <button
            type="button"
            onClick={() => onSearchChange("")}
            aria-label="Clear bank item search"
            className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--color-text-dim)] hover:text-[var(--color-text)]"
            title="Clear search (Esc)"
          >
            <svg viewBox="0 0 24 24" className="size-3" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6 6 18M6 6l12 12" /></svg>
          </button>
        ) : (
          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9.5px] font-mono font-semibold text-[var(--color-text-muted)] bg-[var(--color-bg)] border border-[var(--color-border)] rounded px-1 py-0.5 pointer-events-none select-none">
            ⌘K
          </span>
        )}
        <p id="bank-grid-search-help" className="sr-only">
          Search by item name, subtab or exact OSRS item ID like #4151. Paste multiple IDs separated by spaces to find fallback tiles.
        </p>
        <p id="bank-grid-search-status" role="status" aria-live="polite" className="sr-only">
          {search ? `Filtering bank items for ${search}.` : `${itemCount} visible bank items available.`}
        </p>
      </div>
      {subtabs.length > 1 && (
        <div className="flex items-center gap-1 flex-wrap">
          <FilterChip active={active === null} onClick={() => onChange(null)} count={itemCount}>
            All
          </FilterChip>
          {subtabs.map((subtab) => (
            <FilterChip key={subtab} active={active === subtab} onClick={() => onChange(active === subtab ? null : subtab)}>
              {subtab}
            </FilterChip>
          ))}
        </div>
      )}
    </div>
  );
}

function FilterChip({ active, onClick, count, children }: {
  active: boolean;
  onClick: () => void;
  count?: number;
  children: React.ReactNode;
}) {
  const label = typeof children === "string" ? children : "bank subtab";
  return (
    <button
      type="button"
      aria-pressed={active}
      aria-label={`Show ${label} bank items${count !== undefined ? ` (${count})` : ""}`}
      onClick={onClick}
      className={cn(
        "px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors border whitespace-nowrap",
        active
          ? "bg-[var(--color-accent)]/10 text-[var(--color-accent)] border-[var(--color-accent)]/40"
          : "bg-[var(--color-bg-2)] text-[var(--color-text-dim)] border-[var(--color-border)] hover:text-[var(--color-text)] hover:border-[var(--color-border-strong)]"
      )}
    >
      {children}
      {count !== undefined && <span className="ml-1 opacity-60">{count}</span>}
    </button>
  );
}

function BankBody({ tab, hasPrices, hasQty, sort, density, activeSubtab, matchesSearch, hovered, draggingTo, preset, junkIds, staleIds, goalMatches }: {
  tab: OrganizedTab | undefined;
  hasPrices: boolean;
  hasQty: boolean;
  sort: SortMode;
  density: Density;
  activeSubtab: string | null;
  matchesSearch: (it: OrganizedItem) => boolean;
  hovered: boolean;
  draggingTo: boolean;
  preset: Preset | null;
  junkIds?: Set<number>;
  staleIds?: Set<number>;
  goalMatches?: Map<number, GoalMatch[]>;
}) {
  const { setNodeRef } = useDroppable({ id: tab ? `body:${tab.name}` : "body:none" });

  if (!tab) {
    return (
      <div className="rounded-lg p-10 text-center text-[var(--color-text-dim)]" ref={setNodeRef}>
        Nothing to show — try toggling Hide Misc.
      </div>
    );
  }

  // Apply filters
  const filtered = tab.items.filter((it) => {
    if (activeSubtab && it.subtab !== activeSubtab) return false;
    if (!matchesSearch(it)) return false;
    return true;
  });

  const filteredValue = filtered.reduce((s, it) => s + it.stackValue, 0);
  const isFiltered = filtered.length !== tab.items.length;
  const compactSparseBankBody = filtered.length > 0 && filtered.length <= 16;

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "rounded-md p-3 transition-all",
        compactSparseBankBody ? "min-h-[220px]" : "min-h-[460px]",
        "bg-[var(--color-bg)]",
        "border border-[var(--color-border)]",
        draggingTo && "border-[var(--color-accent)]/40",
        hovered && "ring-2 ring-[var(--color-accent)] ring-inset border-[var(--color-accent)]"
      )}
    >
      <div className="flex items-center justify-between px-1 pb-2.5">
        <span className="text-[11.5px] font-semibold text-[var(--color-text)] tracking-normal">
          {tab.name}
          {activeSubtab && (
            <span className="text-[var(--color-text-dim)] font-normal ml-2">
              › {activeSubtab}
            </span>
          )}
        </span>
        <span className="text-[11px] font-mono tabular-nums text-[var(--color-text-dim)]">
          {isFiltered ? `${filtered.length} / ${tab.items.length}` : `${tab.items.length}`} items
          {hasPrices && filteredValue > 0 && (
            <span className="ml-2 text-[var(--color-accent)]">{formatGp(filteredValue)} gp</span>
          )}
        </span>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded p-12 text-center text-[var(--color-text-muted)] bg-[var(--color-bg-2)] border border-[var(--color-border)]">
          No items match this filter.
        </div>
      ) : preset ? (
        <PresetGrid items={filtered} preset={preset} hasPrices={hasPrices} hasQty={hasQty} junkIds={junkIds} staleIds={staleIds} goalMatches={goalMatches} />
      ) : sort === "default" && !activeSubtab ? (
        <BankGrid tab={tab} items={filtered} hasPrices={hasPrices} hasQty={hasQty} density={density} junkIds={junkIds} staleIds={staleIds} goalMatches={goalMatches} />
      ) : (
        <BankList items={filtered} sort={sort} hasPrices={hasPrices} hasQty={hasQty} density={density} junkIds={junkIds} staleIds={staleIds} goalMatches={goalMatches} />
      )}

      <p className="mt-4 text-[10.5px] text-center text-[var(--color-text-muted)] tracking-wide">
        Click item for Wiki, GE price and ID · drag to move · right-click to pin
      </p>
    </div>
  );
}

// "Default" view: render items in the layout positions provided by the
// organizer (already grouped by subtab, with row-breaks between subtabs).
function BankGrid({ tab, items, hasPrices, hasQty, density, junkIds, staleIds, goalMatches }: {
  tab: OrganizedTab;
  items: OrganizedItem[];
  hasPrices: boolean;
  hasQty: boolean;
  density: Density;
  junkIds?: Set<number>;
  staleIds?: Set<number>;
  goalMatches?: Map<number, GoalMatch[]>;
}) {
  const GRID_COLS = 8;
  const GRID_ROWS_MIN = density === "compact" ? 6 : 8;
  const allowedIds = new Set(items.map((it) => it.id));
  const itemById = new Map(items.map((it) => [it.id, it]));

  // Filter the layout to only include allowed items, but PRESERVE the slot
  // positions. Bank-filler sentinels (id === BANK_FILLER_ID) are NOT in
  // `tab.items` because they're purely visual — let them pass through so
  // the render layer can swap them for the BankFillerSlot tile.
  const filteredLayout: Record<number, number> = {};
  for (const [slot, id] of Object.entries(tab.layout)) {
    if (allowedIds.has(id) || id === BANK_FILLER_ID) {
      filteredLayout[Number(slot)] = id;
    }
  }
  const slots = Object.keys(filteredLayout).map(Number);
  const maxSlot = slots.length ? Math.max(...slots) : items.length - 1;
  const shouldDensePackSparseLayout =
    items.length > 0 &&
    slots.length > 0 &&
    maxSlot + 1 > Math.max(GRID_ROWS_MIN * GRID_COLS, items.length * 4);
  const renderLayout: Record<number, number> = shouldDensePackSparseLayout
    ? Object.fromEntries(items.map((item, index) => [index, item.id]))
    : filteredLayout;
  const renderSlots = Object.keys(renderLayout).map(Number);
  const renderMaxSlot = renderSlots.length ? Math.max(...renderSlots) : items.length - 1;
  const rowsNeeded = shouldDensePackSparseLayout
    ? Math.max(1, Math.ceil(items.length / GRID_COLS))
    : Math.max(GRID_ROWS_MIN, Math.ceil((renderMaxSlot + 1) / GRID_COLS));
  const totalSlots = rowsNeeded * GRID_COLS;

  return (
    <div
      className={cn(
        "grid rounded-md overflow-hidden",
        "bg-[var(--color-bg)]",
        "border border-[var(--color-border)]"
      )}
      style={{ gridTemplateColumns: "repeat(8, minmax(0, 1fr))" }}
    >
      {Array.from({ length: totalSlots }).map((_, i) => {
        const id = renderLayout[i];
        if (id === undefined) return <EmptySlot key={i} />;
        // Bank filler sentinel — placed by layout builders to mark "this slot
        // belongs to a set / pipeline template but the player doesn't own the
        // piece yet". Renders the OSRS bank-filler sprite, labelled with the
        // missing item's name (e.g. "Dharok's platelegs") when known.
        if (id === BANK_FILLER_ID) {
          return <BankFillerSlot key={i} density={density} label={tab.fillerLabels?.[i]} />;
        }
        const item = itemById.get(id);
        if (!item) return <EmptySlot key={i} />;
        return <ItemSlot key={`${i}:${item.id}`} item={item} hasPrices={hasPrices} hasQty={hasQty} isJunk={!!junkIds?.has(item.id)} isStale={!!staleIds?.has(item.id)} goals={goalMatches?.get(item.id)} density={density} />;
      })}
    </div>
  );
}

// Sorted view: group by subtab still (to keep row structure), but order
// items within each subtab by the chosen sort, and split subtabs on row breaks.
function BankList({ items, sort, hasPrices, hasQty, density, junkIds, staleIds, goalMatches }: {
  items: OrganizedItem[];
  sort: SortMode;
  hasPrices: boolean;
  hasQty: boolean;
  density: Density;
  junkIds?: Set<number>;
  staleIds?: Set<number>;
  goalMatches?: Map<number, GoalMatch[]>;
}) {
  const GRID_COLS = 8;

  const slotted = useMemo(() => {
    // Group by subtab in original encounter order
    const bySubtab = new Map<string, OrganizedItem[]>();
    for (const it of items) {
      if (!bySubtab.has(it.subtab)) bySubtab.set(it.subtab, []);
      bySubtab.get(it.subtab)!.push(it);
    }

    // Sort within each subtab
    for (const list of bySubtab.values()) {
      if (sort === "value") list.sort((a, b) => b.stackValue - a.stackValue);
      else if (sort === "quantity") list.sort((a, b) => b.quantity - a.quantity);
      else if (sort === "name") list.sort((a, b) => a.name.localeCompare(b.name));
      // "default" keeps organizer order
    }

    // Pack into slots — each subtab starts on a new row
    const layout: Array<OrganizedItem | null> = [];
    let slot = 0;
    for (const list of bySubtab.values()) {
      for (const it of list) {
        layout[slot++] = it;
      }
      const rem = slot % GRID_COLS;
      if (rem !== 0) {
        for (let i = 0; i < GRID_COLS - rem; i++) layout[slot++] = null;
      }
    }
    return layout;
  }, [items, sort]);

  return (
    <div
      className={cn(
        "grid rounded-md overflow-hidden",
        "bg-[var(--color-bg)]",
        "border border-[var(--color-border)]"
      )}
      style={{ gridTemplateColumns: "repeat(8, minmax(0, 1fr))" }}
    >
      {slotted.map((item, i) =>
        item
          ? <ItemSlot key={item.id} item={item} hasPrices={hasPrices} hasQty={hasQty} isJunk={!!junkIds?.has(item.id)} isStale={!!staleIds?.has(item.id)} goals={goalMatches?.get(item.id)} density={density} />
          : <EmptySlot key={`e-${i}`} />
      )}
    </div>
  );
}

// Preset view: uses the preset's row patterns to lay items out; unmatched
// items fall through into a "rest" block after a visual gap.
function PresetGrid({ items, preset, hasPrices, hasQty, junkIds, staleIds, goalMatches }: {
  items: OrganizedItem[];
  preset: Preset;
  hasPrices: boolean;
  hasQty: boolean;
  junkIds?: Set<number>;
  staleIds?: Set<number>;
  goalMatches?: Map<number, GoalMatch[]>;
}) {
  const layout = layoutWithPreset(items, preset);
  const itemById = new Map(items.map((it) => [it.id, it]));
  const maxSlot = Math.max(...Object.keys(layout).map(Number), preset.rows.length * 8 - 1);
  const totalSlots = (Math.floor(maxSlot / 8) + 1) * 8;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-[11px] text-[var(--color-text-dim)] italic px-1">
        {preset.iconItemId ? (
          <ItemSprite
            id={preset.iconItemId}
            alt=""
            className="pixelated"
            style={{
              width: "16px",
              height: "16px",
              objectFit: "contain"
            }}
          />
        ) : (
          <span aria-hidden="true" className="size-3 rounded-full bg-[var(--color-text-muted)] inline-block" />
        )}
        <span>
          Each row is one stage of your <span className="text-[var(--color-accent)] not-italic font-semibold">{preset.name}</span> loadout.
          Empty slots mean you don&apos;t have that item — gear up.
        </span>
      </div>
      <div
        className="grid bg-[var(--color-osrs-bank-bg)] border border-[var(--color-osrs-wood-edge)] shadow-[inset_0_1px_0_rgb(0_0_0/0.4),inset_0_-1px_0_rgb(255_255_255/0.04)]"
        style={{ gridTemplateColumns: "repeat(8, minmax(0, 1fr))" }}
      >
        {Array.from({ length: totalSlots }).map((_, i) => {
          const id = layout[i];
          if (id === undefined) return <EmptySlot key={i} />;
          const item = itemById.get(id);
          if (!item) return <EmptySlot key={i} />;
          return <ItemSlot key={`${i}:${item.id}`} item={item} hasPrices={hasPrices} hasQty={hasQty} isJunk={!!junkIds?.has(item.id)} isStale={!!staleIds?.has(item.id)} goals={goalMatches?.get(item.id)} />;
        })}
      </div>
    </div>
  );
}

function EmptySlot() {
  return <div className="bg-[var(--color-bg)] border-r border-b border-[var(--color-border)]/40" style={{ aspectRatio: "1 / 1" }} />;
}

// Sentinel item id used by layout builders to mark "this slot belongs to a
// set/family template but the player doesn't own the piece yet". Matches the
// OSRS in-game Bank filler item so the sprite reads naturally as a "reserved
// slot" cue. The constant itself lives in @/lib/bank-filler so both
// layout-side (use-case-tabs.ts) and render-side (this file) can import it
// without a circular dependency through a client component.

// Bank-filler tile. Renders the canonical OSRS "Bank filler" sprite (item id
// 20594) at the same size as a real ItemSlot so the column stays visually
// whole. We deliberately render the sprite at full opacity so it reads as
// the actual in-game bank filler — exactly what the player would see if they
// placed one themselves in RuneLite. A subtle background tint keeps it from
// being mistaken for an owned item.
function BankFillerSlot({ density, label }: { density: Density; label?: string }) {
  // When the layout builder knows what piece *should* sit here (a missing
  // Dharok's platelegs, a missing Prayer potion(3)), `label` carries its
  // name. We show it as a hover tooltip and — except in the tightest density
  // — a small caption so the gap reads as "still to get: X" at a glance.
  const showCaption = !!label && density !== "ultra";
  return (
    <div
      className={cn(
        "bg-[var(--color-bg)] border-r border-b border-[var(--color-border)]/40",
        "relative flex items-center justify-center group/filler"
      )}
      style={{ aspectRatio: "1 / 1" }}
      title={label ? `Missing: ${label}` : "Bank filler — slot reserved for a missing set piece"}
    >
      <ItemSprite
        id={BANK_FILLER_ID}
        alt={label ? `Missing: ${label}` : "Bank filler"}
        className="pixelated"
        style={{
          maxWidth: density === "ultra" ? "70%" : "80%",
          maxHeight: density === "ultra" ? "70%" : "80%",
          opacity: 0.55
        }}
      />
      {showCaption && (
        <span
          className="absolute inset-x-0 bottom-0 px-0.5 pb-0.5 text-center leading-[1.05] text-[var(--color-text-muted)] pointer-events-none truncate"
          style={{ fontSize: "7.5px" }}
        >
          {label}
        </span>
      )}
    </div>
  );
}

function ItemSlot({ item, hasPrices, hasQty, isJunk = false, isStale = false, goals, density = "comfortable" }: { item: OrganizedItem; hasPrices: boolean; hasQty: boolean; isJunk?: boolean; isStale?: boolean; goals?: GoalMatch[]; density?: Density }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: item.id });
  // Each slot is ALSO a drop target. Dropping one item onto another in the
  // same tab reorders them (handled in onDragEnd). The droppable id is
  // namespaced `item:<id>` so the drag handler can tell an item-drop from a
  // tab-drop (`tab:`/`body:`).
  const { setNodeRef: setDropRef, isOver: isDropTarget } = useDroppable({ id: `item:${item.id}` });
  const { active } = useDndContext();
  const dragInProgress = active !== null;
  const slotRef = useRef<HTMLDivElement | null>(null);
  const clickStartRef = useRef<{ x: number; y: number } | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  // For "above" we anchor by bottom-of-viewport so the tooltip doesn't need
  // its own height to position correctly — that avoids the brief flash where
  // it paints at the wrong place before the height is known.
  const [tooltipPos, setTooltipPos] = useState<
    | { x: number; anchor: "above"; bottom: number }
    | { x: number; anchor: "below"; top: number }
    | null
  >(null);
  const hasGoal = !!goals && goals.length > 0;
  const isUnknownFallbackTile = /^unknown item #?\d+$/i.test(item.name) || /^item id #?\d+$/i.test(item.name);
  // Defensive guard: stale snapshots can carry corrupt empty names. Real
  // unknown OSRS IDs stay visible as labelled fallback tiles instead.
  if (!item.name || (/^item \d+$/i.test(item.name) && !isUnknownFallbackTile)) {
    return <EmptySlot />;
  }

  const showTooltip = () => {
    if (dragInProgress) return;     // suppress during drag
    const el = slotRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const TOOLTIP_H_EST = 200;
    const enoughRoomAbove = r.top > TOOLTIP_H_EST + 16;
    const x = r.left + r.width / 2;
    if (enoughRoomAbove) {
      // Anchor by bottom: tooltip's bottom edge sits 6px above the slot top.
      // No reliance on tooltip's own height → no flicker on first paint.
      setTooltipPos({ x, anchor: "above", bottom: window.innerHeight - r.top + 6 });
    } else {
      setTooltipPos({ x, anchor: "below", top: r.bottom + 6 });
    }
  };

  // If a drag starts while a tooltip is open, hide the tooltip.
  useEffect(() => {
    if (dragInProgress && tooltipPos) setTooltipPos(null);
  }, [dragInProgress, tooltipPos]);
  const hideTooltip = () => setTooltipPos(null);

  // Compose three refs onto one node: draggable, droppable, and our own ref
  // for tooltip rect-reading.
  const composedRef = (el: HTMLDivElement | null) => {
    slotRef.current = el;
    setNodeRef(el);
    setDropRef(el);
  };

  // Pin state from context. Right-clicking a slot pins/unpins the item to the
  // front of its tab — a lightweight per-item ordering preference that needs
  // no separate panel and survives reloads (persisted via prefs).
  const pinCtx = useContext(PinContext);
  const pinned = pinCtx?.isPinned(item.id) ?? false;

  // Drop-success flash. When the user just dropped this item, we play a
  // ~480ms route pulse so they see exactly where it landed. The token in
  // the context forces a remount when the same id is dropped twice in
  // a row.
  const flashCtx = useContext(DropFlashContext);
  const isFlashing = flashCtx.flashedId === item.id;

  // Dose / charge count, parsed from a trailing "(N)" in the item name —
  // e.g. "Saradomin brew(4)" → 4, "Ring of dueling(8)" → 8. Shown as a small
  // always-visible badge so the player can read potion doses at a glance
  // without hovering. Only single-digit doses (1-8) are treated as charges;
  // a bare "(unf)" or other suffix yields no number.
  const doseMatch = item.name.match(/\((\d)\)\s*$/);
  const dose = doseMatch ? doseMatch[1] : null;
  const stopWikiDrag = (event: React.MouseEvent | React.PointerEvent) => {
    event.preventDefault();
    event.stopPropagation();
  };
  const openWiki = (event: React.MouseEvent) => {
    stopWikiDrag(event);
    window.open(wikiSearchUrl(item.name), "_blank", "noopener,noreferrer");
  };
  const openDetailButton = (event: React.MouseEvent) => {
    stopWikiDrag(event);
    hideTooltip();
    setDetailOpen(true);
  };
  const openDetail = (event: React.MouseEvent) => {
    const target = event.target as HTMLElement;
    if (target !== event.currentTarget && target.closest("button,a")) return;
    if (dragInProgress) return;
    const start = clickStartRef.current;
    if (start && Math.hypot(event.clientX - start.x, event.clientY - start.y) > 6) return;
    hideTooltip();
    setDetailOpen(true);
  };
  const tileDragAttributes = {
    ...attributes,
    role: undefined,
    tabIndex: undefined
  };

  return (
    <div
      ref={composedRef}
      key={isFlashing ? `flash-${flashCtx.token}` : undefined}
      onPointerDownCapture={(event) => {
        clickStartRef.current = { x: event.clientX, y: event.clientY };
      }}
      onMouseEnter={showTooltip}
      onMouseLeave={hideTooltip}
      className="group relative touch-none"
      style={{
        aspectRatio: "1 / 1",
        // Drop-success: short route pulse that fades. Played by the slot
        // the item *landed in* so the player can see where they put it.
        ...(isFlashing ? { animation: "drop-flash 0.48s ease-out" } : {})
      }}
    >
      <button
        type="button"
        onClick={openDetail}
        onContextMenu={(e) => {
          if (!pinCtx) return;
          e.preventDefault();
          pinCtx.togglePin(item.id);
        }}
        {...tileDragAttributes}
        {...listeners}
        aria-label={`Open ${item.name} details. OSRS item #${item.id}`}
        title={`${item.name} · OSRS item #${item.id}`}
        className={cn(
          "relative h-full w-full cursor-grab active:cursor-grabbing",
          "bg-[var(--color-osrs-slot)] border-r border-b border-[var(--color-border)]/40",
          "flex items-center justify-center select-none",
          "hover:bg-[var(--color-panel-2)] hover:outline hover:outline-2 hover:outline-[var(--color-accent)] hover:outline-offset-[-2px] hover:z-10 hover:shadow-[0_0_18px_-4px_rgba(134, 166, 217,0.4)]",
          "transition-[background-color,outline-color,box-shadow,transform] duration-150",
          "[&:hover>img]:scale-[1.07]",
          isDragging && "opacity-25",
          // Drop-target hint: another item is hovering over this slot — show a
          // bright inset ring so the player sees where it'll land.
          isDropTarget && !isDragging && "outline outline-2 outline-dashed outline-[var(--color-accent)] outline-offset-[-2px] bg-[var(--color-accent)]/15 z-20",
          hasGoal && !isJunk && !isStale && !isDropTarget && "outline outline-2 outline-[var(--color-accent)]/60 outline-offset-[-2px] bg-[var(--color-accent)]/8",
          isJunk && !isDropTarget && "outline outline-2 outline-[var(--color-danger)]/70 outline-offset-[-2px] bg-[var(--color-danger)]/8 [&>img]:opacity-60",
          isStale && !isJunk && !isDropTarget && "outline outline-2 outline-[var(--color-warning)]/60 outline-offset-[-2px] bg-[var(--color-warning)]/8 [&>img]:opacity-65",
          pinned && !isJunk && !isStale && !isDropTarget && "outline outline-2 outline-[var(--color-accent)] outline-offset-[-2px]"
        )}
      >
      {/* Pin indicator — top-left, shown when the item is pinned to front.
          Right-click toggles it (see onContextMenu above). */}
      {pinned && (
        <span
          className="absolute -top-1 -left-1 size-4 rounded-full bg-[var(--color-accent)] text-[var(--color-bg)] flex items-center justify-center pointer-events-none shadow-[0_0_0_2px_var(--color-bg)] z-10"
          title="Pinned to front — right-click to unpin"
        >
          <Pin className="size-2.5" strokeWidth={3} />
        </span>
      )}
      {/* Item sprite at its native size — never upscaled. OSRS sprites are
          designed for the in-game bank slot and look wrong when stretched. */}
      <ItemSprite
        id={spriteIdForItem(item.id, item.quantity)}
        alt={item.name}
        loading="lazy"
        className="pixelated pointer-events-none transition-transform duration-150"
        style={{
          maxWidth: "85%",
          maxHeight: "85%",
          width: "auto",
          height: "auto"
        }}
      />
      {hasQty && item.quantity > 0 && (
        <span
          className={cn(
            // On mobile the bank-grid runs at 4 columns (~72px slots) so
            // qty text at 10px can clip on values like '10.0M'. Drop to
            // 8px on the smallest viewport, snap back to 10px on sm+
            // (audit finding #9). Font-size lives in className now so
            // breakpoints apply; the rest of the inline style stays.
            "absolute top-0.5 left-1 font-bold drop-shadow-[1px_1px_0_rgb(0_0_0/1)] pointer-events-none tracking-normal text-[8px] sm:text-[10px]",
            density === "ultra" && "opacity-0 group-hover:opacity-100 transition-opacity"
          )}
          style={{
            color: qtyColor(item.quantity),
            fontFamily: "var(--font-rs-small), 'Trebuchet MS', sans-serif",
            letterSpacing: "-0.02em"
          }}
        >
          {formatQty(item.quantity)}
        </span>
      )}
      {hasPrices && item.stackValue >= 100_000 && (
        <span
          className="absolute bottom-0.5 right-1 text-[9px] font-semibold pointer-events-none font-mono"
          style={{
            color: "var(--color-accent)",
            textShadow: "1px 1px 0 rgb(0 0 0)"
          }}
        >
          {formatGp(item.stackValue)}
        </span>
      )}
      {/* Dose / charge badge — bottom-left, always visible. Lets the player
          read potion doses ((1)–(4)) and charged-jewellery counts without
          hovering. Bottom-left is the one free corner (qty=top-left,
          gp=bottom-right, junk/stale=top-right). */}
      {dose && (
        <span
          className="absolute bottom-0.5 left-1 text-[9px] font-bold pointer-events-none tabular-nums"
          style={{
            color: "var(--color-osrs-qty-yellow, #ffeb3b)",
            fontFamily: "var(--font-rs-small), 'Trebuchet MS', sans-serif",
            textShadow: "1px 1px 0 rgb(0 0 0)"
          }}
          title={`${dose} dose${dose === "1" ? "" : "s"}`}
        >
          ({dose})
        </span>
      )}
      {isJunk && (
        <span
          className="absolute -top-1 -right-1 size-4 rounded-full bg-[var(--color-danger)] text-white flex items-center justify-center pointer-events-none shadow-[0_0_0_2px_var(--color-bg)]"
          title="Safe to drop"
        >
          <Trash2 className="size-2.5" />
        </span>
      )}
      {!isJunk && isStale && (
        <span
          className="absolute -top-1 -right-1 size-4 rounded-full bg-[var(--color-warning)] text-[var(--color-bg)] flex items-center justify-center pointer-events-none shadow-[0_0_0_2px_var(--color-bg)]"
          title="Untouched 30+ days"
        >
          <Hourglass className="size-2.5" />
        </span>
      )}
      {!isJunk && !isStale && hasGoal && (
        <span
          className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-[var(--color-accent)] text-[var(--color-bg)] flex items-center justify-center text-[9px] font-bold font-mono tabular-nums pointer-events-none shadow-[0_0_0_2px_var(--color-bg)]"
          title={`Contributes to ${goals!.length} goal${goals!.length === 1 ? "" : "s"}`}
        >
          <Target className="size-2.5" />
        </span>
      )}
      {isUnknownFallbackTile && !isJunk && !isStale && !hasGoal && (
        <span
          className="absolute -top-1 -right-1 min-w-[18px] h-4 px-1 rounded-full bg-[var(--color-warning)] text-[var(--color-bg)] flex items-center justify-center gap-0.5 text-[8px] font-black uppercase tracking-normal pointer-events-none shadow-[0_0_0_2px_var(--color-bg)]"
          title={`Unknown OSRS item ID #${item.id} kept as a fallback tile`}
          data-testid="unknown-item-id-badge"
        >
          <Hash className="size-2" />
          ID
        </span>
      )}
      </button>
      <button
        type="button"
        onPointerDown={stopWikiDrag}
        onMouseDown={stopWikiDrag}
        onClick={openDetailButton}
        className={cn(
          "absolute right-0 top-0 z-20 flex size-3 opacity-75 group-hover:opacity-100 group-focus-within:opacity-100",
          "items-center justify-center overflow-hidden rounded-sm border border-[var(--color-border)]",
          "bg-[rgba(7,9,12,0.86)] p-0 text-[0px] font-semibold",
          "text-[var(--color-text-dim)] shadow-[0_8px_18px_-10px_rgb(0_0_0/0.9)]",
          "hover:border-[var(--color-accent)]/45 hover:text-[var(--color-accent)]"
        )}
        title={`Open item ID details for ${item.name}`}
        aria-label={`Open item ID details for ${item.name}`}
      >
        <Hash className="size-2" />
        <span className="sr-only">ID</span>
      </button>
      <button
        type="button"
        onPointerDown={stopWikiDrag}
        onMouseDown={stopWikiDrag}
        onClick={openWiki}
        className={cn(
          "absolute right-0 bottom-0 z-20 flex size-3 sm:hidden sm:group-hover:flex sm:group-focus-within:flex",
          "items-center justify-center overflow-hidden rounded-sm border border-[var(--color-accent)]/35",
          "bg-[rgba(7,9,12,0.86)] p-0 text-[0px] font-semibold",
          "text-[var(--color-accent)] shadow-[0_8px_18px_-10px_rgb(0_0_0/0.9)]",
          "hover:bg-[var(--color-accent)]/15"
        )}
        title={`Open ${item.name} on the OSRS Wiki`}
        aria-label={`Open ${item.name} on the OSRS Wiki`}
      >
        <span className="sr-only">Wiki</span>
        <ExternalLink className="size-2" />
      </button>
      {tooltipPos && createPortal(
        <div
          className="fixed z-[100] pointer-events-none animate-[tooltip-in_0.16s_cubic-bezier(0.22,1,0.36,1)]"
          style={
            tooltipPos.anchor === "above"
              ? { left: tooltipPos.x, bottom: tooltipPos.bottom, transform: "translateX(-50%)" }
              : { left: tooltipPos.x, top: tooltipPos.top, transform: "translateX(-50%)" }
          }
        >
          <div
            className={cn(
              "bg-[var(--color-panel)] border border-[var(--color-border-strong)]",
              "px-3 py-2.5 rounded-lg text-[11.5px] whitespace-nowrap",
              "shadow-[0_14px_30px_-10px_rgb(0_0_0/0.7)]",
              "min-w-[220px]"
            )}
          >
            <div className="text-[var(--color-text)] font-semibold leading-tight flex items-baseline gap-1.5">
              <span>{item.name}</span>
              {hasQty && item.quantity > 0 && (
                <span className="text-[var(--color-text-dim)] font-mono tabular-nums">×{item.quantity.toLocaleString()}</span>
              )}
            </div>
            <div className="text-[10px] text-[var(--color-text-muted)] mt-1 flex items-center gap-1.5">
              <span>{item.subtab}</span>
              {item.slot && (
                <>
                  <span className="opacity-50">·</span>
                  <span className="capitalize">{item.slot}</span>
                </>
              )}
              <span className="opacity-50">·</span>
              <span className="font-mono">#{item.id}</span>
              {isUnknownFallbackTile && (
                <>
                  <span className="opacity-50">·</span>
                  <span className="text-[var(--color-warning)]">unknown ID fallback</span>
                </>
              )}
            </div>
            {(hasPrices && (item.stackValue > 0 || item.unitPrice > 0)) || (item.highalch ?? 0) > 0 || (item.geLimit ?? 0) > 0 ? (
              <div className="mt-2 pt-2 border-t border-[var(--color-border)] grid grid-cols-2 gap-x-3 gap-y-0.5 font-mono text-[10.5px] tabular-nums">
                {item.unitPrice > 0 && (
                  <>
                    <span className="text-[var(--color-text-muted)]">Unit (GE)</span>
                    <span className="text-[var(--color-text)] text-right">{formatGp(item.unitPrice)} gp</span>
                  </>
                )}
                {item.stackValue > 0 && hasQty && item.quantity > 1 && (
                  <>
                    <span className="text-[var(--color-text-muted)]">Stack value</span>
                    <span className="text-[var(--color-accent)] text-right font-semibold">{formatGp(item.stackValue)} gp</span>
                  </>
                )}
                {(item.highalch ?? 0) > 0 && (
                  <>
                    <span className="text-[var(--color-text-muted)]">High alch</span>
                    <span className="text-[var(--color-text-dim)] text-right">{formatGp(item.highalch!)} gp</span>
                  </>
                )}
                {(item.geLimit ?? 0) > 0 && (
                  <>
                    <span className="text-[var(--color-text-muted)]">4-hr limit</span>
                    <span className="text-[var(--color-text-dim)] text-right">{item.geLimit!.toLocaleString()}</span>
                  </>
                )}
              </div>
            ) : null}
            {hasGoal && (
              <div className="mt-2 pt-2 border-t border-[var(--color-border)] text-[10px] text-[var(--color-accent)]">
                <div className="flex items-center gap-1 mb-0.5">
                  <Target className="size-2.5" />
                  <span className="font-semibold uppercase tracking-wider text-[9.5px]">Goal item</span>
                </div>
                {goals!.slice(0, 2).map((g) => (
                  <div key={g.goalId} className="text-[var(--color-text-dim)] leading-tight">
                    · {g.setName}
                  </div>
                ))}
                {goals!.length > 2 && (
                  <div className="text-[var(--color-text-muted)] italic mt-0.5">+ {goals!.length - 2} more</div>
                )}
              </div>
            )}
            <div className="mt-2 pt-2 border-t border-[var(--color-border)] text-[9.5px] text-[var(--color-text-muted)] italic">
              Drag to move · right-click to pin · hover Wiki for guide
            </div>
          </div>
        </div>,
        document.body
      )}
      {detailOpen && (
        <ItemDetailDialog
          item={item}
          hasPrices={hasPrices}
          hasQty={hasQty}
          isJunk={isJunk}
          isStale={isStale}
          goals={goals}
          pinned={pinned}
          onTogglePin={pinCtx ? () => pinCtx.togglePin(item.id) : undefined}
          onClose={() => setDetailOpen(false)}
        />
      )}
    </div>
  );
}

function ItemDetailDialog({
  item,
  hasPrices,
  hasQty,
  isJunk,
  isStale,
  goals,
  pinned,
  onTogglePin,
  onClose
}: {
  item: OrganizedItem;
  hasPrices: boolean;
  hasQty: boolean;
  isJunk: boolean;
  isStale: boolean;
  goals?: GoalMatch[];
  pinned: boolean;
  onTogglePin?: () => void;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState<"id" | "name" | "debug" | "error" | null>(null);
  const [manualItemCopy, setManualItemCopy] = useState<{ label: string; value: string } | null>(null);
  const identity = buildItemIdentity({
    id: item.id,
    name: item.name,
    quantity: item.quantity
  });
  const wikiHref = identity.wikiUrl;
  const priceHref = identity.priceUrl;
  const verdict = buildItemVerdict({
    name: item.name,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    stackValue: item.stackValue,
    highalch: item.highalch,
    geLimit: item.geLimit,
    isJunk,
    isStale,
    goalCount: goals?.length ?? 0
  });
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  const debugPacket = [
    `Scapestack item debug`,
    `Name: ${item.name}`,
    `Item ID: ${item.id}`,
    `Search: #${item.id}`,
    `Quantity: ${item.quantity.toLocaleString()}`,
    `Subtab: ${item.subtab}`,
    item.slot ? `Slot: ${item.slot}` : null,
    item.unitPrice > 0 ? `GE unit: ${formatGp(item.unitPrice)} gp` : null,
    item.stackValue > 0 ? `Stack value: ${formatGp(item.stackValue)} gp` : null,
    `Wiki: ${wikiHref}`,
    `GE: ${priceHref}`
  ].filter(Boolean).join("\n");
  const copyValue = async (kind: "id" | "name" | "debug", value: string) => {
    const result = await copyText(value);
    if (result !== "failed") {
      setManualItemCopy(null);
      setCopied(kind);
      setTimeout(() => setCopied((current) => current === kind ? null : current), 1200);
    } else {
      setManualItemCopy({
        label: kind === "id" ? "item ID" : kind === "name" ? "item name" : "item debug packet",
        value
      });
      setCopied("error");
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[210] flex items-end sm:items-center justify-center p-3 sm:p-5"
      role="dialog"
      aria-modal="true"
      aria-label={`${item.name} details`}
    >
      <button
        type="button"
        aria-label="Close item details"
        className="absolute inset-0 bg-[rgba(7,9,12,0.72)] backdrop-blur-sm"
        onClick={onClose}
      />
      <section
        className="relative w-full max-w-lg rounded-xl border border-[var(--color-border-strong)] bg-[var(--color-panel)] shadow-[0_28px_90px_-24px_rgb(0_0_0/0.85)] overflow-hidden animate-[pop-in_0.2s_cubic-bezier(0.22,1,0.36,1)]"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="flex items-start gap-3 p-4 border-b border-[var(--color-border)] bg-[var(--color-bg-2)]/35">
          <div className="size-14 rounded-lg border border-[var(--color-border)] bg-[var(--color-osrs-slot)] flex items-center justify-center shrink-0">
            <ItemSprite
              id={identity.spriteId}
              alt=""
              size={42}
              fallbackId={995}
              loading="eager"
            />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-[16px] font-bold text-[var(--color-text)] leading-tight truncate">{item.name}</h3>
            <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-[var(--color-text-muted)]">
              <span className="font-mono">{identity.badge}</span>
              <span>·</span>
              <span>{item.subtab}</span>
              {item.slot && (
                <>
                  <span>·</span>
                  <span className="capitalize">{item.slot}</span>
                </>
              )}
              {pinned && <span className="rounded-full bg-[var(--color-accent)]/12 text-[var(--color-accent)] px-1.5 py-0.5">Pinned</span>}
              {isJunk && <span className="rounded-full bg-[var(--color-danger)]/12 text-[var(--color-danger)] px-1.5 py-0.5">Junk</span>}
              {!isJunk && isStale && <span className="rounded-full bg-[var(--color-warning)]/12 text-[var(--color-warning)] px-1.5 py-0.5">Stale</span>}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="size-8 rounded-md flex items-center justify-center text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-bg)]"
            aria-label="Close item details"
          >
            <X className="size-4" />
          </button>
        </header>

        <div className="p-4 space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {hasQty && (
              <ItemStat label="Quantity" value={item.quantity.toLocaleString()} />
            )}
            {hasPrices && item.unitPrice > 0 && (
              <ItemStat label="GE unit" value={`${formatGp(item.unitPrice)} gp`} accent />
            )}
            {hasPrices && item.stackValue > 0 && (
              <ItemStat label="Stack" value={`${formatGp(item.stackValue)} gp`} accent />
            )}
            {(item.highalch ?? 0) > 0 && (
              <ItemStat label="High alch" value={`${formatGp(item.highalch!)} gp`} />
            )}
            {(item.geLimit ?? 0) > 0 && (
              <ItemStat label="4h limit" value={item.geLimit!.toLocaleString()} />
            )}
          </div>

          <ItemVerdictPanel verdict={verdict} />

          <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-2)]/35 px-3 py-2.5">
            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.16em] font-bold text-[var(--color-accent)]">
              <Hash className="size-3" />
              Item identity
            </div>
            <div className="mt-2 grid gap-1.5 sm:grid-cols-3">
              {identity.facts.map((fact) => (
                <div key={fact} className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg)]/45 px-2 py-1.5 font-mono text-[10.5px] leading-relaxed text-[var(--color-text-dim)]">
                  {fact}
                </div>
              ))}
            </div>
          </div>

          {goals && goals.length > 0 && (
            <div className="rounded-lg border border-[var(--color-accent)]/25 bg-[var(--color-accent)]/8 px-3 py-2.5">
              <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.16em] font-bold text-[var(--color-accent)]">
                <Target className="size-3" />
                Goal item
              </div>
              <ul className="mt-1.5 space-y-1">
                {goals.slice(0, 4).map((goal) => (
                  <li key={goal.goalId} className="text-[12px] text-[var(--color-text-dim)]">
                    · {goal.setName}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <a
              href={wikiHref}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-primary"
            >
              Open OSRS Wiki
              <ExternalLink className="size-3.5" />
            </a>
            <a
              href={priceHref}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-ghost"
            >
              GE price page
              <ExternalLink className="size-3.5" />
            </a>
            <button
              type="button"
              onClick={() => copyValue("id", String(item.id))}
              className="btn-ghost"
            >
              <Copy className="size-3.5" />
              {copied === "id" ? "Copied ID" : "Copy item ID"}
            </button>
            <button
              type="button"
              onClick={() => copyValue("debug", debugPacket)}
              className="btn-ghost"
              aria-label={`Copy ${item.name} item debug packet with ID, Wiki, GE and bank search`}
            >
              <Copy className="size-3.5" />
              {copied === "debug" ? "Copied packet" : "Copy debug packet"}
            </button>
            {onTogglePin && (
              <button
                type="button"
                onClick={onTogglePin}
                className="btn-ghost"
              >
                <Pin className="size-3.5" />
                {pinned ? "Unpin item" : "Pin item"}
              </button>
            )}
            <button
              type="button"
              onClick={() => copyValue("name", item.name)}
              className="btn-ghost"
            >
              <Copy className="size-3.5" />
              {copied === "name" ? "Copied name" : "Copy name"}
            </button>
          </div>
          {copied === "error" && manualItemCopy && (
            <div className="rounded-lg border border-[var(--color-danger)]/25 bg-[var(--color-danger)]/8 p-2" aria-live="polite">
              <label className="mb-1 block text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--color-danger)]">
                Clipboard failed — copy {manualItemCopy.label} manually
              </label>
              <textarea
                readOnly
                value={manualItemCopy.value}
                onFocus={(event) => event.currentTarget.select()}
                className="min-h-[54px] w-full resize-y rounded border border-[var(--color-border)] bg-[var(--color-bg)] p-2 font-mono text-[11px] leading-relaxed text-[var(--color-text)]"
                aria-label={`Manual copy fallback for ${item.name} ${manualItemCopy.label}`}
              />
            </div>
          )}
        </div>
      </section>
    </div>,
    document.body
  );
}

function ItemVerdictPanel({ verdict }: { verdict: ReturnType<typeof buildItemVerdict> }) {
  const toneClass: Record<ItemVerdictTone, string> = {
    keep: "border-[var(--color-good)]/25 bg-[var(--color-good)]/8 text-[var(--color-good)]",
    review: "border-[var(--color-warning)]/25 bg-[var(--color-warning)]/8 text-[var(--color-warning)]",
    sell: "border-[var(--color-danger)]/25 bg-[var(--color-danger)]/8 text-[var(--color-danger)]",
    info: "border-[var(--color-accent)]/25 bg-[var(--color-accent)]/8 text-[var(--color-accent)]"
  };

  return (
    <div className={cn("rounded-lg border px-3 py-2.5", toneClass[verdict.tone])}>
      <div className="text-[10px] uppercase tracking-[0.16em] font-bold">
        Scapestack verdict
      </div>
      <div className="mt-1 text-[13px] font-semibold text-[var(--color-text)]">
        {verdict.title}
      </div>
      <p className="mt-1 text-[12px] leading-relaxed text-[var(--color-text-dim)]">
        {verdict.body}
      </p>
      <ul className="mt-2 space-y-1">
        {verdict.bullets.map((bullet) => (
          <li key={bullet} className="flex gap-2 text-[11.5px] leading-relaxed text-[var(--color-text-dim)]">
            <span className="mt-[0.45em] size-1 shrink-0 rounded-full bg-current" />
            <span>{bullet}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ItemStat({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-2)]/35 px-2.5 py-2">
      <div className="text-[9.5px] uppercase tracking-[0.14em] text-[var(--color-text-muted)]">{label}</div>
      <div className={cn("mt-0.5 text-[12px] font-semibold tabular-nums", accent ? "text-[var(--color-accent)]" : "text-[var(--color-text)]")}>
        {value}
      </div>
    </div>
  );
}

// ── helpers ───────────────────────────────────────────────────────────────

function tabWithItems(t: OrganizedTab, items: OrganizedItem[]): OrganizedTab {
  // Dense packing — vanilla OSRS Bank Tags can't import a tab with empty slots
  // in between items, so when the user drags items around we rebuild the
  // layout as a continuous stream.
  const layout: Record<number, number> = {};
  for (let i = 0; i < items.length; i++) layout[i] = items[i].id;
  return {
    ...t,
    items,
    layout,
    quantity: items.reduce((s, x) => s + x.quantity, 0),
    value: items.reduce((s, x) => s + x.stackValue, 0)
  };
}

// Premium junk-tile. Renders a single junk candidate as a square icon with
// a soft danger ring + portal-anchored tooltip on hover. Replaces the old
// verbose-row layout — much denser, more visually scannable, and matches
// the bank-grid aesthetic.
function JunkTile({ item, tab }: { item: OrganizedItem; tab: string }) {
  const tileRef = useRef<HTMLDivElement | null>(null);
  const [tipPos, setTipPos] = useState<{ x: number; y: number } | null>(null);

  const showTip = () => {
    const el = tileRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setTipPos({ x: r.left + r.width / 2, y: r.bottom + 6 });
  };
  const hideTip = () => setTipPos(null);

  return (
    <>
      <div
        ref={tileRef}
        onMouseEnter={showTip}
        onMouseLeave={hideTip}
        onFocus={showTip}
        onBlur={hideTip}
        tabIndex={0}
        // Inline width/height + box-sizing guarantee the tile is exactly
        // one grid cell, regardless of what the parent grid decides. Without
        // this fallback, a missing Tailwind class (`aspect-square` not in
        // the JIT output) would let the tile grow to 100% of its grid cell
        // and the grid would visually collapse to one item per row.
        style={{
          width: "100%",
          height: "100%",
          minHeight: "44px",
          boxSizing: "border-box"
        }}
        className={cn(
          "rounded-md flex items-center justify-center relative cursor-default",
          "bg-[var(--color-bg-2)] border border-[var(--color-danger)]/25",
          "hover:border-[var(--color-danger)]/60 hover:bg-[var(--color-danger)]/10",
          "focus:outline-none focus-visible:border-[var(--color-danger)] focus-visible:ring-2 focus-visible:ring-[var(--color-danger)]/30",
          "transition-all duration-150",
          // Subtle inner glow so the eye reads "this is flagged" without
          // overwhelming the icon.
          "shadow-[inset_0_0_0_1px_rgba(255,90,90,0.04)]"
        )}
      >
        <ItemSprite
          id={spriteIdForItem(item.id, item.quantity)}
          alt={item.name}
          className="pixelated"
          style={{
            maxWidth: "80%",
            maxHeight: "80%"
          }}
        />
        {item.quantity > 1 && (
          <span
            className="absolute top-0.5 left-0.5 text-[8.5px] font-mono leading-none px-0.5"
            style={{ color: qtyColor(item.quantity) }}
          >
            {formatQty(item.quantity)}
          </span>
        )}
      </div>
      {tipPos && createPortal(
        <div
          style={{ left: tipPos.x, top: tipPos.y }}
          className={cn(
            "fixed z-[100] -translate-x-1/2 pointer-events-none",
            "rounded-md border border-[var(--color-border-strong)] bg-[var(--color-panel)]",
            "px-2.5 py-1.5 shadow-[0_8px_24px_-8px_rgb(0_0_0/0.7)]",
            "animate-[tooltip-in_0.16s_cubic-bezier(0.22,1,0.36,1)]"
          )}
        >
          <div className="text-[12px] font-medium leading-tight text-[var(--color-text)]">
            {item.name}
          </div>
          <div className="flex items-center gap-2 mt-0.5 text-[10.5px] text-[var(--color-text-muted)]">
            <span>from {tab}</span>
            <span className="font-mono tabular-nums">
              {item.unitPrice > 0 ? `${formatGp(item.unitPrice)} gp` : "untradeable"}
            </span>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}

// Hover chip that explains the OSRS quantity colours so first-timers know
// what yellow/white/gold numbers mean in Scapestack.
function QtyColorLegend() {
  return (
    <div className="relative group/legend ml-auto">
      <button
        type="button"
        className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-[var(--color-panel)] border border-[var(--color-border)] text-[9.5px] font-mono tabular-nums hover:border-[var(--color-accent)]/40 transition-colors"
        aria-label="Quantity colour legend"
      >
        <span className="text-[var(--color-osrs-qty-yellow)] font-semibold">1k</span>
        <span className="text-[var(--color-osrs-qty-white)] font-semibold">100k</span>
        <span className="text-[var(--color-osrs-qty-green)] font-semibold">10M</span>
      </button>
      <div className="absolute right-0 top-full mt-2 z-40 pointer-events-none opacity-0 group-hover/legend:opacity-100 group-hover/legend:translate-y-0 translate-y-[-4px] transition-all duration-150 delay-100">
        <div className="rounded-lg border border-[var(--color-border-strong)] bg-[var(--color-panel)] shadow-[0_12px_30px_-10px_rgb(0_0_0/0.7)] px-3 py-2.5 w-[210px]">
          <div className="text-[10.5px] uppercase tracking-wider text-[var(--color-text-muted)] font-semibold mb-1.5">Stack colours</div>
          <ul className="space-y-1 text-[11.5px]">
            <li className="flex items-center justify-between">
              <span className="text-[var(--color-osrs-qty-yellow)] font-mono font-semibold">Yellow</span>
              <span className="text-[var(--color-text-dim)]">&lt; 100,000</span>
            </li>
            <li className="flex items-center justify-between">
              <span className="text-[var(--color-osrs-qty-white)] font-mono font-semibold">White</span>
              <span className="text-[var(--color-text-dim)]">100k – 10M</span>
            </li>
            <li className="flex items-center justify-between">
              <span className="text-[var(--color-osrs-qty-green)] font-mono font-semibold">Gold</span>
              <span className="text-[var(--color-text-dim)]">10M+</span>
            </li>
          </ul>
          <p className="mt-2 pt-2 border-t border-[var(--color-border)] text-[10px] text-[var(--color-text-muted)] leading-snug">
            Same colour rules as the in-game bank.
          </p>
        </div>
      </div>
    </div>
  );
}

// Pick one boss trip -> pull the user's best gear from their bank -> emit a Bank Tag
// string they can import. Saves the player from manually building the tab.
type BossLoadoutFilter = "best" | "raid" | "slayer" | "wildy" | "gwd" | "beginner" | "skilling";

const BOSS_LOADOUT_FILTERS: Array<{ key: BossLoadoutFilter; label: string; hint: string }> = [
  { key: "best", label: "Best with bank", hint: "Most useful trips with this bank" },
  { key: "raid", label: "Raids", hint: "CoX, ToB and ToA prep" },
  { key: "slayer", label: "Slayer", hint: "Task bosses and upgrades" },
  { key: "wildy", label: "Wildy", hint: "Risk-aware quick checks" },
  { key: "gwd", label: "GWD", hint: "God Wars trips" },
  { key: "beginner", label: "Beginner", hint: "First boss trips" },
  { key: "skilling", label: "Skilling", hint: "Wintertodt, Tempoross and utility" }
];

function bossMatchesLoadoutFilter(boss: Boss, filter: BossLoadoutFilter): boolean {
  if (filter === "best") return boss.hp > 0 && boss.weaknesses.length > 0;
  if (filter === "beginner") {
    return boss.hp > 0 && boss.hp <= 320 && boss.category !== "raid" && boss.category !== "dt2" && boss.category !== "gwd";
  }
  if (filter === "skilling") return boss.category === "skilling" || boss.slug === "hespori";
  return boss.category === filter;
}

function bossRelevanceScore(boss: Boss, ownedGearItems: ReturnType<typeof ownedGear>): number {
  const dps = bestStyleAndSetup(ownedGearItems, boss);
  const usableBoost = dps.dps > 0 ? 50 : 0;
  const gpBoost = boss.avgLootGp ? Math.min(20, boss.avgLootGp / 20_000) : 0;
  const beginnerBoost = boss.hp > 0 && boss.hp <= 320 ? 8 : 0;
  const riskPenalty = boss.category === "wildy" ? 22 : boss.category === "raid" ? 10 : 0;
  return usableBoost + dps.dps * 6 + gpBoost + beginnerBoost - riskPenalty;
}

function firstOrganizedItemMatch(items: OrganizedItem[], patterns: RegExp[]): OrganizedItem | null {
  for (const pattern of patterns) {
    pattern.lastIndex = 0;
    const found = items.find((item) => {
      pattern.lastIndex = 0;
      return pattern.test(item.name);
    });
    if (found) return found;
  }
  return null;
}

function bossInventoryPrep(items: OrganizedItem[]) {
  return [
    {
      label: "Food",
      item: firstOrganizedItemMatch(items, [/^anglerfish$/i, /^manta ray$/i, /^shark$/i, /^cooked karambwan$/i, /^monkfish$/i])
    },
    {
      label: "Prayer",
      item: firstOrganizedItemMatch(items, [/^super restore\(4\)$/i, /^prayer potion\(4\)$/i, /^sanfew serum\(4\)$/i])
    },
    {
      label: "Boost",
      item: firstOrganizedItemMatch(items, [/^super combat potion\(4\)$/i, /^ranging potion\(4\)$/i, /^magic potion\(4\)$/i, /^bastion potion\(4\)$/i])
    },
    {
      label: "Teleport",
      item: firstOrganizedItemMatch(items, [/^royal seed pod$/i, /^teleport to house$/i, /^house teleport$/i, /^ring of dueling/i, /^games necklace/i, /^amulet of glory/i])
    }
  ];
}

function BossTagSection({ items, flash, copied, onOpenDps }: {
  items: OrganizedItem[];
  flash: (key: string) => void;
  copied: string | null;
  onOpenDps: (bossSlug: string) => void;
}) {
  // Selected boss is null until the player clicks an icon — keeps the section
  // compact on first sight (no giant loadout under the bank by default).
  const [bossSlug, setBossSlug] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [manualBossTag, setManualBossTag] = useState("");
  const [activeFilter, setActiveFilter] = useState<BossLoadoutFilter>("best");
  const [showAllBosses, setShowAllBosses] = useState(false);
  const boss = useMemo(() => (bossSlug ? BOSSES.find((b) => b.slug === bossSlug) ?? null : null), [bossSlug]);
  const ownedGearItems = useMemo(() => ownedGear(items), [items]);

  const visibleBosses = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? BOSSES.filter((b) =>
          b.name.toLowerCase().includes(q) ||
          b.slug.toLowerCase().includes(q) ||
          (b.notes ?? "").toLowerCase().includes(q)
        )
      : BOSSES.filter((b) => bossMatchesLoadoutFilter(b, activeFilter));
    return [...filtered]
      .sort((a, b) => bossRelevanceScore(b, ownedGearItems) - bossRelevanceScore(a, ownedGearItems))
      .slice(0, showAllBosses || q ? 60 : 12);
  }, [activeFilter, ownedGearItems, query, showAllBosses]);

  const best = useMemo(() => (boss ? bestStyleAndSetup(ownedGearItems, boss) : null), [boss, ownedGearItems]);
  const bossVerdict = best && boss
    ? best.dps <= 0
      ? "Gear missing"
      : boss.category === "wildy"
        ? "Risky trip"
        : best.hitChance >= 0.55
          ? "Try one trip"
          : "Test first"
    : "";

  const tagString = useMemo(() => {
    if (!boss || !best) return "";
    const setupIds = [
      best.weapon?.id,
      best.setup.head?.id,
      best.setup.cape?.id,
      best.setup.neck?.id,
      best.setup.ammo?.id,
      best.setup.body?.id,
      best.setup.shield?.id,
      best.setup.legs?.id,
      best.setup.hands?.id,
      best.setup.feet?.id,
      best.setup.ring?.id
    ].filter((n): n is number => typeof n === "number" && n > 0);
    if (!setupIds.length) return "";
    return exportTag({
      name: `${boss.slug}-loadout`,
      iconItemId: setupIds[0],
      items: setupIds
    });
  }, [boss, best]);

  const onCopyBossTag = async () => {
    if (!tagString) return;
    const result = await copyText(tagString);
    if (result !== "failed") {
      setManualBossTag("");
      flash("boss-tag");
    } else {
      setManualBossTag(tagString);
      flash("boss-tag-error");
    }
  };

  const setupSlots = best
    ? ([
        { key: "weapon", item: best.weapon },
        { key: "head",   item: best.setup.head },
        { key: "cape",   item: best.setup.cape },
        { key: "neck",   item: best.setup.neck },
        { key: "body",   item: best.setup.body },
        { key: "legs",   item: best.setup.legs },
        { key: "hands",  item: best.setup.hands },
        { key: "feet",   item: best.setup.feet },
        { key: "ring",   item: best.setup.ring },
        { key: "ammo",   item: best.setup.ammo },
        { key: "shield", item: best.setup.shield }
      ] as Array<{ key: string; item: { id: number; name: string } | undefined }>)
    : [];
  const haveGearCount = setupSlots.filter((s) => s.item).length;
  const missingSlots = setupSlots.filter((s) => !s.item).slice(0, 4);
  const inventoryPrep = useMemo(() => bossInventoryPrep(items), [items]);

  return (
    <section className="mt-8 surface p-4 sm:p-5" aria-label="Boss loadout builder">
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h3 className="text-[18px] font-bold tracking-normal text-[var(--color-text)]">
            Pick one boss trip
          </h3>
          <p className="mt-1 text-[12.5px] leading-relaxed text-[var(--color-text-dim)]">
            Build one RuneLite tab from owned gear, supplies and the boss you want to try.
          </p>
        </div>
        <span className="text-[11px] font-semibold text-[var(--color-text-muted)]">
          {boss ? `${boss.name} selected` : `${visibleBosses.length} quick picks`}
        </span>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,0.95fr)_minmax(340px,1.05fr)]">
        <div className="min-w-0">
          <div className="mb-3 flex flex-wrap gap-2" aria-label="Boss categories">
            {BOSS_LOADOUT_FILTERS.map((filter) => (
              <button
                key={filter.key}
                type="button"
                aria-pressed={activeFilter === filter.key}
                title={filter.hint}
                onClick={() => {
                  setActiveFilter(filter.key);
                  setQuery("");
                  setShowAllBosses(false);
                }}
                className={cn(
                  "rounded-lg border px-3 py-2 text-[12px] font-bold transition-colors",
                  activeFilter === filter.key && !query
                    ? "border-[var(--color-accent)] bg-[var(--color-accent)] text-black"
                    : "border-[var(--color-border)] bg-[var(--color-bg)]/35 text-[var(--color-text-dim)] hover:border-[var(--color-accent)]/45 hover:text-[var(--color-text)]"
                )}
              >
                {filter.label}
              </button>
            ))}
          </div>

          <div className="relative mb-3">
            <label htmlFor="boss-loadout-search" className="sr-only">Search bosses</label>
            <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-[var(--color-text-muted)]" />
            <input
              id="boss-loadout-search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search boss..."
              className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg-2)] py-2 pl-8 pr-8 text-[12.5px] text-[var(--color-text)] outline-none transition-all placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-accent)] focus:shadow-[0_0_0_3px_rgba(134,166,217,0.12)]"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="absolute right-2 top-1/2 flex size-5 -translate-y-1/2 items-center justify-center rounded text-[var(--color-text-dim)] transition-colors hover:bg-[var(--color-bg)] hover:text-[var(--color-text)]"
                aria-label="Clear boss search"
              >
                <X className="size-3" />
              </button>
            )}
          </div>

          <div className="grid grid-cols-[repeat(auto-fill,minmax(54px,1fr))] gap-2" data-testid="boss-quick-picks">
            {visibleBosses.length === 0 ? (
              <div className="col-span-full rounded-md border border-dashed border-[var(--color-border)] px-3 py-6 text-center text-[12px] text-[var(--color-text-muted)]">
                No bosses match &ldquo;{query}&rdquo;.
              </div>
            ) : visibleBosses.map((b) => {
              const isSelected = b.slug === bossSlug;
              return (
                <button
                  key={b.slug}
                  type="button"
                  onClick={() => setBossSlug(b.slug)}
                  aria-pressed={isSelected}
                  title={b.name + (b.notes ? ` - ${b.notes}` : "")}
                  className={cn(
                    "group flex min-h-[64px] flex-col items-center justify-center gap-1 rounded-lg border px-1.5 py-2 text-center transition-all",
                    isSelected
                      ? "scale-[1.02] border-[var(--color-accent)] bg-[var(--color-accent)]/12 shadow-[0_0_0_3px_rgba(134,166,217,0.16)]"
                      : "border-[var(--color-border)] bg-[var(--color-bg-2)] hover:-translate-y-0.5 hover:border-[var(--color-accent)]/40 hover:bg-[var(--color-panel-2)]"
                  )}
                >
                  <BossSprite boss={b} size={38} />
                  <span className="max-w-full truncate text-[9.5px] font-bold text-[var(--color-text-muted)] group-hover:text-[var(--color-text)]">
                    {b.name}
                  </span>
                </button>
              );
            })}
          </div>

          {!query && (
            <button
              type="button"
              onClick={() => setShowAllBosses((value) => !value)}
              className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-[var(--color-border)] bg-[var(--color-bg)]/35 px-3 py-2 text-[12px] font-semibold text-[var(--color-text-dim)] transition-colors hover:border-[var(--color-accent)]/45 hover:text-[var(--color-accent)]"
              aria-expanded={showAllBosses}
            >
              {showAllBosses ? "Show fewer bosses" : "Show all bosses"}
              <ChevronDown className={cn("size-3.5 transition-transform", showAllBosses && "rotate-180")} />
            </button>
          )}
        </div>

        <div className="min-w-0 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)]/30 p-3 sm:p-4">
          {boss && best ? (
            <div className="animate-[pop-in_0.18s_ease-out]">
              <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex min-w-0 gap-3">
                  <div className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-2)]">
                    <BossSprite boss={boss} size={44} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="text-[15px] font-bold leading-tight text-[var(--color-text)]">{boss.name}</div>
                      {boss.iconItemId && (
                        <span className="inline-flex items-center gap-1 rounded border border-[var(--color-border)] bg-[var(--color-bg)]/55 px-1.5 py-0.5 text-[9.5px] font-black text-[var(--color-text-muted)] tabular-nums">
                          <ItemSprite id={boss.iconItemId} alt="" size={16} className="pixelated" />
                          Loadout
                        </span>
                      )}
                    </div>
                    <div className="mt-1 text-[11px] font-semibold text-[var(--color-text-dim)]">
                      {best.dps > 0 ? `${bossVerdict} · ${best.style}` : "No usable weapon found"}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setBossSlug(null)}
                  className="hidden size-7 shrink-0 items-center justify-center rounded text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-bg-2)] hover:text-[var(--color-text)] sm:flex"
                  title="Clear boss"
                  aria-label="Clear selected boss"
                >
                  <X className="size-3.5" />
                </button>
              </div>

              <div className="mb-3 grid grid-cols-4 gap-1.5 sm:grid-cols-6 xl:grid-cols-11">
                {setupSlots.map(({ key, item }) => (
                  <div
                    key={key}
                    className={cn(
                      "aspect-square rounded-md border flex items-center justify-center relative",
                      item
                        ? "border-[var(--color-border)] bg-[var(--color-bg-2)]"
                        : "border-dashed border-[var(--color-border)] bg-[var(--color-bg)]/50"
                    )}
                    title={item ? item.name : `${key} missing`}
                  >
                    {item ? (
                      <ItemSprite
                        id={item.id}
                        alt={item.name}
                        className="pixelated"
                        style={{ maxWidth: "78%", maxHeight: "78%" }}
                      />
                    ) : (
                      <span className="text-[8.5px] uppercase tracking-wider text-[var(--color-text-muted)]">{key}</span>
                    )}
                  </div>
                ))}
              </div>

              <div className="grid gap-2 sm:grid-cols-3">
                <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-panel)]/45 p-2.5">
                  <div className="text-[9.5px] font-bold uppercase tracking-[0.15em] text-[var(--color-text-muted)]">Owned setup slots</div>
                  <div className="mt-1 text-[13px] font-bold text-[var(--color-text)]">{haveGearCount}/{setupSlots.length}</div>
                </div>
                <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-panel)]/45 p-2.5">
                  <div className="text-[9.5px] font-bold uppercase tracking-[0.15em] text-[var(--color-text-muted)]">Missing upgrades</div>
                  <div className="mt-1 text-[12px] font-semibold text-[var(--color-text)]">
                    {missingSlots.length > 0 ? missingSlots.map((slot) => slot.key).join(", ") : "No empty gear slots"}
                  </div>
                </div>
                <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-panel)]/45 p-2.5">
                  <div className="text-[9.5px] font-bold uppercase tracking-[0.15em] text-[var(--color-text-muted)]">Inventory prep</div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {inventoryPrep.map((slot) => (
                      <span
                        key={slot.label}
                        title={slot.item ? slot.item.name : `${slot.label} missing`}
                        className={cn(
                          "inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-semibold",
                          slot.item
                            ? "border-[var(--color-accent)]/25 bg-[var(--color-accent)]/10 text-[var(--color-text)]"
                            : "border-[var(--color-border)] bg-[var(--color-bg)]/45 text-[var(--color-text-muted)]"
                        )}
                      >
                        {slot.item ? <ItemSprite id={slot.item.id} alt="" size={14} className="pixelated" /> : null}
                        {slot.item ? slot.label : `${slot.label}?`}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                <button
                  type="button"
                  onClick={onCopyBossTag}
                  disabled={!tagString}
                  className={cn(
                    "inline-flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-[12.5px] font-bold transition-all",
                    tagString
                      ? "bg-[var(--color-accent)] text-[#0B1116] hover:brightness-110"
                      : "cursor-not-allowed bg-[var(--color-panel-2)] text-[var(--color-text-muted)]"
                  )}
                >
                  {copied === "boss-tag" ? <CheckCheck className="size-3.5" /> : <Copy className="size-3.5" />}
                  {copied === "boss-tag" ? "RuneLite tab copied" : copied === "boss-tag-error" ? "Copy failed" : "Copy RuneLite tab"}
                </button>
                <button
                  type="button"
                  onClick={() => onOpenDps(boss.slug)}
                  className="inline-flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-lg border border-[var(--color-accent)]/35 bg-[var(--color-bg-2)] px-3 py-2 text-[12.5px] font-bold text-[var(--color-accent)] transition-all hover:border-[var(--color-accent)]/60 hover:bg-[var(--color-accent)]/10"
                  aria-label={`Check ${boss.name} kill setup with this bank`}
                  title={`/dps?boss=${boss.slug}`}
                >
                  Check kill
                  <Sword className="size-3.5" />
                </button>
              </div>

              <p className="mt-3 text-[10.5px] leading-relaxed text-[var(--color-text-muted)]">
                Built from owned gear in this bank. Copy the tab to RuneLite, then test one trip before buying upgrades.
              </p>
              {copied === "boss-tag-error" && manualBossTag && (
                <div className="mt-3 rounded-lg border border-[var(--color-danger)]/25 bg-[var(--color-danger)]/8 p-2" aria-live="polite">
                  <label className="mb-1 block text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--color-danger)]">
                    Clipboard failed — copy boss tag manually
                  </label>
                  <textarea
                    readOnly
                    value={manualBossTag}
                    onFocus={(event) => event.currentTarget.select()}
                    className="min-h-[86px] w-full resize-y rounded border border-[var(--color-border)] bg-[var(--color-bg)] p-2 font-mono text-[10.5px] leading-relaxed text-[var(--color-text)]"
                    aria-label={`Manual boss Bank Tags fallback for ${boss.name}`}
                  />
                </div>
              )}
            </div>
          ) : (
            <div className="flex min-h-[260px] flex-col items-center justify-center rounded-lg border border-dashed border-[var(--color-border)] bg-[var(--color-bg)]/25 px-4 py-8 text-center">
              <div className="mb-3 flex -space-x-2">
                {visibleBosses.slice(0, 4).map((candidate) => (
                  <span key={candidate.slug} className="inline-flex size-10 items-center justify-center rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-2)]">
                    <BossSprite boss={candidate} size={34} />
                  </span>
                ))}
              </div>
              <div className="text-[14px] font-bold text-[var(--color-text)]">Choose a boss first</div>
              <p className="mt-1 max-w-sm text-[12px] leading-relaxed text-[var(--color-text-dim)]">
                ScapeStack will fill the gear slots it finds in your bank, flag missing prep, then give you one RuneLite tab to copy.
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
