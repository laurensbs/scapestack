"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

const LOADER_BOSSES = [
  { slug: "vardorvis", label: "Vardorvis" },
  { slug: "vorkath", label: "Vorkath" },
  { slug: "zulrah", label: "Zulrah" },
  { slug: "hydra", label: "Hydra" },
  { slug: "nex", label: "Nex" }
];

const LOADER_STEPS = ["Stats", "Bank", "RuneLite", "Trip"];

interface ShuffleLoaderProps {
  label?: string;
}

export function ShuffleLoader({ label = "Building your next trip…" }: ShuffleLoaderProps) {
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setIdx((current) => (current + 1) % LOADER_BOSSES.length);
    }, 850);
    return () => window.clearInterval(interval);
  }, []);

  const active = LOADER_BOSSES[idx];

  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label={label}
      className="mx-auto flex w-full max-w-xl flex-col items-center px-4 py-8 text-center sm:py-10"
    >
      <div className="text-[12px] font-bold uppercase tracking-[0.2em] text-[var(--color-accent)]">
        {label}
      </div>

      <div className="relative mt-5 grid h-[260px] w-full place-items-center overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[#080808] sm:h-[340px]">
        <div className="absolute inset-x-10 bottom-8 h-20 rounded-full bg-[var(--color-accent)]/10 blur-3xl" />
        {LOADER_BOSSES.map((boss, bossIdx) => (
          <Image
            key={boss.slug}
            src={`/sprites/bosses/${boss.slug}.png`}
            alt=""
            width={420}
            height={420}
            loading="eager"
            className="absolute max-h-[86%] w-auto object-contain transition-all duration-500"
            style={{
              opacity: bossIdx === idx ? 1 : 0,
              transform: bossIdx === idx ? "translateY(0) scale(1)" : "translateY(10px) scale(0.96)",
              filter: "drop-shadow(0 20px 28px rgb(0 0 0 / 0.65))"
            }}
          />
        ))}
        <div className="absolute bottom-4 rounded-full border border-[var(--color-border)] bg-black/55 px-3 py-1 text-[11px] font-semibold text-[var(--color-text-muted)]">
          Checking {active.label}
        </div>
      </div>

      <div className="mt-4 grid w-full grid-cols-2 gap-1.5 sm:grid-cols-4">
        {LOADER_STEPS.map((step, stepIdx) => (
          <div
            key={step}
            className="min-w-0 rounded-full border border-[var(--color-border)] bg-[var(--color-panel)] px-2 py-2 text-[11px] font-bold text-[var(--color-text-dim)]"
          >
            <span className={stepIdx <= idx % LOADER_STEPS.length ? "text-[var(--color-accent)]" : ""}>
              {step}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
