import type { BankObservationResult } from "@/lib/bank-observations";

export function BankObservationsPanel({
  result,
  showInsufficient = true
}: {
  result: BankObservationResult | null;
  showInsufficient?: boolean;
}) {
  if (!result) return null;
  if (result.state === "series-too-short") {
    if (!showInsufficient) return null;
    return (
      <p
        data-testid="bank-observations-too-short"
        className="mt-3 text-[12.5px] leading-relaxed text-[var(--color-text-muted)]"
      >
        {result.explanation}
      </p>
    );
  }
  if (result.observations.length === 0) return null;

  return (
    <div data-testid="bank-observations" className="mt-4 grid gap-2" aria-label="Bank observations">
      {result.observations.map((observation) => (
        <p
          key={observation.id}
          className="rounded-lg border border-[var(--color-accent)]/25 bg-[var(--color-accent)]/10 px-3 py-2.5 text-[13px] leading-relaxed text-[var(--color-text)]"
        >
          {observation.sentence}
        </p>
      ))}
    </div>
  );
}
