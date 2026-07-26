// "What did I miss?" — answered before the plan, for players who were gone.
//
// A Server Component on purpose. Everything it renders is derived on the server
// from WOM's lastChangedAt and a static table, so there is nothing for the
// browser to do; rendering it client-side would only keep it out of the
// prerendered HTML, which is where /dps already lost its boss roster once.
//
// It sits above the plan rather than inside it because it answers a different
// question. The plan says what to do next; this says what changed. A returning
// player who gets the plan first has to take it on trust from a game they no
// longer recognise.

import Link from "next/link";
import { describeAbsenceLength, type Absence } from "@/lib/returning-player";
import type { GameUpdate, UpdatesSince } from "@/lib/game-updates";

const KIND_LABEL: Record<GameUpdate["kind"], string> = {
  skill: "New skill",
  region: "New region",
  raid: "New raid",
  boss: "New boss",
  activity: "New activity"
};

/** Enough to orient, not enough to become a changelog. */
const MAX_HEADLINE = 4;
const MAX_QUESTS = 8;

export function ReturningBriefing({
  absence,
  updates,
  displayName
}: {
  absence: Absence;
  updates: UpdatesSince;
  displayName?: string | null;
}) {
  const away = describeAbsenceLength(absence.days);
  // No length means no honest sentence to write, and nothing new means there is
  // nothing to say. Either way, say nothing — a "welcome back, nothing
  // happened" banner is worse than no banner.
  if (!away || updates.total === 0) return null;

  const headline = updates.headline.slice(0, MAX_HEADLINE);
  const quests = updates.quests.slice(0, MAX_QUESTS);
  const questsHidden = updates.quests.length - quests.length;
  const name = displayName?.trim();

  return (
    // Direction B: no tinted panel and no rounded card. A returning player is
    // reading a change log, and the form for that is a ruled block of the page
    // itself — the rule states where it starts and ends, and nothing else has
    // to. The accent wash this used to carry said "notice me" about content
    // that is already the first thing on the page.
    <section
      aria-labelledby="returning-briefing-heading"
      className="mx-auto mb-6 max-w-3xl border-y border-[var(--color-border-strong)] py-5"
    >
      <p className="eyebrow text-[var(--color-accent)]">
        {name ? `Welcome back, ${name}` : "Welcome back"}
      </p>
      <h2
        id="returning-briefing-heading"
        className="mt-2 text-[21px] font-bold leading-tight text-[var(--color-text)] sm:text-[24px]"
      >
        The game moved on while you were away.
      </h2>
      {/*
        Attributed on purpose, and phrased as what we observed rather than as a
        claim about the player. The freshest signal we have can still lag a
        player who trains without anything updating their Wise Old Man profile;
        "no XP recorded in about five months" stays true in that case, where
        "you have been away five months" would be flatly wrong to someone who
        played this morning. On the one fact the player can check instantly,
        being caught overstating costs the whole page its credibility.
      */}
      <p className="mt-1.5 text-[13.5px] text-[var(--color-text-dim)]">
        No XP recorded on this account in about {away}. In that time{" "}
        {updates.total === 1 ? "one thing landed" : `${updates.total} things landed`}.
        Requirements are listed so you can see what is actually open to you.
      </p>

      {/* Was a two-column grid of tinted cards. The three things a returning
          player checks per entry — what kind of thing it is, what it is called,
          and whether it is open to them — are three columns, so they read down
          instead of being hunted for inside four separate boxes. The
          requirement column drops below 640px; the name and the blurb are what
          decide whether it is worth reading the rest. */}
      {headline.length > 0 && (
        <div className="scape-table-wrap mt-4">
          <table className="scape-table" aria-label="What landed while you were away">
            <thead>
              <tr>
                <th scope="col">Kind</th>
                <th scope="col">What</th>
                <th scope="col" className="hidden sm:table-cell">Needs</th>
              </tr>
            </thead>
            <tbody>
              {headline.map((update) => (
                <tr key={update.id}>
                  <td className="whitespace-nowrap align-top">{KIND_LABEL[update.kind]}</td>
                  <td className="w-full max-w-0 align-top">
                    <span className="block font-semibold text-[var(--color-text)]">{update.name}</span>
                    <span className="mt-0.5 block text-[12px] leading-snug text-[var(--color-text-muted)]">
                      {update.blurb}
                    </span>
                    {/* The requirement is the whole point of the row on a
                        phone, so it moves into this cell rather than being
                        dropped with the column. */}
                    {update.requirement && (
                      <span className="mt-0.5 block text-[12px] leading-snug text-[var(--color-text-muted)] sm:hidden">
                        {update.requirement}
                      </span>
                    )}
                  </td>
                  <td className="hidden align-top sm:table-cell">{update.requirement ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {quests.length > 0 && (
        <p className="mt-4 text-[12.5px] leading-relaxed text-[var(--color-text-dim)]">
          <span className="font-semibold text-[var(--color-text)]">New quests: </span>
          {quests.map((quest) => quest.name).join(", ")}
          {questsHidden > 0 && ` and ${questsHidden} more`}.
        </p>
      )}

      <p className="mt-4 text-[12.5px] text-[var(--color-text-dim)]">
        <Link
          href="/plugin"
          className="font-semibold text-[var(--color-accent)] underline-offset-2 hover:underline"
        >
          Connect RuneLite
        </Link>{" "}
        and this list drops the quests you already finished.
      </p>
    </section>
  );
}
