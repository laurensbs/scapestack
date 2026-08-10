import type { ReactNode } from "react";
import { SpriteFrame, StonePanel, Verdict, type VerdictTone } from "./stone";

/**
 * REBRAND.md 5.6 — bosses grouped by reachability, never a flat grid.
 *
 * The honest difficulty this component has to solve: reachability is a fact
 * about a PLAYER, and the roster renders for visitors who have given no
 * account. Guessing there would be the same false confidence the engine spent
 * a rewrite removing from its recommendations.
 *
 * So the group NAMES change with what is known. Told nothing, the three groups
 * describe the gate the game puts on the door; given a combat level, the same
 * three groups describe the player. One shape, two honest readings, and the
 * caller decides which by passing `combatLevel` or not.
 */

export type BestiaryBand = "in-reach" | "almost" | "a-dream";

export interface BestiaryEntry {
  slug: string;
  name: string;
  /** What the game asks for. "Combat 100+", "Dragon Slayer II". */
  requirement: string | null;
  band: BestiaryBand;
  /** The sprite. Passed in so this component never fetches. */
  sprite?: ReactNode;
}

const BAND_ORDER: BestiaryBand[] = ["in-reach", "almost", "a-dream"];

const BAND: Record<BestiaryBand, { known: string; anonymous: string; verdict: string; tone: VerdictTone }> = {
  "in-reach": { known: "In reach", anonymous: "Walk in", verdict: "Can do it", tone: "good" },
  almost: { known: "Almost", anonymous: "Needs a mid-game account", verdict: "Almost", tone: "almost" },
  "a-dream": { known: "A dream", anonymous: "Late game", verdict: "Not yet", tone: "dream" }
};

export function Bestiary({
  entries,
  combatLevel = null,
  title = "Bestiary"
}: {
  entries: readonly BestiaryEntry[];
  /** Null when nobody is known. Changes the group names, not the grouping. */
  combatLevel?: number | null;
  title?: ReactNode;
}) {
  const total = entries.length;
  const reachable = entries.filter((entry) => entry.band === "in-reach").length;

  return (
    <StonePanel
      title={title}
      data-bestiary="true"
      footer={
        // The game's own quest-list footer: a count, at the bottom, closing
        // the panel. It is also the only number here, which is why it earns
        // the space.
        combatLevel === null
          ? <>Every boss the almanac knows: <span style={{ fontVariantNumeric: "tabular-nums lining-nums" }}>{total}</span></>
          : <>Can walk in today: <span style={{ fontVariantNumeric: "tabular-nums lining-nums" }}>{reachable}</span> of <span style={{ fontVariantNumeric: "tabular-nums lining-nums" }}>{total}</span></>
      }
    >
      <div className="space-y-5">
        {BAND_ORDER.map((band) => {
          const group = entries.filter((entry) => entry.band === band);
          if (group.length === 0) return null;
          const copy = BAND[band];
          const accent =
            band === "in-reach" ? "var(--msg-good)" : band === "almost" ? "var(--gold-500)" : "var(--stone-text-muted)";

          return (
            <section key={band} data-bestiary-band={band}>
              <h3
                className="flex items-baseline gap-2 border-b border-[var(--stone-900)] pb-1 font-[family-name:var(--font-display)] text-[length:var(--text-micro)] font-semibold uppercase tracking-[0.2em]"
                style={{ color: accent }}
              >
                {combatLevel === null ? copy.anonymous : copy.known}
                <span
                  className="font-[family-name:var(--font-body)] text-[length:var(--text-label)] font-normal tracking-normal text-[var(--stone-text-muted)]"
                  style={{ fontVariantNumeric: "tabular-nums lining-nums" }}
                >
                  {group.length}
                </span>
              </h3>

              <ul className="mt-2 divide-y divide-[var(--stone-800)]">
                {group.map((entry) => (
                  <li key={entry.slug} className="flex items-center gap-3 py-2" data-bestiary-entry={entry.slug}>
                    {entry.sprite && <SpriteFrame size={38}>{entry.sprite}</SpriteFrame>}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-[family-name:var(--font-display)] text-[length:var(--text-body)] font-semibold text-[var(--stone-text)]">
                        {entry.name}
                      </span>
                      {entry.requirement && (
                        <span className="mt-0.5 block truncate text-[length:var(--text-micro)] font-normal text-[var(--stone-text-muted)]">
                          {entry.requirement}
                        </span>
                      )}
                    </span>
                    {/* Player language, not a score. "Can do it" is what
                        someone says out loud; "83% match" is what a dashboard
                        says. Only shown once a player is known — with nobody
                        known there is no verdict to give. */}
                    {combatLevel !== null && <Verdict tone={copy.tone}>{copy.verdict}</Verdict>}
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </StonePanel>
  );
}
