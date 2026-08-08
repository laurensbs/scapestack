"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { nextUpAction } from "@/app/actions";
import { PlayerPlanAnswer, PlayerPlanAlternatives, type PlayerPlanLine } from "@/components/player-plan-answer";
import { QuestCompletionQuestions } from "@/components/quest-completion-questions";
import { usePinnedGoals } from "@/components/use-pinned-goals";
import { markAccountTrip } from "@/lib/account-storage";
import { pickForRoute } from "@/lib/mood";
import type { NextUpResult, Recommendation } from "@/lib/next-up";
import { buildNextUpInputFromSources } from "@/lib/planning-input";
import type { PlanningContextPayload } from "@/lib/planning-context";
import {
  activePinnedGoal,
  goalTripWhy,
  orderRecommendationsForGoal,
  recommendationMovesPinnedGoal,
  type PinnedGoalBossSource
} from "@/lib/pinned-goal-orientation";
import type { PinnedGoalProgressEvidence } from "@/lib/pinned-goals";
import {
  buildRecommendationDecision,
  recommendationDecisionCopy,
  type RecommendationDecisionCopy
} from "@/lib/recommendation-decision";
import {
  hidePlayerPlanRecommendation,
  loadRecommendationFeedback,
  recordRecommendationMemory,
  RECOMMENDATION_FEEDBACK_CHANGE_EVENT,
  type RecommendationFeedback
} from "@/lib/recommendation-feedback";
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
  initialContext,
  goalEvidence,
  goalBossSources
}: {
  rsn: string;
  initialContext: PlanningContextPayload;
  goalEvidence: PinnedGoalProgressEvidence;
  goalBossSources: readonly PinnedGoalBossSource[];
}) {
  const [result, setResult] = useState<NextUpResult | null>(initialContext.initialPlan);
  const [selectedRecommendationId, setSelectedRecommendationId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<RecommendationFeedback>(() => ({
    version: 1,
    suppressed: {},
    recent: []
  }));
  const [pending, startTransition] = useTransition();
  const bankItems = initialContext.scapestackSync?.bankItems ?? [];
  const hasBank = bankItems.length > 0;
  const hasRuneLite = Boolean(initialContext.scapestackSync);
  const hasPublicStats = Boolean(initialContext.hiscores);
  const pinnedGoals = usePinnedGoals(rsn);
  const activeGoal = useMemo(
    () => activePinnedGoal(pinnedGoals, goalEvidence),
    [goalEvidence, pinnedGoals]
  );
  const allRecs = useMemo(() => result
    ? result.headline
      ? [result.headline, ...result.rest]
      : result.rest
    : [], [result]);
  const visibleRecs = useMemo(
    () => allRecs.filter((rec) => !feedback.suppressed[rec.id]),
    [allRecs, feedback]
  );
  const goalMovingRecs = useMemo(
    () => activeGoal
      ? visibleRecs.filter((rec) => recommendationMovesPinnedGoal(rec, activeGoal, goalBossSources))
      : [],
    [activeGoal, goalBossSources, visibleRecs]
  );
  const candidateRecs = goalMovingRecs.length > 0 ? goalMovingRecs : visibleRecs;
  const preferredPick = useMemo(() => result ? pickForRoute(
    candidateRecs,
    PLAYER_MOOD,
    PLAYER_MINUTES,
    PLAYER_ROUTE,
    0,
    { honestyContext: { hasPublicStats, hasBank, hasRuneLite } }
  ) : null, [candidateRecs, hasBank, hasPublicStats, hasRuneLite, result]);
  const fallbackPick = useMemo(() => result && goalMovingRecs.length > 0 ? pickForRoute(
    visibleRecs,
    PLAYER_MOOD,
    PLAYER_MINUTES,
    PLAYER_ROUTE,
    0,
    { honestyContext: { hasPublicStats, hasBank, hasRuneLite } }
  ) : null, [goalMovingRecs.length, hasBank, hasPublicStats, hasRuneLite, result, visibleRecs]);
  const basePick = preferredPick ?? fallbackPick;
  const activeRec = selectedRecommendationId
    ? visibleRecs.find((rec) => rec.id === selectedRecommendationId) ?? basePick?.headline ?? null
    : basePick?.headline ?? null;
  const alternatives = activeRec && basePick
    ? orderRecommendationsForGoal(
        [basePick.headline, ...basePick.alternatives, ...visibleRecs],
        activeGoal,
        goalBossSources
      )
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
  const baseDecisionCopy = decision
    ? recommendationDecisionCopy(decision, { hasBank, hasRuneLite })
    : null;
  const decisionCopy = baseDecisionCopy && activeRec && activeGoal
    ? { ...baseDecisionCopy, why: goalTripWhy(activeRec, activeGoal, goalBossSources) }
    : baseDecisionCopy;
  const planLines: PlayerPlanLine[] = activeRec && decisionCopy && result
    ? [
        { label: "Start", value: decisionCopy.firstStep },
        { label: "Bring", value: planBringLine(activeRec, decisionCopy, hasBank, result.summary.accountMode.type) },
        { label: "Stop at", value: decisionCopy.stopPoint }
      ]
    : [];

  useEffect(() => {
    const refreshFeedback = () => setFeedback(loadRecommendationFeedback());
    refreshFeedback();
    window.addEventListener(RECOMMENDATION_FEEDBACK_CHANGE_EVENT, refreshFeedback);
    window.addEventListener("storage", refreshFeedback);
    return () => {
      window.removeEventListener(RECOMMENDATION_FEEDBACK_CHANGE_EVENT, refreshFeedback);
      window.removeEventListener("storage", refreshFeedback);
    };
  }, []);

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

  const hideAlternative = (rec: Recommendation) => {
    setFeedback(hidePlayerPlanRecommendation({
      recommendation: rec,
      mood: PLAYER_MOOD,
      routeLens: PLAYER_ROUTE,
      rsn,
      minutes: PLAYER_MINUTES
    }));
    setSelectedRecommendationId(null);
  };

  if (!result || !activeRec || !decisionCopy) {
    // Even with nothing to go on, the page answers — it does not become a
    // connect-wall. Say what would change the answer, in one line each.
    return (
      <section className="border-y border-[var(--color-border)] py-5" data-player-plan-answer="empty">
        <p className="eyebrow">Tonight</p>
        <p className="mt-2 max-w-[65ch] text-[length:var(--text-body)] font-normal text-[var(--color-text-dim)]">
          Scapestack could not build a safe trip from the public account data yet.
        </p>
        <p className="mt-1 max-w-[65ch] text-[length:var(--text-micro)] font-normal text-[var(--color-text-muted)]">
          Check the spelling of the name, or sync RuneLite once — quests, diaries and your bank turn a guess into a plan.
        </p>
      </section>
    );
  }

  // The answer is the page. The quiz refines it and sits BELOW it — a
  // returning player deciding whether to log in tonight reads the verdict
  // first and answers questions only if they care to sharpen it. The quiz
  // above the answer was a form as a front door.
  return (
    <section aria-label="Tonight" className="min-w-0 max-w-full">
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
        onHide={hideAlternative}
      />
      {result.questQuestions.length > 0 && (
        <QuestCompletionQuestions
          questions={result.questQuestions}
          pending={pending}
          onAnswer={answerQuest}
        />
      )}
    </section>
  );
}
