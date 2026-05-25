"use client";

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
  TrendingDown, Hash, ArrowUpDown,
  LayoutGrid, Rows3, EyeOff, SlidersHorizontal, Share2,
  Wand2, ChevronDown, Sparkles, Trash2, Hourglass, Target, Grid2x2, Search, X,
  Pin, GripVertical
} from "lucide-react";
import { encodeSnapshot } from "@/lib/share";
import { BANK_FILLER_ID } from "@/lib/bank-filler";
import type { ShareSnapshot } from "@/lib/share";
import { presetsForTab, layoutWithPreset, type Preset } from "@/lib/presets";
import { ICON_URL, cn, formatQty, formatGp, qtyColor, spriteIdForItem } from "@/lib/utils";
import type { OrganizedTab, OrganizedItem, OrganizeResult } from "@/lib/organizer";
import { reorganizeTabs, type ReorganizeStrategy } from "@/lib/reorganize";
import { ARCHETYPES, type Archetype } from "@/lib/archetype";
import { buildUseCaseTabs, USE_CASE_ORDER, type UseCaseTab } from "@/lib/use-case-tabs";
import { exportAction } from "@/app/actions";
import { SuggestionsPanel } from "./suggestions-panel";
import { DiffBanner } from "./diff-banner";
import { TipsCard } from "./tips-card";
import { computeTips } from "@/lib/tips";
import { track } from "@/lib/analytics";
import { StackScoreBadge } from "./stack-score-badge";
import { computeStackScore } from "@/lib/stack-score";
import { pushScorePoint, type ScorePoint } from "@/lib/score-history";
import { isJunkCandidate, summarizeJunk, listJunkItems } from "@/lib/junk";
import { recordSnapshot, daysSinceChanged, type ItemHistory } from "@/lib/item-history";
import { matchGoals, summarizeGoalProgress, type GoalMatch } from "@/lib/goal-match";
import { suggestUpgrades, ownedIdSet, type UpgradeSuggestion } from "@/lib/upgrades";
import type { HiscoreSkill } from "@/lib/hiscores";
import { BOSSES, BOSS_CATEGORIES, type Boss, type BossCategory } from "@/lib/bosses";
import { BossSprite } from "./boss-picker";
import { ownedGear } from "@/lib/gear";
import { bestStyleAndSetup } from "@/lib/dps";
import { exportTag } from "@/lib/bank-tags";
import { DiscordWebhookCard } from "./discord-webhook-card";
import { SupportCard } from "./support-card";
import { loadWebhookConfig, sendBankUpdate } from "@/lib/discord";
import {
  diffSnapshots,
  loadSnapshot,
  saveSnapshot,
  snapshotBank,
  type BankDiff,
  type BankSnapshot
} from "@/lib/diff";
import { appendRsnSnapshot } from "@/lib/snapshot-history";

interface BankResultProps {
  initial: OrganizeResult;
  initialStrings: string[];
  onEditInput: () => void;
  inferredArchetype?: Archetype | null;
  inferredRsn?: string | null;
  hiscoreSkills?: HiscoreSkill[] | null;
}

type SortMode = "default" | "value" | "quantity" | "name";
type Density = "ultra" | "compact" | "comfortable";
type TabMode = "type" | "useCase";
const PREFS_KEY = "scapestack-bank:prefs";

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

// After a successful drop, we trigger a short gold flash on the dragged
// item's new slot. Done via context so we don't have to thread a prop
// through every tab/grid/slot. Token is bumped per drop so React
// remounts the animation even when the same id is dropped twice.
interface DropFlashContextValue {
  flashedId: number | null;
  token: number;
}
const DropFlashContext = createContext<DropFlashContextValue>({ flashedId: null, token: 0 });

