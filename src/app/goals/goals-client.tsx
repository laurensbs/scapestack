"use client";

import { useState, useTransition, useMemo, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  Edit3, Search, Target, ChevronDown, ArrowRight, CheckCircle2, Circle, ExternalLink, Compass
} from "lucide-react";
import { Intake } from "@/components/intake";
import { ItemSprite } from "@/components/item-sprite";
import { organizeAction } from "@/app/actions";
import {
  GOAL_SETS, GOAL_CATEGORIES, checkCompletion,
  goalCategoryOrder, normaliseCompletion, iconForGoal,
  type SetCompletion, type GoalCategory
} from "@/lib/goals";
import { loadArchetype, type Archetype } from "@/lib/archetype";
import { hiscoresAction } from "@/app/actions";
import { cn } from "@/lib/utils";
import { wikiSearchUrl } from "@/lib/wiki";
import { goalItemsWithHiscoreUnlocks } from "@/lib/goal-handoff";
import {
  goalManualChecksStorageKey,
  goalRouteHref,
  goalSelectionStorageKey,
  persistActiveGoalRoute
} from "@/lib/goal-companion";
import {
  nextUpBankFromHandoff,
  persistBankHandoffPayload,
  readBankHandoffPayload
} from "@/lib/next-bank-handoff";

