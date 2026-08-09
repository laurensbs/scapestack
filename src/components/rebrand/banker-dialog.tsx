import type { ReactNode } from "react";
import { ParchmentNote } from "./stone";

/**
 * REBRAND.md 5.4 — bank import as an NPC conversation.
 *
 * The paste form is not going away and should not: pasting is what the player
 * actually does, and replacing a working control with a costume would be the
 * "renamed tool" failure in the other direction. What changes is the frame
 * around it. An OSRS dialogue box has a speaker, a name plate and one line of
 * speech, and that is a better container for "here is what I need from you"
 * than a form legend is.
 *
 * The portrait slot is a neutral silhouette, not a wiki NPC render. §9.4 is
 * explicit that assets must not be extracted from the game, and a generic
 * banker sprite would be exactly that; the silhouette carries the shape of the
 * convention without borrowing anyone's art.
 */
export function BankerDialog({
  speaker,
  says,
  children,
  footnote
}: {
  /** The name plate. "Banker", "Guide" — whoever is talking. */
  speaker: string;
  /** One line of speech. Short, plain, faintly dry — OSRS dialogue voice. */
  says: ReactNode;
  /** The control the conversation is about. */
  children: ReactNode;
  footnote?: ReactNode;
}) {
  return (
    <div data-banker-dialog="true">
      <div
        className="flex items-center gap-2 border border-b-0 border-[var(--wood-700)] bg-[var(--wood-500)] px-3 py-1.5"
        style={{ borderTopLeftRadius: "var(--radius-md)", borderTopRightRadius: "var(--radius-md)" }}
      >
        <span
          aria-hidden="true"
          className="flex size-6 shrink-0 items-center justify-center bg-[var(--stone-900)] text-[var(--stone-text-muted)]"
          style={{ borderRadius: "var(--radius-sm)" }}
        >
          {/* A silhouette, drawn here. Not a game asset — §9.4. */}
          <svg viewBox="0 0 16 16" className="size-4" fill="currentColor">
            <circle cx="8" cy="5" r="3" />
            <path d="M2 15c0-3.3 2.7-6 6-6s6 2.7 6 6z" />
          </svg>
        </span>
        <span className="font-[family-name:var(--font-display)] text-[length:var(--text-micro)] font-bold uppercase tracking-[0.2em] text-[var(--gold-300)]">
          {speaker}
        </span>
      </div>
      <ParchmentNote className="rounded-t-none border-t-0" style={{ borderTopLeftRadius: 0, borderTopRightRadius: 0 }}>
        <p className="text-[length:var(--text-body)] font-normal leading-relaxed text-[var(--ink-900)]">{says}</p>
        <div className="mt-3">{children}</div>
        {footnote && (
          <p className="mt-3 border-t border-[var(--parchment-line)] pt-2 text-[length:var(--text-micro)] font-normal italic text-[var(--ink-500)]">
            {footnote}
          </p>
        )}
      </ParchmentNote>
    </div>
  );
}
