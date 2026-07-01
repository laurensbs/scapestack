"use client";

import { useState, useTransition, useMemo, useEffect } from "react";
import {
  Edit3, Check, Search, Target, Trophy, Filter, ChevronDown, ArrowRight, CheckCircle2, Circle, ExternalLink
} from "lucide-react";
import { Intake } from "@/components/intake";
import { ItemSprite } from "@/components/item-sprite";
import { BankContextActions } from "@/components/bank-context-actions";
import { ScapestackReadinessRail } from "@/components/scapestack-readiness-rail";
import { SupportCard } from "@/components/support-card";
import { organizeAction } from "@/app/actions";
import {
  GOAL_SETS, GOAL_CATEGORIES, checkCompletion, goalCategoryOrder,
  closestToComplete, overallStats, normaliseCompletion, iconForGoal,
  type SetCompletion, type GoalCategory
} from "@/lib/goals";
import { loadArchetype, type Archetype } from "@/lib/archetype";
import { hiscoresAction } from "@/app/actions";
import { cn, formatGp } from "@/lib/utils";
import { wikiSearchUrl } from "@/lib/wiki";
import { goalItemsWithHiscoreUnlocks } from "@/lib/goal-handoff";
import {
  bankHandoffItemsFromTabs,
  nextUpBankFromHandoff,
  persistBankHandoffPayload,
  readBankHandoffPayload,
  summarizeBankHandoff,
  type BankHandoffSummary
} from "@/lib/next-bank-handoff";

type CompletionFilter = "all" | "complete" | "incomplete";
const GOAL_CHECK_STORAGE_KEY = "scapestack:goals:manual-checks:v1";

