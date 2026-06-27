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
    `Why: ${rec.why}`,
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
    dataAction ? `Add context later: ${dataAction.label} — ${dataAction.helper}` : null,
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
  if (planned.length === 0) return "Scapestack session\n\nNo plan available yet.";

  const lines = [
    "Scapestack session",
    "",
    ...planned.flatMap((rec, index) => {
      const plan = rec.actionPlan;
      const primaryAction = primaryActionForRecommendation(rec, context);
      const actionHref = primaryAction.href
        ? `${primaryAction.label}: ${shareableHref(primaryAction.href)}`
        : null;
      const label = index === 0 ? "Do this first" : `Backup ${index}`;
      const stopPoint = plan?.steps.at(-1);

      return [
        `${label}: ${rec.title}`,
        `   Why: ${rec.why}`,
        plan ? `   Time: ${plan.timebox}` : null,
        plan ? `   Gear/supplies: ${plan.prep}` : null,
        plan?.steps[0] ? `   First step: ${plan.steps[0]}` : null,
        stopPoint ? `   Stop point: ${stopPoint}` : null,
        actionHref ? `   ${actionHref}` : null,
        ""
      ].filter((line): line is string => line !== null);
    })
  ];

  return lines.join("\n").trimEnd();
}