export function BankResult({ initial, initialStrings, onEditInput, inferredArchetype, inferredRsn, hiscoreSkills }: BankResultProps) {
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
  const [layoutOpen, setLayoutOpen] = useState(false);
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);
  const [activeSubtab, setActiveSubtab] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [diff, setDiff] = useState<BankDiff | null>(null);
  const [diffDismissed, setDiffDismissed] = useState(false);
  const [activePreset, setActivePreset] = useState<Preset | null>(null);
  const [previousScore, setPreviousScore] = useState<number | undefined>(undefined);
  const [reorgFlash, setReorgFlash] = useState<string | null>(null);
  // Last reorganize strategy that was applied — used to re-sort items inside
  // each (use-case) tab after bucketing, so the user actually sees the change.
  const [viewSort, setViewSort] = useState<ReorganizeStrategy | null>(null);
  const [scoreHistory, setScoreHistory] = useState<ScorePoint[]>([]);
  const [itemHistory, setItemHistory] = useState<ItemHistory>({});
  const [rsnSnapshots, setRsnSnapshots] = useState<BankSnapshot[]>([]);
  const [compareSnapshot, setCompareSnapshot] = useState<BankSnapshot | null>(null);
  const [isNarrow, setIsNarrow] = useState(false);

  // Auto-density: switch to compact when viewport is narrow.
  useEffect(() => {
    const check = () => setIsNarrow(window.innerWidth < 640);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);
  const searchRef = useRef<HTMLInputElement>(null);

  // ⌘K / Ctrl+K to focus the bank search.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
      } else if (e.key === "Escape" && document.activeElement === searchRef.current) {
        setSearch("");
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

    // RSN-scoped snapshot history (only if we have an RSN).
    if (inferredRsn) {
      const list = appendRsnSnapshot(inferredRsn, next);
      setRsnSnapshots(list);
    } else {
      setRsnSnapshots([]);
    }

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
    const q = search.trim().toLowerCase();
    if (!q) return;
    // Count matches per visible tab. If the active tab already has matches,
    // leave the user where they are — no point yanking them around mid-type.
    let bestIdx = -1;
    let bestCount = 0;
    visibleTabs.forEach((t, idx) => {
      const count = t.items.reduce((n, it) =>
        n + (it.name.toLowerCase().includes(q) || it.subtab.toLowerCase().includes(q) ? 1 : 0), 0);
      if (count > bestCount) { bestCount = count; bestIdx = idx; }
    });
    const activeCount = visibleTabs[activeIdx]?.items.reduce((n, it) =>
      n + (it.name.toLowerCase().includes(q) || it.subtab.toLowerCase().includes(q) ? 1 : 0), 0) ?? 0;
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

  // Gear upgrade suggestions — only when we have hiscores for this RSN.
  const compareDiff = useMemo<BankDiff | null>(() => {
    if (!compareSnapshot) return null;
    const current = snapshotBank(tabs);
    return diffSnapshots(compareSnapshot, current);
  }, [compareSnapshot, tabs]);

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
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return it.name.toLowerCase().includes(q) || it.subtab.toLowerCase().includes(q);
  }, [search]);

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
    try {
      await navigator.clipboard.writeText(url);
      flash("share-link");
    } catch {
      // Fallback: navigate to it so they can copy from address bar
      window.location.href = url;
    }
  };

  const copyAll = async () => {
    await navigator.clipboard.writeText(strings.join("\n"));
    flash("all");
    track("bank:copy", { mode: "all", tabs: strings.length });
  };
  const copyNumbered = async () => {
    const total = strings.length;
    const blocks = strings.map((s, i) => `--- Tab ${i + 1}/${total}: ${tabs[i]?.name || "?"} ---\n${s}`);
    await navigator.clipboard.writeText(blocks.join("\n\n"));
    flash("numbered");
    track("bank:copy", { mode: "numbered", tabs: total });
  };
  const copyOne = async (i: number) => {
    await navigator.clipboard.writeText(strings[i]);
    flash(`one-${i}`);
    track("bank:copy", { mode: "single", tab: tabs[i]?.name || "?" });
  };
  const flash = (key: string) => {
    setCopied(key);
    setTimeout(() => setCopied((x) => (x === key ? null : x)), 1300);
  };

  const totalValue = useMemo(() => tabs.reduce((s, t) => s + t.value, 0), [tabs]);
  const totalQty = useMemo(() => tabs.reduce((s, t) => s + t.quantity, 0), [tabs]);
  const totalItems = useMemo(() => tabs.reduce((s, t) => s + t.items.length, 0), [tabs]);

  return (
    <div className="animate-[slide-up_0.35s_ease-out]">
      {/* Header — minimal, mono stats, single mint accent on gp */}
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h2 className="text-[20px] font-semibold tracking-tight text-[var(--color-text)] leading-tight">
            {initial.source.name}
          </h2>
          {inferredArchetype && inferredArchetype !== "unspecified" && (() => {
            const meta = ARCHETYPES.find((a) => a.id === inferredArchetype);
            if (!meta) return null;
            return (
              <div className="mt-2 inline-flex items-center gap-2 rounded-full border border-[var(--color-accent)]/30 bg-[var(--color-accent)]/10 pl-1.5 pr-2.5 py-0.5 text-[11.5px] font-medium text-[var(--color-accent)]">
                <span className="size-4 shrink-0 inline-flex items-center justify-center">
                  <img
                    src={ICON_URL(meta.iconItemId)}
                    alt=""
                    className="pixelated"
                    style={{ maxWidth: "100%", maxHeight: "100%", imageRendering: "pixelated", filter: "drop-shadow(1px 1px 0 rgb(0 0 0 / 0.9))" }}
                  />
                </span>
                <span>Layout tuned for <span className="font-semibold">{meta.label}</span></span>
                {inferredRsn && (
                  <span className="text-[var(--color-text-muted)] font-mono normal-case">· {inferredRsn}</span>
                )}
              </div>
            );
          })()}
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-[var(--color-text)] font-mono tabular-nums">
            <span className="flex items-center gap-1.5">
              <Layers className="size-3.5 opacity-50" />
              {totalItems} items · {tabs.length} tabs
            </span>
            {initial.stats.hasQuantities && (
              <span className="flex items-center gap-1.5">
                <Hash className="size-3.5 opacity-50" />
                {formatQty(totalQty)} stack
              </span>
            )}
            {initial.stats.hasPrices && totalValue > 0 && (
              <span className="flex items-center gap-1.5 text-[var(--color-accent)]">
                <Coins className="size-3.5" />
                {formatGp(totalValue)} gp
              </span>
            )}
            {initial.stats.junkFilterActive && (
              <span className="flex items-center gap-1.5 text-[var(--color-warning)]">
                <AlertCircle className="size-3.5" />
                Junk filter on
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <StackScoreBadge tabs={tabs} previousScore={previousScore} />
          {/* PRIMARY ACTION — the moment-of-truth: paste back into RuneLite.
              Previously this lived 1000+ pixels below the bank in an Export
              section, which is the wrong place for the page's main outcome.
              Now it's right where the eye lands after "your bank is sorted". */}
          <button
            onClick={copyAll}
            className={cn(
              "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12.5px] font-semibold transition-all",
              "bg-[var(--color-accent)] text-[#07090C] hover:brightness-110 shadow-[0_0_0_3px_rgba(230, 165, 47,0.15)]",
              "hover:shadow-[0_0_0_4px_rgba(230, 165, 47,0.25)]"
            )}
            title="Copy every tab's Bank Tags string to your clipboard — paste each into RuneLite"
          >
            {copied === "all" ? <CheckCheck className="size-3.5" /> : <Copy className="size-3.5" />}
            {copied === "all" ? "Copied!" : "Copy to RuneLite"}
          </button>
          {/* Bank → /next handoff. Per STRATEGY.md the bank organizer is a
              data feeder for the /next hub, so after a successful organize
              we offer a one-click jump that carries the bank along via
              sessionStorage. /next reads it back and skips the intake form. */}
          <button
            onClick={() => {
              try {
                const items = tabs.flatMap((t) => t.items.map((it) => ({ id: it.id, name: it.name })));
                sessionStorage.setItem("scapestack:next:bank", JSON.stringify(items));
              } catch { /* private mode / quota — fall through, /next still works without */ }
              window.location.href = "/next?from=bank";
            }}
            className={cn(
              "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12.5px] font-medium border transition-colors",
              "border-[var(--color-accent)]/40 text-[var(--color-accent)] hover:bg-[var(--color-accent)]/10"
            )}
            title="Take this bank into the 'what to do next' hub"
          >
            <Sparkles className="size-3.5" />
            What should I do next?
          </button>
          {/* Smart tidy — secondary action, ghost-styled. Re-tidies in place
              if the user wants a different layout (each press uses a fresh
              shuffle seed, so equal-rank items shuffle a touch). */}
          <button
            onClick={() => applyReorganize("smart", "Tidied")}
            className={cn(
              "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12.5px] font-medium border transition-colors",
              "bg-transparent text-[var(--color-text-dim)] border-[var(--color-border)]",
              "hover:text-[var(--color-text)] hover:border-[var(--color-border-strong)]"
            )}
            title="Re-tidy the bank — groups every tab and packs it neatly"
          >
            <Wand2 className="size-3.5" />
            {reorgFlash ? reorgFlash.replace(/ #\d+$/, "") : "Smart tidy"}
          </button>
          {/* Layout popup — tab order + pinned items. Kept off the toolbar so
              that bar stays focused on view prefs; a dot marks customisation. */}
          <button
            onClick={() => setLayoutOpen(true)}
            className={cn(
              "relative inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12.5px] font-medium border transition-colors",
              "bg-transparent text-[var(--color-text-dim)] border-[var(--color-border)]",
              "hover:text-[var(--color-text)] hover:border-[var(--color-border-strong)]"
            )}
            title="Customise tab order and pinned items"
          >
            <GripVertical className="size-3.5" />
            Layout
            {(prefs.tabOrder.length > 0 || prefs.pinnedItems.length > 0) && (
              <span className="size-1.5 rounded-full bg-[var(--color-accent)]" aria-hidden="true" />
            )}
          </button>
          <button onClick={onEditInput} className="btn-ghost">
            <Edit3 className="size-3.5" /> Edit input
          </button>
        </div>
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

      {/* Preferences row — sits directly above the bank so the controls and
          the thing they control are visually paired. */}
      <PreferencesBar
        prefs={prefs}
        setPrefs={setPrefs}
        activeArchetype={activeArchetype}
        onArchetypeChange={setArchetypeOverride}
        inferredArchetype={inferredArchetype}
      />

      <PinContext.Provider value={pinContextValue}>
      <DropFlashContext.Provider value={dropFlash}>
      <DndContext sensors={sensors} collisionDetection={collisionDetection} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragOver={onDragOver} onDragCancel={onDragCancel}>
        {/* Bank frame — dark slate panel, mint title accent. The "OSRS" feel
            comes from the tab strip + pixelated items inside, not the chrome. */}
        <div
          key={reorgFlash ?? "stable"}
          className={cn(
            "group/frame relative mt-3 rounded-lg overflow-hidden",
            "transition-[border-color,box-shadow] duration-300 ease-out",
            "hover:border-[var(--color-accent)]/30 hover:shadow-[0_28px_70px_-28px_rgb(0_0_0/0.75),0_0_0_1px_rgba(230, 165, 47,0.18)]",
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
            style={{ background: "linear-gradient(to right, transparent, rgba(230, 165, 47,0.6), transparent)" }}
          />
          {/* Title bar — minimal monochrome */}
          <div className="relative flex items-center justify-between py-2.5 px-4 border-b border-[var(--color-border)] bg-[var(--color-bg-2)] gap-3">
            <div className="flex items-center gap-2">
              <span className="size-1.5 rounded-full bg-[var(--color-accent)]" />
              <span className="text-[10.5px] uppercase tracking-[0.18em] font-semibold text-[var(--color-text-dim)]">
                Bank view
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
              "p-3",
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
              onSearchChange={setSearch}
              itemCount={activeTab?.items.length || 0}
              searchRef={searchRef}
            />

            {/* Bank body (also droppable so users can drop on the canvas) */}
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

        <DragOverlay dropAnimation={null}>
          {dragging && (
            <div
              className={cn(
                "rounded-md flex items-center justify-center",
                "bg-[var(--color-osrs-slot)] border-2 border-[var(--color-accent)]",
                "shadow-[0_12px_28px_-8px_rgb(0_0_0/0.7),0_0_0_4px_rgba(230, 165, 47,0.15)]",
                "animate-[pop-in_0.16s_cubic-bezier(0.22,1,0.36,1)] cursor-grabbing"
              )}
              // Match the lifted slot's real size so the overlay stays
              // squarely under the cursor (slots are fluid, not 56px fixed).
              style={{ width: dragSize, height: dragSize }}
            >
              <img
                src={ICON_URL(spriteIdForItem(dragging.id, dragging.quantity))}
                alt=""
                loading="eager"
                decoding="sync"
                className="pixelated drop-shadow-[1px_1px_0_rgb(0_0_0/0.9)] pointer-events-none"
                style={{
                  maxWidth: "72%",
                  maxHeight: "72%",
                  width: "auto",
                  height: "auto",
                  imageRendering: "pixelated"
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

      {/* ── Insights — secondary panels, collapsed below the bank ────────────
          Six analytical panels (tips, diffs, junk, upgrades, goals, diet)
          used to stack equally below the bank, competing for attention and
          burying the export action. Now wrapped in a single <details>
          element: a summary line counts what's inside, click to expand.
          Visitors who came to "get tabs and export" never scroll past the
          summary; analytical users find everything one click away.
          Native <details> over a React state toggle on purpose — no extra
          render, keyboard-accessible, survives soft navigation. */}
      <details className="group mt-8 rounded-lg border border-[var(--color-border)] bg-[var(--color-panel)]/40 overflow-hidden">
        <summary className="cursor-pointer list-none flex items-center justify-between gap-3 px-4 py-3 hover:bg-[var(--color-panel)]/60 transition-colors">
          <div className="flex items-center gap-3 min-w-0">
            <Sparkles className="size-4 text-[var(--color-accent)] shrink-0" />
            <span className="text-[13px] font-semibold text-[var(--color-text)] tracking-tight">
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
        <TipsCard tips={bankTips} />
      </div>

      {/* Diff vs previous bank snapshot, if any */}
      {diff && !diffDismissed && (
        <DiffBanner diff={diff} history={scoreHistory} onDismiss={() => setDiffDismissed(true)} />
      )}

      {/* Per-RSN snapshot history selector — appears when there are 2+ snapshots */}
      {rsnSnapshots.length >= 2 && (
        <div className="mb-5 rounded-lg border border-[var(--color-border)] bg-[var(--color-panel)] px-3.5 py-2.5">
          <div className="flex items-center gap-2 flex-wrap">
            <Hourglass className="size-3.5 text-[var(--color-text-muted)]" />
            <span className="text-[11.5px] uppercase tracking-wider text-[var(--color-text-muted)] font-semibold">Compare to</span>
            <div className="flex items-center gap-1 flex-wrap">
              {rsnSnapshots.slice(0, -1).map((snap) => {
                const isActive = compareSnapshot?.ts === snap.ts;
                const days = Math.max(0, Math.round((Date.now() - snap.ts) / (1000 * 60 * 60 * 24)));
                return (
                  <button
                    key={snap.ts}
                    onClick={() => setCompareSnapshot(isActive ? null : snap)}
                    className={cn(
                      "px-2.5 py-1 rounded-md text-[11.5px] font-medium border transition-colors tabular-nums",
                      isActive
                        ? "bg-[var(--color-accent)]/12 text-[var(--color-accent)] border-[var(--color-accent)]/40"
                        : "bg-transparent text-[var(--color-text-dim)] border-[var(--color-border)] hover:text-[var(--color-text)] hover:border-[var(--color-border-strong)]"
                    )}
                  >
                    {days === 0 ? "today" : days === 1 ? "yesterday" : `${days}d ago`}
                  </button>
                );
              })}
              {compareSnapshot && (
                <button
                  onClick={() => setCompareSnapshot(null)}
                  className="ml-1 size-6 rounded flex items-center justify-center text-[var(--color-text-dim)] hover:text-[var(--color-text)] hover:bg-[var(--color-panel-2)]"
                  title="Clear comparison"
                >
                  ✕
                </button>
              )}
            </div>
            <span className="ml-auto text-[10.5px] text-[var(--color-text-muted)]">
              {inferredRsn} · {rsnSnapshots.length} snapshot{rsnSnapshots.length === 1 ? "" : "s"} saved
            </span>
          </div>
          {compareDiff && (
            <div className="mt-2.5 pt-2.5 border-t border-[var(--color-border)] text-[11.5px] grid grid-cols-3 gap-3">
              <div>
                <span className="text-[var(--color-text-muted)] uppercase tracking-wider text-[9.5px] font-semibold">Added</span>
                <div className="font-mono tabular-nums text-[var(--color-good)] font-semibold">{compareDiff.added.length}</div>
              </div>
              <div>
                <span className="text-[var(--color-text-muted)] uppercase tracking-wider text-[9.5px] font-semibold">Removed</span>
                <div className="font-mono tabular-nums text-[var(--color-danger)] font-semibold">{compareDiff.removed.length}</div>
              </div>
              <div>
                <span className="text-[var(--color-text-muted)] uppercase tracking-wider text-[9.5px] font-semibold">Net value</span>
                <div className={cn(
                  "font-mono tabular-nums font-semibold",
                  compareDiff.totalValueAfter >= compareDiff.totalValueBefore ? "text-[var(--color-good)]" : "text-[var(--color-danger)]"
                )}>
                  {compareDiff.totalValueAfter >= compareDiff.totalValueBefore ? "+" : "-"}{formatGp(Math.abs(compareDiff.totalValueAfter - compareDiff.totalValueBefore))} gp
                </div>
              </div>
            </div>
          )}
        </div>
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
                      <img
                        src={ICON_URL(s.upgrade.id)}
                        alt=""
                        className="pixelated"
                        style={{ maxWidth: "78%", maxHeight: "78%", imageRendering: "pixelated", filter: "drop-shadow(1px 1px 0 rgb(0 0 0 / 0.9))" }}
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
                      <img
                        src={ICON_URL(p.set.iconItemId)}
                        alt=""
                        className="pixelated"
                        style={{
                          maxWidth: "78%",
                          maxHeight: "78%",
                          imageRendering: "pixelated",
                          filter: "drop-shadow(1px 1px 0 rgb(0 0 0 / 0.9))"
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
      <SuggestionsPanel tabs={tabs} />

      {/* Export */}
      <section className="mt-8 surface p-5">
        <div className="flex items-baseline justify-between flex-wrap gap-3 mb-1">
          <h3 className="text-[15px] font-semibold text-[var(--color-text)] tracking-tight">
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
            onClick={copyAll}
            className={cn(
              "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] font-medium",
              "bg-[var(--color-accent)] text-[#07090C] hover:brightness-110 transition-all"
            )}
          >
            {copied === "all" ? <CheckCheck className="size-3.5" /> : <Copy className="size-3.5" />}
            Copy all tabs
          </button>
          <button onClick={copyNumbered} className="btn-ghost">
            {copied === "numbered" ? <CheckCheck className="size-3.5 text-[var(--color-accent)]" /> : <Copy className="size-3.5" />}
            Copy with headers
          </button>
        </div>

        <ol className="space-y-1.5">
          {tabs.map((tab, i) => (
            <li
              key={tab.name}
              className="grid grid-cols-[28px_28px_1fr_auto] items-center gap-3 p-3 rounded-md bg-[var(--color-bg-2)] border border-[var(--color-border)] hover:border-[var(--color-border-strong)] transition-colors"
            >
              <span className="text-center text-[11px] font-mono font-medium text-[var(--color-text-muted)] tabular-nums">
                {i + 1}
              </span>
              <img
                src={ICON_URL(tab.iconItemId)}
                alt=""
                loading="lazy"
                decoding="async"
                className="pixelated mx-auto"
                style={{
                  maxWidth: "22px",
                  maxHeight: "22px",
                  width: "auto",
                  height: "auto",
                  imageRendering: "pixelated"
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
        title={inferred ? `Inferred from Hiscores: ${inferred}` : "Pick the profile that matches how you'd like the bank laid out"}
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
      {/* Essential row — view / profile / sort / density, always visible. */}
      <div className="flex flex-wrap items-center gap-3 px-3.5 py-2.5">
        <SlidersHorizontal className="size-3.5 text-[var(--color-text-muted)]" />
        <PrefGroup label="Tabs">
          <SegmentedControl
            value={prefs.tabMode}
            onChange={(v) => setPrefs({ ...prefs, tabMode: v as TabMode })}
            options={[
              { value: "useCase", label: "Use-case", icon: Layers },
              { value: "type", label: "Item type", icon: LayoutGrid }
            ]}
          />
        </PrefGroup>

        {prefs.tabMode === "useCase" && (
          <PrefGroup label="Profile">
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
            <h2 className="text-[14px] font-semibold tracking-tight">Bank layout</h2>
          </div>
          <button
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
                        <img
                          src={ICON_URL(p.id)}
                          alt=""
                          className="pixelated"
                          style={{ maxWidth: "78%", maxHeight: "78%", imageRendering: "pixelated", filter: "drop-shadow(1px 1px 0 rgb(0 0 0 / 0.9))" }}
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
        <img
          src={ICON_URL(tab.iconItemId)}
          alt=""
          loading="lazy"
          decoding="async"
          className={cn(
            "pixelated drop-shadow-[1px_1px_0_rgb(0_0_0/0.9)] pointer-events-none transition-opacity",
            active ? "opacity-100" : "opacity-65"
          )}
          style={{
            maxWidth: "26px",
            maxHeight: "26px",
            width: "auto",
            height: "auto",
            imageRendering: "pixelated"
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
                      <img
                        src={ICON_URL(spriteIdForItem(it.id, it.quantity))}
                        alt=""
                        className="pixelated"
                        style={{ maxWidth: "85%", maxHeight: "85%", imageRendering: "pixelated" }}
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
            <img
              src={ICON_URL(p.iconItemId)}
              alt=""
              className="pixelated"
              style={{
                width: "16px",
                height: "16px",
                objectFit: "contain",
                imageRendering: "pixelated",
                filter: "drop-shadow(1px 1px 0 rgb(0 0 0 / 0.9))"
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
        <input
          ref={searchRef}
          type="text"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search across all tabs…"
          className={cn(
            "w-full pl-7 pr-16 py-1.5 rounded-md text-[12px]",
            "bg-[var(--color-bg-2)] border border-[var(--color-border)]",
            "text-[var(--color-text)] placeholder:text-[var(--color-text-muted)]",
            "focus:outline-none focus:border-[var(--color-accent)] focus:shadow-[0_0_0_3px_rgba(230, 165, 47,0.12)]"
          )}
        />
        <svg className="absolute left-2 top-1/2 -translate-y-1/2 size-3.5 text-[var(--color-text-muted)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
        {search ? (
          <button
            onClick={() => onSearchChange("")}
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
      </div>
      {subtabs.length > 1 && (
        <div className="flex items-center gap-1 flex-wrap">
          <FilterChip active={active === null} onClick={() => onChange(null)} count={itemCount}>
            All
          </FilterChip>
          {subtabs.map((s) => (
            <FilterChip key={s} active={active === s} onClick={() => onChange(active === s ? null : s)}>
              {s}
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
  return (
    <button
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

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "rounded-md p-3 min-h-[460px] transition-all",
        "bg-[var(--color-bg)]",
        "border border-[var(--color-border)]",
        draggingTo && "border-[var(--color-accent)]/40",
        hovered && "ring-2 ring-[var(--color-accent)] ring-inset border-[var(--color-accent)]"
      )}
    >
      <div className="flex items-center justify-between px-1 pb-2.5">
        <span className="text-[11.5px] font-semibold text-[var(--color-text)] tracking-tight">
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
        Drag onto a tab to move it · drag onto another item to reorder · right-click to pin
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
  const rowsNeeded = Math.max(GRID_ROWS_MIN, Math.ceil((maxSlot + 1) / GRID_COLS));
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
        const id = filteredLayout[i];
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
        return <ItemSlot key={i} item={item} hasPrices={hasPrices} hasQty={hasQty} isJunk={!!junkIds?.has(item.id)} isStale={!!staleIds?.has(item.id)} goals={goalMatches?.get(item.id)} density={density} />;
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
          <img
            src={ICON_URL(preset.iconItemId)}
            alt=""
            className="pixelated"
            style={{
              width: "16px",
              height: "16px",
              objectFit: "contain",
              imageRendering: "pixelated",
              filter: "drop-shadow(1px 1px 0 rgb(0 0 0 / 0.9))"
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
          return <ItemSlot key={i} item={item} hasPrices={hasPrices} hasQty={hasQty} isJunk={!!junkIds?.has(item.id)} isStale={!!staleIds?.has(item.id)} goals={goalMatches?.get(item.id)} />;
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
      <img
        src={ICON_URL(BANK_FILLER_ID)}
        alt={label ? `Missing: ${label}` : "Bank filler"}
        className="pixelated"
        style={{
          maxWidth: density === "ultra" ? "70%" : "80%",
          maxHeight: density === "ultra" ? "70%" : "80%",
          imageRendering: "pixelated",
          filter: "drop-shadow(1px 1px 0 rgb(0 0 0 / 0.9))",
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
  // For "above" we anchor by bottom-of-viewport so the tooltip doesn't need
  // its own height to position correctly — that avoids the brief flash where
  // it paints at the wrong place before the height is known.
  const [tooltipPos, setTooltipPos] = useState<
    | { x: number; anchor: "above"; bottom: number }
    | { x: number; anchor: "below"; top: number }
    | null
  >(null);
  const hasGoal = !!goals && goals.length > 0;
  // Defensive guard: stale snapshots could carry unknown IDs (e.g. items added
  // after our wiki mapping was generated). Render as an empty slot rather than
  // an unidentifiable sprite so the user isn't confused.
  if (!item.name || /^item \d+$/i.test(item.name)) {
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
  // ~480ms gold pulse so they see exactly where it landed. The token in
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

  return (
    <div
      ref={composedRef}
      key={isFlashing ? `flash-${flashCtx.token}` : undefined}
      onMouseEnter={showTooltip}
      onMouseLeave={hideTooltip}
      onContextMenu={(e) => {
        if (!pinCtx) return;
        e.preventDefault();
        pinCtx.togglePin(item.id);
      }}
      {...attributes}
      {...listeners}
      className={cn(
        "group relative cursor-grab active:cursor-grabbing touch-none",
        "bg-[var(--color-osrs-slot)] border-r border-b border-[var(--color-border)]/40",
        "flex items-center justify-center select-none",
        "hover:bg-[var(--color-panel-2)] hover:outline hover:outline-2 hover:outline-[var(--color-accent)] hover:outline-offset-[-2px] hover:z-10 hover:shadow-[0_0_18px_-4px_rgba(230, 165, 47,0.4)]",
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
      style={{
        aspectRatio: "1 / 1",
        // Drop-success: short gold pulse that fades. Played by the slot
        // the item *landed in* so the player can see where they put it.
        ...(isFlashing ? { animation: "drop-flash 0.48s ease-out" } : {})
      }}
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
      <img
        src={ICON_URL(spriteIdForItem(item.id, item.quantity))}
        alt={item.name}
        loading="lazy"
        decoding="async"
        className="pixelated pointer-events-none transition-transform duration-150"
        style={{
          maxWidth: "85%",
          maxHeight: "85%",
          width: "auto",
          height: "auto",
          imageRendering: "pixelated",
          filter: "drop-shadow(1px 1px 0 rgb(0 0 0 / 0.9))"
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
            "absolute top-0.5 left-1 font-bold drop-shadow-[1px_1px_0_rgb(0_0_0/1)] pointer-events-none tracking-tight text-[8px] sm:text-[10px]",
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
              Drag to move · click to focus
            </div>
          </div>
        </div>,
        document.body
      )}
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
        <img
          src={ICON_URL(spriteIdForItem(item.id, item.quantity))}
          alt={item.name}
          className="pixelated"
          style={{
            maxWidth: "80%",
            maxHeight: "80%",
            imageRendering: "pixelated",
            filter: "drop-shadow(1px 1px 0 rgb(0 0 0 / 0.9))"
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
// what yellow/white/green numbers mean.
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
              <span className="text-[var(--color-osrs-qty-green)] font-mono font-semibold">Green</span>
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

// Pick a boss → pull the user's best gear from their bank → emit a Bank Tag
// string they can import. Saves the player from manually building the tab.
function BossTagSection({ items, flash, copied }: {
  items: OrganizedItem[];
  flash: (key: string) => void;
  copied: string | null;
}) {
  // Selected boss is null until the player clicks an icon — keeps the section
  // compact on first sight (no giant loadout under the bank by default).
  const [bossSlug, setBossSlug] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const boss = useMemo(() => (bossSlug ? BOSSES.find((b) => b.slug === bossSlug) ?? null : null), [bossSlug]);

  // Group bosses by category for the icon grid. Filter by search query.
  const grouped = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? BOSSES.filter((b) =>
          b.name.toLowerCase().includes(q) ||
          b.slug.toLowerCase().includes(q) ||
          (b.notes ?? "").toLowerCase().includes(q)
        )
      : BOSSES;

    const byCat = new Map<BossCategory, Boss[]>();
    for (const b of filtered) {
      const cat = (b.category ?? "misc") as BossCategory;
      if (!byCat.has(cat)) byCat.set(cat, []);
      byCat.get(cat)!.push(b);
    }
    const order: BossCategory[] = [
      "raid", "gwd", "dt2", "slayer", "wildy", "world", "minigame", "skilling", "quest", "misc"
    ];
    return order
      .filter((c) => byCat.has(c))
      .map((c) => ({ category: c, label: BOSS_CATEGORIES[c], items: byCat.get(c)! }));
  }, [query]);

  const ownedGearItems = useMemo(() => ownedGear(items), [items]);
  const best = useMemo(() => (boss ? bestStyleAndSetup(ownedGearItems, boss) : null), [boss, ownedGearItems]);

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
    try {
      await navigator.clipboard.writeText(tagString);
      flash("boss-tag");
    } catch {}
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

  return (
    <section className="mt-8 surface p-5">
      <div className="flex items-baseline justify-between flex-wrap gap-3 mb-1">
        <h3 className="text-[15px] font-semibold text-[var(--color-text)] tracking-tight">
          Generate a boss loadout tag
        </h3>
        <span className="text-[11px] text-[var(--color-text-muted)]">
          {boss ? `Selected: ${boss.name}` : `Click any boss · ${BOSSES.length} available`}
        </span>
      </div>
      <p className="text-[12.5px] text-[var(--color-text-dim)] leading-relaxed mb-4">
        Click a boss icon — we pull the best loadout from your bank and emit a Bank Tag string for RuneLite.
      </p>

      {/* Search */}
      <div className="relative mb-3 max-w-[280px]">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-[var(--color-text-muted)]" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search bosses…"
          className="w-full pl-8 pr-7 py-1.5 rounded-md text-[12px] bg-[var(--color-bg-2)] border border-[var(--color-border)] text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-accent)] focus:shadow-[0_0_0_3px_rgba(230, 165, 47,0.12)]"
        />
        {query && (
          <button
            onClick={() => setQuery("")}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--color-text-dim)] hover:text-[var(--color-text)]"
            title="Clear"
          >
            <X className="size-3" />
          </button>
        )}
      </div>

      {/* Boss icon grid grouped by category */}
      <div className="space-y-3 mb-4">
        {grouped.length === 0 ? (
          <div className="px-3 py-6 text-center text-[12px] text-[var(--color-text-muted)] border border-dashed border-[var(--color-border)] rounded-md">
            No bosses match &ldquo;{query}&rdquo;
          </div>
        ) : grouped.map((g) => (
          <div key={g.category}>
            <div className="text-[9.5px] uppercase tracking-[0.16em] font-semibold text-[var(--color-text-muted)] mb-1.5 px-1">
              {g.label} · {g.items.length}
            </div>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(44px,1fr))] gap-1.5">
              {g.items.map((b) => {
                const isSelected = b.slug === bossSlug;
                return (
                  <button
                    key={b.slug}
                    type="button"
                    onClick={() => setBossSlug(isSelected ? null : b.slug)}
                    aria-pressed={isSelected}
                    title={b.name + (b.notes ? ` — ${b.notes}` : "")}
                    className={cn(
                      "aspect-square rounded-md flex items-center justify-center relative",
                      "border transition-all",
                      isSelected
                        ? "border-[var(--color-accent)] bg-[var(--color-accent)]/12 shadow-[0_0_0_3px_rgba(230, 165, 47,0.18)] scale-[1.05] z-10"
                        : "border-[var(--color-border)] bg-[var(--color-bg-2)] hover:border-[var(--color-accent)]/40 hover:bg-[var(--color-panel-2)] hover:scale-[1.04]"
                    )}
                  >
                    <BossSprite boss={b} size={36} />
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Selected-boss loadout (collapsible — only renders when a boss is picked) */}
      {boss && best && (
        <div className="rounded-lg border border-[var(--color-accent)]/25 bg-[var(--color-accent)]/5 p-4 animate-[pop-in_0.18s_ease-out]">
          <div className="flex items-center gap-3 flex-wrap mb-3">
            <div className="size-9 shrink-0 rounded-md bg-[var(--color-bg-2)] border border-[var(--color-border)] flex items-center justify-center overflow-hidden">
              <BossSprite boss={boss} size={36} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[14px] font-semibold text-[var(--color-text)] leading-tight">{boss.name}</div>
              <div className="text-[11px] text-[var(--color-text-dim)] font-mono tabular-nums">
                {best.dps > 0 ? `${best.dps.toFixed(2)} DPS · ${best.style}` : "No usable gear in your bank"}
              </div>
            </div>
            <button
              onClick={onCopyBossTag}
              disabled={!tagString}
              className={cn(
                "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] font-medium transition-all",
                tagString
                  ? "bg-[var(--color-accent)] text-[#07090C] hover:brightness-110"
                  : "bg-[var(--color-panel-2)] text-[var(--color-text-muted)] cursor-not-allowed"
              )}
            >
              {copied === "boss-tag" ? <CheckCheck className="size-3.5" /> : <Copy className="size-3.5" />}
              {copied === "boss-tag" ? "Tag copied" : "Copy boss tag"}
            </button>
            <button
              type="button"
              onClick={() => setBossSlug(null)}
              className="text-[var(--color-text-muted)] hover:text-[var(--color-text)] size-7 rounded flex items-center justify-center"
              title="Close"
            >
              <X className="size-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-11 gap-1.5">
            {setupSlots.map(({ key, item }) => (
              <div
                key={key}
                className={cn(
                  "aspect-square rounded-md border flex items-center justify-center relative",
                  item
                    ? "border-[var(--color-border)] bg-[var(--color-bg-2)]"
                    : "border-dashed border-[var(--color-border)] bg-[var(--color-bg)]/50"
                )}
                title={item ? item.name : `${key} — missing`}
              >
                {item ? (
                  <img
                    src={ICON_URL(item.id)}
                    alt={item.name}
                    className="pixelated"
                    style={{ maxWidth: "78%", maxHeight: "78%", imageRendering: "pixelated", filter: "drop-shadow(1px 1px 0 rgb(0 0 0 / 0.9))" }}
                  />
                ) : (
                  <span className="text-[8.5px] uppercase tracking-wider text-[var(--color-text-muted)]">{key}</span>
                )}
              </div>
            ))}
          </div>

          <p className="mt-3 text-[10.5px] text-[var(--color-text-muted)]">
            {haveGearCount}/{setupSlots.length} slots filled from your bank · imports as a fresh tab in RuneLite Bank Tags.
          </p>
        </div>
      )}
    </section>
  );
}

