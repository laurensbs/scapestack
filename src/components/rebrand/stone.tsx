import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * REBRAND.md Section 5 — the base surfaces.
 *
 * Direction: "weathered Gielinor almanac / in-world adventurer's tool", built
 * as direction C, The Field Ledger. The signature element is the journal
 * column: a recessed panel with a studded title bar and a black tally footer,
 * at the proportions an OSRS side panel actually has.
 *
 * Depth here is a HARD BEVEL and never a blur (F11). That is not a stylistic
 * preference — it is what makes the surface read as carved rather than as a
 * floating card, and osrs.design's own shadow token is a 1px offset with no
 * blur at all.
 */

/** Light top-left, dark bottom-right. The whole depth system, in one string. */
const BEVEL_RAISED = "inset 1px 1px 0 var(--bevel-light), inset -1px -1px 0 var(--bevel-dark)";
/** Inverted: the surface is cut INTO the stone rather than sitting on it. */
const BEVEL_RECESSED = "inset 1px 1px 0 var(--bevel-dark), inset -1px -1px 0 var(--bevel-light)";

export function StonePanel({
  title,
  children,
  footer,
  recessed = false,
  className,
  ...rest
}: {
  /** Rendered as a studded title strip. Cinzel, tracked, gold on wood. */
  title?: ReactNode;
  children: ReactNode;
  /** The black tally bar — a total, a count, one number that closes the panel. */
  footer?: ReactNode;
  recessed?: boolean;
  className?: string;
} & Omit<React.HTMLAttributes<HTMLDivElement>, "title">) {
  return (
    <div
      {...rest}
      data-stone-panel="true"
      className={cn("border-[3px] border-[var(--wood-700)] bg-[var(--stone-700)]", className)}
      style={{
        borderRadius: "var(--radius-md)",
        boxShadow: recessed ? BEVEL_RECESSED : BEVEL_RAISED,
        ...(rest.style as CSSProperties)
      }}
    >
      {title !== undefined && (
        <div
          data-stone-panel-title="true"
          className="flex items-center justify-between gap-2 border-b border-[var(--stone-900)] bg-[var(--stone-800)] px-3 py-2"
          style={{ boxShadow: "inset 0 1px 0 var(--bevel-light)" }}
        >
          {/* The studs are two 2px squares, not decoration for its own sake:
              they are what the game's title bars actually carry, and they are
              the cheapest signal that this is a panel and not a div. */}
          <span aria-hidden="true" className="size-[3px] shrink-0 bg-[var(--stone-500)]" />
          <span className="min-w-0 flex-1 truncate text-center font-[family-name:var(--font-display)] text-[length:var(--text-body)] font-bold uppercase tracking-[0.28em] text-[var(--gold-500)]">
            {title}
          </span>
          <span aria-hidden="true" className="size-[3px] shrink-0 bg-[var(--stone-500)]" />
        </div>
      )}
      <div className="p-3 sm:p-4">{children}</div>
      {footer !== undefined && (
        <div
          data-stone-panel-footer="true"
          className="border-t border-[var(--stone-900)] bg-[var(--stone-900)] px-3 py-2 text-center text-[length:var(--text-micro)] font-normal text-[var(--stone-text-muted)]"
        >
          {footer}
        </div>
      )}
    </div>
  );
}

/**
 * The reading surface. Prose a player actually reads goes here and nowhere
 * else — the briefing, an examine line, the privacy scroll.
 *
 * Direction C rations parchment deliberately: the game's quest list is stone
 * and the books you read inside it are paper. A page that is parchment
 * everywhere stops meaning anything by being everywhere.
 */
