import type { ReactNode } from "react";
import { Numeral, ParchmentNote, Ratio } from "./stone";

/**
 * REBRAND.md 5.7 — the Sunday recap, as a sealed scroll.
 *
 * The recap already exists as a Discord embed and a database ledger. This is
 * the same content shown on the site, so /plugin can say what the message
 * looks like instead of describing it.
 *
 * The bar is text, deliberately: it is what actually goes out over Discord, so
 * a picture of a different bar would be a mockup of something that does not
 * ship. Floored, never rounded — a full bar means done, and 99.4% rendering
 * full sends a player to a page to find out they are not.
 */
export function ScrollRecap({
  rsn,
  lines,
  goal
}: {
  rsn: string;
  /** Label + value. Values are single quantities, so they may be numerals. */
  lines: Array<{ label: string; value: ReactNode }>;
  goal?: { target: string; percent: number; remainder?: string | null };
}) {
  const cells = 10;
  const clamped = Math.max(0, Math.min(100, Number.isFinite(goal?.percent ?? 0) ? goal!.percent : 0));
  const filled = Math.min(cells, Math.floor((clamped / 100) * cells));
  const shown = clamped >= 100 ? 100 : Math.min(99, Math.floor(clamped));

  return (
    <ParchmentNote data-scroll-recap="true" className="relative">
      {/* The seal. A circle is legitimate here — it is a blob of wax, not a
          panel — so F8 does not apply and the lint scopes to panel/card. */}
      <span
        aria-hidden="true"
        className="absolute right-3 top-3 flex size-9 items-center justify-center rounded-full font-[family-name:var(--font-display)] text-[length:var(--text-micro)] font-bold text-[var(--parchment-100)]"
        style={{ background: "var(--gold-600)", boxShadow: "1px 1px 0 var(--bevel-dark)" }}
      >
        S
      </span>
      <h3 className="font-[family-name:var(--font-display)] text-[length:var(--text-subject)] font-bold text-[var(--ink-900)]">
        This week in Gielinor
      </h3>
      <p className="mt-0.5 text-[length:var(--text-micro)] font-normal text-[var(--ink-500)]">{rsn}</p>

      <dl className="mt-3 space-y-1.5">
        {lines.map((line) => (
          <div key={line.label} className="flex items-baseline justify-between gap-3 border-b border-[var(--parchment-line)] pb-1.5">
            <dt className="text-[length:var(--text-body)] font-normal text-[var(--ink-700)]">{line.label}</dt>
            <dd className="shrink-0">{line.value}</dd>
          </div>
        ))}
      </dl>

      {goal && (
        <div className="mt-3">
          <p className="text-[length:var(--text-body)] font-semibold text-[var(--ink-900)]">{goal.target}</p>
          {/* Drawn, not typed. The Discord embed sends ▓ and ░ because Discord
              renders them; on the page they fall outside Fraunces and the
              browser substitutes a face that has no glyph, so the empty cells
              came out as tofu boxes. Caught by the Section 7 screenshot pass,
              not by reading the code — which is what that pass is for.

              Same arithmetic as the embed: floored, so a full bar always means
              done. */}
          <p className="mt-1 flex items-center gap-2 text-[length:var(--text-body)] text-[var(--ink-900)]">
            <span aria-hidden="true" className="flex gap-[2px]">
              {Array.from({ length: cells }, (_, index) => (
                <span
                  key={index}
                  className="block h-3 w-2"
                  style={{
                    background: index < filled ? "var(--ink-700)" : "var(--parchment-300)",
                    borderRadius: "var(--radius-sm)"
                  }}
                />
              ))}
            </span>
            <Ratio>{shown}%</Ratio>
          </p>
          {goal.remainder && (
            <p className="mt-0.5 text-[length:var(--text-micro)] font-normal text-[var(--ink-500)]">
              {goal.remainder} to go.
            </p>
          )}
        </div>
      )}
    </ParchmentNote>
  );
}

/** A quantity for a recap row. Single labelled numbers only — never a ratio. */
export function RecapNumber({ children }: { children: ReactNode }) {
  return <Numeral className="text-[length:var(--text-body)] text-[var(--ink-900)]">{children}</Numeral>;
}