export function GoalsClient() {
  const [view, setView] = useState<"intake" | "result">("intake");
  const [items, setItems] = useState<Array<{ id: number; name: string }>>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [activeRsn, setActiveRsn] = useState("");
  const [skipHandoff, setSkipHandoff] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<GoalCategory | "all">("all");
  const [browserOpen, setBrowserOpen] = useState(false);
  const [selectedSetId, setSelectedSetId] = useState<string | null>(null);
  const [openUnlockSetId, setOpenUnlockSetId] = useState<string | null>(null);
  const [manualChecks, setManualChecks] = useState<Set<string>>(() => new Set());
  // Archetype is read from localStorage (set by the bank page on first visit).
  // It only affects category *display order* on this page, not which goals
  // exist or count as completed.
  const [archetype, setArchetype] = useState<Archetype | null>(null);
  useEffect(() => { setArchetype(loadArchetype()); }, []);
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const rawChecks = window.localStorage.getItem(goalManualChecksStorageKey(activeRsn));
      const parsedChecks = rawChecks ? JSON.parse(rawChecks) : [];
      setManualChecks(new Set(
        Array.isArray(parsedChecks)
          ? parsedChecks.filter((item): item is string => typeof item === "string")
          : []
      ));
      const savedSelection = window.localStorage.getItem(goalSelectionStorageKey(activeRsn));
      setSelectedSetId(savedSelection && GOAL_SETS.some((set) => set.id === savedSelection) ? savedSelection : null);
    } catch {
      setManualChecks(new Set());
      setSelectedSetId(null);
    }
  }, [activeRsn]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (view !== "intake") return;
    if (skipHandoff) return;
    try {
      const params = new URLSearchParams(window.location.search);
      const paramRsn = params.get("rsn")?.trim() ?? "";
      const handoffItems = params.get("bank") === "none" ? [] : readBankHandoffPayload(window);
      if (paramRsn) setActiveRsn(paramRsn);
      if (handoffItems.length === 0) {
        if (!paramRsn) return;
        startTransition(async () => {
          const hiscores = await hiscoresAction(paramRsn);
          if (!hiscores) {
            setError(`Could not load Hiscores for "${paramRsn}". Paste a bank export or check the RSN.`);
            return;
          }
          setItems(goalItemsWithHiscoreUnlocks([], hiscores.skills));
          setView("result");
        });
        return;
      }

      if (paramRsn) {
        startTransition(async () => {
          const hiscores = await hiscoresAction(paramRsn);
          setItems(goalItemsWithHiscoreUnlocks(nextUpBankFromHandoff(handoffItems), hiscores?.skills));
          setView("result");
        });
      } else {
        setItems(nextUpBankFromHandoff(handoffItems));
        setView("result");
      }
    } catch {
      // Storage is best-effort; manual paste remains the fallback.
    }
  }, [skipHandoff, view]);

  const run = (input: string, _junkFilter: boolean, rsn: string) => {
    setError(null);
    setSkipHandoff(true);
    setActiveRsn(rsn.trim());
    startTransition(async () => {
      // Fetch bank + hiscores in parallel. The bank gives us tradeable
      // untradeables (capes, gear) we actually own; the hiscores give us
      // skill levels — every 99 mints a virtual skill-cape so the goal
      // tracker reflects what the player has *earned*, not just what's
      // sitting in the bank.
      const [bankRes, hiscores] = await Promise.all([
        organizeAction(input, { junkFilter: false, includePrices: false }),
        rsn.trim() ? hiscoresAction(rsn.trim()) : Promise.resolve(null)
      ]);
      if (bankRes.error || !bankRes.result) {
        setError(bankRes.error || "Failed to read bank");
        return;
      }
      const flat = bankRes.result.tabs.flatMap((t) =>
        t.items.map((it) => ({ id: it.id, name: it.name }))
      );
      try {
        persistBankHandoffPayload(bankRes.result.tabs, window);
      } catch {
        // Cross-tool handoff is best-effort; goals still has local state.
      }
      // Merge in any skills at level 99 from hiscores as virtual cape items.
      // Dedupe by id so a player who has BOTH the cape and the 99 doesn't
      // double-count.
      setItems(goalItemsWithHiscoreUnlocks(flat, hiscores?.skills));
      setView("result");
    });
  };

  const completions = useMemo(() => checkCompletion(items), [items]);
  const rankedUnlocks = useMemo(
    () => rankMeaningfulUnlocks(completions, archetype),
    [archetype, completions]
  );
  const spotlight = useMemo(() => {
    return rankedUnlocks[0] ?? null;
  }, [rankedUnlocks]);
  const selectedCompletion = useMemo(() => {
    const savedSet = selectedSetId ? GOAL_SETS.find((set) => set.id === selectedSetId) : null;
    const savedCompletion = selectedSetId ? completions.find((completion) => completion.setId === selectedSetId) : null;
    const savedStillOpen = savedSet && savedCompletion
      ? !normaliseCompletion(savedCompletion, savedSet).complete
      : false;
    const targetSetId = savedStillOpen ? selectedSetId : spotlight?.setId ?? null;
    if (!targetSetId) return null;
    const set = GOAL_SETS.find((s) => s.id === targetSetId);
    const completion = completions.find((c) => c.setId === targetSetId);
    return set && completion ? { set, completion } : null;
  }, [completions, selectedSetId, spotlight]);
  const openUnlockCompletion = useMemo(() => {
    if (!openUnlockSetId) return null;
    const set = GOAL_SETS.find((s) => s.id === openUnlockSetId);
    const completion = completions.find((c) => c.setId === openUnlockSetId);
    return set && completion ? { set, completion } : null;
  }, [completions, openUnlockSetId]);

  const toggleManualCheck = (key: string) => {
    setManualChecks((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      if (typeof window !== "undefined") {
        try {
          window.localStorage.setItem(goalManualChecksStorageKey(activeRsn), JSON.stringify([...next]));
        } catch {
        }
      }
      return next;
    });
  };

  const setsWithCompletion = useMemo(
    () => GOAL_SETS.map((set) => ({
      set,
      completion: completions.find((c) => c.setId === set.id)!
    })),
    [completions]
  );

  const filteredSets = useMemo(() => {
    let list = setsWithCompletion;
    if (categoryFilter !== "all") {
      list = list.filter(({ set }) => set.category === categoryFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(({ set }) =>
        set.name.toLowerCase().includes(q) ||
        set.goals.some((g) => g.name.toLowerCase().includes(q))
      );
    }
    return list.sort((a, b) => {
      const aRank = rankedUnlocks.findIndex((completion) => completion.setId === a.set.id);
      const bRank = rankedUnlocks.findIndex((completion) => completion.setId === b.set.id);
      return (aRank < 0 ? 999 : aRank) - (bRank < 0 ? 999 : bRank);
    });
  }, [setsWithCompletion, categoryFilter, searchQuery, rankedUnlocks]);

  const chooseUnlock = (setId: string, open = false) => {
    setSelectedSetId(setId);
    if (open) setOpenUnlockSetId(setId);
    if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem(goalSelectionStorageKey(activeRsn), setId);
      } catch {
      }
    }
  };

  // ── Intake view ──
  if (view === "intake") {
    return (
      <section className="mx-auto max-w-3xl">
        <div className="mb-5">
          <p className="eyebrow text-[var(--color-accent)]">Unlock companion</p>
          <h1 className="mt-2 font-serif text-[34px] font-bold leading-tight text-[var(--color-text)] sm:text-[46px]">
            What should you unlock next?
          </h1>
          <p className="mt-2 max-w-xl text-[14px] font-semibold leading-relaxed text-[var(--color-text-dim)]">
            Add your account once. Scapestack finds one useful reward and the next step toward it.
          </p>
        </div>
        <Intake onSubmit={run} loading={pending} error={error} askRsn />
      </section>
    );
  }

  // ── Result view ──
  return (
    <div className="animate-[slide-up_0.35s_ease-out]">
      <section className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="eyebrow text-[var(--color-accent)]">For {activeRsn || "this account"}</p>
          <h2 className="mt-1 font-serif text-[34px] font-bold leading-none text-[var(--color-text)]">Unlock this next</h2>
          <p className="mt-2 max-w-xl text-[13.5px] font-semibold leading-relaxed text-[var(--color-text-dim)]">
            One reward worth chasing now. Open it for the exact next step.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setView("intake");
            setError(null);
            setSkipHandoff(true);
          }}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12.5px]",
            "bg-transparent border border-[var(--color-border)] text-[var(--color-text-dim)]",
            "hover:text-[var(--color-text)] hover:border-[var(--color-border-strong)] transition-colors"
          )}
        >
          <Edit3 className="size-3.5" /> Change input
        </button>
      </section>

      {selectedCompletion && (
        <NextUnlockCompanion
          set={selectedCompletion.set}
          completion={selectedCompletion.completion}
          allCompletions={completions}
          manualChecks={manualChecks}
          onOpenSteps={() => setOpenUnlockSetId(selectedCompletion.set.id)}
        />
      )}

      <section className="mt-6 border-t border-[var(--color-border)] pt-5">
        <button
          type="button"
          onClick={() => setBrowserOpen((open) => !open)}
          aria-expanded={browserOpen}
          className="group flex min-h-14 w-full items-center justify-between gap-4 text-left"
        >
          <span>
            <span className="block font-serif text-[24px] font-bold text-[var(--color-text)]">Browse other unlocks</span>
            <span className="mt-0.5 block text-[12.5px] font-semibold text-[var(--color-text-muted)]">
              Quests, diaries, capes, outfits and useful grinds.
            </span>
          </span>
          <ChevronDown className={cn("size-5 shrink-0 text-[var(--color-accent)] transition-transform", browserOpen && "rotate-180")} />
        </button>

        {browserOpen && (
          <div className="mt-4 animate-[slide-up_0.25s_ease-out]">
            <div className="mb-4 grid gap-2 sm:grid-cols-[minmax(0,1fr)_220px]">
              <div className="relative">
                <label htmlFor="goals-search" className="sr-only">Search unlocks</label>
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--color-text-muted)]" />
                <input
                  id="goals-search"
                  name="goal"
                  type="search"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search a reward or activity"
                  autoComplete="off"
                  spellCheck={false}
                  aria-describedby="goals-search-status"
                  className="min-h-12 w-full rounded-xl border border-[var(--color-border)] bg-[#15120c] pl-10 pr-3 text-[13px] font-semibold text-[var(--color-text)] outline-none transition-colors placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-accent)]"
                />
              </div>
              <label className="sr-only" htmlFor="goal-category">Unlock type</label>
              <select
                id="goal-category"
                value={categoryFilter}
                onChange={(event) => setCategoryFilter(event.target.value as GoalCategory | "all")}
                className="min-h-12 rounded-xl border border-[var(--color-border)] bg-[#15120c] px-3 text-[13px] font-bold text-[var(--color-text)] outline-none focus:border-[var(--color-accent)]"
              >
                <option value="all">Every unlock type</option>
                {Object.entries(GOAL_CATEGORIES)
                  .sort(([, a], [, b]) => a.order - b.order)
                  .map(([category, info]) => <option key={category} value={category}>{info.label}</option>)}
              </select>
            </div>
            <p id="goals-search-status" role="status" aria-live="polite" className="sr-only">
              {filteredSets.length} unlocks shown.
            </p>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {filteredSets.map(({ set, completion }) => (
                <UnlockBrowserTile
                  key={set.id}
                  set={set}
                  completion={completion}
                  selected={(selectedSetId ?? spotlight?.setId) === set.id}
                  onSelect={() => chooseUnlock(set.id, true)}
                />
              ))}
            </div>
            {filteredSets.length === 0 && (
              <p className="py-10 text-center text-[13px] font-semibold text-[var(--color-text-muted)]">
                No unlock matches that search.
              </p>
            )}
          </div>
        )}
      </section>

      {openUnlockCompletion && (
        <GoalUnlockModal
          set={openUnlockCompletion.set}
          completion={openUnlockCompletion.completion}
          allCompletions={completions}
          manualChecks={manualChecks}
          onToggleManualCheck={toggleManualCheck}
          activeRsn={activeRsn}
          onClose={() => setOpenUnlockSetId(null)}
        />
      )}
    </div>
  );
}