export function ParchmentNote({
  children,
  className,
  ruled = false,
  ...rest
}: {
  children: ReactNode;
  className?: string;
  /** Faint rule lines, as an almanac page has. Off by default. */
  ruled?: boolean;
} & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      {...rest}
      data-parchment-note="true"
      className={cn(
        "border border-[var(--parchment-300)] bg-[var(--parchment-100)] p-3 font-[family-name:var(--font-body)] text-[length:var(--text-body)] font-normal leading-relaxed text-[var(--ink-900)] sm:p-4",
        className
      )}
      style={{
        borderRadius: "var(--radius-md)",
        // A hard 2px offset, no blur — paper lying on stone, not floating.
        boxShadow: "2px 2px 0 var(--bevel-dark)",
        // The aging is a repeating gradient rather than an image: no request,
        // no cache, and it survives being scaled.
        backgroundImage: ruled
          ? "repeating-linear-gradient(to bottom, transparent 0, transparent 27px, var(--parchment-line) 27px, var(--parchment-line) 28px)"
          : "radial-gradient(circle at 20% 15%, var(--parchment-200) 0%, transparent 45%), radial-gradient(circle at 80% 70%, var(--parchment-200) 0%, transparent 40%)",
        ...(rest.style as CSSProperties)
      }}
    >
      {children}
    </div>
  );
}

/**
 * Any wiki sprite. Pixel art is rendered pixelated, never smoothed — a
 * bilinear-scaled 32px sprite is the single fastest way to make a game asset
 * look like a stock icon.
 *
 * Also the attribution hook (REBRAND.md 9.4): every sprite on the site passes
 * through here, so there is one place that knows they are CC BY-NC-SA 3.0.
 */
export function SpriteFrame({
  children,
  size = 46,
  className
}: {
  children: ReactNode;
  size?: number;
  className?: string;
}) {
  return (
    <span
      data-sprite-frame="true"
      className={cn("inline-flex shrink-0 items-center justify-center bg-[var(--stone-900)]", className)}
      style={{
        width: size,
        height: size,
        borderRadius: "var(--radius-sm)",
        boxShadow: BEVEL_RECESSED,
        imageRendering: "pixelated"
      }}
    >
      {children}
    </span>
  );
}

/**
 * A single labelled game quantity — a level, a KC, a gp total.
 *
 * NOT for ratios, drop rates or fractions. Measured during Phase A: Pixelify
 * Sans renders 5 as a hard S and 7 as a bare stem, so at every size REBRAND §2
 * names, "1/508" reads as "1/808" and "68/70" reads as "68/10". Those go in
 * Fraunces with tabular lining figures instead — see REBRAND.md §10.2, and
 * `Ratio` below.
 */
export function Numeral({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      data-numeral="true"
      className={cn("font-[family-name:var(--font-numeral)] font-bold text-[var(--gold-300)]", className)}
    >
      {children}
    </span>
  );
}

/** Every ratio, fraction, drop rate and price. Legible by construction. */
export function Ratio({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      data-ratio="true"
      className={cn("font-[family-name:var(--font-body)] font-medium", className)}
      style={{ fontVariantNumeric: "tabular-nums lining-nums" }}
    >
      {children}
    </span>
  );
}

export type VerdictTone = "good" | "almost" | "dream";

/**
 * "Can do it" / "Almost" / "Not yet".
 *
 * The red floor is a WCAG constraint, not a style: --msg-warn #ff0000 measures
 * 3.95:1 on stone-800, which fails AA for normal text. Rendering it at 16px/600
 * puts it under AA-large (3:1). Green and gold clear AA at any size; red gets
 * the size bump so all three can sit in one row. REBRAND.md §10.3.
 */
export function Verdict({ tone, children }: { tone: VerdictTone; children: ReactNode }) {
  const colour =
    tone === "good" ? "var(--msg-good)" : tone === "almost" ? "var(--gold-500)" : "var(--stone-text-muted)";
  return (
    <span
      data-verdict={tone}
      className="shrink-0 font-[family-name:var(--font-body)] font-semibold"
      style={{ color: colour, fontSize: "var(--text-body)" }}
    >
      {children}
    </span>
  );
}
