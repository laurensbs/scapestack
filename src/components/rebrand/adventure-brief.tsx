import type { ReactNode } from "react";
import { ParchmentNote } from "./stone";

/**
 * REBRAND.md 5.5 — a single trip as a parchment briefing.
 *
 * This replaces the Start / Stop-at table on /next. The table was correct and
 * read as a spreadsheet row; the same two facts framed as "You set off:" and
 * "Come home when:" are the same information told as an errand, which is what
 * a trip is.
 *
 * On parchment because it is prose a player reads and acts on — the one
 * surface direction C rations paper for.
 */
export function AdventureBrief({
  title,
  why,
  setOff,
  comeHome,
  sprite,
  footnote
}: {
  title: ReactNode;
  /** One line on why this trip and not another. */
  why?: ReactNode;
  setOff: ReactNode;
  comeHome: ReactNode;
  /** Pinned top-right, as a plate illustration is pinned to an almanac page. */
  sprite?: ReactNode;
  /** Privacy or provenance. Kept verbatim wherever it is factual (§9.3). */
  footnote?: ReactNode;
}) {
  return (
    <ParchmentNote data-adventure-brief="true" className="relative">
      {sprite && <span className="float-right ml-3 mb-2">{sprite}</span>}
      <h2 className="font-[family-name:var(--font-display)] text-[length:var(--text-answer)] font-bold leading-[1.08] text-[var(--ink-900)]">
        {title}
      </h2>
      {why && (
        <p className="mt-2 max-w-[62ch] text-[length:var(--text-body)] font-normal leading-relaxed text-[var(--ink-700)]">
          {why}
        </p>
      )}
      <dl className="mt-4 space-y-2">
        <div className="flex flex-wrap gap-x-2 gap-y-0.5">
          <dt className="shrink-0 font-[family-name:var(--font-body)] text-[length:var(--text-body)] font-semibold text-[var(--ink-500)]">
            You set off:
          </dt>
          <dd className="min-w-0 flex-1 text-[length:var(--text-body)] font-normal text-[var(--ink-900)]">{setOff}</dd>
        </div>
        <div className="flex flex-wrap gap-x-2 gap-y-0.5">
          <dt className="shrink-0 font-[family-name:var(--font-body)] text-[length:var(--text-body)] font-semibold text-[var(--ink-500)]">
            Come home when:
          </dt>
          <dd className="min-w-0 flex-1 text-[length:var(--text-body)] font-normal text-[var(--ink-900)]">{comeHome}</dd>
        </div>
      </dl>
      {footnote && (
        <p className="mt-3 border-t border-[var(--parchment-line)] pt-2 text-[length:var(--text-micro)] font-normal italic text-[var(--ink-500)]">
          {footnote}
        </p>
      )}
    </ParchmentNote>
  );
}