// ── Card components ──

type GoalSetModel = typeof GOAL_SETS[0];
type GoalModel = GoalSetModel["goals"][0];

function manualGoalKey(setId: string, goalId: string): string {
  return `${setId}:${goalId}`;
}

function rankMeaningfulUnlocks(completions: SetCompletion[], archetype: Archetype | null): SetCompletion[] {
  const categoryRank = new Map(goalCategoryOrder(archetype).map((category, index) => [category, index]));
  return completions
    .map((completion) => {
      const set = GOAL_SETS.find((candidate) => candidate.id === completion.setId)!;
      const norm = normaliseCompletion(completion, set);
      return { completion, set, norm, missing: norm.max - norm.progress };
    })
    .filter(({ norm }) => !norm.complete)
    .sort((a, b) => {
      const aStarted = a.norm.progress > 0 ? 0 : 1;
      const bStarted = b.norm.progress > 0 ? 0 : 1;
      return aStarted - bStarted
        || a.missing - b.missing
        || (categoryRank.get(a.set.category) ?? 999) - (categoryRank.get(b.set.category) ?? 999)
        || a.set.name.localeCompare(b.set.name);
    })
    .map(({ completion }) => completion);
}

function nextMissingGoals(
  set: GoalSetModel,
  completion: SetCompletion,
  manualChecks: Set<string> = new Set()
): GoalModel[] {
  const norm = normaliseCompletion(completion, set);
  const missing = set.goals.filter((goal) =>
    !completion.perGoal[goal.id]?.satisfied && !manualChecks.has(manualGoalKey(set.id, goal.id))
  );
  if (!norm.isTiered) return missing.slice(0, 6);
  const nextTier = missing.filter((goal) => (goal.tier ?? 0) === norm.progress + 1);
  return (nextTier.length ? nextTier : missing).slice(0, 4);
}

