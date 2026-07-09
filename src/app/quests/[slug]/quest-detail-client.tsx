"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Circle, PackageSearch, Shield } from "lucide-react";
import { accountModeVisual, type PlannerAccountType } from "@/lib/account-type";
import { AccountModeBadge } from "@/components/account-mode-badge";
import type { QuestRecord } from "@/lib/quest-db";
import {
  evaluateQuestRequirements,
  normalizeQuestBankItems,
  questReadinessLabel,
  type EvaluatedItemRequirement,
  type QuestBankItem,
  type QuestRequirementEvaluation
} from "@/lib/quest-requirements";
import { readBankHandoffPayload, type BankHandoffItem } from "@/lib/next-bank-handoff";
import { pluginBankStatusLabel, pluginBankStatusTone, type PluginBankStatus } from "@/lib/plugin-bank-status";
import { cn } from "@/lib/utils";

interface QuestDetailClientProps {
  quest: QuestRecord;
  initialEvaluation: QuestRequirementEvaluation;
  initialSkills: Array<{ name: string; level: number }>;
  completedQuests: string[];
  accountType: PlannerAccountType | null;
  rsn: string | null;
  syncedBankItems: QuestBankItem[];
  bankStatus: PluginBankStatus | null;
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
      {met ? "Ready" : "Missing"}
    </span>
  );
}

function Section({
  title,
  eyebrow,
  children
}: {
  title: string;
  eyebrow?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-t border-[var(--color-border)] py-5">
      {eyebrow && (
        <div className="mb-1 text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--color-accent)]">
          {eyebrow}
        </div>
      )}
      <h2 className="mb-3 text-[17px] font-bold tracking-normal text-[var(--color-text)]">{title}</h2>
      {children}
    </section>
  );
}

function EmptyRequirement({ children }: { children: React.ReactNode }) {
  return <p className="text-[12.5px] leading-relaxed text-[var(--color-text-muted)]">{children}</p>;
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
    <li className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)]/35 p-3">
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

