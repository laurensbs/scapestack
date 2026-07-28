// "You said 50 KC. You're at 47." — the read half of a loop that already had
// a write half.
//
// Every plugin sync reconciles the stop point the player accepted against the
// new snapshot and stores a verdict (recommendation-outcome.ts). Until now
// that verdict surfaced only on the /u/[rsn] timeline, so the plan page
// greeted a returning player as though nothing had happened — the same
// "DO THIS FIRST" whether they had just hit their target or never left the
// bank. This block is the difference between a first visit and a return.
//
// A Server Component on purpose, in the same slot as ReturningBriefing: the
// payload field is owner-gated in planning-context, and rendering it here
// keeps it out of the 6,000-line client entirely.
//
// The status word is plain text, not the gate ramp. The ramp means "how good
// is this fight"; "did you finish what you started" is a different meaning,
// and one scale per meaning is a rule this repo has already paid for twice.

import type { LastTripOutcome } from "@/lib/recommendation-outcome-repo";

const STATUS_WORD: Record<LastTripOutcome["status"], string> = {
  completed: "Done",
  progressed: "Closer",
  unchanged: "No change",
  contradicted: "Check your scan",
  unknown: "No change"
};

export function LastTripLine({ outcome }: { outcome: LastTripOutcome | null }) {
  if (!outcome) return null;
  return (
    <aside
      aria-label="Your previous trip"
      className="mx-auto mb-5 max-w-3xl border-y border-[var(--color-border)] py-3"
    >
      <p className="eyebrow">Last trip · {STATUS_WORD[outcome.status]}</p>
      <p className="mt-1 text-[13.5px] leading-relaxed text-[var(--color-text)]">
        <span className="font-semibold">{outcome.title}.</span>{" "}
        <span className="text-[var(--color-text-dim)]">{outcome.detail}</span>
        {outcome.progress && (
          <span className="ml-1 tabular-nums text-[var(--color-text-dim)]">
            {outcome.progress.before} → {outcome.progress.after} of {outcome.progress.target}{" "}
            {outcome.progress.unit}.
          </span>
        )}
      </p>
      {outcome.status !== "completed" && outcome.nextStopPoint && (
        <p className="mt-0.5 text-[12.5px] text-[var(--color-text-muted)]">{outcome.nextStopPoint}</p>
      )}
    </aside>
  );
}
