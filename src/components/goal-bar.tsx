"use client";

import { useRef, useState } from "react";
import { ItemSprite } from "@/components/item-sprite";
import { usePinnedGoals } from "@/components/use-pinned-goals";
import {
  createPinnedGoal,
  loadPinnedGoals,
  pinnedGoalBaselineFrom,
  pinnedGoalChoiceFromInput,
  pinnedGoalProgress,
  primaryPinnedGoal,
  replacePinnedGoalsLocally,
  searchPinnedGoalChoices,
  withPrimaryPinnedGoal,
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
 *
 * Onboarding step 1 (SPEC §3.1) is this line in its empty state: the question
 * above the fold, three suggestions one click away, and the trip already
 * rendered underneath so ignoring it costs nothing. It is deliberately not a
 * screen in front of the answer — tests/first-run-flow.test.ts holds the
 * name → answer path open, guarding a first-run setup screen this repo
 * already removed once.
 *
 * The disclosure is also deliberately not `open` on arrival. `open` is a DOM
 * property React keeps rewriting, so it fights the player's own toggling, and
 * goals load from localStorage in an effect — every returning player would get
 * the picker open for a frame and then snapped shut.
 */

async function saveServerGoal(goal: { key: string }): Promise<void> {
  await fetch("/api/account/goals", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ goal })
  }).catch(() => null);
}

/**
 * How far along, as ONE number.
 *
 * The percentage when there is a baseline behind it (§3.1), the raw fraction
 * otherwise — never both. "92/99" and "0%" side by side are two scales for one
 * meaning, and a second way to say the same thing is a bug in the design
 * system rather than a variant. They also read as contradicting each other on
 * the day a goal is pinned, which is the day the line matters most.
 */
function GoalProgressValue({ percent, fraction }: { percent: number | null; fraction: string | null }) {
  const value = percent === null ? fraction : `${Math.round(percent)}%`;
  if (!value) return null;
  return (
    <span
      data-goal-progress={percent === null ? "fraction" : "percent"}
      className="shrink-0 tabular-nums text-[length:var(--text-body)] font-normal text-[var(--color-data-level)]"
    >
      {value}
    </span>
  );
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

  // The primary goal, not goals[0]. The old read took the oldest pin by
  // accident of the sort order, so a goal set two months ago outranked the one
  // set this morning and the player had no way to say which they meant.
  const active = primaryPinnedGoal(goals);
  const progress = active ? pinnedGoalProgress(active, evidence) : null;
  const pinnedKeys = new Set(goals.map((goal) => goal.key));
  // Onboarding step 1 (§3.1) is this, and it is three rows rather than six.
  // A player with nothing pinned is being asked a question for the first time,
  // and a list long enough to need reading is a list that gets skipped. Once
  // they have a goal, the picker is a picker again and shows the full six.
  const suggestionLimit = active ? 6 : 3;
  const suggested = suggestions
    .map(pinnedGoalChoiceFromInput)
    .filter((choice): choice is PinnedGoalChoice => Boolean(choice && !pinnedKeys.has(choice.key)))
    .slice(0, suggestionLimit);
  const results = query.trim()
    ? searchPinnedGoalChoices(query).filter((choice) => !pinnedKeys.has(choice.key)).slice(0, 6)
    : suggested;

  function pinChoice(choice: PinnedGoalChoice): void {
    const now = new Date().toISOString();
    // The baseline is taken here or never. This is the only moment the page
    // knows what the account looked like when the player committed, and §3.1's
    // percentage is measured from exactly that.
    const goal = createPinnedGoal({
      ...choice.input,
      pinnedAt: now,
      baseline: pinnedGoalBaselineFrom(evidence, now),
      // Pinning from the goal line is the player naming what they are working
      // toward. That is the definition of the primary goal.
      isPrimary: true
    });
    if (!goal || pinnedKeys.has(goal.key)) return;
    replacePinnedGoalsLocally(rsn, withPrimaryPinnedGoal([...loadPinnedGoals(rsn), goal], goal.key));
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
            : "What are you working toward?"}
        </span>
        <GoalProgressValue percent={progress?.percent ?? null} fraction={progress?.fraction ?? null} />
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
