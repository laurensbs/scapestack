"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ItemSprite } from "@/components/item-sprite";
import { JournalItemSprite, JournalStatusMark } from "@/components/journal-primitives";
import {
  createPinnedGoal,
  loadPinnedGoals,
  mergePinnedGoals,
  parsePinnedGoal,
  pinGoalLocally,
  pinnedGoalChoiceFromInput,
  pinnedGoalProgress,
  removePinnedGoalLocally,
  replacePinnedGoalsLocally,
  searchPinnedGoalChoices,
  type NewPinnedGoal,
  type PinnedGoal,
  type PinnedGoalChoice,
  type PinnedGoalProgressEvidence
} from "@/lib/pinned-goals";
import { claimPinnedGoalCompletionNotice } from "@/lib/pinned-goal-orientation";

async function readServerGoals(): Promise<PinnedGoal[] | null> {
  const response = await fetch("/api/account/goals", { cache: "no-store" }).catch(() => null);
  if (!response?.ok) return null;
  const body = await response.json() as { goals?: unknown };
  if (!Array.isArray(body.goals)) return null;
  return body.goals.map(parsePinnedGoal).filter((goal): goal is PinnedGoal => goal !== null);
}

async function saveServerGoal(goal: PinnedGoal): Promise<void> {
  await fetch("/api/account/goals", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ goal })
  }).catch(() => null);
}

async function deleteServerGoal(key: string): Promise<void> {
  await fetch("/api/account/goals", {
    method: "DELETE",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ key })
  }).catch(() => null);
}

function GoalChoiceTile({ choice, onPin }: { choice: PinnedGoalChoice; onPin: (choice: PinnedGoalChoice) => void }) {
  return (
    <button
      type="button"
      className="group flex min-w-0 flex-col items-center gap-1.5 border border-[var(--color-border)] bg-transparent px-2 py-2 text-center transition-colors hover:border-[var(--color-border-strong)] hover:bg-[var(--color-surface)]"
      onClick={() => onPin(choice)}
      aria-label={`Pin ${choice.target}`}
      data-goal-choice={choice.key}
    >
      <span className="flex size-12 items-center justify-center overflow-hidden border border-[var(--color-border-strong)] bg-[var(--color-slot)]">
        {choice.spriteItemId ? (
          // 32px, not 52: chisel serves these at 16-30px native, and 52 was a
          // 3.25x non-integer upscale — the "empty box" look. 32 is an exact
          // 2x for the 16px sources and near-native for the rest.
          <ItemSprite id={choice.spriteItemId} alt="" size={32} className="pixelated" style={{ filter: undefined }} />
        ) : (
          <span aria-hidden="true" className="text-[length:var(--text-subject)] text-[var(--color-text-muted)]">?</span>
        )}
      </span>
      <span className="line-clamp-1 text-[length:var(--text-micro)] font-semibold leading-tight text-[var(--color-text)]">
        {choice.target}
      </span>
      <span className="text-[length:var(--text-label)] font-normal uppercase tracking-[0.1em] text-[var(--color-text-muted)]">
        {choice.kindLabel}
      </span>
    </button>
  );
}