function ownedGoalLabel(set: GoalSetModel, completion: SetCompletion): string {
  const norm = normaliseCompletion(completion, set);
  if (norm.complete) return "Finished";
  if (norm.isTiered && norm.progress > 0) {
    const owned = set.goals.find((goal) => goal.tier === norm.progress);
    return owned ? `You have ${owned.name}` : `Tier ${norm.progress}/${norm.max}`;
  }
  const owned = set.goals
    .filter((goal) => completion.perGoal[goal.id]?.satisfied)
    .slice(0, 2)
    .map((goal) => goal.name);
  if (owned.length > 0) return `You have ${owned.join(", ")}`;
  return "Nothing checked yet";
}

function whyThisUnlock(set: GoalSetModel, completion: SetCompletion): string {
  const norm = normaliseCompletion(completion, set);
  const missingCount = set.goals.filter((goal) => !completion.perGoal[goal.id]?.satisfied).length;
  if (norm.complete) return "You already finished this set, so it is only here for review.";
  if (norm.isTiered && norm.progress > 0) {
    return `You are already on tier ${norm.progress}. The next reward is a clean account upgrade, not a random checklist.`;
  }
  if (missingCount === 1) return "Only one piece is missing, so this is the fastest visible unlock.";
  if (set.category === "diary") return "Diary rewards unlock useful teleports and perks, and higher tiers cover the earlier rewards.";
  if (set.id === "void-knight" || set.id === "elite-void") return "Void is a real PvM unlock path: normal pieces first, elite upgrades after the diary gate.";
  if (set.category === "barrows") return "A near-complete Barrows set is worth finishing because the set effect only matters when all pieces are owned.";
  return "This is close enough that chasing it should feel better than browsing every possible unlock.";
}

function sourceHintForGoal(set: GoalSetModel, goal: GoalModel): string {
  const name = `${set.name} ${goal.name}`.toLowerCase();
  if (set.category === "diary") return "Claim from the diary NPC after finishing the next tier.";
  if (set.id === "void-knight") return "Buy with Pest Control points. Body, robe, gloves and helms make the set usable.";
  if (set.id === "elite-void") return "Needs the Void pieces plus the Western Provinces diary gate.";
  if (set.category === "barrows") return "Run Barrows and stop when this missing piece lands.";
  if (set.category === "gwd") return "Boss drop. Check whether your bank supports the trip before camping it.";
  if (set.category === "raid-uniques") return "Raid unique. Treat it as a long-term chase, not a quick checklist.";
  if (set.category === "wildy-bosses") return "Wilderness drop. Only chase it when you actually want a risk session.";
  if (set.category === "skill-outfits" || name.includes("graceful")) return "Earn with the activity currency, then re-check the set.";
  if (set.category === "capes") return goal.notes ?? "Earn the requirement, then claim or buy the cape.";
  return goal.notes ?? "Check the OSRS Wiki route before committing.";
}

function unlockRequirementLine(set: GoalSetModel, target: GoalModel): string {
  if (set.category === "diary") return `Open the ${target.name} task list for the exact skills, quests and items. Unknown tasks stay unticked until you confirm them.`;
  if (set.id === "elite-void") return "Bring the normal Void core and finish the Western Provinces diary requirement before buying the elite pieces.";
  if (set.id === "void-knight") return "Pest Control points buy the core pieces. Choose only the combat helm you plan to use first.";
  if (set.category === "barrows") return "Use your Barrows combat setup, prayer restore and chest route; the target is the missing set piece.";
  if (set.category === "gwd" || set.category === "raid-uniques" || set.category === "wildy-bosses") {
    return "Open Check kill before the grind. Your bank should decide gear, food and supplies for the first trip.";
  }
  if (set.category === "skill-outfits" || set.category === "graceful") return "Use the activity that awards this piece and stop when you can buy the next reward.";
  return sourceHintForGoal(set, target);
}

function unlockPlanSteps(set: GoalSetModel, completion: SetCompletion, missing: GoalModel[]): Array<{ title: string; body: string }> {
  const norm = normaliseCompletion(completion, set);
  const target = missing[0];
  if (!target) {
    return [
      { title: "Done", body: "Pick another unlock or use /next for tonight's trip." }
    ];
  }
  if (set.category === "diary") {
    return [
      { title: "Start", body: `Open the ${set.name.replace(/ (gloves|cloak|shield|legs|amulet|armour|sea boots|headgear|sword|banner)$/i, "")} diary and finish the next tier tasks.` },
      { title: "Claim", body: `Claim ${target.name}, then it will count the lower tiers automatically.` },
      { title: "Stop", body: "Re-open unlocks after the reward is in your bank or RuneLite sync sees it." }
    ];
  }
  if (set.id === "elite-void") {
    return [
      { title: "Start", body: "Check normal Void first: top, robe, gloves and the helm you actually use." },
      { title: "Then", body: "Finish the Western Provinces diary gate before spending more Pest Control points." },
      { title: "Stop", body: `Finish after ${target.name} is bought, then check whether the second elite piece is next.` }
    ];
  }
  if (set.id === "void-knight") {
    return [
      { title: "Start", body: "Buy the body, robe and gloves before treating Void as a PvM setup." },
      { title: "Then", body: `Pick up ${target.name}; helms only matter for the style you plan to use.` },
      { title: "Stop", body: "Finish after the missing piece and let your plan decide whether Elite Void is worth it." }
    ];
  }
  if (set.category === "barrows") {
    return [
      { title: "Start", body: `Run Barrows for ${target.name}; the set only turns on when all pieces are owned.` },
      { title: "Bring", body: "Use your normal Barrows teleports, prayer restore and loot route." },
      { title: "Stop", body: "Stop at the missing piece or when the session turns into dry streak misery." }
    ];
  }
  if (set.category === "gwd" || set.category === "raid-uniques" || set.category === "wildy-bosses") {
    return [
      { title: "Start", body: `Open Check kill before chasing ${target.name}. Gear decides if this is worth doing now.` },
      { title: "Then", body: "Do one short trip or raid block instead of committing to a huge grind blind." },
      { title: "Stop", body: "Stop after the block and re-check upgrades, supplies and the next unlock." }
    ];
  }
  if (norm.progress > 0 || missing.length <= 2) {
    return [
      { title: "Start", body: `Chase ${target.name} first; it is the cleanest missing piece.` },
      { title: "Then", body: missing[1] ? `After that, check ${missing[1].name}.` : "After that, re-check the set." },
      { title: "Stop", body: "Finish after the set changes so Scapestack can pick the next best unlock." }
    ];
  }
  return [
    { title: "Start", body: `Start with ${target.name}.` },
    { title: "Then", body: "Keep the session narrow: one unlock lane, not the whole collection log." },
    { title: "Stop", body: "Stop after one piece or one clear progress block." }
  ];
}

