"use client";

import { useEffect, useState } from "react";
import { track } from "@/lib/analytics";

// Gallery-style hero visual. One boss at a time, full-bleed inside the
// frame, cross-fading every 5s. Replaces the orbit-of-8 arena which read
// as 'budget carousel' — too many tiny circles, none of them dramatic.
// This is the opposite: one boss owning the right hero column.
const SHOWCASE_BOSSES: Array<{ slug: string; label: string; dpsTarget: boolean }> = [
  { slug: "vorkath",   label: "Vorkath",            dpsTarget: true },
  { slug: "zulrah",    label: "Zulrah",             dpsTarget: true },
  { slug: "cox",       label: "Chambers of Xeric",  dpsTarget: false },
  { slug: "tob",       label: "Theatre of Blood",   dpsTarget: false },
  { slug: "toa",       label: "Tombs of Amascut",   dpsTarget: false },
  { slug: "hydra",     label: "Alchemical Hydra",   dpsTarget: true },
  { slug: "nex",       label: "Nex",                dpsTarget: true },
  { slug: "vardorvis", label: "Vardorvis",          dpsTarget: true }
];

const CYCLE_MS = 5000;

export function BossShowcase() {
  const [idx, setIdx] = useState(0);
  // Pause auto-cycle while the user is hovering over the showcase —
  // gives them a moment to read the name + decide whether to click
  // without the boss vanishing under their cursor.
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused) return;
    const t = setInterval(() => setIdx((i) => (i + 1) % SHOWCASE_BOSSES.length), CYCLE_MS);
    return () => clearInterval(t);
  }, [paused]);

  const active = SHOWCASE_BOSSES[idx];

  const navigate = (entry: typeof SHOWCASE_BOSSES[number]) => {
    const dest = entry.dpsTarget ? `/dps?boss=${entry.slug}` : "/next";
    track("homepage:sample", {
      source: "showcase-boss",
      boss: entry.slug,
      dest: entry.dpsTarget ? "dps" : "next"
    });
    window.location.assign(dest);
  };

  return (
    <div
      className="relative mx-auto"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      style={{
        width: "min(440px, 92vw)",
        aspectRatio: "1 / 1"
      }}
    >
      {/* Ambient glow behind the portrait — same gold gradient the arena
          had. With the frame gone, this is what tells the eye 'something
          important lives here.' */}
      <div
        className="absolute inset-[-10%] pointer-events-none"
        style={{
          background: "radial-gradient(closest-side, rgba(230, 165, 47, 0.22) 0%, transparent 70%)",
          opacity: 0.6,
          animation: "glow-fade 1.6s ease-out 0.4s both"
        }}
      />

      {/* No frame, no border, no vignette. Just the portrait floating
          on the page background — same treatment a magazine spread
          uses for a hero shot. object-contain so we never crop into
          the boss (the old object-cover + 1.04x scale was clipping
          horns/wings/limbs). */}
      <button
        type="button"
        onClick={() => navigate(active)}
        aria-label={`Open ${active.label}`}
        className="absolute inset-0 cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]/60 focus-visible:rounded-2xl"
        style={{
          animation: "showcase-frame-rise 0.7s cubic-bezier(0.22, 1, 0.36, 1) 0.4s both"
        }}
      >
        {/* All eight portraits stacked. Only the active one is at full
            opacity; the others sit at opacity 0 ready to cross-fade in. */}
        {SHOWCASE_BOSSES.map((entry, i) => (
          <img
            key={entry.slug}
            src={`/sprites/bosses/${entry.slug}.png`}
            alt=""
            aria-hidden={i === idx ? undefined : "true"}
            loading="eager"
            className="absolute inset-0 w-full h-full object-contain"
            style={{
              // Drop shadow gives the floating portrait some weight without
              // a frame. Heavier than icon-shadows because the source is
              // 800px and the target is ~440px — small blur reads as fuzz.
              filter: "drop-shadow(0 14px 24px rgb(0 0 0 / 0.55))",
              opacity: i === idx ? 1 : 0,
              // 600ms fade matches the cycle-feel — long enough to read
              // as a transition, short enough that you never see two
              // portraits at half-opacity mid-blend at 5s cadence.
              transition: "opacity 600ms ease-out"
            }}
          />
        ))}
      </button>

      {/* Progress dots — clickable, doubles as a manual selector. The
          active dot is an elongated pill to mark position in the cycle. */}
      <div className="absolute -bottom-7 left-1/2 -translate-x-1/2 flex items-center gap-1.5">
        {SHOWCASE_BOSSES.map((entry, i) => (
          <button
            key={entry.slug}
            type="button"
            onClick={() => setIdx(i)}
            aria-label={`Show ${entry.label}`}
            className={
              i === idx
                ? "h-1.5 w-6 rounded-full bg-[var(--color-accent)] transition-all"
                : "h-1.5 w-1.5 rounded-full bg-[var(--color-border-strong)] hover:bg-[var(--color-text-muted)] transition-all"
            }
          />
        ))}
      </div>
    </div>
  );
}
