"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

/**
 * What /p/[rsn] and /u/[rsn] render when the hiscores lookup did not come
 * back — a 5xx, a dead socket, or the 900ms deadline in planning-context.
 *
 * Not the same page as a Jagex 404. That one still calls notFound(), because
 * Jagex answering 404 is the only proof a player does not exist. This one is
 * the question going unanswered, and observed on production 2026-08-08 it was
 * rendering as "this page does not exist" for a player who did.
 *
 * The page keeps the shape of the page it replaces: the same h1 at
 * --text-subject, the same hairline under it. What changes is the line that
 * normally reads "Maxed iron · 2277 total · 126 cb" — here it says why there
 * is nothing under it yet. A failure that looks like a different product is a
 * second thing to understand at the moment the player has the least patience.
 *
 * No entrance animation. This is the first paint of the only content on the
 * screen; fading in the thing the player asked for by name is the one motion
 * rule the design system states twice.
 *
 * cause="hiscores" is the Jagex lookup failing; cause="internal" is
 * loadPlanningContext itself rejecting, which by construction is never Jagex —
 * the hiscores are bounded and classified inside the loader. The two must not
 * share copy: blaming Jagex for a Scapestack fault is the same class of lie as
 * the 404 this component replaced, and it is the worse one, because the party
 * being blamed cannot answer.
 *
 * The two variants also differ on what a retry is worth, and say so. A Jagex
 * outage clears on its own; a planner bug is deterministic until someone
 * deploys, so promising "try again in a moment" there would be a third lie.
 */
export function HiscoresUnavailable({
  rsn,
  cause = "hiscores"
}: {
  rsn: string;
  cause?: "hiscores" | "internal";
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [tries, setTries] = useState(0);

  /**
   * router.refresh(), not location.reload().
   *
   * The fetch that failed is server-side, so either would re-run it — but
   * refresh() refetches the RSC payload and invalidates the client Router
   * Cache without remounting this component, and that is what makes the retry
   * honest. When the hiscores are still down the server sends this component
   * back, React reconciles it in place, and `tries` survives to say so. A full
   * reload throws that away: the page would come back byte-identical and the
   * button would look broken.
   */
  const retry = () => {
    setTries((count) => count + 1);
    startTransition(() => {
      router.refresh();
    });
  };

  // Only after a completed attempt that left us still standing here. Counted,
  // because a retry that gives no evidence it ran is a dead button. The noun
  // differs by cause: an outage yields nothing, a planner bug yields the same
  // thing every time, and the second is the one that tells you to stop.
  const status = !pending && tries > 0
    ? `${cause === "hiscores" ? "Still nothing" : "Same result"} after ${tries} ${tries === 1 ? "try" : "tries"}.`
    : "";

  return (
    <main
      className="scape-page scape-page--reading"
      data-hiscores-retry="true"
      data-hiscores-retry-cause={cause}
    >
      {/* This is a transient failure wearing a real player's URL and metadata.
          React hoists the tag into <head>; without it a crawler indexes the
          outage under the player's name, as a 200. */}
      <meta name="robots" content="noindex" />
      <header className="mb-5 border-b border-[var(--color-border)] pb-4">
        <h1 className="break-words text-[length:var(--text-subject)] font-semibold leading-none text-[var(--color-text)]">
          {rsn}
        </h1>
        <p className="mt-2 max-w-[65ch] text-[length:var(--text-body)] font-normal leading-relaxed text-[var(--color-text-muted)]">
          {cause === "hiscores" ? (
            <>
              The hiscores didn&apos;t answer &mdash; that is Jagex&apos;s end, not yours. It says
              nothing about whether the account exists, so try again in a moment.
            </>
          ) : (
            <>
              Scapestack fell over building this page &mdash; a bug on this end, not
              anything you did. The error is logged, and a retry only helps if it was
              a one-off.
            </>
          )}
        </p>
      </header>
      <button
        type="button"
        onClick={retry}
        disabled={pending}
        aria-busy={pending}
        className="btn-primary min-h-11 disabled:opacity-60"
      >
        {pending ? "Looking…" : "Try again"}
      </button>
      {/* Rendered empty rather than conditionally, so the live region exists
          before it has anything to announce. `empty:hidden` keeps it off the
          page until it does. */}
      <p
        role="status"
        className="mt-3 text-[length:var(--text-micro)] font-normal text-[var(--color-text-muted)] empty:hidden"
      >
        {status}
      </p>
    </main>
  );
}
