"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { BossSprite } from "@/components/boss-picker";
import { BOSSES, type Boss } from "@/lib/bosses";
import { track } from "@/lib/analytics";

// The eight bosses people actually want to know about. Each entry has a
// `display` slug (used for analytics + tooltip) and a `wikiNpc` (the NPC
// the wiki has a portrait for). For raid entries the two differ — CoX is
// a raid, but the wiki only has a portrait for Great Olm; we show Olm,
// label it 'Chambers of Xeric'. Order = clockwise from 12 o'clock.
const ARENA_BOSSES: Array<{ display: string; label: string; wikiNpc: string }> = [
  { display: "vorkath",   label: "Vorkath",            wikiNpc: "Vorkath" },
  { display: "zulrah",    label: "Zulrah",             wikiNpc: "Zulrah" },
  { display: "cox",       label: "Chambers of Xeric",  wikiNpc: "Great Olm" },
  { display: "tob",       label: "Theatre of Blood",   wikiNpc: "Verzik Vitur" },
  { display: "toa",       label: "Tombs of Amascut",   wikiNpc: "Tumeken's Warden" },
  { display: "hydra",     label: "Alchemical Hydra",   wikiNpc: "Alchemical Hydra" },
  { display: "nex",       label: "Nex",                wikiNpc: "Nex" },
  { display: "vardorvis", label: "Vardorvis",          wikiNpc: "Vardorvis" }
];

// Build a synthetic Boss-shaped object so BossSprite's existing 3-stage
// fallback chain works for raids too (it reads `npcName ?? name`).
function arenaBoss(entry: typeof ARENA_BOSSES[number]): Boss {
  // Prefer a real BOSSES entry when one exists (gets us iconItemId for
  // the drop-sprite fallback). Otherwise synthesise the minimum shape.
  const real = BOSSES.find((b) => b.slug === entry.display);
  return {
    ...(real ?? { slug: entry.display, name: entry.label, hp: 0, iconItemId: 4151 } as Boss),
    name: entry.label,
    npcName: entry.wikiNpc
  };
}

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

  // Resolve every entry to a Boss-shaped object once on mount.
  const bosses = ARENA_BOSSES.map(arenaBoss);

  const active = hovered ?? spotlight;
  const activeBoss = bosses[active];

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
      {bosses.map((boss, i) => {
        if (!boss) return null;
        const { x, y } = calcOffset(i, ARENA_BOSSES.length);
        const isActive = i === active;
        // Position by absolute top/left as percentages of the container
        // (50% = centre), then translate -50% / -50% by transform so the
        // tile is centred on that point. The % on `transform` would refer
        // to the tile's own box, which is why we keep position+transform
        // separate.
        return (
          <div
            key={ARENA_BOSSES[i].display}
            className="absolute -translate-x-1/2 -translate-y-1/2"
            style={{
              left: `calc(50% + ${x})`,
              top: `calc(50% + ${y})`,
              animation: `tile-rise 0.55s cubic-bezier(0.22,1,0.36,1) ${0.6 + i * 0.06}s both`
            }}
          >
            <button
              type="button"
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
              onFocus={() => setHovered(i)}
              onBlur={() => setHovered(null)}
              onClick={() => {
                track("homepage:sample", { source: "arena-boss", boss: ARENA_BOSSES[i].display });
                // Same destination as the CTA — the arena is a fancier
                // CTA, not a per-boss deep-link (no /boss/<slug> route).
                window.location.assign("/next");
              }}
              aria-label={boss.name}
              className="relative size-[58px] sm:size-[64px] rounded-full bg-[var(--color-bg-2)] border border-[var(--color-border-strong)] flex items-center justify-center overflow-hidden transition-all duration-300 hover:scale-110 focus:scale-110 outline-none focus:ring-2 focus:ring-[var(--color-accent)]/60"
              style={{
                // Halo on the active tile. We animate the box-shadow
                // so the transition is smooth as spotlight rotates.
                boxShadow: isActive
                  ? "0 0 0 2px rgba(230, 165, 47, 0.55), 0 0 28px 4px rgba(230, 165, 47, 0.35)"
                  : "0 4px 12px -4px rgba(0, 0, 0, 0.6)"
              }}
            >
              <BossSprite boss={boss} size={48} />
            </button>
          </div>
        );
      })}

      {/* Tooltip — bottom-centred, shows the active boss name. Lives
          outside the orbit ring so it doesn't get cropped by overflow. */}
      {activeBoss && (
        <div
          key={activeBoss.slug}
          className="absolute left-1/2 -translate-x-1/2 -bottom-2 sm:-bottom-4 px-3 py-1.5 rounded-full bg-[var(--color-panel)] border border-[var(--color-border-strong)] text-[11.5px] font-semibold tracking-tight text-[var(--color-text)] whitespace-nowrap shadow-[0_8px_24px_-12px_rgb(0_0_0/0.7)]"
          style={{ animation: "fade-in 0.25s ease-out" }}
        >
          {activeBoss.name}
        </div>
      )}
    </div>
  );
}
