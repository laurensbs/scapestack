"use client";

import { useEffect, useState } from "react";
import { ItemSprite } from "@/components/item-sprite";
import type { IconicItem } from "@/lib/saved-bank";

interface Props {
  items: IconicItem[];
}

// Fires when a returning player's fresh bank-paste contains iconic items
// that weren't in their previously-saved bank. The whole reason save-bank
// exists is so we can recognise this moment: a player who quietly logged
// a Tbow last week opens the site and sees us recognise it. We don't
// celebrate on first paste (no diff possible) or when nothing iconic
// changed — the silence is the signal there.
//
// Auto-dismisses after ~6s; can be closed early via the × button.
// CSS-only animations (drop-celebrate-in / drop-celebrate-out keyframes
// in globals.css). No deps.
export function DropCelebration({ items }: Props) {
  const [visible, setVisible] = useState(true);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    // Six seconds is long enough to read, short enough that it doesn't
    // become wallpaper if the page sits open. The fade-out animation is
    // 0.5s; we trigger it 500ms before unmount.
    const t1 = setTimeout(() => setClosing(true), 5500);
    const t2 = setTimeout(() => setVisible(false), 6000);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  if (!visible || items.length === 0) return null;

  // Pick the single most impressive item (first in ICONIC_ITEMS order =
  // rarest tier). Showing all three feels like a marketing banner; one
  // big purple-style drop reads as the moment.
  const headline = items[0];
  const extra = items.length - 1;

  return (
    <div
      className="relative mb-4 overflow-hidden rounded-xl border border-[var(--color-accent)]/45 bg-gradient-to-r from-[var(--color-accent)]/12 via-[#7c3aed]/12 to-[var(--color-accent)]/12 px-5 py-4 flex items-center gap-4"
      style={{
        animation: closing
          ? "drop-celebrate-out 0.5s ease-in forwards"
          : "drop-celebrate-in 0.65s cubic-bezier(0.22, 1, 0.36, 1) both"
      }}
    >
      {/* Purple-sweep gradient overlay, moving once on mount. The OSRS
          on-drop "purple" colour is the visual cue every player recognises. */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ animation: closing ? undefined : "drop-celebrate-sweep 1.8s ease-out" }}
      />

      <div className="size-14 shrink-0 rounded-lg bg-[var(--color-bg)] border border-[var(--color-accent)]/50 flex items-center justify-center relative">
        <ItemSprite
          id={headline.iconItemId}
          alt=""
          className="pixelated"
          style={{
            maxWidth: "75%",
            maxHeight: "75%",
            filter: "drop-shadow(2px 2px 0 rgb(0 0 0 / 0.9))"
          }}
        />
      </div>

      <div className="flex-1 min-w-0">
        <div className="eyebrow text-[var(--color-accent)] mb-0.5">New since last visit</div>
        <h3 className="text-[16px] font-bold text-[var(--color-text)] tracking-normal">
          {headline.displayName}
          {extra > 0 && (
            <span className="ml-2 text-[12px] font-normal text-[var(--color-text-dim)]">
              +{extra} more iconic{extra > 1 ? "s" : ""}
            </span>
          )}
        </h3>
        <p className="mt-0.5 text-[12px] text-[var(--color-text-dim)]">
          Detected from your Bank Memory item names against the browser-only saved bank.
        </p>
      </div>

      <button
        type="button"
        onClick={() => { setClosing(true); setTimeout(() => setVisible(false), 500); }}
        className="size-7 shrink-0 rounded-md flex items-center justify-center text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-bg)]/40 transition-colors text-[18px]"
        aria-label="Dismiss"
      >
        ×
      </button>
    </div>
  );
}
