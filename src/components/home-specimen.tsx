// What the answer looks like, on the homepage, before you type anything.
//
// Direction B's claim is that the data is the design, so the homepage has to
// show data rather than describe it. The hard part is honesty: a table built
// from an invented bank would break the one thing the direction argues for, and
// a best-in-slot bank is worse than invented — the engine picks Tumeken's
// shadow for all 59 bosses and every row comes out identical.
//
// So this runs the real engine over the reference account Scapestack already
// ships behind "Try a sample plan". Every number below is computed at build
// time by the same code that answers for a real player, and the account is
// named on the page so nobody mistakes it for their own.

import { BOSSES, isNonCombatBossActivity } from "@/lib/bosses";
import { bossKnowledge, bossKnowledgeSupportsSingleDps } from "@/lib/boss-knowledge";
import { bossViabilityFromSimpleBank, type BossViability } from "@/lib/boss-viability";
import { combatStatsFromSkills } from "@/lib/dps";
import {
  REFERENCE_ACCOUNT_LABEL,
  REFERENCE_BANK,
  REFERENCE_LEVELS,
  referenceSkills
} from "@/lib/reference-account";

/** Enough to show the shape of an answer. Not a catalogue — that is /dps. */
const ROWS = 5;

function killTime(ttk: number | null): string {
  if (ttk === null || !Number.isFinite(ttk)) return "—";
  return ttk < 90 ? `${Math.round(ttk)}s` : `${Math.round(ttk / 60)}m`;
}

/** Exported so the guards exercise this, not a copy of it. */
export function specimenRows(): BossViability[] {
  const stats = combatStatsFromSkills(referenceSkills());
  if (!stats) return [];
  return BOSSES
    // Only encounters the engine is willing to answer with one DPS number.
    // Sorting by slowest-winnable pulled raids to the top and printed
    // "Theatre of Blood — Abyssal whip — 15m — Can kill" on the homepage,
    // which is exactly the overclaim direction B exists to avoid: a raid is
    // rooms, roles and a team, and a single kill time says nothing true about
    // it. The engine already knows this — bossKnowledge carries a dpsModel —
    // so the filter is its judgement, not a hand-kept blocklist.
    .filter((boss) => !isNonCombatBossActivity(boss)
      && bossKnowledgeSupportsSingleDps(bossKnowledge(boss)))
    .map((boss) => bossViabilityFromSimpleBank(REFERENCE_BANK, boss, stats))
    .filter((row): row is BossViability => Boolean(row) && row!.dps > 0 && row!.ttk !== null)
    .filter((row) => row.tone !== "blocked");
}

/**
 * The boundary, not the top or the bottom of the list.
 *
 * A page of seventeen-second kills teaches nothing and a page of four-minute
 * slogs is discouraging. What a player actually wants to know is where their
 * account stops being comfortable — so this takes the hardest fights that are
 * still clean, then the easiest ones that are not. It also means the verdict
 * column carries more than one step of the ramp, which is the design making
 * its own argument rather than being described.
 */
export function boundaryRows(all: BossViability[]): BossViability[] {
  const slowest = (rows: BossViability[]) =>
    [...rows].sort((left, right) => (right.ttk ?? 0) - (left.ttk ?? 0));
  const ready = slowest(all.filter((row) => row.tone === "ready")).slice(0, 3);
  const test = slowest(all.filter((row) => row.tone === "test")).reverse().slice(0, ROWS - ready.length);
  // If one side is thin, fill from the other rather than shipping a short table.
  const rows = [...ready, ...test];
  if (rows.length >= ROWS) return rows.slice(0, ROWS);
  const seen = new Set(rows.map((row) => row.boss.slug));
  return [...rows, ...slowest(all).filter((row) => !seen.has(row.boss.slug))].slice(0, ROWS);
}

export function HomeSpecimen() {
  const rows = boundaryRows(specimenRows());
  if (rows.length === 0) return null;

  const combat = Math.round(
    0.25 * (REFERENCE_LEVELS.Defence + REFERENCE_LEVELS.Hitpoints + Math.floor(REFERENCE_LEVELS.Prayer / 2))
    + 0.325 * (REFERENCE_LEVELS.Attack + REFERENCE_LEVELS.Strength)
  );

  return (
    <section className="mt-8" aria-labelledby="home-specimen-heading">
      <h2
        id="home-specimen-heading"
        className="text-[11px] font-semibold uppercase tracking-[0.07em] text-[var(--color-text-muted)]"
      >
        What the answer looks like
      </h2>
      <p className="mt-1 text-[13px] text-[var(--color-text-dim)]">
        {REFERENCE_ACCOUNT_LABEL}, combat {combat}, {REFERENCE_BANK.length} items in the bank.
      </p>

      {/* No width cap here: .scape-table-wrap already sets max-width:100% and
          wins the cascade, and the page's own 46rem measure is what actually
          constrains this. A Tailwind max-w- utility on this element looks like
          it works and does nothing — which is how the Setup column ended up
          reading "Ab…" while a comment above it claimed to have fixed that. */}
      <div className="scape-table-wrap mt-3">
        <table className="scape-table">
          <caption className="sr-only">
            Five bosses the demo account can kill, slowest first
          </caption>
          <thead>
            <tr>
              <th scope="col">Boss</th>
              <th scope="col">Setup</th>
              <th scope="col" data-num>Kill</th>
              <th scope="col">Verdict</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.boss.slug}>
                {/* The boss name is the one that may truncate: it is the
                    row's label and a reader recognises it from a prefix. The
                    setup is the answer, and half a weapon name answers
                    nothing. */}
                <th scope="row" className="w-full max-w-0 truncate">{row.boss.name}</th>
                <td className="whitespace-nowrap">{row.weaponName ?? "—"}</td>
                <td data-num>{killTime(row.ttk)}</td>
                <td>
                  {/* The word carries the meaning; the colour is a second
                      signal, never the only one. */}
                  <span className="scape-verdict" data-gate={row.tone}>{row.verdict}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