export function QuestDetailClient({
  quest,
  initialEvaluation,
  initialSkills,
  completedQuests,
  accountType,
  rsn,
  syncedBankItems,
  bankStatus,
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
  const hasSyncedBank = syncedBankItems.length > 0;
  const hasBrowserBank = browserBankItems.length > 0;
  const hasBankContext = bankItems.length > 0;

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

  return (
    <div className="mx-auto max-w-5xl px-5 py-7 pb-20">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="eyebrow text-[var(--color-accent)]">Quest requirements</div>
          <h1 className="mt-1 text-[28px] font-black leading-tight tracking-normal text-[var(--color-text)] sm:text-[36px]">
            {quest.name}
          </h1>
          <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-[var(--color-text-muted)]">
            Skill gates, quest blockers, item prep and bank checks for this account.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {progressSource === "runelite" && <SourceBadge label="RuneLite synced" tone="good" />}
            {progressSource === "hiscores" && <SourceBadge label="Hiscores fallback" tone="accent" />}
            {hasBrowserBank && <SourceBadge label="Browser bank" tone="accent" />}
            {!hasBankContext && <SourceBadge label="No bank check yet" />}
          </div>
        </div>
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-panel)]/65 px-3 py-2 text-[12px] text-[var(--color-text-dim)]">
          <AccountModeBadge accountType={accountType} confidence={accountType ? "detected" : "unknown"} compact showSourceCopy />
          <div>{rsn ? `RSN: ${rsn}` : "Add ?rsn=Name for synced progress"}</div>
        </div>
      </div>

      {evaluation.accountWarnings.length > 0 && (
        <div className="mb-4 rounded-xl border border-[var(--color-warning)]/30 bg-[var(--color-warning)]/10 p-3 text-[12px] leading-relaxed text-[var(--color-warning)]">
          <div className="mb-1 flex items-center gap-1.5 font-bold">
            <Shield className="size-4" />
            Accounttype notes
          </div>
          <ul className="space-y-1">
            {evaluation.accountWarnings.map((warning) => <li key={warning}>{warning}</li>)}
          </ul>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)]/35 p-3">
          <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">Readiness</div>
          <div className={cn(
            "mt-1 text-[18px] font-black leading-tight",
            evaluation.readinessStatus === "ready-to-start" ? "text-[var(--color-good)]" : "text-[var(--color-warning)]"
          )}>
            {questReadinessLabel(evaluation.readinessStatus)}
          </div>
        </div>
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)]/35 p-3">
          <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">Missing</div>
          <div className="mt-1 text-[22px] font-black text-[var(--color-warning)]">{evaluation.missingRequirements.length}</div>
        </div>
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)]/35 p-3">
          <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">Bank</div>
          <div className="mt-1 text-[13px] font-bold text-[var(--color-text)]">
            {evaluation.bank.notApplicable
              ? pluginBankStatusLabel(bankStatus, accountType)
              : evaluation.bank.checked
                ? `${evaluation.bank.owned.length}/${evaluation.itemRequirements.length} items ready`
                : bankStatus
                  ? pluginBankStatusLabel(bankStatus, accountType)
                  : "No bank check yet"}
          </div>
          <div className="mt-1 text-[11px] font-semibold text-[var(--color-text-muted)]">
            {evaluation.bank.notApplicable
              ? accountModeVisual(accountType, accountType ? "detected" : "unknown").bankCopy
              : hasBrowserBank
                ? hasSyncedBank ? "RuneLite + browser bank" : "Browser bank"
                : hasSyncedBank ? "RuneLite synced" : "No bank check yet"}
          </div>
          {bankStatus && (
            <div className={cn(
              "mt-1 text-[11px] font-semibold",
              pluginBankStatusTone(bankStatus) === "good"
                ? "text-[var(--color-good)]"
                : pluginBankStatusTone(bankStatus) === "warn"
                  ? "text-[var(--color-warning)]"
                  : "text-[var(--color-text-muted)]"
            )}>
              RuneLite bank status
            </div>
          )}
        </div>
      </div>

      <Section title="Skill requirements" eyebrow="Can I start?">
        {evaluation.skillRequirements.length > 0 ? (
          <ul className="grid gap-2 sm:grid-cols-2">
            {evaluation.skillRequirements.map((req) => (
              <li key={req.skill} className="flex items-center justify-between gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)]/35 px-3 py-2 text-[12.5px]">
                <span>{req.skill} {req.level}</span>
                <span className={req.met ? "text-[var(--color-good)]" : "text-[var(--color-warning)]"}>
                  {req.currentLevel}/{req.level}
                </span>
              </li>
            ))}
          </ul>
        ) : <EmptyRequirement>No skill requirements listed.</EmptyRequirement>}
      </Section>

      <Section title="Quest requirements" eyebrow="What blocks me?">
        {evaluation.questRequirements.length > 0 ? (
          <ul className="grid gap-2 sm:grid-cols-2">
            {evaluation.questRequirements.map((req) => (
              <li key={req.name} className="flex items-center justify-between gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)]/35 px-3 py-2 text-[12.5px]">
                <span>{req.name}</span>
                <RequirementPill met={req.met} />
              </li>
            ))}
          </ul>
        ) : <EmptyRequirement>No prerequisite quests listed.</EmptyRequirement>}
      </Section>

      <Section title="Item requirements" eyebrow="What should I bring?">
        {evaluation.itemRequirements.length > 0 ? (
          <>
            {!evaluation.bank.checked && (
              <div className="mb-3 flex items-start gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)]/35 p-3 text-[12px] text-[var(--color-text-muted)]">
                <PackageSearch className="mt-0.5 size-4 shrink-0 text-[var(--color-accent)]" />
                Open this quest from `/next` or sync/open bank first to mark owned items.
              </div>
            )}
            {evaluation.bank.notApplicable && (
              <div className="mb-3 flex items-start gap-2 rounded-lg border border-[var(--color-warning)]/30 bg-[var(--color-warning)]/10 p-3 text-[12px] text-[var(--color-warning)]">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                UIM mode: this list is a staging checklist, not a normal bank-ready check.
              </div>
            )}
            <ul className="space-y-2">
              {evaluation.itemRequirements.map((req) => (
                <ItemRequirementLine key={req.id} req={req} bankNotApplicable={evaluation.bank.notApplicable} />
              ))}
            </ul>
          </>
        ) : <EmptyRequirement>No item requirements listed.</EmptyRequirement>}
      </Section>

      <Section title="Completed requirements" eyebrow="Already covered">
        {evaluation.completedRequirements.length > 0 ? (
          <ul className="grid gap-2 sm:grid-cols-2">
            {evaluation.completedRequirements.slice(0, 24).map((item) => (
              <li key={item} className="rounded-lg border border-[var(--color-good)]/25 bg-[var(--color-good)]/10 px-3 py-2 text-[12px] text-[var(--color-good)]">
                {item}
              </li>
            ))}
          </ul>
        ) : <EmptyRequirement>No completed requirements in the current context yet.</EmptyRequirement>}
      </Section>

      <Section title="Missing requirements" eyebrow="Next blockers">
        {evaluation.missingRequirements.length > 0 ? (
          <ul className="grid gap-2 sm:grid-cols-2">
            {evaluation.missingRequirements.slice(0, 24).map((item) => (
              <li key={item} className="rounded-lg border border-[var(--color-warning)]/25 bg-[var(--color-warning)]/10 px-3 py-2 text-[12px] text-[var(--color-warning)]">
                {item}
              </li>
            ))}
          </ul>
        ) : <EmptyRequirement>All known requirements in the current context are complete.</EmptyRequirement>}
      </Section>
    </div>
  );
}
