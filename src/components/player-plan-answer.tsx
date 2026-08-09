"use client";

import Link from "next/link";
import { ArrowRight, ExternalLink, Target } from "lucide-react";
import { BossSprite } from "@/components/boss-picker";
import { GoalBar } from "@/components/goal-bar";
import { JournalItemSprite, JournalSpriteSlot } from "@/components/journal-primitives";
import { BOSSES } from "@/lib/bosses";
import type { Recommendation } from "@/lib/next-up";
import type { RecommendationDecisionCopy } from "@/lib/recommendation-decision";
import type { NewPinnedGoal, PinnedGoalProgressEvidence } from "@/lib/pinned-goals";
import {
  primaryActionForRecommendation,
  type RecommendationActionContext
} from "@/lib/recommendation-action";
import { cn } from "@/lib/utils";

export interface PlayerPlanLine {
  label: "Start" | "Bring" | "Stop at";
  value: string;
}

function actionLabelFor(rec: Recommendation, fallback: string): string {
  if (rec.kind === "boss" || rec.kind === "kc") return "Check kill";
  if (rec.kind === "bank") return "Set up bank";
  if (rec.kind === "quest") return "Open quest";
  if (rec.kind === "diary") return "Open diary";
  if (rec.kind === "slayer") return "Open task";
  if (rec.kind === "skill") return "Start training";
  if (rec.kind === "money") return "Open route";
  return fallback || "Start this trip";
}

function RecommendationGlyph({ rec }: { rec: Recommendation }) {
  const boss = rec.bossSlug
    ? BOSSES.find((candidate) => candidate.slug === rec.bossSlug)
    : null;
  if ((rec.kind === "kc" || rec.kind === "boss") && boss) {
    return (
      <JournalSpriteSlot>
        <BossSprite boss={boss} size={40} />
      </JournalSpriteSlot>
    );
  }
  if (rec.iconItemId) {
    return <JournalItemSprite id={rec.iconItemId} />;
  }
  return (
    <JournalSpriteSlot>
      <Target className="size-6 text-[var(--color-text-secondary)]" strokeWidth={1.75} />
    </JournalSpriteSlot>
  );
}

export function PlayerPlanAnswer({
  rec,
  decisionCopy,
  planLines,
  actionContext,
  goalBar,
  alternatives = [],
  onSelectAlternative,
  onRejectHeadline,
  onStart,
  onBossOpen
}: {
  rec: Recommendation;
  decisionCopy: RecommendationDecisionCopy;
  planLines: PlayerPlanLine[];
  actionContext: RecommendationActionContext;
  /** Pinned-goal wiring. Absent on surfaces that have no goals of their own. */
  goalBar?: { rsn: string; evidence: PinnedGoalProgressEvidence; canSync: boolean; suggestions?: readonly NewPinnedGoal[] };
  alternatives?: Recommendation[];
  onSelectAlternative?: (rec: Recommendation) => void;
  onRejectHeadline?: (rec: Recommendation) => void;
  onStart?: (rec: Recommendation) => void;
  onBossOpen?: (slug: string) => void;
}) {
  const primaryAction = primaryActionForRecommendation(rec, actionContext);
  const opensBossDetail = Boolean(
    onBossOpen && (rec.kind === "kc" || rec.kind === "boss") && rec.bossSlug
  );
  const actionLabel = actionLabelFor(rec, opensBossDetail ? "Check kill" : primaryAction.label);
  const actionClass = "scapestack-command-button scapestack-primary-action px-4";

  return (
    <article
      className="min-w-0 max-w-full pb-4"
      data-next-trip-card="true"
      data-player-plan-answer="true"
    >
      {/* The goal, where the "Do this first" eyebrow used to be. That label
          told a player nothing — of course it is first, it is the top of the
          page — while the goal turns the answer into a consequence of
          something they said. */}
      {goalBar && <GoalBar {...goalBar} />}
      <h2 className="flex min-w-0 items-center gap-3 text-[length:var(--text-answer)] font-extrabold! leading-[1.08] text-[var(--color-text)]">
        <RecommendationGlyph rec={rec} />
        <span className="min-w-0 break-words">{decisionCopy.title}</span>
      </h2>
      <p className="mt-2 max-w-[65ch] text-[length:var(--text-body)] font-normal leading-relaxed text-[var(--color-text-dim)]">
        {decisionCopy.why}
      </p>
      {decisionCopy.sourceLine && (
        <p className="mt-1.5 max-w-[65ch] text-[length:var(--text-micro)] font-normal leading-snug text-[var(--color-text-muted)]">
          {decisionCopy.sourceLine}
        </p>
      )}

      <div className="scape-table-wrap mt-4">
        <table className="scape-table" aria-label="This trip">
          <tbody>
            {planLines.map((line) => (
              <tr key={`${line.label}:${line.value}`}>
                <th scope="row" className="w-[84px] align-top sm:w-[104px]">{line.label}</th>
                <td className="[overflow-wrap:anywhere]">{line.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="scape-answer-actions">
        {opensBossDetail && rec.bossSlug ? (
          <button
            type="button"
            onClick={() => {
              onStart?.(rec);
              onBossOpen?.(rec.bossSlug!);
            }}
            className={cn(actionClass, "min-h-11 w-full justify-center sm:w-auto")}
            aria-label={`${actionLabel}: ${rec.title}`}
          >
            {actionLabel} <ArrowRight className="size-4" />
          </button>
        ) : primaryAction.href ? (
          primaryAction.external ? (
            <a
              href={primaryAction.href}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => onStart?.(rec)}
              className={cn(actionClass, "min-h-11 w-full justify-center sm:w-auto")}
              aria-label={`${actionLabel}: ${rec.title}`}
            >
              {actionLabel} <ExternalLink className="size-3.5" />
            </a>
          ) : (
            <Link
              href={primaryAction.href}
              onClick={() => onStart?.(rec)}
              className={cn(actionClass, "min-h-11 w-full justify-center sm:w-auto")}
              aria-label={`${actionLabel}: ${rec.title}`}
            >
              {actionLabel} <ArrowRight className="size-4" />
            </Link>
          )
        ) : null}
      
        {alternatives.length > 0 && (
          <p className="scape-answer-alts" data-player-plan-alternatives="true">
            <span>Not tonight?</span>
            {alternatives.slice(0, 2).map((alt) => (
              <span key={alt.id} className="contents">
                <button type="button" onClick={() => onSelectAlternative?.(alt)} aria-label={`Choose ${alt.title}`}>
                  {alt.title}
                </button>
                <span aria-hidden="true">·</span>
              </span>
            ))}
            {/* One control that means "not this, ever", bound to the headline —
                instead of a hide button per alternative, which asked the player
                to reject a backup they were seeing for the first time. */}
            <button type="button" onClick={() => onRejectHeadline?.(rec)} aria-label={`Hide ${rec.title} and pick something else`}>
              Something else
            </button>
          </p>
        )}
      </div>    </article>
  );
}
