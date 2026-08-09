"use client";

// The always-visible boss roster on /dps.
//
// /dps promises "Can I kill this?" and used to show zero bosses until a bank
// was pasted — a page about bosses with no bosses on it. Content now stands on
// its own and the account makes it personal, rather than being the price of
// admission.
//
// Deliberately verdict-free: without a bank we show what the game requires
// (combat level, unlock quest), never a guess at whether the player can do it.
// The verdict arrives once there is something real to base it on.

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { BOSSES, type Boss } from "@/lib/bosses";
// The engine's own table, not a copy of it. The copy that used to live here
// had drifted twenty-five entries behind.
import { BOSS_CL_GATE as COMBAT_GATE } from "@/lib/boss-gates";
import { BOSS_ACCESS } from "@/lib/content-access-data";
import { BossSprite } from "@/components/boss-picker";


export type ReachBand = "in-reach" | "almost" | "a-dream";

/**
 * REBRAND.md 5.6 — the Bestiary is grouped by reachability, not listed flat.
 *
 * The honest problem: reachability is a fact about a PLAYER, and this roster
 * renders for visitors who have given no account. The component's own header
 * comment already refuses to guess there, and it is right to.
 *
 * So the bands are absolute when nobody is known — they describe the gate the
 * GAME puts on the door — and become personal the moment a combat level is
 * available. Same three groups, same order, one honest label each way. A boss
 * with no combat gate at all is a walk-in, which is a fact about the boss.
 */
function bandFor(boss: Boss, combatLevel: number | null): ReachBand {
  const gate = COMBAT_GATE[boss.slug] ?? 0;
  if (combatLevel === null) {
    if (gate <= 60) return "in-reach";
    if (gate <= 100) return "almost";
    return "a-dream";
  }
  if (combatLevel >= gate) return "in-reach";
  if (combatLevel >= gate - 15) return "almost";
  return "a-dream";
}

const BAND_ORDER: ReachBand[] = ["in-reach", "almost", "a-dream"];

const BAND_COPY: Record<ReachBand, { known: string; anonymous: string }> = {
  "in-reach": { known: "In reach", anonymous: "Walk in" },
  almost: { known: "Almost", anonymous: "Needs a mid-game account" },
  "a-dream": { known: "A dream", anonymous: "Late game" }
};

function requirementLine(boss: Boss): string | null {
  const quests = BOSS_ACCESS[boss.slug]?.quests;
  if (quests?.length) return quests.join(" · ");
  const gate = COMBAT_GATE[boss.slug];
  return gate ? `Combat ${gate}+` : null;
}

/**
 * `onPick` is optional on purpose.
 *
 * Rendered inside DpsClient it can drive that component's state, but
 * dps-client.tsx calls useSearchParams, which excludes everything inside the
 * page's Suspense boundary from the statically prerendered HTML. The roster
 * was therefore invisible to anything that does not run JavaScript — the
 * opposite of why it was added.
 *
 * Without a callback the tiles are ordinary links to /dps?boss=<slug>, so the
 * roster renders on the server, gets crawled, and each boss has a URL worth
 * sharing.
 */
