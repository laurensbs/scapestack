"use client";

import { useEffect, useMemo, useState } from "react";
import { ItemSprite } from "@/components/item-sprite";
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

      {loaded && goals.length > 0 ? (
        <ul className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {goals.map((goal) => {
            const progress = pinnedGoalProgress(goal, evidence);
            return (
              <li key={goal.key} className="flex min-w-0 items-center gap-3 border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
                <span className="flex size-10 shrink-0 items-center justify-center overflow-hidden border border-[var(--color-border)] bg-[var(--color-bg)]">
                  {goal.spriteItemId
                    ? <ItemSprite id={goal.spriteItemId} alt="" size={32} />
                    : <span aria-hidden="true" className="text-[14px] text-[var(--color-text-muted)]">•</span>}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-semibold text-[var(--color-text)]">{goal.target}</span>
                  {progress.fraction ? (
                    <span className="mt-0.5 block tabular-nums text-[12px] text-[var(--color-text-dim)]">
                      {progress.fraction}{progress.done ? <span className="scape-verdict ml-2" data-gate="ready">Done</span> : null}
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

      <div className="mt-4 grid gap-3 border-t border-[var(--color-border)] pt-4 sm:grid-cols-[10rem_minmax(0,1fr)_auto] sm:items-end">
        <label className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--color-text-muted)]">
          Goal type
          <select aria-label="Goal type" className="mt-1 min-h-11 w-full border border-[var(--color-border)] bg-[var(--color-bg)] px-3 text-[13px] normal-case tracking-normal text-[var(--color-text)]" value={kind} onChange={(event) => setKind(event.target.value as PickerKind)}>
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
