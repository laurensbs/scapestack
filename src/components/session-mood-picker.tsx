"use client";

import { useEffect, useState } from "react";
import { ChevronRight, Sword, X } from "lucide-react";
import { ItemSprite } from "@/components/item-sprite";
import { MOOD_LABEL, type Mood, type TimeBudget } from "@/lib/mood";
import { saveMood } from "@/lib/mood-storage";
import { cn } from "@/lib/utils";

const SESSION_MOODS: Array<{ mood: Mood; minutes: TimeBudget }> = [
  { mood: "chill", minutes: 30 },
  { mood: "cash", minutes: 60 },
  { mood: "bossing", minutes: 60 },
  { mood: "unlock", minutes: 120 },
  { mood: "afk", minutes: 60 },
  { mood: "short", minutes: 15 }
];

interface SessionMoodPickerProps {
  rsn?: string | null;
  label?: string;
  compact?: boolean;
  mobileTile?: boolean;
  wide?: boolean;
  className?: string;
  onMoodChange?: (selection: { mood: Mood; minutes: TimeBudget; label: string }) => void;
}

export function SessionMoodPicker({
  rsn,
  label = "Best now",
  compact = false,
  mobileTile = false,
  wide = false,
  className,
  onMoodChange
}: SessionMoodPickerProps) {
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState(label);

  useEffect(() => {
    setPicked(label);
  }, [label]);

  const chooseMood = (mood: Mood, minutes: TimeBudget) => {
    saveMood({ mood, minutes }, rsn || undefined);
    setPicked(MOOD_LABEL[mood].name);
    onMoodChange?.({ mood, minutes, label: MOOD_LABEL[mood].name });
    setOpen(false);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        className={cn(
          wide
            ? "group flex min-h-[68px] w-full items-center justify-between gap-3 rounded-lg border border-[var(--color-parchment-edge)] bg-[var(--color-parchment-dark)]/42 px-3 py-3 text-left shadow-[inset_0_1px_0_rgba(245,236,221,0.05)] transition-colors hover:border-[var(--color-accent)] hover:bg-[var(--color-parchment)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]/45"
            : mobileTile
              ? "flex min-h-[54px] flex-col items-center justify-center rounded-xl border border-[var(--color-accent)]/35 bg-[var(--color-accent)]/10 px-1.5 text-center text-[var(--color-accent)] transition-colors hover:border-[var(--color-accent)]/55"
              : "inline-flex items-center gap-1 whitespace-nowrap rounded-full px-1.5 py-1 transition-colors hover:text-[var(--color-accent)]",
          compact && !mobileTile && !wide && "rounded-lg border border-[var(--color-border)] px-2 py-1.5",
          className
        )}
      >
        {wide ? (
          <>
            <span className="min-w-0">
              <span className="block text-[12.5px] font-bold text-[var(--color-text)]">
                What are you in the mood for?
              </span>
              <span className="mt-0.5 block text-[11px] leading-relaxed text-[var(--color-text-muted)]">
                Tap to pick Chill, GP, Bossing, Unlock, AFK or Short.
              </span>
            </span>
            <span className="inline-flex shrink-0 items-center gap-2 rounded-md border border-[var(--color-gold-deep)] bg-[var(--color-accent)] px-3 py-2 text-[13px] font-extrabold text-[#0B0906] shadow-[inset_0_1px_0_rgba(255,241,168,0.32),inset_0_-2px_0_rgba(0,0,0,0.22)]">
              <Sword className="size-3.5 text-[#0B0906]" />
              <span className="max-w-[92px] truncate">{picked}</span>
              <ChevronRight className="size-3.5 text-[#0B0906] transition-transform group-hover:translate-x-0.5" />
            </span>
          </>
        ) : (
          <>
            <Sword className={mobileTile ? "size-4" : "size-3.5"} />
            <span className={mobileTile ? "mt-1 max-w-full truncate text-[11px] font-bold leading-none" : ""}>
              {picked}
            </span>
            {mobileTile && (
              <span className="mt-0.5 max-w-full truncate text-[9.5px] font-semibold leading-none opacity-70">
                Vibe
              </span>
            )}
          </>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="session-mood-title"
          className="fixed inset-0 z-[120] bg-black/70 px-4 pb-5 pt-24 backdrop-blur-sm sm:grid sm:place-items-center sm:py-8"
          onClick={() => setOpen(false)}
        >
          <div
            className="osrs-frame w-full max-w-xl text-left"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="osrs-title-bar flex items-start justify-between gap-4 px-5 py-3 sm:px-6">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--color-accent)]">Pick a session</p>
                <h2 id="session-mood-title" className="mt-1 text-[24px] font-semibold leading-tight text-[var(--color-text)]">
                  What do you feel like doing?
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close session picker"
                className="inline-flex size-9 shrink-0 items-center justify-center rounded-full border border-[var(--color-border)] text-[var(--color-text-muted)] transition-colors hover:border-[var(--color-accent)]/55 hover:text-[var(--color-accent)]"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="osrs-body px-5 pb-5 pt-4 sm:px-6 sm:pb-6">
              <p className="text-[13px] leading-relaxed text-[var(--color-text-muted)]">
                Your next plan changes for this account.
              </p>
              <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {SESSION_MOODS.map(({ mood, minutes }) => {
                const meta = MOOD_LABEL[mood];
                return (
                  <button
                    key={mood}
                    type="button"
                    onClick={() => chooseMood(mood, minutes)}
                    className="min-h-[88px] rounded-lg border border-[var(--color-parchment-edge)]/70 bg-[var(--color-parchment-dark)]/58 px-3 py-3 text-left shadow-[inset_0_1px_0_rgba(245,236,221,0.04)] transition-colors hover:border-[var(--color-accent)] hover:bg-[var(--color-parchment)]"
                  >
                    <span className="flex items-center gap-2">
                      <span className="inline-flex size-8 items-center justify-center rounded-lg border border-[var(--color-accent)]/25 bg-[var(--color-accent)]/10">
                        <ItemSprite id={meta.itemId} alt="" size={22} />
                      </span>
                      <span className="text-[14px] font-bold text-[var(--color-text)]">{meta.name}</span>
                    </span>
                    <span className="mt-2 block text-[11.5px] leading-snug text-[var(--color-text-muted)]">
                      {meta.tagline}
                    </span>
                  </button>
                );
              })}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
