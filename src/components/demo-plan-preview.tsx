import Link from "next/link";
import { AdventureBrief } from "@/components/rebrand/adventure-brief";
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
      {/* REBRAND.md 6.2 and 4.2: "This is what your plan looks like" becomes
          "A sample briefing", and the Start / Stop-at table becomes an
          AdventureBrief — the same two facts told as an errand rather than as
          a spreadsheet row. A trip is an errand.

          This is /next's plan surface for a visitor with no account, which is
          exactly what 6.2 names. The same table on /p/[rsn] is deliberately
          left alone: that page carries an enforced five-colour budget, and
          parchment brings three ink colours with it. Section 6 migrates pages
          one at a time for this reason. */}
      <p className="eyebrow">A sample briefing</p>
      <div className="mt-2">
        <AdventureBrief
          title={copy.title}
          why={copy.why}
          setOff={copy.firstStep}
          comeHome={copy.stopPoint}
        />
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
