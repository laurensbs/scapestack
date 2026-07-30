"use client";

import { useMemo, useState, useTransition } from "react";
import { nextUpAction } from "@/app/actions";
import { PlayerPlanAnswer, PlayerPlanAlternatives, type PlayerPlanLine } from "@/components/player-plan-answer";
import { QuestCompletionQuestions } from "@/components/quest-completion-questions";
import { markAccountTrip } from "@/lib/account-storage";
import { pickForRoute } from "@/lib/mood";
import type { NextUpResult, Recommendation } from "@/lib/next-up";
import { buildNextUpInputFromSources } from "@/lib/planning-input";
import type { PlanningContextPayload } from "@/lib/planning-context";
import {
  buildRecommendationDecision,
  recommendationDecisionCopy,
  type RecommendationDecisionCopy
} from "@/lib/recommendation-decision";
import { recordRecommendationMemory } from "@/lib/recommendation-feedback";
import {
  loadQuestCompletionAnswers,
  saveQuestCompletionAnswer
} from "@/lib/quest-completion-answers";
import { recordTripEvent } from "@/lib/trip-timeline";

const PLAYER_MOOD = "unlock" as const;
const PLAYER_ROUTE = "smart" as const;
const PLAYER_MINUTES = 60 as const;

function planBringLine(
  rec: Recommendation,
  copy: RecommendationDecisionCopy,
  hasBank: boolean,
  accountMode: NextUpResult["summary"]["accountMode"]["type"]
): string {
  if (copy.requiredSetup.length > 0) return copy.requiredSetup.slice(0, 4).join(", ");
  if (accountMode === "ultimate") return "Stage the route items and teleport before starting; no bank access is assumed.";
  if (hasBank) return "Check the synced bank for route gear, supplies and teleports before leaving.";
  if (rec.kind === "quest" || rec.kind === "diary") return "Check required items and a teleport near the first step.";
  if (rec.kind === "boss" || rec.kind === "kc" || rec.kind === "slayer") {
    return "Check weapon, armour, food, potions and a teleport out.";
  }
  return "Check the method items, supplies and teleport before leaving.";
}

export function PlayerPlanPanel({
  rsn,
  initialContext
}: {
  rsn: string;
  initialContext: PlanningContextPayload;
}) {
  const [result, setResult] = useState<NextUpResult | null>(initialContext.initialPlan);
  const [selectedRecommendationId, setSelectedRecommendationId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const bankItems = initialContext.scapestackSync?.bankItems ?? [];
  const hasBank = bankItems.length > 0;
  const hasRuneLite = Boolean(initialContext.scapestackSync);
  const hasPublicStats = Boolean(initialContext.hiscores);
  const allRecs = useMemo(() => result
    ? result.headline
      ? [result.headline, ...result.rest]
      : result.rest
    : [], [result]);
  const basePick = useMemo(() => result ? pickForRoute(
    allRecs,
    PLAYER_MOOD,
    PLAYER_MINUTES,
    PLAYER_ROUTE,
    0,
    { honestyContext: { hasPublicStats, hasBank, hasRuneLite } }
  ) : null, [allRecs, hasBank, hasPublicStats, hasRuneLite, result]);
  const activeRec = selectedRecommendationId
    ? allRecs.find((rec) => rec.id === selectedRecommendationId) ?? basePick?.headline ?? null
    : basePick?.headline ?? null;
  const alternatives = activeRec && basePick
    ? [basePick.headline, ...basePick.alternatives]
        .filter((rec, index, list) => rec.id !== activeRec.id && list.findIndex((candidate) => candidate.id === rec.id) === index)
        .slice(0, 2)
    : [];
  const decision = activeRec && result
    ? buildRecommendationDecision({
        winner: activeRec,
        alternatives,
        mood: PLAYER_MOOD,
        routeFamily: PLAYER_ROUTE,
        minutes: PLAYER_MINUTES,
        accountStage: result.summary.accountStage.id,
        accountType: result.summary.accountType,
        hasPublicStats,
        hasBank,
        hasRuneLite
      })
    : null;
  const decisionCopy = decision
    ? recommendationDecisionCopy(decision, { hasBank, hasRuneLite })
    : null;
  const planLines: PlayerPlanLine[] = activeRec && decisionCopy && result
    ? [
        { label: "Start", value: decisionCopy.firstStep },
        { label: "Bring", value: planBringLine(activeRec, decisionCopy, hasBank, result.summary.accountMode.type) },
        { label: "Stop at", value: decisionCopy.stopPoint }
      ]
    : [];

  const answerQuest = (quest: string, completed: boolean) => {
    const answers = saveQuestCompletionAnswer(rsn, { quest, completed });
    const plannerInput = buildNextUpInputFromSources({
      rsn,
      hiscores: initialContext.hiscores,
      wom: initialContext.wom,
      collectionLogOwnedItemIds: initialContext.collectionLog?.ownedItemIds,
      scapestackSync: initialContext.scapestackSync,
      questCompletionAnswers: answers.length ? answers : loadQuestCompletionAnswers(rsn)
    });
    if (!plannerInput) return;
    setSelectedRecommendationId(null);
    startTransition(async () => setResult(await nextUpAction(plannerInput)));
  };

  const rememberStart = (rec: Recommendation) => {
    const event = {
      id: rec.id,
      kind: rec.kind,
      title: rec.title,
      action: "started" as const,
      mood: PLAYER_MOOD,
      routeLens: PLAYER_ROUTE,
      rsn,
      stopPoint: decisionCopy?.stopPoint ?? "Finish after one clear trip."
    };
    recordTripEvent(event);
    markAccountTrip(rsn, event);
    recordRecommendationMemory({
      id: rec.id,
      kind: rec.kind,
      title: rec.title,
      action: "started",
      mood: PLAYER_MOOD,
      routeLens: PLAYER_ROUTE,
      rsn,
      minutes: PLAYER_MINUTES
    });
  };

  if (!result || !activeRec || !decisionCopy) {
    return (
      <section className="border-y border-[var(--color-border)] py-5" data-player-plan-answer="empty">
        <p className="eyebrow">The answer</p>
        <p className="mt-2 text-[13px] text-[var(--color-text-dim)]">
          Scapestack could not build a safe trip from the public account data yet.
        </p>
      </section>
    );
  }

  return (
    <div className="min-w-0 max-w-full">
      {result.questQuestions.length > 0 && (
        <QuestCompletionQuestions
          questions={result.questQuestions}
          pending={pending}
          onAnswer={answerQuest}
        />
      )}
      <PlayerPlanAnswer
        rec={activeRec}
        decisionCopy={decisionCopy}
        planLines={planLines}
        actionContext={{ from: "next", hasBankContext: hasBank, rsn, accountType: result.summary.accountMode.type }}
        onStart={rememberStart}
      />
      <PlayerPlanAlternatives
        headline={activeRec}
        alternatives={alternatives}
        onSelect={(rec) => {
          setSelectedRecommendationId(rec.id);
          document.querySelector("[data-player-plan-answer='true']")?.scrollIntoView({ behavior: "smooth", block: "start" });
        }}
      />
    </div>
  );
}