type UnlockIntel = {
  doNext: string;
  reward: string;
  watchOut: string;
  routeChips: string[];
};

function setCompletionById(allCompletions: SetCompletion[], setId: string) {
  const set = GOAL_SETS.find((candidate) => candidate.id === setId);
  const completion = allCompletions.find((candidate) => candidate.setId === setId);
  if (!set || !completion) return null;
  return { set, completion, norm: normaliseCompletion(completion, set) };
}

function voidPrereqLine(allCompletions: SetCompletion[]): string {
  const voidRoute = setCompletionById(allCompletions, "void-knight");
  if (!voidRoute) return "Check normal Void first: top, robe, gloves and the helm you actually use.";
  if (voidRoute.norm.complete) return "Normal Void is done. Elite pieces are the real upgrade now.";
  const missing = nextMissingGoals(voidRoute.set, voidRoute.completion)
    .slice(0, 3)
    .map((goal) => goal.name);
  return `Normal Void first: ${missing.join(", ")} still missing.`;
}

function diaryRewardLine(set: GoalSetModel, target?: GoalModel): string {
  if (set.id === "karamja-diary") {
    return target?.id === "karamja-4"
      ? "Karamja gloves 4 finishes the route and makes Duradel/gem-mine travel cleaner."
      : "Karamja gloves are useful because every higher tier keeps the lower tier perks.";
  }
  if (set.id === "ardougne-diary") return "Ardougne cloak is one of the best everyday teleport and pickpocket rewards.";
  if (set.id === "morytania-diary") return "Morytania legs improve Barrows, slime and region travel.";
  if (set.id === "falador-diary") return "Falador shield gives daily Prayer restore and region utility.";
  return "Diary rewards are permanent account utility, not one-off loot.";
}

function unlockIntel(set: GoalSetModel, completion: SetCompletion, allCompletions: SetCompletion[]): UnlockIntel {
  const norm = normaliseCompletion(completion, set);
  const missing = nextMissingGoals(set, completion);
  const target = missing[0];
  if (!target || norm.complete) {
    return {
      doNext: "Pick another unlock or run /next for a fresh trip.",
      reward: "This reward path is already finished.",
      watchOut: "Do not keep chasing a completed set unless you want collection log padding.",
      routeChips: ["Done", "Re-check plan", "Pick new lane"]
    };
  }
  if (set.id === "elite-void") {
    return {
      doNext: voidPrereqLine(allCompletions),
      reward: "Elite Void upgrades the ranged and magic body pieces for real PvM setups.",
      watchOut: "Do not spend more Pest Control points until the normal Void pieces and Western Provinces gate make sense.",
      routeChips: ["Normal Void", "Western diary", "Pest Control"]
    };
  }
  if (set.id === "void-knight") {
    return {
      doNext: "Buy body, robe and gloves before chasing every helm.",
      reward: "Normal Void becomes a usable setup once the core pieces are together.",
      watchOut: "Helms only matter for the style you are actually using.",
      routeChips: ["Core pieces", "Pick helm", "Then elite"]
    };
  }
  if (set.category === "diary") {
    return {
      doNext: `Open the diary tab and finish the tasks for ${target.name}.`,
      reward: diaryRewardLine(set, target),
      watchOut: "Claim the reward after the tier; RuneLite can then stop suggesting the lower steps.",
      routeChips: ["Diary tab", "Claim reward", "Sync after"]
    };
  }
  if (set.category === "barrows") {
    return {
      doNext: `Run Barrows for ${target.name}; stop when the missing piece lands.`,
      reward: "The set only gets interesting when the full effect is active.",
      watchOut: "Do not camp it forever if the plan was meant to be a short session.",
      routeChips: ["One set", "Chest loop", "Stop on piece"]
    };
  }
  if (set.category === "gwd" || set.category === "raid-uniques" || set.category === "wildy-bosses") {
    return {
      doNext: `Check whether your bank supports ${target.name} before committing a long grind.`,
      reward: "This is a real PvM chase, so gear and supplies decide whether it belongs today.",
      watchOut: "If Check kill says the setup is weak, unlock or upgrade first.",
      routeChips: ["Check kill", "One block", "Upgrade first"]
    };
  }
  if (set.category === "skill-outfits" || set.category === "graceful") {
    return {
      doNext: `Start the activity that buys ${target.name}.`,
      reward: "Outfit pieces compound over long skilling sessions.",
      watchOut: "Stop after the next piece; the best route can change quickly.",
      routeChips: ["Activity", "Currency", "Next piece"]
    };
  }
  return {
    doNext: `Go for ${target.name} first.`,
    reward: "This is the closest visible reward path from your current account state.",
    watchOut: "Keep it to one unlock lane so this does not become a collection-log browse.",
    routeChips: ["One lane", "One reward", "Re-check"]
  };
}

