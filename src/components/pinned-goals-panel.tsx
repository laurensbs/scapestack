"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { JournalItemSprite, JournalStatusMark } from "@/components/journal-primitives";
import {
  ITEM_GOAL_CHOICES,
  LEVEL_GOAL_SKILLS,
  createPinnedGoal,
  loadPinnedGoals,
  mergePinnedGoals,
  parsePinnedGoal,
  pinGoalLocally,
  pinnedGoalProgress,
  removePinnedGoalLocally,
  replacePinnedGoalsLocally,
  type PinnedGoal,
  type PinnedGoalProgressEvidence
} from "@/lib/pinned-goals";
import { UNLOCK_GOAL_DEFINITIONS, type UnlockGoalId } from "@/lib/unlock-goal-catalog";
import { claimPinnedGoalCompletionNotice } from "@/lib/pinned-goal-orientation";

type PickerKind = PinnedGoal["kind"];

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
  const [kind, setKind] = useState<PickerKind>("item");
  const [itemGoalId, setItemGoalId] = useState(ITEM_GOAL_CHOICES[0]?.goalId ?? "");
  const [skill, setSkill] = useState(LEVEL_GOAL_SKILLS.includes("Slayer") ? "Slayer" : LEVEL_GOAL_SKILLS[0] ?? "Attack");
  const [targetLevel, setTargetLevel] = useState(99);
  const [unlockId, setUnlockId] = useState(UNLOCK_GOAL_DEFINITIONS[0]?.id ?? "");

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

  const chosen = useMemo(() => {
    if (kind === "item") return createPinnedGoal({ kind, goalId: itemGoalId });
    if (kind === "level") return createPinnedGoal({ kind, skill, targetLevel });
    return createPinnedGoal({ kind, unlockId });
  }, [itemGoalId, kind, skill, targetLevel, unlockId]);
  const alreadyPinned = Boolean(chosen && goals.some((goal) => goal.key === chosen.key));

  function pinChosen(): void {
    if (!chosen || alreadyPinned) return;
    const saved = pinGoalLocally(rsn, chosen);
    setGoals(saved);
    if (canSync) void saveServerGoal(chosen);
  }

  function removeGoal(goal: PinnedGoal): void {
    setGoals(removePinnedGoalLocally(rsn, goal.key));
    if (canSync) void deleteServerGoal(goal.key);
  }

  return (
    <section className="mt-5 border-y border-[var(--color-border)] py-5" aria-labelledby="pinned-goals-title" data-pinned-goals="true">
      <p className="eyebrow">Your goals</p>
      <h2 id="pinned-goals-title" className="mt-1 text-2xl font-semibold text-[var(--color-text)]">
        What are you working toward?
      </h2>

      {completionNotice && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-y border-[var(--color-border)] py-3" data-pinned-goal-complete={completionNotice.key}>
          <p className="text-[13px] text-[var(--color-text)]">
            <span className="scape-verdict" data-gate="ready">Goal complete</span>
            <span> — {completionNotice.target}.</span>
          </p>
          <button
            type="button"
            className="btn-ghost min-h-11 px-3 text-[12px] font-bold"
            onClick={() => document.getElementById("pinned-goal-kind")?.focus()}
          >
            Pin next
          </button>
        </div>
      )}

      {loaded && goals.length > 0 ? (
        <ul className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {goals.map((goal) => {
            const progress = pinnedGoalProgress(goal, evidence);
            return (
              <li key={goal.key} className="flex min-w-0 items-center gap-3 border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
                {goal.spriteItemId ? <JournalItemSprite id={goal.spriteItemId} /> : null}
                <span className="min-w-0 flex-1">
                  <span className={goal.kind === "item"
                    ? "block truncate text-[13px] font-semibold text-[var(--color-data-item)]"
                    : "block truncate text-[13px] font-semibold text-[var(--color-text)]"}
                  >
                    {goal.target}
                  </span>
                  {progress.fraction ? (
                    <span className="mt-1 flex items-center gap-2 tabular-nums text-[12px] text-[var(--color-text-dim)]">
                      <JournalStatusMark done={progress.done} />
                      {progress.fraction}
                    </span>
                  ) : (
                    <span className="mt-0.5 block text-[11.5px] leading-snug text-[var(--color-text-muted)]">{progress.note}</span>
                  )}
                </span>
                <button type="button" className="btn-ghost min-h-9 shrink-0 px-2 text-[11px]" onClick={() => removeGoal(goal)} aria-label={`Remove ${goal.target}`}>
                  Remove
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mt-3 text-[13px] text-[var(--color-text-dim)]">
          Nothing pinned. Choose an item, level or unlock below.
        </p>
      )}

      <div id="pinned-goal-picker" className="mt-4 grid gap-3 border-t border-[var(--color-border)] pt-4 sm:grid-cols-[10rem_minmax(0,1fr)_auto] sm:items-end">
        <label className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--color-text-muted)]">
          Goal type
          <select id="pinned-goal-kind" aria-label="Goal type" className="mt-1 min-h-11 w-full border border-[var(--color-border)] bg-[var(--color-bg)] px-3 text-[13px] normal-case tracking-normal text-[var(--color-text)]" value={kind} onChange={(event) => setKind(event.target.value as PickerKind)}>
            <option value="item">Item</option>
            <option value="level">Level</option>
            <option value="unlock">Unlock</option>
          </select>
        </label>

        {kind === "item" ? (
          <label className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--color-text-muted)]">
            Item
            <select aria-label="Item" className="mt-1 min-h-11 w-full border border-[var(--color-border)] bg-[var(--color-bg)] px-3 text-[13px] normal-case tracking-normal text-[var(--color-text)]" value={itemGoalId} onChange={(event) => setItemGoalId(event.target.value)}>
              {ITEM_GOAL_CHOICES.map((choice) => <option key={choice.goalId} value={choice.goalId}>{choice.target} · {choice.group}</option>)}
            </select>
          </label>
        ) : kind === "level" ? (
          <div className="grid grid-cols-[minmax(0,1fr)_6rem] gap-2">
            <label className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--color-text-muted)]">
              Skill
              <select aria-label="Skill" className="mt-1 min-h-11 w-full border border-[var(--color-border)] bg-[var(--color-bg)] px-3 text-[13px] normal-case tracking-normal text-[var(--color-text)]" value={skill} onChange={(event) => setSkill(event.target.value)}>
                {LEVEL_GOAL_SKILLS.map((name) => <option key={name} value={name}>{name}</option>)}
              </select>
            </label>
            <label className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--color-text-muted)]">
              Level
              <input aria-label="Level" className="mt-1 min-h-11 w-full border border-[var(--color-border)] bg-[var(--color-bg)] px-3 text-[13px] normal-case tracking-normal text-[var(--color-text)]" type="number" min={2} max={99} value={targetLevel} onChange={(event) => setTargetLevel(Number(event.target.value))} />
            </label>
          </div>
        ) : (
          <label className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--color-text-muted)]">
            Unlock
            <select aria-label="Unlock" className="mt-1 min-h-11 w-full border border-[var(--color-border)] bg-[var(--color-bg)] px-3 text-[13px] normal-case tracking-normal text-[var(--color-text)]" value={unlockId} onChange={(event) => setUnlockId(event.target.value as UnlockGoalId)}>
              {UNLOCK_GOAL_DEFINITIONS.map((choice) => <option key={choice.id} value={choice.id}>{choice.title}</option>)}
            </select>
          </label>
        )}

        <button type="button" className="btn-primary min-h-11 px-4 text-[12.5px] font-bold disabled:cursor-not-allowed disabled:opacity-50" disabled={!chosen || alreadyPinned} onClick={pinChosen}>
          {alreadyPinned ? "Pinned" : "Pin goal"}
        </button>
      </div>
    </section>
  );
}
