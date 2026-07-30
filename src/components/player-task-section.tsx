import type { SlayerTaskDecision } from "@/lib/slayer-task-decision";

function taskGate(decision: SlayerTaskDecision): "ready" | "test" | "blocked" {
  if (decision.verdict === "refresh") return "blocked";
  if (decision.verdict === "skip") return "test";
  return "ready";
}

export function PlayerTaskSection({
  decision,
  emptyReason
}: {
  decision: SlayerTaskDecision | null;
  emptyReason: string;
}) {
  return (
    <section id="task" data-player-tool-section="task" className="scroll-mt-20 border-t border-[var(--color-border)] pt-6" aria-labelledby="player-task-title">
      <p className="eyebrow">Task</p>
      <h2 id="player-task-title" className="mt-1 text-[22px] font-semibold text-[var(--color-text)]">
        What is the current Slayer task?
      </h2>
      {decision ? (
        <div className="mt-3 min-w-0">
          <div className="flex min-w-0 flex-wrap items-baseline justify-between gap-2 border-y border-[var(--color-border)] py-3">
            <p className="min-w-0 break-words text-[17px] font-semibold text-[var(--color-text)]">
              {decision.remaining.toLocaleString()} {decision.task.name}{decision.remaining === 1 ? "" : "s"}
            </p>
            <span className="scape-verdict" data-gate={taskGate(decision)}>{decision.verdictLabel}</span>
          </div>
          <dl className="grid min-w-0 border-b border-[var(--color-border)] sm:grid-cols-[7rem_minmax(0,1fr)]">
            {[
              ["Why", decision.why],
              ["Start", decision.firstStep],
              ["Stop at", decision.stopPoint],
              ["Location", decision.location],
              ["Missing", decision.missing.length > 0 ? decision.missing.join(", ") : "Nothing from the checked task setup"]
            ].map(([label, value]) => (
              <div key={label} className="contents">
                <dt className="border-b border-[var(--color-border)] py-2 text-[11px] font-semibold uppercase tracking-[0.07em] text-[var(--color-text-muted)] sm:px-2">{label}</dt>
                <dd data-task-answer={label} className="min-w-0 whitespace-normal break-words border-b border-[var(--color-border)] py-2 text-[12.5px] leading-relaxed text-[var(--color-text-secondary)] sm:px-2">{value}</dd>
              </div>
            ))}
          </dl>
        </div>
      ) : (
        <p className="mt-2 whitespace-normal break-words text-[13px] leading-relaxed text-[var(--color-text-muted)]">{emptyReason}</p>
      )}
    </section>
  );
}