function NextUnlockCompanion({
  set,
  completion,
  allCompletions,
  manualChecks,
  onOpenSteps
}: {
  set: GoalSetModel;
  completion: SetCompletion;
  allCompletions: SetCompletion[];
  manualChecks: Set<string>;
  onOpenSteps: () => void;
}) {
  const missing = nextMissingGoals(set, completion, manualChecks);
  const ownedTop = set.goals
    .filter((goal) => completion.perGoal[goal.id]?.owned)
    .sort((a, b) => (b.tier ?? 0) - (a.tier ?? 0))[0];
  const rewardIconId = ownedTop
    ? iconForGoal(ownedTop.id, completion.perGoal[ownedTop.id])
    : missing[0]
      ? iconForGoal(missing[0].id, completion.perGoal[missing[0].id]) ?? set.iconItemId
      : set.iconItemId ?? iconForGoal(set.goals[set.goals.length - 1].id);
  const completedViaUpgrade = set.goals.filter((goal) => {
    const state = completion.perGoal[goal.id];
    return state?.satisfied && !state.owned && state.satisfiedBy;
  });
  const planSteps = unlockPlanSteps(set, completion, missing);
  const guideTarget = missing[0]?.name ?? set.name;
  const stopStep = planSteps.find((step) => step.title === "Stop" || step.title === "Done") ?? planSteps[planSteps.length - 1];
  const beforeLine = planSteps[0]?.body ?? `Start with ${guideTarget}.`;
  const finishLine = stopStep?.body ?? "Stop after one clear progress block.";
  const intel = unlockIntel(set, completion, allCompletions);

  return (
    <section className="scape-focus overflow-hidden">
      <div className="grid gap-5 p-4 sm:p-6 md:grid-cols-[112px_minmax(0,1fr)]">
        <div className="flex size-24 items-center justify-center self-start rounded-lg border border-[var(--color-accent)]/30 bg-black/30 sm:size-28">
          {rewardIconId ? (
            <ItemSprite id={rewardIconId} alt="" size={76} loading="eager" className="pixelated" />
          ) : (
            <Target className="size-9 text-[var(--color-accent)]" />
          )}
        </div>
        <div className="min-w-0">
          <p className="eyebrow text-[var(--color-accent)]">Best next unlock</p>
          <h3 className="mt-1 font-serif text-[30px] font-bold leading-tight text-[var(--color-text)] sm:text-[38px]">
            {guideTarget}
          </h3>
          <p className="mt-1 text-[12px] font-bold text-[var(--color-accent)]">{set.name}</p>
          <p className="mt-3 max-w-3xl text-[15px] font-semibold leading-relaxed text-[var(--color-text)]">
            {intel.doNext}
          </p>
          <p className="mt-2 max-w-3xl text-[13px] font-semibold leading-relaxed text-[var(--color-text-dim)]">
            {intel.reward}
          </p>

          <div className="mt-4 border-t border-[var(--color-border)] pt-4">
            <p className="text-[12.5px] font-semibold leading-relaxed text-[var(--color-text-dim)]">
              <span className="font-bold text-[var(--color-text)]">Start:</span> {beforeLine}
            </p>
            <p className="mt-1 text-[12.5px] font-semibold leading-relaxed text-[var(--color-text-dim)]">
              <span className="font-bold text-[var(--color-text)]">Stop:</span> {finishLine}
            </p>
            <button
              type="button"
              onClick={onOpenSteps}
              className="scape-primary-action mt-4 sm:w-auto"
            >
              See the route
              <ArrowRight className="size-3.5" />
            </button>
          </div>

          <details className="group mt-4 border-t border-[var(--color-border)] pt-3">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-[12px] font-bold text-[var(--color-text)] marker:hidden [&::-webkit-details-marker]:hidden">
              Why this unlock?
              <ChevronDown className="size-3.5 text-[var(--color-text-muted)] transition-transform group-open:rotate-180" />
            </summary>
            <div className="mt-3 space-y-2 text-[12.5px] leading-relaxed text-[var(--color-text-muted)]">
              <p>{whyThisUnlock(set, completion)}</p>
              <p><span className="font-bold text-[var(--color-text)]">You have:</span> {ownedGoalLabel(set, completion)}</p>
              {completedViaUpgrade.length > 0 && (
                <p>
                  <span className="font-bold text-[var(--color-accent)]">Counts through:</span>{" "}
                  {completedViaUpgrade.length} lower tier{completedViaUpgrade.length === 1 ? "" : "s"} already count because you own the better reward.
                </p>
              )}
            </div>
          </details>
        </div>
      </div>
    </section>
  );
}