export function GoalsClient() {
  const [view, setView] = useState<"intake" | "result">("intake");
  const [items, setItems] = useState<Array<{ id: number; name: string }>>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [bankSummary, setBankSummary] = useState<BankHandoffSummary | null>(null);
  const [loadedFromHandoff, setLoadedFromHandoff] = useState(false);
  const [loadedFromHiscoresOnly, setLoadedFromHiscoresOnly] = useState(false);
  const [activeRsn, setActiveRsn] = useState("");
  const [skipHandoff, setSkipHandoff] = useState(false);

  const [filter, setFilter] = useState<CompletionFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<GoalCategory | "all">("all");
  const [selectedSetId, setSelectedSetId] = useState<string | null>(null);
  const [manualChecks, setManualChecks] = useState<Set<string>>(() => new Set());
  // Archetype is read from localStorage (set by the bank page on first visit).
  // It only affects category *display order* on this page, not which goals
  // exist or count as completed.
  const [archetype, setArchetype] = useState<Archetype | null>(null);
  useEffect(() => { setArchetype(loadArchetype()); }, []);
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(GOAL_CHECK_STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      if (Array.isArray(parsed)) {
        setManualChecks(new Set(parsed.filter((item): item is string => typeof item === "string")));
      }
    } catch {
    }
  }, []);

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
          setBankSummary(null);
          setLoadedFromHandoff(false);
          setLoadedFromHiscoresOnly(true);
          setView("result");
        });
        return;
      }

      setBankSummary(summarizeBankHandoff(handoffItems));
      setLoadedFromHandoff(true);
      setLoadedFromHiscoresOnly(false);
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
      setBankSummary(summarizeBankHandoff(bankHandoffItemsFromTabs(bankRes.result.tabs)));
      setLoadedFromHandoff(false);
      setLoadedFromHiscoresOnly(false);
      // Merge in any skills at level 99 from hiscores as virtual cape items.
      // Dedupe by id so a player who has BOTH the cape and the 99 doesn't
      // double-count.
      setItems(goalItemsWithHiscoreUnlocks(flat, hiscores?.skills));
      setView("result");
    });
  };

  const completions = useMemo(() => checkCompletion(items), [items]);
  const closest = useMemo(() => closestToComplete(completions), [completions]);
  const stats = useMemo(() => overallStats(completions), [completions]);
  const spotlight = useMemo(() => {
    return closest.find((c) => {
      const set = GOAL_SETS.find((s) => s.id === c.setId);
      return set ? !normaliseCompletion(c, set).complete : false;
    }) ?? closest[0] ?? null;
  }, [closest]);
  const selectedCompletion = useMemo(() => {
    const targetSetId = selectedSetId ?? spotlight?.setId ?? null;
    if (!targetSetId) return null;
    const set = GOAL_SETS.find((s) => s.id === targetSetId);
    const completion = completions.find((c) => c.setId === targetSetId);
    return set && completion ? { set, completion } : null;
  }, [completions, selectedSetId, spotlight]);

  const toggleManualCheck = (key: string) => {
    setManualChecks((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      if (typeof window !== "undefined") {
        try {
          window.localStorage.setItem(GOAL_CHECK_STORAGE_KEY, JSON.stringify([...next]));
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
    if (filter === "complete") {
      list = list.filter(({ set, completion }) => normaliseCompletion(completion, set).complete);
    } else if (filter === "incomplete") {
      list = list.filter(({ set, completion }) => !normaliseCompletion(completion, set).complete);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(({ set }) =>
        set.name.toLowerCase().includes(q) ||
        set.goals.some((g) => g.name.toLowerCase().includes(q))
      );
    }
    return list;
  }, [setsWithCompletion, categoryFilter, filter, searchQuery]);

  // Category counts for chip badges
  const categoryCounts = useMemo(() => {
    const counts = new Map<GoalCategory, { done: number; total: number }>();
    for (const { set, completion } of setsWithCompletion) {
      const c = counts.get(set.category) || { done: 0, total: 0 };
      c.done += completion.completed;
      c.total += completion.total;
      counts.set(set.category, c);
    }
    return counts;
  }, [setsWithCompletion]);

  // ── Intake view ──
  if (view === "intake") {
    return (
      <>
        <div className="mb-6 grid sm:grid-cols-3 gap-3">
          <FeatureCard icon={Target}
            title={`${GOAL_SETS.length} goal sets`}
            body="Capes, Barrows, GWD, raids, diary rewards, skilling outfits — all the untradeables that mark progress." />
          <FeatureCard icon={Trophy}
            title="Auto-checked"
            body="Paste your bank — we tick every item we recognize. No manual checklist." />
          <FeatureCard icon={Search}
            title="Close-to-complete"
            body="Surfaces sets where you're 1-2 items away, so you know exactly what to chase next." />
        </div>
        <Intake onSubmit={run} loading={pending} error={error} askRsn />
      </>
    );
  }

  // ── Result view ──
  return (
    <div className="animate-[slide-up_0.35s_ease-out]">
      <section className="mb-4 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-baseline gap-3">
            <h2 className="font-serif text-[32px] font-bold leading-none text-[var(--color-text)]">Pick an unlock</h2>
            <span className="text-[13px] font-semibold text-[var(--color-text-muted)]">
              {stats.done}/{stats.total} done
            </span>
          </div>
          <div className="mt-3 h-2 w-[220px] overflow-hidden rounded-full bg-[var(--color-slot)]">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${stats.percent}%`,
                background: "linear-gradient(90deg, oklch(0.56 0.13 65), oklch(0.84 0.16 80))"
              }}
            />
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            setView("intake");
            setError(null);
            setSkipHandoff(true);
            setLoadedFromHiscoresOnly(false);
          }}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12.5px]",
            "bg-transparent border border-[var(--color-border)] text-[var(--color-text-dim)]",
            "hover:text-[var(--color-text)] hover:border-[var(--color-border-strong)] transition-colors"
          )}
        >
          <Edit3 className="size-3.5" /> Edit input
        </button>
      </section>

      {selectedCompletion && (
        <NextUnlockCompanion
          set={selectedCompletion.set}
          completion={selectedCompletion.completion}
          manualChecks={manualChecks}
          onToggleManualCheck={toggleManualCheck}
        />
      )}

      {closest.length > 0 && (
        <section className="mb-7 mt-5">
          <div className="mb-3 flex items-end justify-between gap-3">
            <div>
              <h2 className="font-serif text-[22px] font-bold text-[var(--color-text)]">Almost there</h2>
              <p className="mt-1 text-[12.5px] text-[var(--color-text-muted)]">
                Click a reward to see what is done, what counts through upgrades, and what is still missing.
              </p>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {closest.map((c) => {
              const set = GOAL_SETS.find((s) => s.id === c.setId)!;
              const norm = normaliseCompletion(c, set);
              const missingGoals = set.goals.filter((g) => !c.perGoal[g.id].satisfied);
              // For tiered sets, "next" = the very next tier up only.
              const nextGoals = norm.isTiered
                ? missingGoals.filter((g) => (g.tier ?? 0) === norm.progress + 1)
                : missingGoals.slice(0, 4);
              // Set-header icon: prefer the highest tier the user owns,
              // else fall back to a canonical icon for the set.
              const ownedTop = set.goals
                .filter((g) => c.perGoal[g.id]?.owned)
                .sort((a, b) => (b.tier ?? 0) - (a.tier ?? 0))[0];
              const headerIconId = ownedTop
                ? iconForGoal(ownedTop.id, c.perGoal[ownedTop.id])
                : set.iconItemId ?? iconForGoal(set.goals[set.goals.length - 1].id);
              return (
                <button
                  key={c.setId}
                  type="button"
                  onClick={() => setSelectedSetId(c.setId)}
                  aria-pressed={(selectedSetId ?? spotlight?.setId) === c.setId}
                  className={cn(
                    "group rounded-2xl border p-4 text-left transition-colors",
                    (selectedSetId ?? spotlight?.setId) === c.setId
                      ? "border-[var(--color-accent)] bg-[var(--color-accent)]/10"
                      : "border-[var(--color-border)] bg-[var(--color-panel)]/75 hover:border-[var(--color-accent)]/55"
                  )}
                >
                  <div className="mb-3 flex items-center gap-3">
                    {headerIconId ? (
                      <span className="flex size-12 shrink-0 items-center justify-center rounded-xl border border-[var(--color-border)] bg-black/25">
                        <ItemSprite id={headerIconId} alt="" size={36} className="pixelated shrink-0" />
                      </span>
                    ) : (
                      <span aria-hidden="true" className="size-3 rounded-full bg-[var(--color-text-muted)] inline-block" />
                    )}
                    <div className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] font-bold text-[var(--color-text)]">{set.name}</span>
                      <span className="mt-1 block text-[11px] font-semibold text-[var(--color-accent)]">
                        {norm.progress}/{norm.max} done
                      </span>
                    </div>
                    <ArrowRight className="size-4 text-[var(--color-text-muted)] transition-transform group-hover:translate-x-0.5 group-hover:text-[var(--color-accent)]" />
                  </div>
                  <div className="min-h-[34px]">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {nextGoals.map((g) => {
                        const iconId = iconForGoal(g.id, c.perGoal[g.id]);
                        return (
                          <div
                            key={g.id}
                            className="flex items-center gap-1 text-[11px] text-[var(--color-text-dim)]"
                            title={g.name}
                          >
                            {iconId && (
                              <ItemSprite
                                id={iconId}
                                alt=""
                                size={16}
                                className="pixelated shrink-0 opacity-70"
                              />
                            )}
                            <span className="truncate">{g.name}</span>
                          </div>
                        );
                      })}
                      {missingGoals.length > nextGoals.length && (
                        <span className="text-[10.5px] text-[var(--color-text-muted)]">
                          +{missingGoals.length - nextGoals.length} more
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      )}

      <details className="mb-6 rounded-xl border border-[var(--color-border)] bg-[var(--color-panel)]/45 p-4">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-[13px] font-bold text-[var(--color-text)] marker:hidden">
          <span>Make unlocks sharper</span>
          <span className="text-[11px] font-semibold text-[var(--color-text-muted)]">Bank, RSN, RuneLite</span>
        </summary>
        <div className="mt-4 space-y-4">
          <ScapestackReadinessRail
            surface="goals"
            hasBankContext={items.length > 0 && !loadedFromHiscoresOnly}
            hasRsn={Boolean(activeRsn)}
            rsn={activeRsn}
          />
          {bankSummary && (
            <GoalsBankContextBanner
              rsn={activeRsn}
              summary={bankSummary}
              loadedFromHandoff={loadedFromHandoff}
            />
          )}
          {loadedFromHiscoresOnly && activeRsn && (
            <GoalsHiscoreContextBanner rsn={activeRsn} />
          )}
        </div>
      </details>

      {/* Filters */}
      <section className="mb-5 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 max-w-[280px] min-w-[180px]">
          <label htmlFor="goals-search" className="sr-only">
            Search goals by item, set or category
          </label>
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-[var(--color-text-dim)]" />
          <input
            id="goals-search"
            name="goal"
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search goals…"
            autoComplete="off"
            spellCheck={false}
            aria-describedby="goals-search-help goals-search-status"
            className={cn(
              "w-full pl-8 pr-8 py-1.5 rounded-md text-[12px]",
              "bg-[var(--color-slot)] border border-[var(--color-border)]",
              "text-[var(--color-text)] placeholder:text-[var(--color-text-dim)]/60",
              "focus:outline-none focus:border-[var(--color-gold-soft)]"
            )}
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              aria-label="Clear goals search"
              className="absolute right-2 top-1/2 flex size-5 -translate-y-1/2 items-center justify-center rounded text-[var(--color-text-dim)] transition-colors hover:bg-[var(--color-panel)] hover:text-[var(--color-text)]"
            >
              ×
            </button>
          )}
        </div>
        <p id="goals-search-help" className="sr-only">
          Type a set, item or activity name to filter goal cards.
        </p>
        <p id="goals-search-status" role="status" aria-live="polite" className="sr-only">
          {searchQuery
            ? `${filteredSets.length} goal set${filteredSets.length === 1 ? "" : "s"} match ${searchQuery}.`
            : `${GOAL_SETS.length} goal sets available.`}
        </p>
        <CompletionFilterChips active={filter} onChange={setFilter} stats={stats} />
        <CategoryFilter active={categoryFilter} onChange={setCategoryFilter} counts={categoryCounts} />
      </section>

      {/* Goal sets grouped by category */}
      <section className="space-y-7">
        {GROUPS_BY_CATEGORY(filteredSets, archetype).map(({ category, sets }) => (
          <div key={category}>
            <h2 className="text-[11px] uppercase tracking-[0.18em] font-bold text-[var(--color-gold-soft)] mb-3">
              {GOAL_CATEGORIES[category].label}
            </h2>
            <div className="grid sm:grid-cols-2 gap-3">
              {sets.map(({ set, completion }) => (
                <GoalSetCard key={set.id} set={set} completion={completion} />
              ))}
            </div>
          </div>
        ))}
        {filteredSets.length === 0 && (
          <div className="rounded-xl p-12 text-center text-[var(--color-text-dim)] bg-[var(--color-panel)]/40 border border-[var(--color-border)]">
            No goal sets match this filter.
          </div>
        )}
      </section>

      <SupportCard context="Found your next untradeable goal?" />
    </div>
  );
}

// ── Card components ──

type GoalSetModel = typeof GOAL_SETS[0];
type GoalModel = GoalSetModel["goals"][0];

function manualGoalKey(setId: string, goalId: string): string {
  return `${setId}:${goalId}`;
}

function nextMissingGoals(set: GoalSetModel, completion: SetCompletion): GoalModel[] {
  const norm = normaliseCompletion(completion, set);
  const missing = set.goals.filter((goal) => !completion.perGoal[goal.id]?.satisfied);
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

function unlockNudge(set: GoalSetModel, completion: SetCompletion): string {
  const norm = normaliseCompletion(completion, set);
  const missing = nextMissingGoals(set, completion);
  if (norm.complete) return "This one is done. Pick another unlock.";
  if (norm.isTiered && norm.progress > 0 && missing[0]) {
    return `Go for ${missing[0].name}. Higher diary rewards count the lower tiers automatically.`;
  }
  if (set.id === "elite-void") {
    return "Elite Void upgrades the robe and top; normal Void pieces still matter for the full setup.";
  }
  if (missing.length === 1) return `${missing[0].name} is the clean next target.`;
  return "Work through the closest missing pieces first.";
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
      { title: "Stop", body: `Stop when ${target.name} is bought, then check whether the second elite piece is next.` }
    ];
  }
  if (set.id === "void-knight") {
    return [
      { title: "Start", body: "Buy the body, robe and gloves before treating Void as a PvM setup." },
      { title: "Then", body: `Pick up ${target.name}; helms only matter for the style you plan to use.` },
      { title: "Stop", body: "Stop after the missing piece and let /next decide whether Elite Void is worth it." }
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
      { title: "Stop", body: "Stop when the set changes so Scapestack can pick the next best unlock." }
    ];
  }
  return [
    { title: "Start", body: `Start with ${target.name}.` },
    { title: "Then", body: "Keep the session narrow: one unlock lane, not the whole collection log." },
    { title: "Stop", body: "Stop after one piece or one clear progress block." }
  ];
}

function NextUnlockCompanion({
  set,
  completion,
  manualChecks,
  onToggleManualCheck
}: {
  set: GoalSetModel;
  completion: SetCompletion;
  manualChecks: Set<string>;
  onToggleManualCheck: (key: string) => void;
}) {
  const norm = normaliseCompletion(completion, set);
  const missing = nextMissingGoals(set, completion);
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

  return (
    <section className="rounded-[20px] border-2 border-[var(--color-accent)]/45 bg-[#2b2418]/90 p-4 shadow-[0_24px_90px_-55px_rgba(0,0,0,0.95)] sm:p-5">
      <div className="grid gap-5 md:grid-cols-[170px_minmax(0,1fr)]">
        <div className="flex items-center justify-center rounded-2xl border border-[var(--color-accent)]/30 bg-black/25 p-5">
          {rewardIconId ? (
            <ItemSprite id={rewardIconId} alt="" size={104} className="pixelated" />
          ) : (
            <Target className="size-16 text-[var(--color-accent)]" />
          )}
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="eyebrow text-[var(--color-accent)]">Next unlock</p>
              <h3 className="mt-1 font-serif text-[30px] font-bold leading-tight text-[var(--color-text)] sm:text-[36px]">
                {set.name}
              </h3>
              <p className="mt-2 max-w-2xl text-[14px] font-semibold leading-relaxed text-[var(--color-text-dim)]">
                {unlockNudge(set, completion)}
              </p>
              <p className="mt-2 max-w-2xl text-[12.5px] leading-relaxed text-[var(--color-text-muted)]">
                <span className="font-bold text-[var(--color-accent)]">Why:</span>{" "}
                {whyThisUnlock(set, completion)}
              </p>
            </div>
            <span className="inline-flex items-center rounded-full border border-[var(--color-accent)]/35 bg-[var(--color-accent)]/10 px-3 py-1.5 text-[12px] font-bold text-[var(--color-accent)]">
              {norm.progress}/{norm.max}
            </span>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-[var(--color-border)] bg-black/15 p-3">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">Already got</p>
              <p className="mt-1 text-[13px] font-bold text-[var(--color-text)]">{ownedGoalLabel(set, completion)}</p>
            </div>
            <div className="rounded-xl border border-[var(--color-border)] bg-black/15 p-3">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">Next missing</p>
              <p className="mt-1 text-[13px] font-bold text-[var(--color-text)]">{missing[0]?.name ?? "Nothing missing"}</p>
            </div>
            <div className="rounded-xl border border-[var(--color-border)] bg-black/15 p-3">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">Counts through</p>
              <p className="mt-1 text-[13px] font-bold text-[var(--color-text)]">
                {completedViaUpgrade.length > 0 ? `${completedViaUpgrade.length} lower tier${completedViaUpgrade.length === 1 ? "" : "s"}` : "Direct items only"}
              </p>
            </div>
          </div>

          <div className="mt-4 rounded-xl border border-[var(--color-accent)]/25 bg-[var(--color-accent)]/8 p-3">
            <div className="mb-2 flex items-center justify-between gap-3">
              <p className="text-[12px] font-bold text-[var(--color-text)]">Do this next</p>
              <a
                href={wikiSearchUrl(guideTarget)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-accent)]/25 bg-black/15 px-2.5 py-1.5 text-[11px] font-bold text-[var(--color-accent)] transition-colors hover:bg-[var(--color-accent)]/10"
              >
                Wiki
                <ExternalLink className="size-3" />
              </a>
            </div>
            <div className="grid gap-2 sm:grid-cols-3">
              {planSteps.map((step) => (
                <div key={step.title} className="rounded-lg border border-[var(--color-border)]/60 bg-black/15 p-3">
                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--color-accent)]">{step.title}</p>
                  <p className="mt-1 text-[12.5px] font-semibold leading-relaxed text-[var(--color-text-dim)]">{step.body}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 rounded-xl border border-[var(--color-border)] bg-black/15 p-3">
            <div className="mb-2 flex items-center justify-between gap-3">
              <p className="text-[12px] font-bold text-[var(--color-text)]">Finish this</p>
              <p className="text-[11px] text-[var(--color-text-muted)]">Local checklist</p>
            </div>
            {missing.length > 0 ? (
              <div className="grid gap-2 sm:grid-cols-2">
                {missing.map((goal) => {
                  const key = manualGoalKey(set.id, goal.id);
                  const checked = manualChecks.has(key);
                  const iconId = iconForGoal(goal.id, completion.perGoal[goal.id]) ?? set.iconItemId;
                  return (
                    <button
                      key={goal.id}
                      type="button"
                      onClick={() => onToggleManualCheck(key)}
                      aria-pressed={checked}
                      className={cn(
                        "flex min-h-14 items-center gap-3 rounded-xl border px-3 py-2 text-left transition-colors",
                        checked
                          ? "border-[var(--color-accent)]/45 bg-[var(--color-accent)]/12 text-[var(--color-text)]"
                          : "border-[var(--color-border)] bg-[var(--color-bg)]/35 text-[var(--color-text-dim)] hover:border-[var(--color-accent)]/35"
                      )}
                    >
                      {checked ? <CheckCircle2 className="size-5 shrink-0 text-[var(--color-accent)]" /> : <Circle className="size-5 shrink-0" />}
                      {iconId && <ItemSprite id={iconId} alt="" size={28} className="pixelated shrink-0" />}
                      <span className="min-w-0">
                        <span className="block truncate text-[13px] font-bold">{goal.name}</span>
                        <span className="mt-0.5 block truncate text-[11px] opacity-75">
                          {sourceHintForGoal(set, goal)}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="flex items-center gap-2 rounded-xl border border-[var(--color-accent)]/30 bg-[var(--color-accent)]/10 px-3 py-3 text-[13px] font-bold text-[var(--color-text)]">
                <CheckCircle2 className="size-5 text-[var(--color-accent)]" />
                Done. Pick another unlock.
              </div>
            )}
          </div>

          {completedViaUpgrade.length > 0 && (
            <p className="mt-3 text-[12px] leading-relaxed text-[var(--color-text-muted)]">
              Higher-tier rewards already tick lower tiers. Example: Karamja gloves 4 counts gloves 1, 2 and 3.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

function FeatureCard({ icon: Icon, title, body }: { icon: React.ComponentType<{ className?: string }>; title: string; body: string }) {
  return (
    <div className={cn(
      "rounded-xl p-3.5 bg-gradient-to-br from-[var(--color-panel)] to-[var(--color-bg-2)]",
      "border border-[var(--color-border)]"
    )}>
      <Icon className="size-4 text-[var(--color-gold-soft)] mb-2" />
      <div className="text-[12.5px] font-semibold text-[var(--color-text)] mb-1">{title}</div>
      <p className="text-[11.5px] text-[var(--color-text-dim)] leading-relaxed">{body}</p>
    </div>
  );
}

function CompletionFilterChips({ active, onChange, stats }: {
  active: CompletionFilter;
  onChange: (f: CompletionFilter) => void;
  stats: { done: number; total: number };
}) {
  const options: Array<{ id: CompletionFilter; label: string; count: number }> = [
    { id: "all", label: "All", count: stats.total },
    { id: "complete", label: "Got", count: stats.done },
    { id: "incomplete", label: "Missing", count: stats.total - stats.done }
  ];
  return (
    <div className="flex items-center gap-1">
      {options.map((opt) => (
        <button
          key={opt.id}
          type="button"
          aria-pressed={active === opt.id}
          aria-label={`Show ${opt.label.toLowerCase()} goal sets (${opt.count})`}
          onClick={() => onChange(opt.id)}
          className={cn(
            "px-2.5 py-1.5 rounded-md text-[11.5px] font-medium transition-all border",
            active === opt.id
              ? "bg-gradient-to-b from-[oklch(0.4_0.06_60)] to-[oklch(0.28_0.04_55)] text-[var(--color-gold)] border-[var(--color-gold-deep)]/40"
              : "bg-[var(--color-slot)] text-[var(--color-text-dim)] border-[var(--color-border)] hover:text-[var(--color-text)]"
          )}
        >
          {opt.label}
          <span className="ml-1 opacity-60">{opt.count}</span>
        </button>
      ))}
    </div>
  );
}

function CategoryFilter({ active, onChange, counts }: {
  active: GoalCategory | "all";
  onChange: (c: GoalCategory | "all") => void;
  counts: Map<GoalCategory, { done: number; total: number }>;
}) {
  const [open, setOpen] = useState(false);
  const cats = Object.entries(GOAL_CATEGORIES)
    .sort(([, a], [, b]) => a.order - b.order) as Array<[GoalCategory, typeof GOAL_CATEGORIES[GoalCategory]]>;
  return (
    <div className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Filter goals by category"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11.5px] font-medium",
          "bg-[var(--color-slot)] border border-[var(--color-border)]",
          "text-[var(--color-text-dim)] hover:text-[var(--color-text)]"
        )}
      >
        <Filter className="size-3" />
        {active === "all" ? "All categories" : GOAL_CATEGORIES[active].label}
        <ChevronDown className={cn("size-3 transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-full mt-1 w-56 max-h-[60vh] overflow-y-auto rounded-lg bg-[var(--color-bg-2)] border border-[var(--color-border)] shadow-xl z-30 py-1 animate-[pop-in_0.15s_ease-out]">
          <button
            type="button"
            role="menuitemradio"
            aria-checked={active === "all"}
            onClick={() => { onChange("all"); setOpen(false); }}
            className={cn(
              "w-full text-left px-3 py-1.5 text-[12px] hover:bg-[var(--color-panel)]",
              active === "all" && "text-[var(--color-gold)]"
            )}
          >
            All categories
          </button>
          {cats.map(([cat, info]) => {
            const c = counts.get(cat) || { done: 0, total: 0 };
            return (
              <button
                key={cat}
                type="button"
                role="menuitemradio"
                aria-checked={active === cat}
                onClick={() => { onChange(cat); setOpen(false); }}
                className={cn(
                  "w-full flex items-center justify-between px-3 py-1.5 text-[12px] hover:bg-[var(--color-panel)]",
                  active === cat && "text-[var(--color-gold)]"
                )}
              >
                <span>{info.label}</span>
                <span className="text-[10px] text-[var(--color-text-dim)] tabular-nums">
                  {c.done}/{c.total}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function GoalSetCard({ set, completion }: { set: typeof GOAL_SETS[0]; completion: SetCompletion }) {
  const [expanded, setExpanded] = useState(false);
  const norm = normaliseCompletion(completion, set);
  const percent = Math.round((norm.progress / norm.max) * 100);
  const isComplete = norm.complete;
  // For tiered sets, find the highest-owned goal so we can use its icon.
  const highestOwnedGoal = norm.isTiered
    ? set.goals
        .filter((g) => completion.perGoal[g.id]?.owned)
        .sort((a, b) => (b.tier ?? 0) - (a.tier ?? 0))[0]
    : null;
  // Header icon priority:
  //   1. The actual item we matched in the player's bank (real ownership).
  //   2. Otherwise: the set's curated iconItemId (defined per set — chosen to
  //      represent the whole goal set rather than its alphabetically-last goal).
  //   3. Final fallback: the GOAL_ICON_IDS lookup for the last goal.
  const matchedGoal = set.goals.find((g) => completion.perGoal[g.id]?.matchedItemId);
  const headerIconId = highestOwnedGoal
    ? iconForGoal(highestOwnedGoal.id, completion.perGoal[highestOwnedGoal.id])
    : matchedGoal
      ? completion.perGoal[matchedGoal.id].matchedItemId
      : set.iconItemId ?? iconForGoal(set.goals[set.goals.length - 1].id);
  const panelId = `goal-set-panel-${set.id}`;

  return (
    <div className={cn(
      "rounded-xl border transition-colors",
      isComplete
        ? "bg-gradient-to-br from-[oklch(0.24_0.05_65/0.16)] to-[var(--color-bg-2)] border-[var(--color-good)]/40"
        : "bg-gradient-to-br from-[var(--color-panel)] to-[var(--color-bg-2)] border-[var(--color-border)] hover:border-[var(--color-border-strong)]"
    )}>
      <button
        type="button"
        aria-expanded={expanded}
        aria-controls={panelId}
        aria-label={`${expanded ? "Hide" : "Show"} ${set.name} goal details`}
        onClick={() => setExpanded((v) => !v)}
        className="w-full text-left p-3.5 flex items-start gap-3"
      >
        <div className="size-8 shrink-0 flex items-center justify-center bg-[var(--color-bg-2)] border border-[var(--color-border)] rounded-md">
          {headerIconId ? (
            <ItemSprite
              id={headerIconId}
              alt=""
              loading="lazy"
              className="pixelated pointer-events-none"
              style={{
                maxWidth: "24px",
                maxHeight: "24px",
                width: "auto",
                height: "auto"
              }}
            />
          ) : (
            <span aria-hidden="true" className="size-4 rounded-full bg-[var(--color-text-muted)] inline-block" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-[13px] font-semibold text-[var(--color-text)]">{set.name}</h3>
            {norm.isTiered && norm.earnedAny && !isComplete && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9.5px] font-bold uppercase tracking-wider bg-[oklch(0.32_0.05_65/0.3)] text-[var(--color-gold)]">
                Tier {norm.progress}/{norm.max}
              </span>
            )}
            {isComplete && (
              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-[oklch(0.32_0.05_65/0.3)] text-[var(--color-good)]">
                <Check className="size-2.5" /> Complete
              </span>
            )}
          </div>
          {set.description && (
            <p className="text-[11px] text-[var(--color-text-dim)] mt-0.5">{set.description}</p>
          )}
          <div className="mt-2 flex items-center gap-2">
            <div className="flex-1 h-1.5 rounded-full bg-[var(--color-slot)] overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${percent}%`,
                  background: isComplete
                    ? "var(--color-good)"
                    : "linear-gradient(90deg, oklch(0.56 0.13 65), oklch(0.84 0.16 80))"
                }}
              />
            </div>
            <span className="text-[11px] font-mono font-bold text-[var(--color-text)] tabular-nums">
              {norm.progress}/{norm.max}
            </span>
          </div>
        </div>
        <ChevronDown className={cn(
          "size-4 text-[var(--color-text-dim)] shrink-0 mt-1 transition-transform",
          expanded && "rotate-180"
        )} />
      </button>
      {expanded && (
        <div id={panelId} className="px-3.5 pb-3 grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-1.5 border-t border-[var(--color-border)]/40 pt-3">
          {set.goals.map((g) => {
            const state = completion.perGoal[g.id];
            const iconId = iconForGoal(g.id, state);
            const got = state.satisfied;
            const direct = state.owned;
            const supersededLabel = state.satisfiedBy
              ? set.goals.find((x) => x.id === state.satisfiedBy)?.name
              : undefined;
            return (
              <div
                key={g.id}
                title={
                  supersededLabel
                    ? `${g.name} — earned via ${supersededLabel}`
                    : g.notes || g.name
                }
                className={cn(
                  "relative flex flex-col items-center gap-1 p-1.5 rounded-md border",
                  direct && "bg-[oklch(0.32_0.05_65/0.10)] border-[var(--color-good)]/40",
                  !direct && got && "bg-[oklch(0.32_0.05_65/0.10)] border-[var(--color-gold-soft)]/30",
                  !got && "bg-[var(--color-slot)]/40 border-[var(--color-border)]/40"
                )}
              >
                {(iconId ?? set.iconItemId) ? (
                  <ItemSprite
                    id={(iconId ?? set.iconItemId)!}
                    alt={g.name}
                    loading="lazy"
                    className={cn(
                      "pixelated pointer-events-none",
                      !got && "opacity-30 grayscale"
                    )}
                    style={{
                      maxWidth: "32px",
                      maxHeight: "32px",
                      width: "auto",
                      height: "auto"
                    }}
                  />
                ) : (
                  <span aria-hidden="true" className={cn("size-4 rounded-full bg-[var(--color-text-muted)] inline-block", !got && "opacity-30")} />
                )}
                <span className={cn(
                  "text-[10px] text-center leading-tight truncate w-full px-0.5",
                  got ? "text-[var(--color-text)]" : "text-[var(--color-text-dim)]/70"
                )}>
                  {g.name}
                </span>
                {direct && (
                  <Check className="absolute top-0.5 right-0.5 size-3 text-[var(--color-good)] drop-shadow-[1px_1px_0_rgb(0_0_0)]" />
                )}
                {!direct && got && (
                  <span className="absolute top-0.5 right-0.5 size-3 rounded-full bg-[var(--color-gold-soft)] text-[8px] text-[oklch(0.15_0.02_50)] font-bold flex items-center justify-center" title={supersededLabel ? `via ${supersededLabel}` : "via upgrade"}>
                    ⤴
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function GoalsBankContextBanner({
  rsn,
  summary,
  loadedFromHandoff
}: {
  rsn?: string | null;
  summary: BankHandoffSummary;
  loadedFromHandoff: boolean;
}) {
  return (
    <section className="mb-6 rounded-xl border border-[var(--color-accent)]/30 bg-[var(--color-accent)]/8 px-4 py-3">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="flex min-w-0 gap-3">
          <span className="mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-lg border border-[var(--color-accent)]/25 bg-[var(--color-bg)]/40">
            <ItemSprite id={9813} alt="" size={25} />
          </span>
          <div className="min-w-0">
            <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--color-accent)]">
              {loadedFromHandoff ? "Bank added" : "Bank checked"}
            </div>
            <p className="mt-1 text-[12.5px] leading-relaxed text-[var(--color-text-dim)]">
              <span className="font-semibold text-[var(--color-text)]">{summary.label}</span>
              {" · "}
              Bank-owned untradeables are checked from item IDs; earned skill capes can come from Hiscores when an RSN is attached.
            </p>
            <p className="mt-1 text-[11.5px] leading-relaxed text-[var(--color-text-muted)]">
              RuneLite can help later when diary rewards, quest rewards or clog-only goals would change the route.
            </p>
            {summary.topItems.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {summary.topItems.map((item) => (
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
              </div>
            )}
          </div>
        </div>
        <BankContextActions source="goals" rsn={rsn} />
      </div>
    </section>
  );
}

function GoalsHiscoreContextBanner({ rsn }: { rsn: string }) {
  return (
    <section className="mb-6 rounded-xl border border-[var(--color-good)]/30 bg-[var(--color-good)]/8 px-4 py-3">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="flex min-w-0 gap-3">
          <span className="mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-lg border border-[var(--color-good)]/25 bg-[var(--color-bg)]/40">
            <ItemSprite id={9811} alt="" size={25} />
          </span>
          <div className="min-w-0">
            <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--color-good)]">
              Hiscores handoff loaded
            </div>
            <p className="mt-1 text-[12.5px] leading-relaxed text-[var(--color-text-dim)]">
              <span className="font-semibold text-[var(--color-text)]">{rsn}</span>
              {" · "}
              Skill-cape goals are inferred from public Hiscores. Paste a bank or sync RuneLite to add gear, diaries and untradeable item ownership.
            </p>
          </div>
        </div>
        <BankContextActions source="goals" rsn={rsn} hasBankContext={false} />
      </div>
    </section>
  );
}

// Group sets by category. Order is archetype-aware: a PvMer sees raid+GWD
// uniques up top; a skiller sees skill-outfits + capes first. Falls back to
// the default order from GOAL_CATEGORIES when archetype is null.
function GROUPS_BY_CATEGORY(
  list: Array<{ set: typeof GOAL_SETS[0]; completion: SetCompletion }>,
  archetype: Archetype | null
) {
  const groups = new Map<GoalCategory, typeof list>();
  for (const item of list) {
    if (!groups.has(item.set.category)) groups.set(item.set.category, []);
    groups.get(item.set.category)!.push(item);
  }
  const order = goalCategoryOrder(archetype);
  const rank: Record<string, number> = {};
  order.forEach((c, i) => { rank[c] = i; });
  return Array.from(groups.entries())
    .sort(([a], [b]) => (rank[a] ?? 999) - (rank[b] ?? 999))
    .map(([category, sets]) => ({ category, sets }));
}
