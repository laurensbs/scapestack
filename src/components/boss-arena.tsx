"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { track } from "@/lib/analytics";

// The eight bosses people actually want to know about. Portraits are
// downloaded once at build time by scripts/build-boss-sprites.mjs and
// served from /sprites/bosses/<slug>.png — runtime wiki-fetching was
// flaky (Special:FilePath/Zulrah.png 404s; the actual filename is
// Zulrah_(serpentine).png). Local-first means consistent rendering
// and no third-party request per visitor.
const ARENA_BOSSES: Array<{ slug: string; label: string }> = [
  { slug: "vorkath",   label: "Vorkath" },
  { slug: "zulrah",    label: "Zulrah" },
  { slug: "cox",       label: "Chambers of Xeric" },
  { slug: "tob",       label: "Theatre of Blood" },
  { slug: "toa",       label: "Tombs of Amascut" },
  { slug: "hydra",     label: "Alchemical Hydra" },
  { slug: "nex",       label: "Nex" },
  { slug: "vardorvis", label: "Vardorvis" }
];

// Arena radius is expressed as % of the container size so the layout
// scales with viewport. We compute the (x, y) offset for tile `index`
// as a percentage of the arena box — multiplying by a literal number
// in JS, not via CSS calc(cos()) which is patchier across browsers and
// silently failed in the v0.5 launch by collapsing every tile to (0,0).
const ORBIT_RADIUS_PCT = 42; // % of container size from centre
function calcOffset(index: number, total: number): { x: string; y: string } {
  // Start at -90° (12 o'clock) and go clockwise.
  const theta = (-Math.PI / 2) + (index / total) * Math.PI * 2;
  const x = `${(Math.cos(theta) * ORBIT_RADIUS_PCT).toFixed(2)}%`;
  const y = `${(Math.sin(theta) * ORBIT_RADIUS_PCT).toFixed(2)}%`;
  return { x, y };
}