function GoalUnlockModal({
  set,
  completion,
  allCompletions,
  manualChecks,
  onToggleManualCheck,
  activeRsn,
  onClose
}: {
  set: GoalSetModel;
  completion: SetCompletion;
  allCompletions: SetCompletion[];
  manualChecks: Set<string>;
  onToggleManualCheck: (key: string) => void;
  activeRsn: string;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [onClose]);

  if (typeof document === "undefined") return null;

  const missing = nextMissingGoals(set, completion, manualChecks);
  const target = missing[0] ?? set.goals[set.goals.length - 1];
  const rewardIconId = iconForGoal(target.id, completion.perGoal[target.id]) ?? set.iconItemId;
  const completedViaUpgrade = set.goals.filter((goal) => {
    const state = completion.perGoal[goal.id];
    return state?.satisfied && !state.owned && state.satisfiedBy;
  });
  const planSteps = unlockPlanSteps(set, completion, missing);
  const intel = unlockIntel(set, completion, allCompletions);
  const routeHref = goalRouteHref({ rsn: activeRsn, setId: set.id, targetName: target.name });

  const chooseAsRoute = () => {
    try {
      persistActiveGoalRoute(window.localStorage, activeRsn, {
        setId: set.id,
        setName: set.name,
        targetName: target.name
      });
    } catch {
    }
  };

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="goal-unlock-modal-title"
      className="fixed inset-0 z-[220] overflow-y-auto bg-black/78 px-3 py-5 backdrop-blur-sm sm:grid sm:place-items-center sm:px-5"
    >
      <button
        type="button"
        aria-label={`Close ${set.name} unlock steps`}
        aria-hidden="true"
        tabIndex={-1}
        onClick={onClose}
        className="fixed inset-0 cursor-default"
      />
      <section className="osrs-frame relative mx-auto w-full max-w-2xl overflow-hidden text-left shadow-[0_32px_90px_-22px_rgba(0,0,0,0.95)]">
        <header className="osrs-title-bar flex items-start justify-between gap-4 px-5 py-4 sm:px-6">
          <div className="flex min-w-0 gap-4">
            <span className="grid size-20 shrink-0 place-items-center rounded-xl border border-[var(--color-accent)]/35 bg-black/35">
              {rewardIconId ? (
                <ItemSprite id={rewardIconId} alt="" size={58} loading="eager" className="pixelated" />
              ) : (
                <Target className="size-10 text-[var(--color-accent)]" />
              )}
            </span>
            <div className="min-w-0">
              <p className="eyebrow text-[var(--color-accent)]">Your next unlock</p>
              <h2 id="goal-unlock-modal-title" className="mt-1 font-serif text-[28px] font-bold leading-tight text-[var(--color-text)] sm:text-[36px]">
                {target?.name ?? set.name}
              </h2>
              <p className="mt-1 text-[13px] font-semibold leading-relaxed text-[var(--color-text-muted)]">
                {set.name}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={`Close ${set.name} unlock steps`}
            className="inline-flex size-9 shrink-0 items-center justify-center rounded-full border border-[var(--color-border)] text-[var(--color-text-muted)] transition-colors hover:border-[var(--color-accent)]/55 hover:text-[var(--color-accent)]"
          >
            <span className="text-xl leading-none">×</span>
          </button>
        </header>

        <div className="osrs-body space-y-5 p-5 sm:p-6">
          <section>
            <p className="eyebrow text-[var(--color-accent)]">Why it matters</p>
            <p className="mt-2 text-[14px] font-semibold leading-relaxed text-[var(--color-text)]">{intel.reward}</p>
            <p className="mt-1 text-[12.5px] font-semibold leading-relaxed text-[var(--color-text-muted)]">{intel.watchOut}</p>
          </section>

          <section className="border-y border-[var(--color-border)] py-4">
            <p className="eyebrow text-[var(--color-accent)]">Do this</p>
            <ol className="mt-3 space-y-3">
              {planSteps.map((step, index) => (
                <li key={`${step.title}:${step.body}`} className="grid grid-cols-[28px_minmax(0,1fr)] gap-3">
                  <span className="flex size-7 items-center justify-center rounded-full border border-[var(--color-accent)]/40 bg-black/25 text-[11px] font-bold text-[var(--color-accent)]">{index + 1}</span>
                  <div>
                    <p className="text-[12px] font-bold text-[var(--color-text)]">{step.title}</p>
                    <p className="mt-0.5 text-[12.5px] font-semibold leading-relaxed text-[var(--color-text-dim)]">{step.body}</p>
                  </div>
                </li>
              ))}
            </ol>
            <p className="mt-4 text-[12px] font-semibold leading-relaxed text-[var(--color-text-muted)]">
              <span className="font-bold text-[var(--color-text)]">Before you start:</span> {unlockRequirementLine(set, target)}
            </p>
          </section>

          <section>
            <div className="flex flex-wrap items-end justify-between gap-2">
              <div>
                <p className="eyebrow text-[var(--color-accent)]">Reward path</p>
                <p className="mt-1 text-[12px] font-semibold text-[var(--color-text-muted)]">Tap only steps Scapestack cannot confirm yet. Saved for {activeRsn || "this device"}.</p>
              </div>
            </div>
            <div className="mt-3 space-y-2">
              {set.goals.map((goal) => {
                const state = completion.perGoal[goal.id];
                const key = manualGoalKey(set.id, goal.id);
                const manuallyChecked = manualChecks.has(key);
                const confirmed = state?.satisfied || manuallyChecked;
                const iconId = iconForGoal(goal.id, state) ?? set.iconItemId;
                const coveredBy = state?.satisfiedBy
                  ? set.goals.find((candidate) => candidate.id === state.satisfiedBy)?.name
                  : null;
                return (
                  <button
                    key={goal.id}
                    type="button"
                    disabled={Boolean(state?.satisfied)}
                    onClick={() => onToggleManualCheck(key)}
                    aria-pressed={confirmed}
                    className={cn(
                      "flex min-h-14 w-full items-center gap-3 rounded-xl border px-3 py-2 text-left transition-colors",
                      confirmed
                        ? "border-[var(--color-accent)]/35 bg-[var(--color-accent)]/10 text-[var(--color-text)]"
                        : "border-[var(--color-border)] bg-black/15 text-[var(--color-text-dim)] hover:border-[var(--color-accent)]/35"
                    )}
                  >
                    {confirmed ? <CheckCircle2 className="size-5 shrink-0 text-[var(--color-accent)]" /> : <Circle className="size-5 shrink-0" />}
                    {iconId && <ItemSprite id={iconId} alt="" size={30} className="pixelated shrink-0" />}
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13px] font-bold">{goal.name}</span>
                      <span className="mt-0.5 block text-[11px] font-semibold leading-snug text-[var(--color-text-muted)]">
                        {state?.owned
                          ? "Found on this account"
                          : coveredBy
                            ? `Covered by ${coveredBy}`
                            : manuallyChecked
                              ? "Marked done by you"
                              : "Not confirmed yet — tap when done"}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
            {completedViaUpgrade.length > 0 && (
              <p className="mt-2 text-[11.5px] font-semibold leading-relaxed text-[var(--color-text-muted)]">
                A higher-tier reward already covers the lower tiers.
              </p>
            )}
          </section>

          <div className="flex flex-col gap-2 sm:flex-row">
            <a
              href={routeHref}
              onClick={chooseAsRoute}
              className="btn-primary min-h-12 flex-1 justify-center px-4 text-[13px]"
            >
              Make this my route
              <ArrowRight className="size-3.5" />
            </a>
            <a
              href={wikiSearchUrl(target?.name ?? set.name)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-12 flex-1 items-center justify-center gap-1.5 rounded-lg border border-[var(--color-border)] px-4 text-[13px] font-bold text-[var(--color-text-dim)] transition-colors hover:border-[var(--color-accent)]/45 hover:text-[var(--color-text)]"
            >
              Open Wiki
              <ExternalLink className="size-3.5" />
            </a>
          </div>
        </div>
      </section>
    </div>,
    document.body
  );
}

function UnlockBrowserTile({
  set,
  completion,
  selected,
  onSelect
}: {
  set: GoalSetModel;
  completion: SetCompletion;
  selected: boolean;
  onSelect: () => void;
}) {
  const norm = normaliseCompletion(completion, set);
  const missing = nextMissingGoals(set, completion);
  const target = missing[0] ?? set.goals[set.goals.length - 1];
  const ownedTop = set.goals
    .filter((goal) => completion.perGoal[goal.id]?.owned)
    .sort((a, b) => (b.tier ?? 0) - (a.tier ?? 0))[0];
  const iconId = ownedTop
    ? iconForGoal(ownedTop.id, completion.perGoal[ownedTop.id])
    : iconForGoal(target.id, completion.perGoal[target.id]) ?? set.iconItemId;

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        "scape-route-choice group min-h-[164px] p-4 text-left",
        selected
          ? "border-[var(--color-accent)] bg-[#342613]"
          : "border-[var(--color-border)] bg-[#17130c]/80 hover:border-[var(--color-accent)]/55"
      )}
    >
      <span className="flex h-full gap-4">
        <span className="flex size-20 shrink-0 items-center justify-center rounded-lg border border-[var(--color-accent)]/25 bg-black/25">
          {iconId ? <ItemSprite id={iconId} alt="" size={56} className="pixelated" /> : <Compass className="size-8 text-[var(--color-accent)]" />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-start justify-between gap-2">
            <span className="font-serif text-[20px] font-bold leading-tight text-[var(--color-text)]">{set.name}</span>
            <ArrowRight className="mt-1 size-4 shrink-0 text-[var(--color-text-muted)] transition-transform group-hover:translate-x-0.5 group-hover:text-[var(--color-accent)]" />
          </span>
          <span className="mt-2 block text-[12px] font-bold leading-snug text-[var(--color-accent)]">
            {norm.complete ? "Finished on this account" : `Next: ${target.name}`}
          </span>
          <span className="mt-2 line-clamp-2 block text-[11.5px] font-semibold leading-relaxed text-[var(--color-text-muted)]">
            {norm.complete ? "Open it to review what already counts." : sourceHintForGoal(set, target)}
          </span>
        </span>
      </span>
    </button>
  );
}
