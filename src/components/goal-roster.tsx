"use client";

// The always-visible unlock catalogue on /goals.
//
// /goals asks "What unlock next?" and showed none of the forty-two curated
// sets until a bank was pasted — the page was a bank-import form wearing an
// unlock headline. Same inversion as the boss roster: content stands on its
// own, the account makes it personal.
//
// Deliberately verdict-free without a bank. We show what a set contains,
// never a guess at how close the player is — that claim needs their items.

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { GOAL_SETS, type GoalSet } from "@/lib/goals";
import { ItemSprite } from "@/components/item-sprite";

/** Grouping the player recognises, in the order a normal account meets them. */
const CATEGORY_ORDER: Array<{ key: string; label: string }> = [
  { key: "diary", label: "Diary rewards" },
  { key: "skill-outfits", label: "Skilling outfits" },
  { key: "capes", label: "Capes" },
  { key: "combat-prestige", label: "Combat prestige" },
  { key: "barrows", label: "Barrows" },
  { key: "gwd", label: "God Wars" },
  { key: "raid-uniques", label: "Raid uniques" },
  { key: "wildy-bosses", label: "Wilderness" },
  { key: "quest-uniques", label: "Quest rewards" },
  { key: "graceful", label: "Graceful" },
  { key: "misc-untradeable", label: "Other untradeables" }
];

function pieceLabel(set: GoalSet): string {
  const count = set.goals.length;
  return `${count} ${count === 1 ? "piece" : "pieces"}`;
}

export function GoalRoster({ onPick }: { onPick?: (set: GoalSet) => void }) {
  const [query, setQuery] = useState("");

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const pool = q
      ? GOAL_SETS.filter((set) =>
          set.name.toLowerCase().includes(q)
          || set.goals.some((goal) => goal.name.toLowerCase().includes(q)))
      : GOAL_SETS;

    const known = new Set(CATEGORY_ORDER.map((entry) => entry.key));
    const ordered = CATEGORY_ORDER.map((entry) => ({
      label: entry.label,
      sets: pool.filter((set) => set.category === entry.key)
    }));
    // Anything with a category we did not list still has to appear, or adding
    // one silently hides content.
    const rest = pool.filter((set) => !known.has(set.category));
    if (rest.length > 0) ordered.push({ label: "More", sets: rest });
    return ordered.filter((group) => group.sets.length > 0);
  }, [query]);

  const total = groups.reduce((sum, group) => sum + group.sets.length, 0);

  return (
    <section className="mt-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-[19px] font-bold tracking-normal text-[var(--color-text)]">
            Every unlock
          </h2>
          <p className="mt-0.5 text-[13px] text-[var(--color-text-dim)]">
            What each one takes, before any account. Add your bank and each shows how close you are.
          </p>
        </div>
        <label className="relative sm:w-64">
          <span className="sr-only">Search unlocks</span>
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--color-text-dim)]"
          />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search unlocks or items"
            className="w-full rounded-none border border-[var(--color-accent)]/20 bg-[var(--color-bg)]/60 py-2.5 pl-9 pr-3 text-[13px] text-[var(--color-text)] placeholder:text-[var(--color-text-dim)] focus:border-[var(--color-accent)]/50 focus:outline-none"
          />
        </label>
      </div>

      {total === 0 ? (
        <p className="mt-6 text-[13px] text-[var(--color-text-dim)]">
          Nothing matches “{query.trim()}”.
        </p>
      ) : (
        groups.map((group) => (
          <div key={group.label} className="mt-5">
            <h3 className="text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--color-accent)]">
              {group.label}
            </h3>
            <ul className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
              {group.sets.map((set) => {
                const body = (
                  <>
                    <span className="inline-flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-none border border-[var(--color-accent)]/20 bg-[var(--color-bg)]/60">
                      {set.iconItemId
                        ? <ItemSprite id={set.iconItemId} alt="" size={26} />
                        : <span aria-hidden="true" className="text-[15px]">{set.emoji ?? "•"}</span>}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-[13px] font-semibold text-[var(--color-text)]">
                        {set.name}
                      </span>
                      <span className="mt-0.5 block truncate text-[11.5px] text-[var(--color-text-dim)]">
                        {pieceLabel(set)}
                      </span>
                    </span>
                  </>
                );
                const className = "flex h-full w-full items-center gap-2.5 rounded-none border border-[var(--color-accent)]/15 bg-[var(--color-bg)]/40 px-3 py-2.5 text-left transition-all hover:border-[var(--color-accent)]/45 hover:bg-[var(--color-accent)]/5";
                return (
                  <li key={set.id}>
                    {onPick ? (
                      <button type="button" onClick={() => onPick(set)} className={className}>
                        {body}
                      </button>
                    ) : (
                      <div className={className}>{body}</div>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ))
      )}
    </section>
  );
}
