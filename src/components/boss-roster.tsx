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
import { Search } from "lucide-react";
import { BOSSES, type Boss } from "@/lib/bosses";
import { BOSS_ACCESS } from "@/lib/content-access-data";
import { BossSprite } from "@/components/boss-picker";

/** Combat-level entry bars, mirrored from the /next engine's BOSS_CL_GATE. */
const COMBAT_GATE: Record<string, number> = {
  "obor": 50, "bryophyta": 55, "giant-mole": 65,
  "barrows": 75, "king-black-dragon": 80, "sarachnis": 80,
  "dks-rex": 85, "dks-prime": 85, "dks-supreme": 85, "kraken": 85,
  "zulrah": 90, "sire": 95, "thermonuclear": 90, "skotizo": 95,
  "vorkath": 100, "graardor": 100, "kree": 100, "cerberus": 100,
  "grotesque-guardians": 100, "phantom-muspah": 105, "demonic-gorillas": 105,
  "zilyana": 110, "kril": 110, "hydra": 110, "araxxor": 110,
  "vardorvis": 115, "leviathan": 115, "whisperer": 115, "duke-sucellus": 115,
  "nex": 120
};

function requirementLine(boss: Boss): string | null {
  const quests = BOSS_ACCESS[boss.slug]?.quests;
  if (quests?.length) return quests.join(" · ");
  const gate = COMBAT_GATE[boss.slug];
  return gate ? `Combat ${gate}+` : null;
}

export function BossRoster({ onPick }: { onPick: (boss: Boss) => void }) {
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
            className="w-full rounded-lg border border-[var(--color-accent)]/20 bg-[var(--color-bg)]/60 py-2.5 pl-9 pr-3 text-[13px] text-[var(--color-text)] placeholder:text-[var(--color-text-dim)] focus:border-[var(--color-accent)]/50 focus:outline-none"
          />
        </label>
      </div>

      {bosses.length === 0 ? (
        <p className="mt-6 text-[13px] text-[var(--color-text-dim)]">
          No boss matches “{query.trim()}”.
        </p>
      ) : (
        <ul className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {bosses.map((boss) => {
            const requirement = requirementLine(boss);
            return (
              <li key={boss.slug}>
                <button
                  type="button"
                  onClick={() => onPick(boss)}
                  className="flex h-full w-full items-center gap-2.5 rounded-xl border border-[var(--color-accent)]/15 bg-[var(--color-bg)]/40 px-3 py-2.5 text-left transition-all hover:border-[var(--color-accent)]/45 hover:bg-[var(--color-accent)]/5"
                >
                  <span className="inline-flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-[var(--color-accent)]/20 bg-[var(--color-bg)]/60">
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
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
