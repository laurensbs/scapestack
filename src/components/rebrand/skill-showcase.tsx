import type { ReactNode } from "react";
import { Numeral, SpriteFrame, StonePanel } from "./stone";

/**
 * REBRAND.md 5.3 — the skills vitrine.
 *
 * The one place Pixelify Sans earns its keep. A skill level is the archetypal
 * single labelled quantity: one number, one word beside it, no ratio to
 * misread. §10.2 keeps the face away from fractions for a measured reason —
 * its 5 reads as an S and its 7 as a bare stem — and none of that applies to
 * "99".
 *
 * The hover turns the number --title-yellow, which is what the game does to
 * anything under the cursor. It is the cheapest possible nod and it costs no
 * layout.
 */

export interface ShowcaseSkill {
  name: string;
  level: number;
  /** The wiki sprite. Passed in; this component never fetches. */
  sprite?: ReactNode;
  /** Set on a skill that just levelled — flashes --msg-good. */
  levelledUp?: boolean;
}

export function SkillShowcase({
  skills,
  total,
  title = "Skills"
}: {
  skills: readonly ShowcaseSkill[];
  /** Total level. The black bar the game closes its skill tab with. */
  total?: number;
  title?: ReactNode;
}) {
  return (
    <StonePanel
      title={title}
      data-skill-showcase="true"
      footer={
        total === undefined
          ? undefined
          : (
            <>
              Total level{" "}
              <Numeral className="text-[length:var(--text-body)] text-[var(--title-yellow)]">{total}</Numeral>
            </>
          )
      }
    >
      {/* Three columns, as the game's own skill tab has. Not a responsive
          auto-fit: the three-column read IS the reference, and a grid that
          reflows to five on a wide screen stops looking like the thing it is
          quoting. */}
      <ul className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
        {skills.map((skill) => (
          <li
            key={skill.name}
            data-showcase-skill={skill.name.toLowerCase()}
            className="group/skill flex items-center gap-2 bg-[var(--stone-800)] px-2 py-1.5"
            style={{
              borderRadius: "var(--radius-sm)",
              boxShadow: "inset 1px 1px 0 var(--bevel-dark), inset -1px -1px 0 rgba(255,236,190,0.08)"
            }}
          >
            {skill.sprite && <SpriteFrame size={24}>{skill.sprite}</SpriteFrame>}
            <span className="min-w-0 flex-1 truncate text-[length:var(--text-micro)] font-normal text-[var(--stone-text-muted)]">
              {skill.name}
            </span>
            <Numeral
              className={
                skill.levelledUp
                  ? "text-[length:var(--text-body)] text-[var(--msg-good)]"
                  : "text-[length:var(--text-body)] group-hover/skill:text-[var(--title-yellow)]"
              }
            >
              {skill.level}
            </Numeral>
          </li>
        ))}
      </ul>
    </StonePanel>
  );
}
