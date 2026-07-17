"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowRight, CheckCircle2, Circle, ExternalLink, Shield } from "lucide-react";
import { type PlannerAccountType } from "@/lib/account-type";
import { AccountModeBadge } from "@/components/account-mode-badge";
import { ItemSprite } from "@/components/item-sprite";
import type { QuestRecord } from "@/lib/quest-db";
import type { QuestRouteProgress } from "@/lib/quest-route";
import {
  evaluateQuestRequirements,
  normalizeQuestBankItems,
  questTripDecision,
  type EvaluatedItemRequirement,
  type QuestBankItem,
  type QuestRequirementEvaluation
} from "@/lib/quest-requirements";
import { readBankHandoffPayload, type BankHandoffItem } from "@/lib/next-bank-handoff";
import { cn } from "@/lib/utils";
import { wikiSearchUrl } from "@/lib/wiki";

interface QuestDetailClientProps {
  quest: QuestRecord;
  initialRoute: QuestRouteProgress;
  initialEvaluation: QuestRequirementEvaluation;
  initialSkills: Array<{ name: string; level: number }>;
  completedQuests: string[];
  accountType: PlannerAccountType | null;
  rsn: string | null;
  syncedBankItems: QuestBankItem[];
  progressSource: "runelite" | "hiscores" | "none";
}

function bankItemFromHandoff(item: BankHandoffItem): QuestBankItem {
  return {
    id: item.id,
    name: item.name,
    quantity: item.quantity
  };
}

function RequirementPill({ met }: { met: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10.5px] font-bold",
        met
          ? "border-[var(--color-good)]/35 bg-[var(--color-good)]/10 text-[var(--color-good)]"
          : "border-[var(--color-warning)]/35 bg-[var(--color-warning)]/10 text-[var(--color-warning)]"
      )}
    >
      {met ? <CheckCircle2 className="size-3" /> : <Circle className="size-3" />}
      {met ? "Done" : "Needed"}
    </span>
  );
}

function SourceBadge({ label, tone = "muted" }: { label: string; tone?: "good" | "accent" | "muted" }) {
  return (
    <span className={cn(
      "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10.5px] font-bold",
      tone === "good" && "border-[var(--color-good)]/30 bg-[var(--color-good)]/10 text-[var(--color-good)]",
      tone === "accent" && "border-[var(--color-accent)]/30 bg-[var(--color-accent)]/10 text-[var(--color-accent)]",
      tone === "muted" && "border-[var(--color-border)] bg-[var(--color-bg)]/35 text-[var(--color-text-muted)]"
    )}>
      {label}
    </span>
  );
}

function ItemRequirementLine({
  req,
  bankNotApplicable
}: {
  req: EvaluatedItemRequirement;
  bankNotApplicable: boolean;
}) {
  const alternatives = req.alternatives.length
    ? ` Alternative: ${req.alternatives.map((alt) => `${alt.quantity}x ${alt.name}`).join(" or ")}.`
    : "";
  return (
    <li className="border-b border-[var(--color-border)] py-3 last:border-b-0">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="font-semibold text-[var(--color-text)]">
            {req.quantity}x {req.name}
          </div>
          <p className="mt-1 text-[11.5px] leading-relaxed text-[var(--color-text-muted)]">
            {bankNotApplicable
              ? req.availabilityCopy
              : req.ownedInBank
              ? `In bank: ${req.ownedQuantity}x ${req.ownedName ?? req.name}.`
              : req.ownedQuantity > 0
                ? `Bank has ${req.ownedQuantity}x; missing ${req.missingQuantity}x.`
                : req.availabilityCopy}
            {alternatives}
          </p>
          {!req.ownedInBank && req.sourceHints.length > 0 && (
            <p className="mt-1 text-[11px] leading-relaxed text-[var(--color-text-muted)]">
              Source: {req.sourceHints.slice(0, 2).map((hint) => hint.label).join(" / ")}
            </p>
          )}
          {req.note && (
            <p className="mt-1 text-[11px] leading-relaxed text-[var(--color-text-muted)]">{req.note}</p>
          )}
        </div>
        <RequirementPill met={req.met} />
      </div>
    </li>
  );
}

function RouteStep({
  label,
  children,
  last = false,
  tone = "default"
}: {
  label: string;
  children: React.ReactNode;
  last?: boolean;
  tone?: "default" | "warning" | "good";
}) {
  return (
    <div className="relative grid grid-cols-[24px_minmax(0,1fr)] gap-3 pb-5 last:pb-0">
      {!last && <span className="absolute left-[11px] top-6 h-[calc(100%-12px)] w-px bg-[var(--color-border)]" />}
      <span className={cn(
        "relative z-10 mt-0.5 flex size-6 items-center justify-center rounded-full border bg-[var(--color-panel)]",
        tone === "good" && "border-[var(--color-good)]/45 text-[var(--color-good)]",
        tone === "warning" && "border-[var(--color-warning)]/45 text-[var(--color-warning)]",
        tone === "default" && "border-[var(--color-accent)]/45 text-[var(--color-accent)]"
      )}>
        {tone === "good" ? <CheckCircle2 className="size-3.5" /> : tone === "warning" ? <AlertTriangle className="size-3.5" /> : <ArrowRight className="size-3.5" />}
      </span>
      <div className="min-w-0">
        <div className="eyebrow text-[var(--color-text-dim)]">{label}</div>
        <div className="mt-1 text-[13px] font-semibold leading-relaxed text-[var(--color-text)]">{children}</div>
      </div>
    </div>
  );
}

