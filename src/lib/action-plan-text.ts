import type { Recommendation } from "./next-up";
import {
  primaryActionForRecommendation,
  type RecommendationActionContext
} from "./recommendation-action";
import { missingDataActionForRecommendation } from "./recommendation-data-action";
import { brandUrl } from "./brand";

function shareableHref(href: string): string {
  return href.startsWith("/") ? brandUrl(href) : href;
}

function sessionChoiceLabel(rec: Recommendation): string {
  if (rec.kind === "money") return "GP";
  if (rec.kind === "boss" || rec.kind === "kc") return "Bossing";
  if (rec.kind === "slayer") return "Slayer";
  if (rec.kind === "skill") return "AFK";
  if (rec.kind === "bank" || rec.kind === "minigame") return "Chill";
  return "Unlock";
}

export function formatRecommendationActionPlan(
  rec: Recommendation,
  context: RecommendationActionContext = {}
): string {
  const plan = rec.actionPlan;
  if (!plan) return `${rec.title}\n\n${rec.why}`;
  const primaryAction = primaryActionForRecommendation(rec, context);
  const dataAction = missingDataActionForRecommendation(rec, context);
  const actionHref = primaryAction.href
    ? `${primaryAction.label}: ${shareableHref(primaryAction.href)}`
    : null;
  const dataActionHref = dataAction?.href
    ? `${dataAction.label}: ${shareableHref(dataAction.href)}`
    : null;

  const lines = [
    rec.title,
    "",
    `Goal: ${rec.title}`,
    `Why: ${rec.decisionReason ?? rec.why}`,
    rec.payoff ? `Unlock/payoff: ${rec.payoff}` : null,
    `Time: ${plan.timebox}`,
    "",
    `Gear/supplies: ${plan.prep}`,
    "",
    ...plan.steps.map((step, index) => `${index + 1}. ${step}`),
    actionHref ? "" : null,
    actionHref,
    plan.caveat ? "" : null,
    plan.caveat ? `Watch out: ${plan.caveat}` : null,
    dataAction ? `Optional: ${dataAction.label} — ${dataAction.helper}` : null,
    dataActionHref
  ].filter((line): line is string => line !== null);

  return lines.join("\n");
}

export function formatRecommendationSessionPlan(
  recs: Recommendation[],
  context: RecommendationActionContext = {},
  limit = 3
): string {
  const planned = recs.slice(0, limit);
  if (planned.length === 0) return "Scapestack anti-bankstanding plan\n\nNo plan available yet.";

  const lines = [
    "Scapestack anti-bankstanding plan",
    context.rsn ? `RSN: ${context.rsn}` : null,
    "Stop bankstanding: do the first step, then stop at the stop point.",
    "",
    ...planned.flatMap((rec, index) => {
      const plan = rec.actionPlan;
      const primaryAction = primaryActionForRecommendation(rec, context);
      const actionHref = primaryAction.href
        ? `${primaryAction.label}: ${shareableHref(primaryAction.href)}`
        : null;
      const label = index === 0 ? "Do this first" : `Backup ${index}`;
      const title = index === 0 ? rec.title : `${sessionChoiceLabel(rec)} - ${rec.title}`;
      const stopPoint = plan?.steps.at(-1);

      return [
        `${label}: ${title}`,
        `   Why: ${rec.decisionReason ?? rec.why}`,
        plan ? `   Time: ${plan.timebox}` : null,
        plan?.steps[0] ? `   First step: ${plan.steps[0]}` : null,
        plan ? `   Bring: ${plan.prep}` : null,
        stopPoint ? `   Stop point: ${stopPoint}` : null,
        actionHref ? `   ${actionHref}` : null,
        ""
      ].filter((line): line is string => line !== null);
    })
  ];

  return lines.join("\n").trimEnd();
}
