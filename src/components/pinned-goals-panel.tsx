"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { JournalItemSprite, JournalStatusMark } from "@/components/journal-primitives";
import {
  loadPinnedGoals,
  mergePinnedGoals,
  parsePinnedGoal,
  pinnedGoalProgress,
  removePinnedGoalLocally,
  replacePinnedGoalsLocally,
  type PinnedGoal,
  type PinnedGoalProgressEvidence
} from "@/lib/pinned-goals";
import { claimPinnedGoalCompletionNotice } from "@/lib/pinned-goal-orientation";

/**
 * The roster, and only the roster: what you are working toward and how close.
 *
 * Picking used to live here too — a "Find a goal" label, a 1,104px-wide search
 * input, "Nothing pinned…", "Closest for this account" and six tiles: five
 * announcements before the payload, with the tiles landing below the fold. All
 * of it moved into the goal line at the top of the answer (goal-bar.tsx), so a
 * player can state an intention without scrolling past the verdict first.
 *
 * The "Pinned — …" confirmation went with it. The goal line naming the goal is
 * the confirmation, at zero pixels; a notice is the page explaining what the
 * player can already see. It also rendered
 * .scape-verdict[data-gate="ready"] = #40FF00, a sixth text colour on a page
 * budgeted to five, in a state the budget spec never entered.
 */

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

export function PinnedGoalsPanel({
  rsn,
  evidence,
  canSync
}: {
  rsn: string;
  evidence: PinnedGoalProgressEvidence;
  canSync: boolean;
}) {
  const [goals, setGoals] = useState<PinnedGoal[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [completionNotice, setCompletionNotice] = useState<PinnedGoal | null>(null);
  const checkedCompletionSignature = useRef("");

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

  const rows = useMemo(
    () => goals.map((goal) => ({ goal, progress: pinnedGoalProgress(goal, evidence) })),
    [evidence, goals]
  );

  function removeGoal(goal: PinnedGoal): void {
    setGoals(removePinnedGoalLocally(rsn, goal.key));
    if (canSync) void deleteServerGoal(goal.key);
  }

  return (
    <section className="scape-section-rule" aria-labelledby="pinned-goals-title" data-pinned-goals="true">
      <h2 id="pinned-goals-title" className="scape-section-name">
        Your goals
      </h2>

      {completionNotice && (
        <p className="mt-3 text-[length:var(--text-body)] text-[var(--color-text)]" data-pinned-goal-complete={completionNotice.key}>
          <span className="scape-verdict" data-gate="ready">Goal complete</span>
          <span> — {completionNotice.target}.</span>
        </p>
      )}

      {loaded && rows.length > 0 ? (
        <ul className="mt-3">
          {rows.map(({ goal, progress }) => (
            <li key={goal.key} className="flex min-w-0 items-center gap-3 border-b border-[var(--color-border)] py-3 last:border-b-0">
              {goal.spriteItemId ? <JournalItemSprite id={goal.spriteItemId} /> : null}
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[length:var(--text-subject)] font-semibold text-[var(--color-text)]">
                  {goal.target}
                </span>
                {!progress.fraction && (
                  <span className="mt-1 block max-w-[65ch] text-[length:var(--text-micro)] leading-snug text-[var(--color-text-muted)]">
                    {progress.note}
                  </span>
                )}
              </span>
              {progress.fraction && (
                <span className="flex items-center gap-2 whitespace-nowrap tabular-nums text-[length:var(--text-subject)] font-normal text-[var(--color-data-level)]">
                  <JournalStatusMark done={progress.done} />
                  {progress.fraction}
                </span>
              )}
              <button
                type="button"
                className="min-h-11 shrink-0 px-1 text-[length:var(--text-micro)] text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
                onClick={() => removeGoal(goal)}
                aria-label={`Remove ${goal.target}`}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-[length:var(--text-body)] font-normal text-[var(--color-text-muted)]">
          Nothing pinned. The goal line at the top of the page pins one.
        </p>
      )}
    </section>
  );
}
