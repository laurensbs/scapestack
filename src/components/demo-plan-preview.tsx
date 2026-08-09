import Link from "next/link";
import { computeNextUp } from "@/lib/next-up";
import {
  buildRecommendationDecision,
  recommendationDecisionCopy
} from "@/lib/recommendation-decision";
import { REFERENCE_ACCOUNT_LABEL, referenceNextUpInput } from "@/lib/reference-account";

/**
 * The demo account's real plan, rendered under an empty input (SPEC §3.4).
 *
 * "No page renders a bare input and one sentence" is the rule; the reason it
 * is worth the work is that the alternative — a promise about what will
 * appear — is exactly what a player has already read on five other sites.
 * This is the engine answering about a real set of levels and a real bank, so
 * what is on screen is the product rather than a description of it.
 *
 * A Server Component on purpose. The engine reads the quest dataset from disk,
 * the result is the same for every visitor, and doing it here keeps it out of
 * the client bundle and off the first paint.
 */

// The same three the player's own page uses. A preview computed under
// different settings would be a different product than the one behind it.
const MOOD = "unlock" as const;
const ROUTE = "smart" as const;
const MINUTES = 60 as const;

export async function DemoPlanPreview() {
  const result = await computeNextUp(referenceNextUpInput());
  const winner = result.headline ?? result.rest[0] ?? null;
  // No pick means no preview. An empty frame headed "this is what your plan
  // looks like" would argue against the product.
  if (!winner) return null;

  const decision = buildRecommendationDecision({
    winner,
    alternatives: result.rest.filter((rec) => rec.id !== winner.id).slice(0, 2),
    mood: MOOD,
    routeFamily: ROUTE,
    minutes: MINUTES,
    accountStage: result.summary.accountStage.id,
    accountType: result.summary.accountType,
    hasPublicStats: true,
    hasBank: true,
    hasRuneLite: false
  });
  const copy = recommendationDecisionCopy(decision, { hasBank: true, hasRuneLite: false });

  return (
    <section
      className="mt-8 border-t border-[var(--color-border)] pt-6"
      aria-label="What a plan looks like"
      data-demo-plan-preview="true"
    >
      <p className="eyebrow">This is what your plan looks like</p>
      <h2 className="mt-2 text-[length:var(--text-answer)] font-extrabold! leading-[1.08] text-[var(--color-text)]">
        {copy.title}
      </h2>
      <p className="mt-2 max-w-[65ch] text-[length:var(--text-body)] font-normal leading-relaxed text-[var(--color-text-dim)]">
        {copy.why}
      </p>

      <div className="scape-table-wrap mt-4">
        <table className="scape-table" aria-label="The demo account's trip">
          <tbody>
            <tr>
              <th scope="row" className="w-[84px] align-top sm:w-[104px]">Start</th>
              <td className="[overflow-wrap:anywhere]">{copy.firstStep}</td>
            </tr>
            <tr>
              <th scope="row" className="align-top">Stop at</th>
              <td className="[overflow-wrap:anywhere]">{copy.stopPoint}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-[length:var(--text-micro)] font-normal leading-snug text-[var(--color-text-muted)]">
        {REFERENCE_ACCOUNT_LABEL}: 90 Attack, 92 Ranged, 250 Vorkath. Yours will read your own levels.{" "}
        <Link href="/next?sample=1" className="underline decoration-dotted underline-offset-4 hover:text-[var(--color-text)]">
          Poke around the demo
        </Link>
      </p>
    </section>
  );
}