export function BossRoster({
  onPick,
  interactive = true,
  combatLevel = null
}: {
  onPick?: (boss: Boss) => void;
  /**
   * The viewer's combat level, when it is known. Null turns the bands from a
   * verdict about them into a statement about the game — see bandFor.
   */
  combatLevel?: number | null;
  /**
   * False where a tile has nowhere to go.
   *
   * The link below points at /dps?boss=<slug>, and /dps reads only `rsn` — it
   * drops `boss` and redirects an anonymous visitor straight back to the page
   * they clicked from, losing their scroll position in a 59-row grid. So on a
   * surface with no boss detail to open, the tiles are rows rather than 59
   * links that cost a round trip to do nothing, and the line above them stops
   * telling the player to pick one.
   */
  interactive?: boolean;
}) {
  const [query, setQuery] = useState("");

  const bosses = useMemo(() => {
    const q = query.trim().toLowerCase();
    const pool = q
      ? BOSSES.filter((boss) => boss.name.toLowerCase().includes(q))
      : BOSSES;
    // Easiest first — a new player should meet Obor before Nex.
    return [...pool].sort((a, b) =>
      (COMBAT_GATE[a.slug] ?? 999) - (COMBAT_GATE[b.slug] ?? 999)
      || a.name.localeCompare(b.name));
  }, [query]);

  return (
    <section className="mt-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-[19px] font-bold tracking-normal text-[var(--color-text)]">
            Every boss
          </h2>
          <p className="mt-0.5 text-[13px] text-[var(--color-text-dim)]">
            {interactive
              ? "Pick one to see the trip. Add your bank and each gets a verdict."
              : "What the game asks for, before any account. Add your name and each of these gets a verdict about yours."}
          </p>
        </div>
        <label className="relative sm:w-64">
          <span className="sr-only">Search bosses</span>
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--color-text-dim)]"
          />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search bosses"
            className="w-full rounded-none border border-[var(--color-accent)]/20 bg-[var(--color-bg)]/60 py-2.5 pl-9 pr-3 text-[13px] text-[var(--color-text)] placeholder:text-[var(--color-text-dim)] focus:border-[var(--color-accent)]/50 focus:outline-none"
          />
        </label>
      </div>

      {bosses.length === 0 ? (
        <p className="mt-6 text-[13px] text-[var(--color-text-dim)]">
          No boss matches “{query.trim()}”.
        </p>
      ) : (
        <div className="mt-4 space-y-6">
          {BAND_ORDER.map((band) => {
            const group = bosses.filter((boss) => bandFor(boss, combatLevel) === band);
            if (group.length === 0) return null;
            const accent =
              band === "in-reach" ? "var(--msg-good)" : band === "almost" ? "var(--gold-500)" : "var(--stone-text-muted)";
            return (
              <div key={band} data-bestiary-band={band}>
                {/* The header carries the count. A group that says how many it
                    holds is the game's own quest-list footer, and it is the
                    difference between a heading and a label. */}
                <h3
                  className="flex items-baseline gap-2 border-b border-[var(--color-border)] pb-1 font-[family-name:var(--font-display)] text-[13px] font-bold uppercase tracking-[0.2em]"
                  style={{ color: accent }}
                >
                  {combatLevel === null ? BAND_COPY[band].anonymous : BAND_COPY[band].known}
                  <span className="text-[11.5px] font-normal tracking-normal text-[var(--color-text-dim)]" style={{ fontVariantNumeric: "tabular-nums" }}>
                    {group.length}
                  </span>
                </h3>
                <ul className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
{group.map((boss) => {
            const requirement = requirementLine(boss);
            return (
              <li key={boss.slug}>
                {(() => {
                  const tileClass = "flex h-full w-full items-center gap-2.5 rounded-none border border-[var(--color-accent)]/15 bg-[var(--color-bg)]/40 px-3 py-2.5 text-left transition-all hover:border-[var(--color-accent)]/45 hover:bg-[var(--color-accent)]/5";
                  const inner = (
                    <>
                      <span className="inline-flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-none border border-[var(--color-accent)]/20 bg-[var(--color-bg)]/60">
                        <BossSprite boss={boss} size={28} />
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-[13px] font-semibold text-[var(--color-text)]">
                          {boss.name}
                        </span>
                        {requirement && (
                          <span className="mt-0.5 block truncate text-[11.5px] text-[var(--color-text-dim)]">
                            {requirement}
                          </span>
                        )}
                      </span>
                    </>
                  );
                  if (onPick) {
                    return (
                      <button type="button" onClick={() => onPick(boss)} className={tileClass}>
                        {inner}
                      </button>
                    );
                  }
                  if (!interactive) return <div className={tileClass}>{inner}</div>;
                  return (
                    <Link href={`/dps?boss=${boss.slug}`} className={tileClass}>
                      {inner}
                    </Link>
                  );
                })()}
              </li>
            );
          })}
                </ul>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
