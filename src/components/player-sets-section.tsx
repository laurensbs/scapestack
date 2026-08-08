import {
  affordabilityLine,
  formatGpExact,
  type AffordabilityReport,
  type AffordableSet
} from "@/lib/bank-affordability";
import { BankShareControl } from "@/components/bank-share-control";
import { JournalItemSprite } from "@/components/journal-primitives";
import {
  orderAffordableSetsForGoal,
  type PinnedGoalBankFact
} from "@/lib/pinned-goal-orientation";
import type { PinnedGoal } from "@/lib/pinned-goals";

function allStartedSets(report: AffordabilityReport): AffordableSet[] {
  const seen = new Set<string>();
  return [...report.buyableNow, ...report.shortBy, ...report.notForSale].filter((row) => {
    if (seen.has(row.setId)) return false;
    seen.add(row.setId);
    return true;
  });
}

export function PlayerSetsSection({
  report,
  cannotBuy,
  canShare,
  activeGoal = null,
  goalBankFact = null
}: {
  report: AffordabilityReport | null;
  cannotBuy: boolean;
  canShare: boolean;
  activeGoal?: PinnedGoal | null;
  goalBankFact?: PinnedGoalBankFact | null;
}) {
  const rows = report ? orderAffordableSetsForGoal(allStartedSets(report), activeGoal) : [];
  const headline = report && !cannotBuy ? affordabilityLine(report) : null;
  return (
    <section id="sets" data-player-tool-section="sets" className="scroll-mt-20 border-t border-[var(--color-border)] pt-6" aria-labelledby="player-sets-title">
      <p className="eyebrow">Sets</p>
      <h2 id="player-sets-title" className="mt-1 text-[length:var(--text-subject)] font-semibold text-[var(--color-text)]">
        What can this bank finish?
      </h2>
      {activeGoal && (
        <div className="mt-3 flex gap-3 border-y border-[var(--color-border)] py-3" data-pinned-goal-bank-answer={activeGoal.key}>
          {activeGoal.spriteItemId ? <JournalItemSprite id={activeGoal.spriteItemId} /> : null}
          <div className="min-w-0 flex-1">
            <p className="text-[length:var(--text-label)] font-semibold uppercase tracking-[0.1em] text-[var(--color-text-muted)]">
              For {activeGoal.target}
            </p>
            <p className="mt-1 max-w-[65ch] text-[length:var(--text-body)] font-normal leading-relaxed text-[var(--color-text)]">
              {goalBankFact?.line ?? `No exact bank price is available for ${activeGoal.target}. The started sets stay below.`}
            </p>
            {goalBankFact && (
              <p className="mt-1 text-[length:var(--text-micro)] font-normal">
                <span className="scape-verdict" data-gate={goalBankFact.gate}>{goalBankFact.verdict}</span>
              </p>
            )}
          </div>
        </div>
      )}
      {!report ? (
        <p className="mt-2 max-w-[65ch] text-[length:var(--text-body)] font-normal leading-relaxed text-[var(--color-text-muted)]">Waiting on your bank.</p>
      ) : report.pricesUnavailable && !cannotBuy ? (
        <p className="mt-2 max-w-[65ch] text-[length:var(--text-body)] font-normal leading-relaxed text-[var(--color-text-muted)]">Grand Exchange prices are unavailable, so no set is called affordable.</p>
      ) : (
        <>
          <p className="mt-2 max-w-[65ch] tabular-nums text-[length:var(--text-body)] font-normal leading-relaxed text-[var(--color-text)]">
            {cannotBuy
              ? `${rows.length.toLocaleString()} unfinished sets already have at least one piece in this bank. GE purchases are excluded.`
              : headline ?? `${report.buyableNow.length.toLocaleString()} sets can be finished with banked coins.`}
          </p>
          {rows.length > 0 ? (
            <ul className="mt-3 divide-y divide-[var(--color-border)] border-y border-[var(--color-border)]" aria-label="Sets started by this bank">
              {rows.map((row) => (
                <li key={row.setId} className="flex min-w-0 items-start gap-3 py-3">
                  {row.iconItemId ? <JournalItemSprite id={row.iconItemId} /> : null}
                  <div className="grid min-w-0 flex-1 gap-1 sm:grid-cols-[minmax(0,1fr)_auto] sm:gap-x-4">
                    <div className="min-w-0">
                      <p className="break-words text-[length:var(--text-subject)] font-semibold text-[var(--color-text)]">
                        {row.setName} <span className="tabular-nums font-semibold text-[var(--color-text-muted)]">{row.owned}/{row.total}</span>
                      </p>
                      <p data-set-answer={row.setId} className="mt-1 max-w-[65ch] whitespace-normal break-words text-[length:var(--text-micro)] font-normal leading-relaxed text-[var(--color-text-dim)]">
                        Missing: {row.missing.map((piece, index) => (
                          <span key={piece.goalId} className="text-[var(--color-data-item)]">
                            {index > 0 ? ", " : ""}{piece.name}
                          </span>
                        ))}.
                      </p>
                    </div>
                    {!cannotBuy && (
                      <p className="self-start whitespace-nowrap tabular-nums text-[length:var(--text-body)] font-semibold text-[var(--color-text)]">
                        {row.cost === null ? "Not for sale" : formatGpExact(row.cost)}
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-[length:var(--text-micro)] font-normal text-[var(--color-text-muted)]">No unfinished set has a banked piece yet.</p>
          )}
        </>
      )}
      {canShare && rows.length > 0 && !report?.pricesUnavailable && <BankShareControl />}
    </section>
  );
}
