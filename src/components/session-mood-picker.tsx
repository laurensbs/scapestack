"use client";

import { useEffect, useState } from "react";
import { Sword, X } from "lucide-react";
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
  className?: string;
  onMoodChange?: (selection: { mood: Mood; minutes: TimeBudget; label: string }) => void;
}

export function SessionMoodPicker({
  rsn,
  label = "Best now",
  compact = false,
  mobileTile = false,
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
          mobileTile
            ? "flex min-h-[54px] flex-col items-center justify-center rounded-xl border border-[var(--color-accent)]/35 bg-[var(--color-accent)]/10 px-1.5 text-center text-[var(--color-accent)] transition-colors hover:border-[var(--color-accent)]/55"
            : "inline-flex items-center gap-1 whitespace-nowrap rounded-full px-1.5 py-1 transition-colors hover:text-[var(--color-accent)]",
          compact && !mobileTile && "rounded-lg border border-[var(--color-border)] px-2 py-1.5",
          className
        )}
      >
        <Sword className={mobileTile ? "size-4" : "size-3.5"} />
        <span className={mobileTile ? "mt-1 max-w-full truncate text-[11px] font-bold leading-none" : ""}>
          {picked}
        </span>
        {mobileTile && (
          <span className="mt-0.5 max-w-full truncate text-[9.5px] font-semibold leading-none opacity-70">
            Vibe
          </span>
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
            className="w-full max-w-xl rounded-2xl border border-[var(--color-border)] bg-[#090909] p-5 text-left shadow-[0_30px_100px_-45px_rgba(0,0,0,0.92)] sm:p-6"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="eyebrow text-[var(--color-accent)]">Pick a session</p>
                <h2 id="session-mood-title" className="mt-1 text-[24px] font-semibold leading-tight text-[var(--color-text)]">
                  What do you feel like doing?
                </h2>
                <p className="mt-1 text-[13px] leading-relaxed text-[var(--color-text-muted)]">
                  Your next plan changes for this account.
                </p>
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

            <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {SESSION_MOODS.map(({ mood, minutes }) => {
                const meta = MOOD_LABEL[mood];
                return (
                  <button
                    key={mood}
                    type="button"
                    onClick={() => chooseMood(mood, minutes)}
                    className="min-h-[88px] rounded-xl border border-[var(--color-border)] bg-[var(--color-panel)] px-3 py-3 text-left transition-colors hover:border-[var(--color-accent)]/45 hover:bg-[var(--color-accent)]/8"
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
      )}
    </>
  );
}
