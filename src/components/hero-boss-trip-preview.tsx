"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { track } from "@/lib/analytics";

const HERO_BOSSES = [
  { boss: "vardorvis", name: "Vardorvis" },
  { boss: "vorkath", name: "Vorkath" },
  { boss: "zulrah", name: "Zulrah" },
  { boss: "hydra", name: "Alchemical Hydra" },
  { boss: "nex", name: "Nex" }
] as const;

const CYCLE_MS = 3600;

export function HeroBossTripPreview() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const active = HERO_BOSSES[activeIndex];

  useEffect(() => {
    if (paused) return;
    const timer = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % HERO_BOSSES.length);
    }, CYCLE_MS);
    return () => window.clearInterval(timer);
  }, [paused]);

  const openBoss = (boss: string) => {
    track("homepage:sample", { source: "hero-boss", boss });
    window.location.assign(`/dps?boss=${boss}`);
  };

  return (
    <aside
      aria-label="Rotating OSRS bosses"
      className="relative mx-auto grid w-full max-w-[520px] place-items-center"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="pointer-events-none absolute inset-x-[10%] bottom-[12%] h-16 rounded-full bg-black/70 blur-2xl" />

      <button
        type="button"
        onClick={() => openBoss(active.boss)}
        className="group/boss relative grid aspect-[0.82] w-full place-items-center overflow-visible outline-none"
        aria-label={`Open ${active.name} kill check`}
      >
        <Image
          key={active.boss}
          src={`/sprites/bosses/${active.boss}.png`}
          alt={`${active.name} boss`}
          fill
          priority={activeIndex === 0}
          loading={activeIndex === 0 ? undefined : "lazy"}
          sizes="(max-width: 768px) 92vw, 520px"
          className="absolute inset-0 object-contain transition-transform duration-700 ease-out group-hover/boss:scale-[1.035]"
          style={{
            filter: "drop-shadow(0 34px 40px rgb(0 0 0 / 0.76))",
            transform: "translateY(0) scale(1.08)"
          }}
        />
      </button>

      <div className="relative z-10 -mt-5 flex items-center justify-center gap-2">
        {HERO_BOSSES.map((trip, index) => (
          <button
            key={trip.boss}
            type="button"
            onClick={() => setActiveIndex(index)}
            className="group grid size-11 place-items-center rounded-md"
            aria-label={`Show ${trip.name}`}
            aria-pressed={index === activeIndex}
          >
            <span
              aria-hidden="true"
              className={`h-2.5 rounded-full border border-[var(--color-accent)]/50 transition-all ${
                index === activeIndex
                  ? "w-8 bg-[var(--color-accent)]"
                  : "w-2.5 bg-[var(--color-accent)]/14 group-hover:bg-[var(--color-accent)]/32"
              }`}
            />
          </button>
        ))}
      </div>
    </aside>
  );
}