export function BossArena() {
  // Index of the boss currently in the spotlight (= subtle gold halo).
  // Cycles every 3.6s — long enough that the user can read the tooltip
  // before it moves on, short enough that the page doesn't feel frozen.
  const [spotlight, setSpotlight] = useState(0);
  // null = no hover, otherwise the index that overrides the spotlight.
  const [hovered, setHovered] = useState<number | null>(null);

  useEffect(() => {
    const t = setInterval(() => {
      setSpotlight((s) => (s + 1) % ARENA_BOSSES.length);
    }, 3600);
    return () => clearInterval(t);
  }, []);

  const active = hovered ?? spotlight;
  const activeBoss = ARENA_BOSSES[active];

  return (
    <div
      className="relative mx-auto"
      style={{
        // Square arena. Orbit radius = ORBIT_RADIUS_PCT (42%) of side;
        // centre CTA takes ~40% to leave breathing room between the
        // text and the nearest boss tile.
        width: "min(460px, 90vw)",
        aspectRatio: "1 / 1"
      }}
    >
      {/* Background ambient glow — same gold gradient the old BankPreview
          had, kept for tonal continuity. */}
      <div
        className="absolute inset-[-15%] pointer-events-none"
        style={{
          background: "radial-gradient(closest-side, rgba(230, 165, 47, 0.18) 0%, transparent 70%)",
          opacity: 0.5,
          animation: "glow-fade 1.6s ease-out 0.4s both"
        }}
      />

      {/* Centre CTA — the call-to-action sits in the middle, the bosses
          orbit it. ~44% of the container (was 30%, which truncated the
          three-line copy to 'Should ight?' as caught in the v0.5
          screenshot review). */}
      <Link
        href="/next"
        onClick={() => track("homepage:sample", { source: "arena-cta" })}
        className="absolute inset-0 m-auto flex flex-col items-center justify-center text-center group/cta px-2"
        style={{
          width: "44%",
          height: "44%",
          animation: "hero-fade 0.7s cubic-bezier(0.22,1,0.36,1) 0.5s both"
        }}
      >
        <span className="eyebrow text-[var(--color-accent)] mb-1.5">Stuck?</span>
        <span className="text-[13px] sm:text-[14px] font-bold leading-tight tracking-tight text-[var(--color-text)]">
          What should<br />I do tonight?
        </span>
        <span className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--color-accent)] group-hover/cta:gap-1.5 transition-all whitespace-nowrap">
          Start <ArrowRight className="size-3" />
        </span>
      </Link>

      {/* The orbiting bosses */}
      {ARENA_BOSSES.map((entry, i) => {
        const { x, y } = calcOffset(i, ARENA_BOSSES.length);
        const isActive = i === active;
        // Position by absolute top/left as percentages of the container
        // (50% = centre); transform: translate(-50%, -50%) centres the
        // tile on the computed point. We keep position+transform separate
        // because % on `transform` would refer to the tile's own box.
        return (
          <div
            key={entry.slug}
            className="absolute -translate-x-1/2 -translate-y-1/2"
            style={{
              left: `calc(50% + ${x})`,
              top: `calc(50% + ${y})`,
              animation: `tile-rise 0.55s cubic-bezier(0.22,1,0.36,1) ${0.6 + i * 0.06}s both`,
              // The active tile lifts ~6px while the inactive ones float
              // gently (via animation-delay-staggered float-y). Combined
              // with the gold halo this gives the spotlight real weight.
              zIndex: isActive ? 10 : 1
            }}
          >
            <button
              type="button"
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
              onFocus={() => setHovered(i)}
              onBlur={() => setHovered(null)}
              onClick={() => {
                track("homepage:sample", { source: "arena-boss", boss: entry.slug });
                window.location.assign("/next");
              }}
              aria-label={entry.label}
              className="relative size-[60px] sm:size-[68px] rounded-full bg-[var(--color-bg-2)] border border-[var(--color-border-strong)] flex items-center justify-center overflow-hidden outline-none focus:ring-2 focus:ring-[var(--color-accent)]/60 transition-[transform,box-shadow] duration-500 ease-out"
              style={{
                transform: isActive ? "scale(1.18)" : "scale(1)",
                boxShadow: isActive
                  ? "0 0 0 2px rgba(230, 165, 47, 0.65), 0 0 32px 6px rgba(230, 165, 47, 0.40), 0 8px 24px -6px rgba(0, 0, 0, 0.7)"
                  : "0 4px 12px -4px rgba(0, 0, 0, 0.6), inset 0 0 0 1px rgba(255, 255, 255, 0.02)"
              }}
            >
              <img
                src={`/sprites/bosses/${entry.slug}.png`}
                alt=""
                aria-hidden="true"
                loading="eager"
                className="w-full h-full object-cover transition-transform duration-700"
                style={{
                  // Active = full vibrant + tiny zoom for parallax feel.
                  // Inactive = slightly desaturated + dimmed so the
                  // spotlight reads instantly.
                  filter: isActive
                    ? "none"
                    : "grayscale(0.35) brightness(0.78)",
                  transform: isActive ? "scale(1.08)" : "scale(1)"
                }}
              />
            </button>
          </div>
        );
      })}

      {/* Active-boss name chip — bottom-centred, outside the orbit ring
          so it doesn't get cropped. Only renders when something is
          actively spotlit or hovered; never overlaps the per-tile area. */}
      {activeBoss && (
        <div
          key={activeBoss.slug}
          className="absolute left-1/2 -translate-x-1/2 -bottom-3 sm:-bottom-5 px-3.5 py-1.5 rounded-full bg-[var(--color-panel)] border border-[var(--color-accent)]/40 text-[12px] font-semibold tracking-tight text-[var(--color-text)] whitespace-nowrap shadow-[0_8px_24px_-10px_rgb(0_0_0/0.75)]"
          style={{ animation: "fade-in 0.25s ease-out" }}
        >
          {activeBoss.label}
        </div>
      )}
    </div>
  );
}
