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
export function BossRoster({ onPick }: { onPick?: (boss: Boss) => void }) {
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
            Pick one to see the trip. Add your bank and each gets a verdict.
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
        <ul className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {bosses.map((boss) => {
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
                  return onPick ? (
                    <button type="button" onClick={() => onPick(boss)} className={tileClass}>
                      {inner}
                    </button>
                  ) : (
                    <Link href={`/dps?boss=${boss.slug}`} className={tileClass}>
                      {inner}
                    </Link>
                  );
                })()}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
