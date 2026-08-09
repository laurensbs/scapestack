"use client";

import { useRef, useState } from "react";
import { ItemSprite } from "@/components/item-sprite";
import { usePinnedGoals } from "@/components/use-pinned-goals";
import {
  createPinnedGoal,
  pinGoalLocally,
  pinnedGoalChoiceFromInput,
  pinnedGoalProgress,
  searchPinnedGoalChoices,
  type NewPinnedGoal,
  type PinnedGoalChoice,
  type PinnedGoalProgressEvidence
} from "@/lib/pinned-goals";

/**
 * The goal is the answer's first line, not a section further down.
 *
 * It replaced `<p class="eyebrow">Do this first</p>` — a label that told a
 * player nothing, since of course it is first, it is the top of the page.
 * Naming the goal there turns the answer from a generic verdict into the
 * consequence of something the player said, and it costs the same ~20px.
 *
 * The whole line is the control. A <details>, deliberately: it works with
 * JavaScript off, it is keyboard- and screen-reader-native without a scrap of
 * focus-management code, and — the reason that matters here — the page-budget
 * spec's expanded-height pass can see inside it. The React-state picker it
 * replaces was invisible to every gate in the repo.
 *
 * Six goals as ROWS, not a grid of squares: same row grammar as the goal
 * roster and the route steps, so the page speaks one row language instead of
 * three. Search goes last and small — a player who can see "95 Fletching" as a
 * row does not need to type it.
 */

async function saveServerGoal(goal: { key: string }): Promise<void> {
  await fetch("/api/account/goals", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ goal })
  }).catch(() => null);
}

function GoalChoiceRow({ choice, onPin }: { choice: PinnedGoalChoice; onPin: (choice: PinnedGoalChoice) => void }) {
  return (
    <button
      type="button"
      className="scape-goal-choice"
      onClick={() => onPin(choice)}
      aria-label={`Pin ${choice.target}`}
      data-goal-choice={choice.key}
    >
      <span className="scape-goal-choice__slot">
        {choice.spriteItemId
          ? <ItemSprite id={choice.spriteItemId} alt="" size={32} className="pixelated" />
          : <span aria-hidden="true" className="text-[length:var(--text-subject)] text-[var(--color-text-muted)]">?</span>}
      </span>
      <span className="min-w-0 flex-1 truncate text-left text-[length:var(--text-body)] font-normal text-[var(--color-text)]">
        {choice.target}
      </span>
      <span className="shrink-0 text-[length:var(--text-label)] font-normal uppercase tracking-[0.1em] text-[var(--color-text-muted)]">
        {choice.kindLabel}
      </span>
    </button>
  );
}

export function GoalBar({
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
  const goals = usePinnedGoals(rsn);
  const [query, setQuery] = useState("");
  const detailsRef = useRef<HTMLDetailsElement>(null);

  const active = goals[0] ?? null;
  const progress = active ? pinnedGoalProgress(active, evidence) : null;
  const pinnedKeys = new Set(goals.map((goal) => goal.key));
  const suggested = suggestions
    .map(pinnedGoalChoiceFromInput)
    .filter((choice): choice is PinnedGoalChoice => Boolean(choice && !pinnedKeys.has(choice.key)))
    .slice(0, 6);
  const results = query.trim()
    ? searchPinnedGoalChoices(query).filter((choice) => !pinnedKeys.has(choice.key)).slice(0, 6)
    : suggested;

  function pinChoice(choice: PinnedGoalChoice): void {
    const goal = createPinnedGoal(choice.input);
    if (!goal || pinnedKeys.has(goal.key)) return;
    pinGoalLocally(rsn, goal);
    setQuery("");
    // Closing the disclosure IS the confirmation: the line above it now reads
    // the goal's name and the answer under it re-renders. A "Pinned — …"
    // notice would be the page explaining what the player can already see.
    if (detailsRef.current) detailsRef.current.open = false;
    if (canSync) void saveServerGoal(goal);
  }

  return (
    <details ref={detailsRef} className="scape-goal-bar" data-goal-bar={active ? "pinned" : "empty"}>
      <summary className="scape-goal-bar__line">
        <span className="eyebrow shrink-0">Goal</span>
        <span className="min-w-0 flex-1 truncate text-[length:var(--text-body)] font-normal text-[var(--color-text)]">
          {active
            ? active.target
            : "Nothing pinned — tonight is just the nearest thing."}
        </span>
        {progress?.fraction && (
          <span className="shrink-0 tabular-nums text-[length:var(--text-body)] font-normal text-[var(--color-data-level)]">
            {progress.fraction}
          </span>
        )}
        <span className="scape-goal-bar__cue shrink-0">{active ? "Change" : "Pin a goal"}</span>
      </summary>

      <div className="scape-goal-bar__panel" data-goal-picker="true">
        {results.length > 0 ? (
          <div className="scape-goal-choices">
            {results.map((choice) => (
              <GoalChoiceRow key={choice.key} choice={choice} onPin={pinChoice} />
            ))}
          </div>
        ) : (
          <p className="text-[length:var(--text-body)] font-normal text-[var(--color-text-muted)]">
            Nothing matches {`"${query.trim()}"`}. Try a skill name, a boss, or an unlock.
          </p>
        )}
        <label className="mt-3 block max-w-[22rem]">
          <span className="sr-only text-[length:var(--text-micro)]">Search goals</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={`Try "barrows", "99 slay" or "fairy"`}
            className="scape-goal-bar__search"
          />
        </label>
      </div>
    </details>
  );
}