export function QuestDetailClient({
  quest,
  initialRoute,
  initialEvaluation,
  initialSkills,
  completedQuests,
  accountType,
  rsn,
  syncedBankItems,
  progressSource
}: QuestDetailClientProps) {
  const [browserBankItems, setBrowserBankItems] = useState<QuestBankItem[]>([]);

  useEffect(() => {
    const browserBank = readBankHandoffPayload(window).map(bankItemFromHandoff);
    if (browserBank.length > 0) setBrowserBankItems(browserBank);
  }, []);

  const bankItems = useMemo(
    () => normalizeQuestBankItems([...syncedBankItems, ...browserBankItems]),
    [browserBankItems, syncedBankItems]
  );
  const hasBrowserBank = browserBankItems.length > 0;
  const evaluation = useMemo(
    () => bankItems.length > 0
      ? evaluateQuestRequirements(quest, {
          skills: initialSkills.map((skill, index) => ({
            id: index + 1,
            name: skill.name,
            level: skill.level,
            rank: 0,
            xp: 0
          })),
          completedQuests,
          bankItems,
          accountType
        })
      : initialEvaluation,
    [accountType, bankItems, completedQuests, initialEvaluation, initialSkills, quest]
  );
  const decision = useMemo(() => questTripDecision(evaluation), [evaluation]);
  const startCopy = initialSkills.length === 0
    ? "Add your RSN or check RuneLite before choosing this route."
    : decision.beforeYouGo[0] ?? `Open ${quest.name} and begin the first step.`;
  const rawFirstMissing = decision.stillMissing.find((line) => line !== "Nothing obvious missing.") ?? null;
  const firstMissing = rawFirstMissing && !startCopy.includes(rawFirstMissing) ? rawFirstMissing : null;
  const bankCopy = evaluation.bank.notApplicable
    ? "Stage the quest items before starting."
    : evaluation.bank.checked
      ? evaluation.itemRequirements.length === 0
        ? "No quest items needed for this block."
        : evaluation.bank.owned.length === evaluation.itemRequirements.length
          ? "Your bank already covers the listed quest items."
          : `${evaluation.bank.owned.length}/${evaluation.itemRequirements.length} quest items are already in your bank.`
      : initialRoute.bankNote;
  const sourceCopy = progressSource === "runelite"
    ? `RuneLite checked${rsn ? ` for ${rsn}` : ""}.`
    : progressSource === "hiscores"
      ? `Stats loaded${rsn ? ` for ${rsn}` : ""}; quest completion is not guessed.`
      : "Add your RSN or RuneLite later for completed quest checks.";

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 pb-20 sm:px-6 sm:py-9">
      <header className="mb-6 flex items-start gap-4">
        <div className="flex size-16 shrink-0 items-center justify-center rounded-lg border border-[var(--color-accent)]/35 bg-[var(--color-panel)] sm:size-20">
          <ItemSprite id={9813} alt="Quest point cape" size={54} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="eyebrow text-[var(--color-accent)]">
            {initialRoute.activeIsTarget ? "Quest block" : `On route to ${initialRoute.targetQuestName}`}
          </div>
          <h1 className="mt-1 text-[28px] font-black leading-tight tracking-normal text-[var(--color-text)] sm:text-[38px]">
            {quest.name}
          </h1>
          <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-[var(--color-text-muted)]">
            {initialRoute.whyThisBlock}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-[11.5px] text-[var(--color-text-dim)]">
            <AccountModeBadge accountType={accountType} confidence={accountType ? "detected" : "unknown"} compact />
            <span>{sourceCopy}</span>
            {hasBrowserBank && <span>Browser bank used.</span>}
          </div>
        </div>
      </header>

      {initialRoute.completionEvidence === "unknown" && (
        <div className="mb-4 flex items-start gap-2 border-y border-[var(--color-warning)]/30 py-3 text-[12px] leading-relaxed text-[var(--color-warning)]">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          Check RuneLite before committing to the full chain; completed prerequisites are not guessed.
        </div>
      )}

      <section className="mb-5 overflow-hidden rounded-xl border border-[var(--color-accent)]/35 bg-[var(--color-panel)]/84">
        <div className="border-b border-[var(--color-border)] px-4 py-4 sm:px-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="eyebrow text-[var(--color-accent)]">Do this first</div>
              <h2 className="mt-1 text-[22px] font-black leading-tight tracking-normal text-[var(--color-text)] sm:text-[28px]">
                {initialSkills.length === 0 ? "Add your RSN first" : decision.title}
              </h2>
            </div>
            <SourceBadge label={initialRoute.expectedBlock} tone="accent" />
          </div>
          <p className="mt-3 text-[12.5px] leading-relaxed text-[var(--color-text-muted)]">
            <strong className="text-[var(--color-text)]">Payoff:</strong> {initialRoute.payoff}
            {!initialRoute.activeIsTarget && ` · ${initialRoute.remainingBlocks - 1} later block${initialRoute.remainingBlocks - 1 === 1 ? "" : "s"} stay out of this session.`}
          </p>
        </div>

        <div className="px-4 py-5 sm:px-6">
          <RouteStep label="Start" tone="good">{startCopy}</RouteStep>
          <RouteStep label={evaluation.bank.notApplicable ? "Stage" : "Bring"} tone={firstMissing ? "warning" : "good"}>
            {decision.bringItems.length > 0 ? decision.bringItems.slice(0, 3).join(" · ") : bankCopy}
          </RouteStep>
          {firstMissing && <RouteStep label="Get first" tone="warning">{firstMissing}</RouteStep>}
          <RouteStep label="Stop">{initialRoute.stopPoint}</RouteStep>
          {initialRoute.nextQuestName && <RouteStep label="Next" last>{initialRoute.nextQuestName}</RouteStep>}
        </div>

        <div className="flex flex-wrap items-center gap-3 border-t border-[var(--color-border)] px-4 py-4 sm:px-6">
          <a
            href={wikiSearchUrl(quest.name)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-[var(--color-accent)]/40 bg-[var(--color-accent)] px-4 text-[12.5px] font-black text-[var(--color-bg)]"
          >
            Open Wiki guide <ExternalLink className="size-4" />
          </a>
        </div>
      </section>

      {evaluation.accountWarnings.length > 0 && (
        <details className="mb-4 rounded-xl border border-[var(--color-warning)]/25 bg-[var(--color-warning)]/8 p-3">
          <summary className="flex cursor-pointer list-none items-center gap-1.5 text-[12px] font-bold text-[var(--color-warning)] marker:hidden [&::-webkit-details-marker]:hidden">
            <Shield className="size-4" />
            Account note
          </summary>
          <ul className="mt-2 space-y-1 text-[12px] leading-relaxed text-[var(--color-warning)]">
            {evaluation.accountWarnings.map((warning) => <li key={warning}>{warning}</li>)}
          </ul>
        </details>
      )}

      <details className="rounded-xl border border-[var(--color-border)] bg-[var(--color-panel)]/55">
        <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-4 text-[13px] font-bold text-[var(--color-text)] marker:hidden sm:px-5 [&::-webkit-details-marker]:hidden">
          Check exact requirements
          <span className="text-[11px] font-semibold text-[var(--color-text-dim)]">Skills, quests and items</span>
        </summary>
        <div className="border-t border-[var(--color-border)] px-4 py-4 sm:px-5">
          {evaluation.skillRequirements.length > 0 && (
            <div className="mb-5">
              <div className="eyebrow text-[var(--color-text-dim)]">Skills</div>
              <ul className="mt-2 divide-y divide-[var(--color-border)]">
                {evaluation.skillRequirements.map((req) => (
                  <li key={req.skill} className="flex items-center justify-between gap-3 py-2.5 text-[12.5px]">
                    <span>{req.skill} {req.level}</span>
                    <span className={req.met ? "text-[var(--color-good)]" : "text-[var(--color-warning)]"}>{req.currentLevel}/{req.level}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {evaluation.questRequirements.length > 0 && (
            <div className="mb-5">
              <div className="eyebrow text-[var(--color-text-dim)]">Earlier quests</div>
              <ul className="mt-2 divide-y divide-[var(--color-border)]">
                {evaluation.questRequirements.map((req) => (
                  <li key={req.name} className="flex items-center justify-between gap-3 py-2.5 text-[12.5px]">
                    <span>{req.name}</span>
                    <RequirementPill met={req.met} />
                  </li>
                ))}
              </ul>
            </div>
          )}

          {evaluation.itemRequirements.length > 0 ? (
            <div>
              <div className="eyebrow text-[var(--color-text-dim)]">Quest items</div>
              {!evaluation.bank.checked && <p className="mt-2 text-[12px] text-[var(--color-text-muted)]">Add your bank to mark owned items.</p>}
              {evaluation.bank.notApplicable && (
                <div className="mt-2 flex items-start gap-2 text-[12px] text-[var(--color-warning)]">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0" /> UIM mode: use this as a staging list.
                </div>
              )}
              <ul className="mt-2">
                {evaluation.itemRequirements.map((req) => <ItemRequirementLine key={req.id} req={req} bankNotApplicable={evaluation.bank.notApplicable} />)}
              </ul>
            </div>
          ) : (
            <p className="text-[12px] text-[var(--color-text-muted)]">No listed quest items for this block.</p>
          )}
        </div>
      </details>
    </div>
  );
}
