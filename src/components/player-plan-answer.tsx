"use client";

import Link from "next/link";
import { ArrowRight, EyeOff, ExternalLink, Target } from "lucide-react";
import { BossSprite } from "@/components/boss-picker";
import { JournalItemSprite, JournalSpriteSlot } from "@/components/journal-primitives";
import { BOSSES } from "@/lib/bosses";
import type { Recommendation } from "@/lib/next-up";
import { backupChoicePrompt, playerChoiceTag } from "@/lib/player-plan-copy";
import {
  recommendationConfidenceEyebrow,
  type RecommendationDecisionCopy
} from "@/lib/recommendation-decision";
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
  onStart,
  onBossOpen
}: {
  rec: Recommendation;
  decisionCopy: RecommendationDecisionCopy;
  planLines: PlayerPlanLine[];
  actionContext: RecommendationActionContext;
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
      className="min-w-0 max-w-full border-b border-[var(--color-border)] pb-5"
      data-next-trip-card="true"
      data-player-plan-answer="true"
    >
      <p className="eyebrow mb-2">
        {recommendationConfidenceEyebrow(decisionCopy.confidence)}
      </p>
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

      <div className="mt-4">
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
      </div>
    </article>
  );
}

export function PlayerPlanAlternatives({
  headline,
  alternatives,
  onSelect,
  onHide
}: {
  headline: Recommendation;
  alternatives: Recommendation[];
  onSelect: (rec: Recommendation) => void;
  onHide: (rec: Recommendation) => void;
}) {
  if (alternatives.length === 0) return null;
  return (
    <div role="region" className="pt-4" aria-labelledby="next-alternatives-title" data-player-plan-alternatives="true">
      <h3 id="next-alternatives-title" className="text-[length:var(--text-subject)] font-semibold text-[var(--color-text)]">
        Not this?
      </h3>
      <div className="scape-table-wrap mt-2">
        <table className="scape-table" aria-label="Alternative routes">
          <thead>
            <tr>
              <th scope="col">Route</th>
              <th scope="col">Goal</th>
              <th scope="col"><span className="sr-only">Action</span></th>
            </tr>
          </thead>
          <tbody>
            {alternatives.slice(0, 2).map((rec) => {
              const choice = playerChoiceTag(rec);
              const prompt = backupChoicePrompt(rec, headline);
              return (
                <tr key={rec.id}>
                  <td className="w-full max-w-0">
                    <button
                      type="button"
                      onClick={() => onSelect(rec)}
                      aria-label={`Choose ${rec.title}`}
                      className="block min-h-11 w-full py-1 text-left"
                    >
                      <span className="flex min-w-0 items-center gap-3">
                        <RecommendationGlyph rec={rec} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[length:var(--text-subject)] font-semibold text-[var(--color-text)]">
                            {rec.title}
                          </span>
                          <span className="block max-w-[65ch] text-[length:var(--text-micro)] font-normal leading-snug text-[var(--color-text-muted)]">
                            {prompt.helper}
                          </span>
                        </span>
                      </span>
                    </button>
                  </td>
                  <td className="whitespace-nowrap align-middle">{choice.label}</td>
                  <td className="whitespace-nowrap align-middle">
                    <button
                      type="button"
                      onClick={() => onHide(rec)}
                      aria-label={`Hide ${rec.title}`}
                      className="inline-flex min-h-11 items-center gap-1.5 px-1.5 text-[length:var(--text-micro)] font-normal text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-danger)]"
                    >
                      <EyeOff className="size-3.5" />
                      Hide
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
