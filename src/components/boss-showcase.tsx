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
      {/* Ambient glow behind the frame — same gold gradient the arena had,
          slightly stronger so the single portrait carries the same hero
          weight as the old eight-tile orbit. */}
      <div
        className="absolute inset-[-10%] pointer-events-none"
        style={{
          background: "radial-gradient(closest-side, rgba(230, 165, 47, 0.22) 0%, transparent 70%)",
          opacity: 0.6,
          animation: "glow-fade 1.6s ease-out 0.4s both"
        }}
      />

      {/* The boss frame. Rounded square with gold inset ring and a subtle
          radial vignette so the portraits get edge fade-out and the
          attention pools at the centre. */}
      <button
        type="button"
        onClick={() => navigate(active)}
        aria-label={`Open ${active.label}`}
        className="absolute inset-0 rounded-2xl overflow-hidden bg-[var(--color-bg-2)] border border-[var(--color-border-strong)] cursor-pointer outline-none focus:ring-2 focus:ring-[var(--color-accent)]/60 transition-transform duration-300 hover:scale-[1.02]"
        style={{
          boxShadow: "inset 0 0 0 1px rgba(230, 165, 47, 0.18), 0 24px 60px -16px rgb(0 0 0 / 0.7)",
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
            className="absolute inset-0 w-full h-full object-cover"
            style={{
              opacity: i === idx ? 1 : 0,
              transform: i === idx ? "scale(1)" : "scale(1.04)",
              // 600ms fade matches the cycle-feel — long enough to read
              // as a transition, short enough that you never see two
              // portraits at half-opacity mid-blend at 5s cadence.
              transition: "opacity 600ms ease-out, transform 800ms ease-out"
            }}
          />
        ))}

        {/* Edge vignette — fades the portrait into the frame so we don't
            see hard rectangular edges where the wiki crop ends. Pure
            box-shadow inset; no extra image, no blur cost. */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: "radial-gradient(ellipse at center, transparent 55%, rgba(7, 9, 12, 0.55) 100%)"
          }}
        />

        {/* Active-boss name plate at the bottom. Same chip style as the
            old arena's tooltip but anchored to the frame so it travels
            with the boss. Re-mounts per boss-change so the fade restarts. */}
        <div
          key={active.slug}
          className="absolute left-1/2 -translate-x-1/2 bottom-4 px-4 py-2 rounded-full bg-[var(--color-bg)]/85 backdrop-blur border border-[var(--color-accent)]/40 text-[13.5px] font-semibold tracking-tight text-[var(--color-text)] whitespace-nowrap shadow-[0_8px_24px_-10px_rgb(0_0_0/0.75)]"
          style={{ animation: "showcase-label-in 0.45s cubic-bezier(0.22, 1, 0.36, 1)" }}
        >
          {active.label}
        </div>
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