export function PinnedGoalsPanel({
  rsn,
  evidence,
  canSync,
  suggestions = []
}: {
  rsn: string;
  evidence: PinnedGoalProgressEvidence;
  canSync: boolean;
  suggestions?: readonly NewPinnedGoal[];
}) {
  const [goals, setGoals] = useState<PinnedGoal[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [completionNotice, setCompletionNotice] = useState<PinnedGoal | null>(null);
  // One click re-renders the plan above and the routes below; without a
  // confirmation the page just teleports under the cursor. Same inline shape
  // as the completion notice, so no new surface and no new section.
  const [pinNotice, setPinNotice] = useState<PinnedGoal | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [query, setQuery] = useState("");
  const checkedCompletionSignature = useRef("");
  const searchRef = useRef<HTMLInputElement>(null);
  const addGoalRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    let active = true;
    const local = loadPinnedGoals(rsn);
    setGoals(local);
    setLoaded(true);
    if (!canSync) return () => { active = false; };

    void readServerGoals().then((server) => {
      if (!active || !server) return;
      const merged = mergePinnedGoals(local, server);
      replacePinnedGoalsLocally(rsn, merged);
      setGoals(merged);
      const serverKeys = new Set(server.map((goal) => goal.key));
      for (const goal of local) {
        if (!serverKeys.has(goal.key)) void saveServerGoal(goal);
      }
    });
    return () => { active = false; };
  }, [canSync, rsn]);

  useEffect(() => {
    if (!loaded) return;
    const signature = goals.map((goal) => `${goal.key}@${goal.pinnedAt}`).join("|");
    if (signature === checkedCompletionSignature.current) return;
    checkedCompletionSignature.current = signature;
    const completed = claimPinnedGoalCompletionNotice(localStorage, rsn, goals, evidence);
    if (completed) setCompletionNotice(completed);
  }, [evidence, goals, loaded, rsn]);

  const pinnedKeys = useMemo(() => new Set(goals.map((goal) => goal.key)), [goals]);
  const suggestedChoices = useMemo(() => suggestions
    .map(pinnedGoalChoiceFromInput)
    .filter((choice): choice is PinnedGoalChoice => Boolean(choice && !pinnedKeys.has(choice.key)))
    .slice(0, 6), [pinnedKeys, suggestions]);
  const searchResults = useMemo(() => searchPinnedGoalChoices(query)
    .filter((choice) => !pinnedKeys.has(choice.key)), [pinnedKeys, query]);
  const visibleChoices = query.trim() ? searchResults : suggestedChoices;
  const showPicker = loaded && (goals.length === 0 || pickerOpen);

  function openPicker(): void {
    setPickerOpen(true);
    requestAnimationFrame(() => searchRef.current?.focus());
  }

  function pinChoice(choice: PinnedGoalChoice): void {
    const goal = createPinnedGoal(choice.input);
    if (!goal || pinnedKeys.has(goal.key)) return;
    setGoals(pinGoalLocally(rsn, goal));
    setQuery("");
    setPickerOpen(false);
    setPinNotice(goal);
    // The picker unmounts on the same tick and takes the clicked button —
    // and the keyboard focus — with it. Hand focus to what replaces it.
    requestAnimationFrame(() => addGoalRef.current?.focus());
    if (canSync) void saveServerGoal(goal);
  }

  function removeGoal(goal: PinnedGoal): void {
    setGoals(removePinnedGoalLocally(rsn, goal.key));
    if (canSync) void deleteServerGoal(goal.key);
  }

  return (
    <section className="mt-3 border-y border-[var(--color-border)] py-3" aria-labelledby="pinned-goals-title" data-pinned-goals="true">
      <h2 id="pinned-goals-title" className="scape-section-name">
        Your goals
      </h2>

      {pinNotice && !completionNotice && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-y border-[var(--color-border)] py-3" data-pinned-goal-added={pinNotice.key}>
          <p className="text-[length:var(--text-body)] text-[var(--color-text)]">
            <span className="scape-verdict" data-gate="ready">Pinned</span>
            <span> — {pinNotice.target}. Tonight&apos;s plan is about this now.</span>
          </p>
          <button type="button" className="min-h-11 text-[length:var(--text-micro)] font-normal text-[var(--color-text-secondary)] underline underline-offset-4" onClick={() => setPinNotice(null)}>
            Dismiss
          </button>
        </div>
      )}

      {completionNotice && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-y border-[var(--color-border)] py-3" data-pinned-goal-complete={completionNotice.key}>
          <p className="text-[length:var(--text-body)] text-[var(--color-text)]">
            <span className="scape-verdict" data-gate="ready">Goal complete</span>
            <span> — {completionNotice.target}.</span>
          </p>
          <button type="button" className="min-h-11 text-[length:var(--text-micro)] font-normal text-[var(--color-text-secondary)] underline underline-offset-4" onClick={openPicker}>
            Pin next
          </button>
        </div>
      )}

      {loaded && goals.length > 0 ? (
        <>
          <ul className="mt-3">
            {goals.map((goal) => {
              const progress = pinnedGoalProgress(goal, evidence);
              return (
                <li key={goal.key} className="flex min-w-0 items-center gap-3 border-b border-[var(--color-border)] py-3 last:border-b-0">
                  {goal.spriteItemId ? <JournalItemSprite id={goal.spriteItemId} /> : null}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[length:var(--text-subject)] font-semibold text-[var(--color-text)]"
                    >
                      {goal.target}
                    </span>
                    {!progress.fraction && (
                      <span className="mt-1 block max-w-[65ch] text-[length:var(--text-micro)] leading-snug text-[var(--color-text-muted)]">{progress.note}</span>
                    )}
                  </span>
                  {progress.fraction && (
                    <span className="flex items-center gap-2 whitespace-nowrap tabular-nums text-[length:var(--text-subject)] font-normal text-[var(--color-data-level)]">
                      <JournalStatusMark done={progress.done} />
                      {progress.fraction}
                    </span>
                  )}
                  <button type="button" className="min-h-11 shrink-0 px-1 text-[length:var(--text-micro)] text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]" onClick={() => removeGoal(goal)} aria-label={`Remove ${goal.target}`}>
                    Remove
                  </button>
                </li>
              );
            })}
          </ul>
          {!showPicker && (
            <button ref={addGoalRef} type="button" className="mt-3 min-h-11 text-[length:var(--text-body)] text-[var(--color-text-secondary)] hover:underline" onClick={openPicker}>
              + Add goal
            </button>
          )}
        </>
      ) : null}

      {showPicker && (
        <div className="mt-4 border-t border-[var(--color-border)] pt-4" data-goal-picker="true">
          <div className="flex items-start justify-between gap-3">
            <label className="min-w-0 flex-1">
              <span className="block text-[length:var(--text-label)] font-normal uppercase tracking-[0.1em] text-[var(--color-text-muted)]">
                Find a goal
              </span>
              <input
                ref={searchRef}
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder='Try "barrows", "99 slay" or "fairy"'
                className="mt-2 min-h-11 w-full border border-[var(--color-border-strong)] bg-[var(--color-bg)] px-3 text-[length:var(--text-body)] font-normal text-[var(--color-text)] placeholder:text-[var(--color-text-muted)]"
              />
            </label>
            {goals.length > 0 && (
              <button type="button" className="min-h-11 px-1 text-[length:var(--text-micro)] text-[var(--color-text-muted)]" onClick={() => { setPickerOpen(false); setQuery(""); }}>
                Close
              </button>
            )}
          </div>

          {goals.length === 0 && !query.trim() && (
            <p className="mt-3 text-[length:var(--text-body)] text-[var(--color-text-dim)]">
              Nothing pinned. Pick one of the closest routes below, or search.
            </p>
          )}
          <p className="mt-3 tabular-nums text-[length:var(--text-label)] font-normal uppercase tracking-[0.1em] text-[var(--color-text-muted)]">
            {query.trim() ? `${visibleChoices.length} matches` : "Closest for this account"}
          </p>
          {visibleChoices.length > 0 ? (
            <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-6">
              {visibleChoices.map((choice) => <GoalChoiceTile key={choice.key} choice={choice} onPin={pinChoice} />)}
            </div>
          ) : (
            <p className="mt-3 text-[length:var(--text-body)] text-[var(--color-text-dim)]">
              No goals match that search.
            </p>
          )}
        </div>
      )}
    </section>
  );
}
