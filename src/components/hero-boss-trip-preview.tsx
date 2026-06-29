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
      <div className="pointer-events-none absolute inset-x-0 top-[15%] h-[70%] rounded-full bg-[radial-gradient(circle,rgba(214,166,58,0.20),rgba(214,166,58,0.07)_36%,transparent_68%)] blur-2xl" />
      <div className="pointer-events-none absolute inset-x-[10%] bottom-[12%] h-16 rounded-full bg-black/70 blur-2xl" />

      <button
        type="button"
        onClick={() => openBoss(active.boss)}
        className="group/boss relative grid aspect-[0.82] w-full place-items-center overflow-visible outline-none"
        aria-label={`Open ${active.name} kill check`}
      >
        {HERO_BOSSES.map((trip, index) => {
          const isActive = index === activeIndex;
          return (
            <Image
              key={trip.boss}
              src={`/sprites/bosses/${trip.boss}.png`}
              alt={isActive ? `${trip.name} boss` : ""}
              aria-hidden={!isActive}
              fill
              priority={index === 0}
              sizes="(max-width: 768px) 92vw, 520px"
              className="absolute inset-0 object-contain transition-all duration-700 ease-out group-hover/boss:scale-[1.035]"
              style={{
                opacity: isActive ? 1 : 0,
                filter: "drop-shadow(0 34px 40px rgb(0 0 0 / 0.76))",
                transform: isActive ? "translateY(0) scale(1.08)" : "translateY(12px) scale(1.01)"
              }}
            />
          );
        })}
      </button>

      <div className="relative z-10 -mt-5 flex items-center justify-center gap-2">
        {HERO_BOSSES.map((trip, index) => (
          <button
            key={trip.boss}
            type="button"
            onClick={() => setActiveIndex(index)}
            className={`h-2.5 rounded-full border border-[var(--color-accent)]/50 transition-all ${
              index === activeIndex
                ? "w-8 bg-[var(--color-accent)]"
                : "w-2.5 bg-[var(--color-accent)]/14 hover:bg-[var(--color-accent)]/32"
            }`}
            aria-label={`Show ${trip.name}`}
            aria-pressed={index === activeIndex}
          />
        ))}
      </div>
    </aside>
  );
}
